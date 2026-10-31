@file:OptIn(ExperimentalLayoutApi::class)

package com.satpurastudio.kiln.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.satpurastudio.kiln.core.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Fixed-width card on big screens, full width on phones. */
@Composable
private fun EntryCard(content: @Composable ColumnScope.() -> Unit) {
    val tok = LocalTok.current
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).imePadding().verticalScroll(rememberScrollState()).padding(16.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 460.dp).fillMaxWidth().card(tok, RoundedCornerShape(20.dp), tok.panelStrong).padding(22.dp), verticalArrangement = Arrangement.spacedBy(13.dp), content = content)
    }
}

@Composable
fun LoginScreen() {
    val store = LocalStore.current
    val tok = LocalTok.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf(if (store.prefs.string("kiln-auth-intent") == "signup") "signup" else "signin") }
    var name by remember { mutableStateOf(store.prefs.string("kiln-pending-name") ?: "") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var resendIn by remember { mutableIntStateOf(0) }
    val resendWait = 60 // Supabase sends at most one email a minute

    LaunchedEffect(Unit) {
        // the one-time handoff from onboarding doesn't stick around
        store.prefs.remove("kiln-pending-name")
        store.prefs.remove("kiln-auth-intent")
    }
    LaunchedEffect(resendIn) {
        if (resendIn > 0) {
            delay(1000)
            resendIn--
        }
    }
    /** Supabase's commonest messages, in the reader's language; anything else as-is. */
    fun authError(m: String) = mapOf("Invalid login credentials" to t("errBadCredentials"), "User already registered" to t("errUserExists"))[m] ?: m
    fun switchMode(m: String) {
        mode = m
        error = ""
    }

    /** The button in the email and the code are the same one-time token, so whoever taps the
     *  button finds the code "expired" when they come back. Their email is verified by then:
     *  the password they just typed gets them in. */
    suspend fun trySignIn(): Boolean {
        if (password.isEmpty()) return false
        return try {
            store.cloud.signIn(email.trim(), password)
            store.toast(t("emailVerified"), "✓")
            true
        } catch (_: CloudException) {
            false
        }
    }

    suspend fun resend(justFailed: Boolean = false) {
        error = ""
        resendIn = resendWait
        // already verified through the button? Then a resend would send nothing
        if (!justFailed && trySignIn()) return
        try {
            store.cloud.resendSignup(email.trim())
            // a resend retires the previous code, so don't leave it in the box
            code = ""
            store.toast(t("newCodeSent"), "✉")
        } catch (e: CloudException) {
            val m = e.message ?: ""
            // "For security purposes, you can only request this after 42 seconds."
            val wait = Regex("after (\\d+) seconds").find(m)?.groupValues?.get(1)?.toIntOrNull()
            resendIn = wait ?: 0
            error = if (wait != null) t("errCodeRecent") else if (Regex("rate limit", RegexOption.IGNORE_CASE).containsMatchIn(m)) t("errRateLimit") else m
        }
    }

    // back from the mail app after tapping the button: let them straight in
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner, mode, password) {
        val o = LifecycleEventObserver { _, e ->
            if (e == Lifecycle.Event.ON_RESUME && mode == "sent" && password.isNotEmpty()) scope.launch { trySignIn() }
        }
        owner.lifecycle.addObserver(o)
        onDispose { owner.lifecycle.removeObserver(o) }
    }

    fun signIn() {
        if (!email.contains("@") || password.isEmpty()) {
            error = t("errEnterEmailPw")
            return
        }
        busy = true
        error = ""
        scope.launch {
            try {
                store.cloud.signIn(email.trim(), password)
            } catch (e: CloudException) {
                if (e.message == "Email not confirmed") {
                    // straight to the code screen, with a fresh code on its way
                    mode = "sent"
                    code = ""
                    resend(justFailed = true)
                } else error = authError(e.message ?: "")
            }
            busy = false
        }
    }

    fun signUp() {
        if (name.isBlank()) {
            error = t("errTellName")
            return
        }
        if (!email.contains("@")) {
            error = t("errEmailWrong")
            return
        }
        if (password.length < 6) {
            error = t("errPwShort")
            return
        }
        busy = true
        error = ""
        scope.launch {
            try {
                if (!store.cloud.signUp(email.trim(), password, name.trim())) {
                    code = ""
                    resendIn = resendWait
                    mode = "sent"
                }
            } catch (e: CloudException) {
                error = authError(e.message ?: "")
            }
            busy = false
        }
    }

    fun verify() {
        val token = code.filter { it.isDigit() }
        if (token.length < 6) {
            error = t("errEnterCode")
            return
        }
        busy = true
        error = ""
        scope.launch {
            try {
                store.cloud.verifySignup(email.trim(), token)
                store.toast(t("emailVerified"), "✓")
            } catch (e: CloudException) {
                if (!trySignIn()) {
                    val m = e.message ?: ""
                    error = if (Regex("expired|invalid", RegexOption.IGNORE_CASE).containsMatchIn(m)) t("errCodeBad") else authError(m)
                }
            }
            busy = false
        }
    }

    fun forgot() {
        if (!email.contains("@")) {
            error = t("errEnterEmailFirst")
            return
        }
        busy = true
        error = ""
        scope.launch {
            try {
                store.cloud.recover(email.trim())
                mode = "sent-reset"
            } catch (e: CloudException) {
                error = authError(e.message ?: "")
            }
            busy = false
        }
    }

    fun guestStart() {
        val c = name.trim()
        if (c.isEmpty()) {
            error = t("errTellName")
            return
        }
        store.dispatch { it.copy(profile = itemOf("name" to J.Str(c), "createdAt" to J.Num(Clock.ms.toDouble()))) }
        store.toast(t("welcomeToast", "name" to c.split(Regex("\\s+"))[0]), "🔥")
    }

    fun submit() {
        if (busy) return
        when (mode) {
            "signin" -> signIn()
            "signup" -> signUp()
            else -> guestStart()
        }
    }

    @Composable
    fun link(text: String, enabled: Boolean = true, onClick: () -> Unit) = T(text, tok.ui(13.5f, c = tok.text2), Modifier.tap(enabled = enabled, onClick = onClick).padding(vertical = 5.dp))

    @Composable
    fun errorLine() {
        if (error.isNotEmpty()) T(error, tok.ui(13f, c = tok.danger))
    }

    EntryCard {
        BrandMark(46.dp)
        Row {
            T("kiln", tok.display(52f))
            T(".", tok.display(52f, tok.accent))
        }
        T(t("loginTagline"), tok.ui(14.5f, c = tok.text2))
        when (mode) {
            "sent" -> {
                T("✉", tok.ui(30f, c = tok.accent))
                T(t("checkInbox"), tok.ui(17f, FontWeight.SemiBold))
                T("${t("codeSentTo")} $email\n${t("codeSentHint")}", tok.ui(13.5f, c = tok.text2))
                KField(code, { v -> code = v.filter { it.isDigit() } }, "••••••", limit = 10, keyboard = KeyboardType.Number, onDone = { verify() })
                errorLine()
                PrimaryButton(if (busy) t("oneMoment") else t("verifyEnter"), Modifier.fillMaxWidth(), busy, ::verify)
                link(if (resendIn > 0) t("resendIn", "n" to resendIn.toString()) else t("resendCode"), resendIn == 0) { scope.launch { resend() } }
                link("← ${t("backToSignIn")}") { switchMode("signin") }
            }
            "sent-reset" -> {
                T("✉", tok.ui(30f, c = tok.accent))
                T(t("checkInbox"), tok.ui(17f, FontWeight.SemiBold))
                T("${t("resetSentTo")} $email\n${t("resetSentHint")}", tok.ui(13.5f, c = tok.text2))
                link("← ${t("backToSignIn")}") { switchMode("signin") }
            }
            "guest" -> {
                T(t("whatCallYou"), tok.ui(13.5f, FontWeight.Medium, tok.text2))
                KField(name, { name = it }, t("yourName"), limit = 40, onDone = { guestStart() })
                errorLine()
                PrimaryButton("${t("continueDevice")} →", Modifier.fillMaxWidth(), onClick = ::guestStart)
                Hint(t("guestNote"))
                link("← ${t("backToSignIn")}") { switchMode("signin") }
            }
            else -> {
                if (mode == "signup") KField(name, { name = it }, t("yourName"), limit = 40, onDone = { submit() })
                KField(email, { email = it }, "you@email.com", keyboard = KeyboardType.Email, onDone = { submit() })
                KField(password, { password = it }, if (mode == "signup") t("choosePassword") else t("password"), secure = true, onDone = { submit() })
                errorLine()
                PrimaryButton(if (busy) t("oneMoment") else if (mode == "signin") t("signInArrow") else t("createAccountArrow"), Modifier.fillMaxWidth(), busy, ::submit)
                if (mode == "signin") {
                    link("${t("newHere")} ${t("createAnAccount")}") { switchMode("signup") }
                    link(t("forgotPassword"), onClick = ::forgot)
                    link(t("continueNoAccount")) { switchMode("guest") }
                } else link("${t("haveAccount")} ${t("signIn")}") { switchMode("signin") }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
            T(t("privacy"), tok.ui(12f, c = tok.text3), Modifier.tap { openUrl(context, Backend.WEB_URL + "privacy.html") })
            T("·", tok.ui(12f, c = tok.text3))
            T(t("terms"), tok.ui(12f, c = tok.text3), Modifier.tap { openUrl(context, Backend.WEB_URL + "terms.html") })
        }
    }
}

