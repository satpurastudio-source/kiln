package com.satpurastudio.kiln.core

import kotlinx.coroutines.Deferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

object Backend {
    /** The anon key is public by design — safety comes from Row Level Security. */
    const val URL = "https://hdrqegyvegsbpjdjmozp.supabase.co"
    const val ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcnFlZ3l2ZWdzYnBqZGptb3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NTU1NDIsImV4cCI6MjA5OTUzMTU0Mn0.U06b0zXbXLrUCdffRh21yvNJh9jKy8NcXfGXDgTHC80"
    /** Email links land on the web app: a mail app can't open this one. */
    const val WEB_URL = "https://kiln.satpurastudio.com/"
}

data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Double,
    val userId: String,
    val email: String?,
    val name: String?,
) {
    val json: J
        get() = jsonOf(
            "access_token" to J.Str(accessToken), "refresh_token" to J.Str(refreshToken), "expires_at" to J.Num(expiresAt),
            "user" to jsonOf("id" to J.Str(userId), "email" to email.j(), "user_metadata" to jsonOf("name" to name.j())),
        )

    companion object {
        fun of(j: J?): AuthSession? {
            val access = j?.get("access_token")?.string ?: return null
            val refresh = j["refresh_token"]?.string ?: return null
            val user = j["user"] ?: return null
            val id = user["id"]?.string ?: return null
            val at = j["expires_at"]?.number ?: (System.currentTimeMillis() / 1000.0 + (j["expires_in"]?.number ?: 3600.0))
            return AuthSession(access, refresh, at, id, user["email"]?.string, user["user_metadata"]?.get("name")?.string)
        }
    }
}

interface SessionStore {
    fun load(): AuthSession?
    fun save(s: AuthSession)
    fun clear()
}

/** A thin client for the three Supabase surfaces kiln uses: auth, the one kiln_data row, delete-account. */
class Cloud(private val store: SessionStore, private val scope: CoroutineScope) : CloudTransport {
    var session: AuthSession? = store.load()
        private set
    var onSessionChange: (String, AuthSession?) -> Unit = { _, _ -> }
    val http: OkHttpClient = OkHttpClient.Builder().callTimeout(25, TimeUnit.SECONDS).pingInterval(25, TimeUnit.SECONDS).build()
    private var refreshing: Deferred<AuthSession>? = null
    private val jsonType = "application/json".toMediaType()

