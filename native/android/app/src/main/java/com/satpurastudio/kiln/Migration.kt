package com.satpurastudio.kiln

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebView
import android.webkit.WebViewClient
import com.satpurastudio.kiln.core.AuthSession
import com.satpurastudio.kiln.core.J
import java.io.File

/**
 * Moves people's data out of the old Capacitor app. It kept everything in the WebView's
 * localStorage for https://localhost, and updating over it keeps that storage on disk, so a
 * throwaway WebView at the same origin can read it once. A fresh install has no WebView data
 * and skips this entirely, so no WebView is ever loaded for it.
 */
object Migration {
    private const val DONE = "kiln-migrated-from-webview"
    private const val SESSION_KEY = "sb-hdrqegyvegsbpjdjmozp-auth-token"
    private val PREF_KEYS = listOf("kiln-focus", "kiln-tips", "kiln-reminders", "kiln-whatsnew-seen", "satpura:v")

    fun needed(c: Context): Boolean {
        val p = Prefs(c)
        if (p.string(DONE) != null) return false
        if (File(c.filesDir, "state.json").exists() || !File(c.dataDir, "app_webview").exists()) {
            p.set(DONE, "1")
            return false
        }
        return true
    }

    @SuppressLint("SetJavaScriptEnabled")
    fun run(c: Context, done: () -> Unit) {
        var finished = false
        fun finish() {
            if (!finished) {
                finished = true
                done()
            }
        }
        val web = WebView(c)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                view.evaluateJavascript("JSON.stringify(Object.fromEntries(Object.entries(localStorage)))") { raw ->
                    // the callback gets a JSON string holding our JSON string
                    val all = J.parse(raw)?.string?.let(J::parse)
                    if (all != null) store(c, all)
                    view.destroy()
                    finish()
                }
            }
        }
        web.loadDataWithBaseURL("https://localhost/", "<!doctype html><title>kiln</title>", "text/html", "utf-8", null)
        // a broken WebView must not keep anyone out of their tasks
        web.postDelayed({ finish() }, 8000)
    }

    private fun store(c: Context, all: J) {
        val prefs = Prefs(c)
        val disk = Disk(c)
        all["zenith-v1"]?.string?.let { disk.write(disk.stateFile, it) }
        all["kiln-sync-base"]?.string?.let { disk.write(disk.baseFile, it) }
        PREF_KEYS.forEach { k -> all[k]?.string?.let { prefs.set(k, it) } }
        AuthSession.of(all[SESSION_KEY]?.string?.let(J::parse))?.let { KeystoreSessionStore(c).save(it) }
        prefs.set(DONE, "1")
    }
}