/** First-run flow: personalize first, ask to sign in last. Also reopened as a quick tour. */
@Composable
fun OnboardingScreen() {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    val firstRun = !s.replayTour && s.profile == null
    val steps = if (firstRun) listOf("lang", "welcome", "look", "purpose", "capture", "complete", "account") else listOf("welcome", "look", "capture", "complete", "done")
    var step by remember { mutableIntStateOf(0) }
    var name by remember { mutableStateOf(s.profile?.get("name")?.string ?: "") }
    val picked = remember { mutableStateListOf<String>() }
    var firstTask by remember { mutableStateOf("") }
    var demo by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1700)
            demo++
        }
    }
    val key = steps[minOf(step, steps.size - 1)]
    val last = step == steps.size - 1
    val canNext = key != "welcome" || name.isNotBlank()

    /** The seed was built before anyone picked a language; rewrite it in the chosen one. */
    fun localizeSeed(projects: List<Project>) {
        fun tr(x: String) = SEED_TEXT[x]?.let { t(it) } ?: x
        store.dispatch { st ->
            var n = st.setProjects(projects.map { Project(it.j + ("name" to J.Str(tr(it.name)))) })
            for (task in st.tasks) if (task.title in SEED_TEXT) n = n.updateTask(task.id, itemOf("title" to J.Str(tr(task.title)), "notes" to J.Str(tr(task.notes))))
            n
        }
    }

    fun applyPersonalization() {
        val clean = name.trim()
        if (!firstRun && clean.isNotEmpty()) store.dispatch { st -> st.copy(profile = st.profile?.plus("name" to J.Str(clean))) }
        if (!firstRun) return
        val keep = store.state.projects.firstOrNull() ?: return
        val folders = PURPOSES.filter { it.id in picked && it.name != keep.name }.map { Project(itemOf("id" to J.Str(uid()), "name" to J.Str(it.name), "color" to J.Str(it.color), "icon" to J.Str(it.icon))) }
        localizeSeed(if (picked.isEmpty()) store.state.projects else listOf(keep) + folders)
        val text = firstTask.trim()
        if (text.isNotEmpty()) {
            // read it the way the quick-add bar does; a #new-folder tag just files it under Getting Started
            val p = store.parse(firstTask)
            store.dispatch { it.addTask(p.title.trim().ifEmpty { text }, p.projectId ?: keep.id, p.due ?: todayStr(), p.time, p.priority ?: "none") }
        }
    }

    fun finishGuest() {
        applyPersonalization()
        val shown = name.trim().ifEmpty { t("friend") }
        store.dispatch { it.copy(profile = itemOf("name" to J.Str(shown), "createdAt" to J.Num(Clock.ms.toDouble())), onboarded = true) }
        store.toast(t("welcomeToast", "name" to shown.split(Regex("\\s+"))[0]), "🔥")
    }

    fun finishToAuth(intent: String) {
        applyPersonalization()
        if (name.isNotBlank()) store.prefs.set("kiln-pending-name", name.trim())
        store.prefs.set("kiln-auth-intent", intent)
        store.dispatch { it.copy(onboarded = true) }
    }

    @Composable
    fun title(a: String, b: String) {
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            T(a, tok.display(35f))
            T(b, tok.ui(14.5f, c = tok.text2))
        }
    }

    EntryCard {
        if (firstRun) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                T(t("skip"), tok.ui(13f, c = tok.text3), Modifier.tap {
                    localizeSeed(store.state.projects)
                    store.dispatch { it.copy(onboarded = true) }
                }.padding(6.dp))
            }
        }
        when (key) {
            "lang" -> {
                title(t("langTitle"), t("langSub"))
                LanguagePicker()
            }
            "welcome" -> {
                BrandMark(48.dp)
                title(t("welcomeTitle", "app" to "kiln") + ".", t("welcomeSub"))
                KField(name, { name = it }, t("yourName"), limit = 40, onDone = { if (name.isNotBlank()) step++ })
            }
            "look" -> {
                title(t("lookTitle"), t("lookSub"))
                T(t("accent"), tok.ui(13f, FontWeight.Medium, tok.text2))
                AccentPicker()
                T(t("theme"), tok.ui(13f, FontWeight.Medium, tok.text2))
                Seg(s.theme, listOf("light" to t("light"), "dark" to t("dark"))) { v -> store.dispatch { it.copy(theme = v) } }
            }
            "purpose" -> {
                title(t("purposeTitle"), t("purposeSub"))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PURPOSES.forEach { p ->
                        val on = p.id in picked
                        Row(
                            Modifier.heightIn(min = 42.dp).background(if (on) tok.accent.copy(alpha = 0.12f) else tok.panel, CircleShape).border(1.dp, if (on) tok.accent.copy(alpha = 0.6f) else tok.border, CircleShape)
                                .tap { if (on) picked.remove(p.id) else picked.add(p.id) }.padding(horizontal = 11.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Box(Modifier.size(22.dp).background(color(p.color), CircleShape), contentAlignment = Alignment.Center) { T(iconGlyph(p.icon), tok.ui(11f, c = Color.White)) }
                            T(t("p_${p.id}"), tok.ui(14f, FontWeight.Medium))
                        }
                    }
                }
            }
            "capture" -> {
                title(t("captureTitle"), t("captureSub"))
                val first = demo / 3 % 2 == 0
                val parsed = if (first) Parsed("gym", null, t("p_fitness"), "high", "07:00", addDaysStr(1)) else Parsed("pay rent", null, t("home"), null, "18:00", "2026-10-26")
                Column(Modifier.fillMaxWidth().card(tok).padding(13.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    T(if (first) "gym tomorrow 7am !high #fitness" else "pay rent 26 oct 6pm #home", tok.mono(13f, c = tok.text))
                    ParsePills(parsed, label = false)
                }
                if (firstRun) {
                    T(t("yourTurn"), tok.ui(13f, FontWeight.Medium, tok.text2))
                    KField(firstTask, { firstTask = it }, t("firstTaskPh"), limit = 140, onDone = { step++ })
                    Hint(t("firstTaskHint"))
                }
            }
            "complete" -> {
                title(t("completeTitle"), t("completeSub"))
                val on = demo % 2 == 1
                Row(Modifier.fillMaxWidth().card(tok), verticalAlignment = Alignment.CenterVertically) {
                    CheckCircle(on, tok.accent) {}
                    T(t("seedTask4"), tok.ui(15f, FontWeight.Medium, if (on) tok.text3 else tok.text).copy(textDecoration = if (on) TextDecoration.LineThrough else null), maxLines = 1)
                }
            }
            "account" -> {
                val first = name.trim().split(Regex("\\s+")).firstOrNull()?.takeIf { it.isNotEmpty() }
                BrandMark(48.dp)
                title((first?.let { t("allSetName", "name" to it) } ?: t("allSet")) + ".", t("accountSub"))
                PrimaryButton(t("createAccount"), Modifier.fillMaxWidth()) { finishToAuth("signup") }
                GhostButton(t("continueDevice"), Modifier.fillMaxWidth(), ::finishGuest)
                T("${t("haveAccount")} ${t("signIn")}", tok.ui(13.5f, c = tok.text2), Modifier.align(Alignment.CenterHorizontally).tap { finishToAuth("signin") }.padding(6.dp))
            }
            else -> {
                BrandMark(48.dp)
                title(t("allSet") + ".", t("tourDone"))
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                steps.indices.forEach { i -> Box(Modifier.size(6.dp).background(if (i == step) tok.accent else tok.borderStrong, CircleShape)) }
            }
            if (!(firstRun && last)) {
                if (step > 0) GhostButton(t("back")) { step-- }
                PrimaryButton(if (last) t("done") else t("next"), busy = !canNext) {
                    if (last) {
                        if (!firstRun) {
                            applyPersonalization()
                            store.dispatch { it.copy(onboarded = true, replayTour = false) }
                        }
                    } else step++
                }
            }
        }
    }
}