    private fun q(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    suspend fun request(method: String, path: String, body: J? = null, headers: Map<String, String> = emptyMap(), authed: Boolean = true): J? {
        val bearer = if (authed && session != null) validToken() else Backend.ANON_KEY
        return withContext(Dispatchers.IO) {
            val b = Request.Builder().url(Backend.URL + path)
                .header("apikey", Backend.ANON_KEY)
                .header("Authorization", "Bearer $bearer")
                .header("Content-Type", "application/json")
            headers.forEach { (k, v) -> b.header(k, v) }
            val payload = body?.stable?.toRequestBody(jsonType)
            b.method(method, payload ?: if (method == "GET") null else ByteArray(0).toRequestBody(null))
            try {
                http.newCall(b.build()).execute().use { r ->
                    val text = r.body?.string().orEmpty()
                    val json = if (text.isEmpty()) null else J.parse(text)
                    if (!r.isSuccessful) {
                        val m = json?.get("msg")?.string ?: json?.get("error_description")?.string ?: json?.get("message")?.string
                            ?: json?.get("error")?.string ?: "Request failed (${r.code})"
                        throw CloudException(m, json?.get("code")?.string ?: json?.get("error_code")?.string, r.code)
                    }
                    json
                }
            } catch (e: IOException) {
                throw CloudException(e.message ?: "Network error", isNetwork = true)
            }
        }
    }

    suspend fun validToken(): String {
        val s = session ?: throw CloudException("Not signed in")
        if (s.expiresAt - System.currentTimeMillis() / 1000.0 > 60) return s.accessToken
        return refreshSession().accessToken
    }

    private suspend fun refreshSession(): AuthSession {
        refreshing?.let { return it.await() }
        val current = session ?: throw CloudException("Not signed in")
        val task = scope.async {
            try {
                val json = request("POST", "/auth/v1/token?grant_type=refresh_token", jsonOf("refresh_token" to J.Str(current.refreshToken)), authed = false)
                val next = AuthSession.of(json) ?: throw CloudException("Bad session")
                adopt(next, "TOKEN_REFRESHED")
                next
            } catch (e: CloudException) {
                // a revoked or expired refresh token is a real sign-out; a network blip is not
                if (!e.isNetwork && e.status in 400..499) clear()
                throw e
            } finally {
                refreshing = null
            }
        }
        refreshing = task
        return task.await()
    }

    private fun adopt(s: AuthSession, event: String) {
        session = s
        store.save(s)
        onSessionChange(event, s)
    }

    private fun clear() {
        session = null
        store.clear()
        onSessionChange("SIGNED_OUT", null)
    }

    suspend fun signIn(email: String, password: String) {
        val json = request("POST", "/auth/v1/token?grant_type=password", jsonOf("email" to J.Str(email), "password" to J.Str(password)), authed = false)
        adopt(AuthSession.of(json) ?: throw CloudException("Bad session"), "SIGNED_IN")
    }

    /** True if a session came straight back (email confirmation off). */
    suspend fun signUp(email: String, password: String, name: String): Boolean {
        val json = request(
            "POST", "/auth/v1/signup?redirect_to=${q(Backend.WEB_URL + "?verified=1")}",
            jsonOf("email" to J.Str(email), "password" to J.Str(password), "data" to jsonOf("name" to J.Str(name))), authed = false,
        )
        val s = AuthSession.of(json) ?: return false
        adopt(s, "SIGNED_IN")
        return true
    }

    suspend fun verifySignup(email: String, code: String) {
        val json = request("POST", "/auth/v1/verify", jsonOf("email" to J.Str(email), "token" to J.Str(code), "type" to J.Str("signup")), authed = false)
        adopt(AuthSession.of(json) ?: throw CloudException("Bad session"), "SIGNED_IN")
    }

    suspend fun resendSignup(email: String) {
        request("POST", "/auth/v1/resend?redirect_to=${q(Backend.WEB_URL + "?verified=1")}", jsonOf("type" to J.Str("signup"), "email" to J.Str(email)), authed = false)
    }

    suspend fun recover(email: String) {
        request("POST", "/auth/v1/recover?redirect_to=${q(Backend.WEB_URL + "?reset=1")}", jsonOf("email" to J.Str(email)), authed = false)
    }

    suspend fun changeEmail(email: String) {
        request("PUT", "/auth/v1/user?redirect_to=${q(Backend.WEB_URL + "?verified=1")}", jsonOf("email" to J.Str(email)))
    }

    suspend fun changePassword(password: String) {
        request("PUT", "/auth/v1/user", jsonOf("password" to J.Str(password)))
    }

    suspend fun signOut() {
        if (session != null) {
            try {
                request("POST", "/auth/v1/logout?scope=local")
            } catch (_: CloudException) {
                // signing out here still works if the server can't be told
            }
        }
        clear()
    }

    suspend fun deleteAccount() {
        request("POST", "/functions/v1/delete-account", J.Obj(emptyMap()))
    }

    override suspend fun pull(userId: String): CloudRow? {
        val json = request("GET", "/rest/v1/kiln_data?select=data,updated_at&user_id=eq.${q(userId)}")
        val row = json?.array?.firstOrNull() ?: return null
        val data = row["data"] ?: return null
        return CloudRow(data, row["updated_at"]?.string)
    }

    override suspend fun update(userId: String, data: J, at: String, ifAt: String): String? {
        val json = request(
            "PATCH", "/rest/v1/kiln_data?user_id=eq.${q(userId)}&updated_at=eq.${q(ifAt)}&select=updated_at",
            jsonOf("data" to data, "updated_at" to J.Str(at)), mapOf("Prefer" to "return=representation"),
        )
        return json?.array?.firstOrNull()?.get("updated_at")?.string
    }

    override suspend fun insert(userId: String, data: J, at: String): String? = try {
        val json = request(
            "POST", "/rest/v1/kiln_data?select=updated_at",
            jsonOf("user_id" to J.Str(userId), "data" to data, "updated_at" to J.Str(at)), mapOf("Prefer" to "return=representation"),
        )
        json?.array?.firstOrNull()?.get("updated_at")?.string ?: at
    } catch (e: CloudException) {
        if (e.code == "23505") null else throw e // already exists
    }

    override suspend fun upsert(userId: String, data: J, at: String) {
        request("POST", "/rest/v1/kiln_data", jsonOf("user_id" to J.Str(userId), "data" to data, "updated_at" to J.Str(at)), mapOf("Prefer" to "resolution=merge-duplicates,return=minimal"))
    }
}
