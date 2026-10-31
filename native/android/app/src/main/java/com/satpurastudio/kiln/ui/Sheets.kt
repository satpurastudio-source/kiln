@file:OptIn(ExperimentalLayoutApi::class)

package com.satpurastudio.kiln.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.satpurastudio.kiln.Reminders
import com.satpurastudio.kiln.Store
import com.satpurastudio.kiln.core.*
import kotlinx.coroutines.launch

private const val LATEST = "2026-10-25"

/** Once, to people who were here before them; brand-new people are quietly marked up to date. */
fun shouldShowWhatsNew(store: Store): Boolean {
    val seen = store.prefs.string("kiln-whatsnew-seen")
    if (seen == LATEST) return false
    val returning = seen != null || store.state.tasks.any { it.createdAt > 0 && Clock.ms - it.createdAt > 864e5 }
    if (!returning) store.prefs.set("kiln-whatsnew-seen", LATEST)
    return returning
}

fun openUrl(c: Context, url: String) {
    try {
        c.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: Exception) {
        // nothing on this phone can open it
    }
}

/** A title, a scrolling body and a Done control — shared by every sheet. */
@Composable
fun SheetShell(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val tok = LocalTok.current
    BackHandler(onBack = onClose)
    Box(Modifier.fillMaxSize().background(tok.scrim).tap(onClick = onClose), contentAlignment = Alignment.Center) {
        Column(
            Modifier.widthIn(max = 560.dp).fillMaxSize().background(tok.bg).tap {}.windowInsetsPadding(WindowInsets.systemBars).imePadding(),
        ) {
            Row(Modifier.padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                T(title, tok.display(29f), Modifier.weight(1f), maxLines = 1)
                T(t("done"), tok.ui(14.5f, FontWeight.SemiBold, tok.accent), Modifier.tap(onClick = onClose).padding(8.dp))
            }
            Column(
                Modifier.verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, bottom = 30.dp),
                verticalArrangement = Arrangement.spacedBy(26.dp), content = content,
            )
        }
    }
}

@Composable
fun SetSection(icon: String? = null, title: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val tok = LocalTok.current
    Column(verticalArrangement = Arrangement.spacedBy(11.dp)) {
        if (title != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                if (icon != null) KIcon(icon, 12.dp, tok.text3)
                T(title.uppercase(), tok.mono(11.5f, true))
            }
        }
        content()
    }
}

@Composable
fun SetAction(icon: String? = null, title: String, danger: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val tok = LocalTok.current
    Row(
        Modifier.fillMaxWidth().heightIn(min = 46.dp).card(tok, RoundedCornerShape(11.dp)).tap(enabled = enabled, onClick = onClick).padding(horizontal = 13.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (icon != null) KIcon(icon, 15.dp, if (danger) tok.danger else tok.text)
        T(title, tok.ui(14f, FontWeight.Medium, if (danger) tok.danger else tok.text))
    }
}

@Composable
fun Hint(text: String) = T(text, LocalTok.current.ui(12.5f, c = LocalTok.current.text3))

@Composable
fun SetRow(title: String, sub: String? = null, trailing: @Composable () -> Unit) {
    val tok = LocalTok.current
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            T(title, tok.ui(14f))
            if (sub != null) T(sub, tok.ui(12f, c = tok.text3))
        }
        trailing()
    }
}

@Composable
fun KSwitch(on: Boolean, onChange: (Boolean) -> Unit) {
    val tok = LocalTok.current
    Switch(on, onChange, colors = SwitchDefaults.colors(checkedTrackColor = tok.accent, checkedThumbColor = Color.White, uncheckedTrackColor = tok.border, uncheckedBorderColor = tok.borderStrong, uncheckedThumbColor = tok.text2))
}

@Composable
fun KSlider(value: Float, range: ClosedFloatingPointRange<Float>, modifier: Modifier = Modifier, steps: Int = 0, onChange: (Float) -> Unit) {
    val tok = LocalTok.current
    Slider(value, onChange, modifier, valueRange = range, steps = steps, colors = SliderDefaults.colors(thumbColor = tok.accent, activeTrackColor = tok.accent, inactiveTrackColor = tok.border, activeTickColor = Color.Transparent, inactiveTickColor = Color.Transparent))
}

@Composable
fun <V> Seg(value: V, options: List<Pair<V, String>>, pick: (V) -> Unit) {
    val tok = LocalTok.current
    Row(Modifier.background(tok.border.copy(alpha = tok.border.alpha * 0.6f), R9).padding(2.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        options.forEach { (id, label) ->
            Box(
                Modifier.heightIn(min = 32.dp).background(if (value == id) tok.panelHover else Color.Transparent, RoundedCornerShape(7.dp)).tap { pick(id) }.padding(horizontal = 10.dp),
                contentAlignment = Alignment.Center,
            ) { T(label, tok.ui(12.5f, FontWeight.Medium, if (value == id) tok.text else tok.text3), maxLines = 1) }
        }
    }
}

@Composable
fun LanguagePicker() {
    val store = LocalStore.current
    val tok = LocalTok.current
    val current = store.state.language
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        LANGUAGES.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                pair.forEach { l ->
                    Column(
                        Modifier.weight(1f).card(tok, RoundedCornerShape(10.dp), if (current == l.code) tok.accent.copy(alpha = 0.12f) else tok.panel, if (current == l.code) tok.accent.copy(alpha = 0.6f) else tok.border)
                            .tap { store.dispatch { it.setSettings(itemOf("language" to J.Str(l.code))) } }.padding(horizontal = 12.dp, vertical = 8.dp),
                    ) {
                        T(l.native, tok.ui(14f, FontWeight.Medium))
                        T(l.name, tok.ui(11.5f, c = tok.text3))
                    }
                }
            }
        }
    }
}

@Composable
fun AccentPicker() {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state.settings
    var draft by remember { mutableStateOf(s["customAccent"]?.string ?: "#d85a30") }
    val valid = Regex("^#[0-9a-fA-F]{6}$").matches(draft)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            ACCENTS.forEach { a ->
                Box(
                    Modifier.size(32.dp).background(color(a.accent), CircleShape).border(2.dp, if (s["accent"]?.string == a.id) tok.text else Color.Transparent, CircleShape)
                        .tap(label = t("accent_${a.id}")) { store.dispatch { it.setSettings(itemOf("accent" to J.Str(a.id))) } },
                )
            }
        }
        // the choice applies when you press Apply, so typing never retints the app per keystroke
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(26.dp).background(if (valid) color(draft) else tok.border, CircleShape))
            Box(Modifier.width(110.dp).heightIn(min = 34.dp).card(tok, R9).padding(horizontal = 10.dp), contentAlignment = Alignment.CenterStart) {
                Input(draft, { v -> draft = v.trim().let { if (it.isNotEmpty() && !it.startsWith("#")) "#$it" else it } }, "#hex", tok.mono(13f, c = tok.text), limit = 7)
            }
            MiniButton(t("apply"), enabled = valid) {
                store.dispatch { it.setSettings(itemOf("accent" to J.Str("custom"), "customAccent" to J.Str(draft.lowercase()))) }
            }
        }
    }
}

@Composable
private fun ConfirmBox(text: String, buttons: @Composable () -> Unit) {
    val tok = LocalTok.current
    Column(Modifier.fillMaxWidth().background(tok.danger.copy(alpha = 0.07f), RoundedCornerShape(11.dp)).border(1.dp, tok.danger.copy(alpha = 0.25f), RoundedCornerShape(11.dp)).padding(13.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        T(text, tok.ui(13.5f))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) { buttons() }
    }
}

@Composable
fun SettingsSheet(onClose: () -> Unit, openSheet: (SheetKind) -> Unit, openAmbient: (Boolean) -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val s = store.state
    val settings = s.settings
    val cloud = s.isCloud
    val email = s.profile?.get("email")?.string
    var name by remember { mutableStateOf(s.profile?.get("name")?.string ?: "") }
    var confirmDelete by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var signOutStuck by remember { mutableStateOf(false) }
    var restore by remember { mutableStateOf<Snapshot?>(null) }

    val exporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) {
            context.contentResolver.openOutputStream(uri)?.use { it.write(backupFile(store.state).toByteArray()) }
            store.toast(t("backupDownloaded"), "⬇")
        }
    }
    val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            try {
                val text = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } ?: ""
                restore = parseBackup(text)
            } catch (e: BackupError) {
                store.toast(e.message ?: "", "⚠")
            }
        }
    }
    fun export() = exporter.launch("kiln-backup-${todayStr()}.json")
    fun commitName() {
        val clean = name.trim()
        val current = store.state.profile?.get("name")?.string ?: ""
        if (clean.isNotEmpty() && clean != current) {
            store.dispatch { st -> st.copy(profile = st.profile?.plus("name" to J.Str(clean))) }
            store.toast(t("nameUpdated"), "✓")
        } else name = current
    }
    val close = {
        commitName()
        onClose()
    }
    fun signOut(force: Boolean = false) {
        busy = true
        scope.launch {
            val ok = store.signOut(force)
            busy = false
            if (ok) onClose() else signOutStuck = true
        }
    }

    SheetShell(t("settings"), close) {
        SetSection("User", t("you")) {
            KField(name, { name = it }, t("yourName"), limit = 40, onDone = { commitName() })
            Hint(t("displayNameHint"))
            if (cloud) {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(7.dp).background(if (store.syncStatus == SyncStatus.Synced) Color(0xFF6F9B7A) else if (store.syncStatus == SyncStatus.Syncing) tok.accent else Color(0xFFD98E32), CircleShape))
                    val label = when (store.syncStatus) {
                        SyncStatus.Synced -> t("syncSynced")
                        SyncStatus.Syncing -> t("syncSyncing")
                        SyncStatus.Offline -> t("syncOffline")
                        SyncStatus.Error -> t("syncError")
                        SyncStatus.Idle -> t("connecting")
                    }
                    T((email?.let { "$it · " } ?: "") + label, tok.ui(12.5f, c = tok.text3))
                }
                AccountSection(email)
            }
        }
        SetSection("Globe", if (t("language") == "Language") "Language" else "Language · ${t("language")}") { LanguagePicker() }
        SetSection("Sparkle", t("accentColor")) { AccentPicker() }
        SetSection("Sun", t("appearance")) {
            SetRow(t("theme")) { Seg(s.theme, listOf("light" to t("light"), "dark" to t("dark"))) { v -> store.dispatch { it.copy(theme = v) } } }
            SetRow(t("textSize"), t("textSizeSub")) {
                T("${Math.round(s.textScale * 100)}%", tok.mono(12.5f, c = tok.text2), Modifier.tap { store.dispatch { it.setSettings(itemOf("textScale" to 1.j())) } }.padding(6.dp))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                T("A", tok.ui(12f, c = tok.text3))
                KSlider(s.textScale.toFloat(), TEXT_SCALE_MIN.toFloat()..TEXT_SCALE_MAX.toFloat(), Modifier.weight(1f), steps = 9) { v ->
                    store.dispatch { it.setSettings(itemOf("textScale" to (Math.round(v * 20) / 20.0).j())) }
                }
                T("A", tok.ui(18f, c = tok.text3))
            }
            SetRow(t("soundEffects")) { KSwitch(s.sound) { v -> store.dispatch { it.copy(sound = v) } } }
            SetRow(t("reducedVisuals"), t("reducedVisualsSub")) { KSwitch(s.reducedEffects) { v -> store.dispatch { it.setSettings(itemOf("reducedEffects" to v.j())) } } }
        }
        SetSection("Flag", t("newTaskDefaults")) {
            SetRow(t("dueDate")) {
                Seg(settings["defaultDue"]?.string ?: "today", listOf("none" to t("noDate"), "today" to t("today"), "tomorrow" to t("tomorrow"))) { v -> store.dispatch { it.setSettings(itemOf("defaultDue" to J.Str(v))) } }
            }
            T(t("priority"), tok.ui(14f))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                PRIORITIES.forEach { (id, c) ->
                    val on = settings["defaultPriority"]?.string == id
                    Chip(on, { store.dispatch { it.setSettings(itemOf("defaultPriority" to J.Str(id))) } }) {
                        if (id != "none") KIcon("Flag", 11.dp, color(c))
                        ChipText(t("prio_$id"), on)
                    }
                }
            }
            SetRow(t("defaultTime")) { TimeField(settings["defaultTime"]?.string ?: "") { v -> store.dispatch { it.setSettings(itemOf("defaultTime" to J.Str(v))) } } }
        }
        SetSection("Bell", t("notifications")) {
            SetRow(t("taskReminders")) {
                KSwitch(store.remindersOn) {
                    if (store.remindersOn) {
                        store.disableReminders()
                        store.toast(t("remindersOff"), "🔕")
                    } else scope.launch { store.turnOnReminders() }
                }
            }
            if (store.remindersOn) {
                Hint(t("remindersHint"))
                SetRow(t("checkItWorks")) {
                    MiniButton(t("sendTest")) {
                        if (Reminders.granted(context)) {
                            Reminders.sendTest(context, t("testReminderBody"))
                            store.toast(t("testOnWay"), "🔔")
                        } else scope.launch { store.turnOnReminders() }
                    }
                }
            }
        }
        SetSection("Flame", t("ambient")) {
            Hint(t("ambientHint"))
            SetAction("Flame", t("openAmbient")) { openAmbient(false) }
            SetAction("Sparkle", t("customizeAmbient")) { openAmbient(true) }
            if (settings["ambient"]?.obj.orEmpty().isNotEmpty()) SetAction(title = t("resetAmbient")) { store.dispatch { it.setSettings(itemOf("ambient" to J.Obj(emptyMap()))) } }
        }
        SetSection("Info", t("helpFeedback")) {
            SetAction("Keyboard", t("helpShortcuts")) { openSheet(SheetKind.Help) }
            SetAction("Mail", t("sendFeedback")) { openSheet(SheetKind.Feedback) }
            SetAction("Gift", t("whatsNew")) { openSheet(SheetKind.WhatsNew) }
        }
        SetSection {
            SetAction("Info", t("replayTour")) {
                commitName()
                store.dispatch { it.copy(onboarded = false, replayTour = true) }
                onClose()
            }
            SetAction("Download", t("downloadBackup")) { export() }
            SetAction("Download", t("restoreBackup")) { importer.launch(arrayOf("application/json", "*/*")) }
            restore?.let { r ->
                ConfirmBox(t("restoreConfirm", "folders" to tn("folders", r.projects.size), "tasks" to tn("tasks", r.tasks.size))) {
                    MiniButton(t("cancel")) { restore = null }
                    MiniButton(t("restoreBackupBtn"), danger = true) {
                        // current tasks are swapped out, not destroyed — they go to the trash
                        val incoming = r.tasks.mapNotNull { it["id"]?.string }.toSet()
                        store.dispatch { st -> st.deleteTasks(st.tasks.filter { it.id !in incoming }.map { it.id }).hydrate(r) }
                        store.toast(tn("restoredTasks", r.tasks.size), "↩")
                        restore = null
                        onClose()
                    }
                }
            }
            if (cloud && !signOutStuck) SetAction(title = if (busy) t("savingChanges") else t("signOut"), danger = true, enabled = !busy) { signOut() }
            if (signOutStuck) {
                ConfirmBox(t("signOutStuck")) {
                    MiniButton(t("staySignedIn")) { signOutStuck = false }
                    MiniButton(t("downloadBackupShort")) { export() }
                    MiniButton(t("signOutAnyway"), danger = true) { signOut(true) }
                }
            }
        }
        SetSection(title = t("dangerZone")) {
            if (!confirmDelete) SetAction(title = t("deleteAccount"), danger = true) { confirmDelete = true }
            else ConfirmBox(if (cloud) t("deleteConfirmCloud") else t("deleteConfirmLocal")) {
                MiniButton(t("cancel"), enabled = !busy) { confirmDelete = false }
                MiniButton(if (busy) t("deleting") else t("yesDeleteAll"), danger = true, enabled = !busy) {
                    busy = true
                    scope.launch {
                        val ok = store.deleteAccount()
                        busy = false
                        if (ok) onClose() else {
                            confirmDelete = false
                            store.toast(t("deleteFailed"), "⚠")
                        }
                    }
                }
            }
            Hint(t("exportFirst"))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                T(t("privacy"), tok.ui(12.5f, c = tok.text2), Modifier.tap { openUrl(context, Backend.WEB_URL + "privacy.html") })
                T("·", tok.ui(12.5f, c = tok.text3))
                T(t("terms"), tok.ui(12.5f, c = tok.text2), Modifier.tap { openUrl(context, Backend.WEB_URL + "terms.html") })
            }
        }
    }
}

/** Change the sign-in email or password. Email changes are confirmed from the inbox. */
@Composable
private fun AccountSection(email: String?) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val scope = rememberCoroutineScope()
    var open by remember { mutableStateOf<String?>(null) }
    var value by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    fun toggle(which: String?) {
        open = if (open == which) null else which
        value = ""
        confirm = ""
        error = ""
    }
    fun save() {
        error = ""
        if (open == "email") {
            val next = value.trim().lowercase()
            if (!Regex("^\\S+@\\S+\\.\\S+$").matches(next)) {
                error = t("errEmailInvalid")
                return
            }
            if (next == email?.lowercase()) {
                error = t("errSameEmail")
                return
            }
            busy = true
            scope.launch {
                try {
                    store.cloud.changeEmail(next)
                    store.toast(t("checkInboxNewEmail"), "✉")
                    toggle(null)
                } catch (e: CloudException) {
                    error = e.message ?: ""
                }
                busy = false
            }
        } else {
            if (value.length < 6) {
                error = t("errPwShort")
                return
            }
            if (value != confirm) {
                error = t("errPwMismatch")
                return
            }
            busy = true
            scope.launch {
                try {
                    store.cloud.changePassword(value)
                    store.toast(t("passwordChanged"), "✓")
                    toggle(null)
                } catch (e: CloudException) {
                    // projects with "secure password change" want a recent sign-in first
                    val m = e.message ?: ""
                    error = if (Regex("reauth|recent", RegexOption.IGNORE_CASE).containsMatchIn(m)) t("errReauth") else m
                }
                busy = false
            }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        SetAction("Mail", t("changeEmail")) { toggle("email") }
        if (open == "email") {
            KField(value, { value = it }, t("newEmail"), keyboard = KeyboardType.Email)
            Hint(t("newEmailHint"))
            if (error.isNotEmpty()) T(error, tok.ui(12.5f, c = tok.danger))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MiniButton(t("cancel")) { toggle(null) }
                MiniButton(if (busy) t("sending") else t("sendLink"), primary = true, enabled = !busy, onClick = ::save)
            }
        }
        SetAction("Lock", t("changePassword")) { toggle("password") }
        if (open == "password") {
            KField(value, { value = it }, t("newPassword"), secure = true)
            KField(confirm, { confirm = it }, t("typeAgain"), secure = true)
            if (error.isNotEmpty()) T(error, tok.ui(12.5f, c = tok.danger))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MiniButton(t("cancel")) { toggle(null) }
                MiniButton(if (busy) t("saving") else t("changePassword"), primary = true, enabled = !busy, onClick = ::save)
            }
        }
    }
}

@Composable
fun HelpSheet(onClose: () -> Unit) {
    val tok = LocalTok.current
    @Composable
    fun row(k: String, v: String, code: Boolean = false) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            T(k, if (code) tok.mono(12.5f, c = tok.text) else tok.ui(13.5f, FontWeight.Medium), Modifier.weight(1f))
            T(v, tok.ui(13f, c = tok.text2).copy(textAlign = TextAlign.End), Modifier.weight(1f))
        }
    }
    SheetShell(t("help"), onClose) {
        SetSection("Sparkle", t("quickAddUnderstands")) {
            T("${t("typeLikeSay")} pay rent friday 5pm !high #home", tok.ui(13.5f, c = tok.text2))
            listOf("tomorrow · friday · next week" to "sayDue", "26 oct · 12/11" to "sayDate", "5pm · 6:30pm · noon" to "sayTime", "!high · !med · !low" to "priority", "#home" to "sayFolder").forEach { (k, v) -> row(k, t(v), true) }
        }
        SetSection("Menu", t("gestures")) {
            listOf("gSwipeRight" to "gSwipeRightDo", "gSwipeLeft" to "gSwipeLeftDo", "gPull" to "gPullDo", "gBack" to "gBackDo").forEach { (k, v) -> row(t(k), t(v)) }
        }
        SetSection("Keyboard", t("keyboard")) {
            listOf("Enter" to "keyEnter").forEach { (k, v) -> row(k, t(v), true) }
        }
    }
}

@Composable
fun FeedbackSheet(onClose: () -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val context = LocalContext.current
    var kind by remember { mutableStateOf("bug") }
    var text by remember { mutableStateOf("") }
    var withDevice by remember { mutableStateOf(true) }
    val mail = "satpurastudio@gmail.com"
    val kinds = listOf(Triple("bug", "Something’s broken", "fbBug"), Triple("idea", "An idea", "fbIdea"), Triple("other", "Something else", "fbOther"))
    SheetShell(t("sendFeedbackTitle"), onClose) {
        SetSection {
            T(t("fbWhatAbout"), tok.ui(13.5f, FontWeight.Medium))
            Seg(kind, kinds.map { it.first to t(it.third) }) { kind = it }
            T(if (kind == "bug") t("fbWhatHappened") else t("fbTellUs"), tok.ui(13.5f, FontWeight.Medium))
            Box(Modifier.fillMaxWidth().heightIn(min = 120.dp).card(tok, RoundedCornerShape(11.dp)).padding(11.dp)) {
                Input(text, { text = it }, if (kind == "bug") t("fbBugPh") else t("fbIdeaPh"), tok.ui(14f), Modifier.fillMaxWidth(), singleLine = false)
            }
            SetRow(t("fbDevice"), t("fbDeviceSub")) { KSwitch(withDevice) { withDevice = it } }
            PrimaryButton(t("send"), Modifier.fillMaxWidth()) {
                val label = kinds.first { it.first == kind }.second
                val version = context.packageManager.getPackageInfo(context.packageName, 0).versionName
                val device = if (withDevice) "---\nkiln $version (android ${Build.VERSION.RELEASE}, ${Build.MANUFACTURER} ${Build.MODEL})\n" else ""
                val i = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$mail")).putExtra(Intent.EXTRA_SUBJECT, "[kiln] $label").putExtra(Intent.EXTRA_TEXT, "${text.trim()}\n\n$device")
                try {
                    context.startActivity(i)
                    store.toast(t("openingMail"), "✉")
                } catch (_: Exception) {
                    store.toast(mail, "✉")
                }
            }
            Hint(t("fbOpensMail"))
            T(mail, tok.mono(12.5f, c = tok.accent), Modifier.tap {
                (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("email", mail))
                store.toast(t("emailCopied"), "✓")
            })
        }
    }
}

@Composable
fun WhatsNewSheet(onClose: () -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    DisposableEffect(Unit) { onDispose { store.prefs.set("kiln-whatsnew-seen", LATEST) } }
    SheetShell(t("whatsNew"), onClose) {
        CHANGELOG.forEach { (id, items) ->
            SetSection(title = fmtDate(parseDateStr(id), "MMMMd")) {
                T(t("cl_${id}_title"), tok.ui(15f, FontWeight.SemiBold))
                repeat(items) { i ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        T("✦", tok.ui(10f, c = tok.accent), Modifier.padding(top = 3.dp))
                        T(t("cl_${id}_$i"), tok.ui(13.5f, c = tok.text2))
                    }
                }
            }
        }
    }
}

@Composable
fun ProjectEditorSheet(project: Project?, onClose: () -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    var name by remember { mutableStateOf(project?.name ?: "") }
    var hue by remember { mutableStateOf(project?.color ?: PROJECT_COLORS[0]) }
    var icon by remember { mutableStateOf(project?.icon ?: PROJECT_ICONS[0]) }
    var confirmDelete by remember { mutableStateOf(false) }
    fun submit() {
        val clean = name.trim()
        if (clean.isEmpty()) return
        if (project != null) {
            store.dispatch { it.updateProject(project.id, itemOf("name" to J.Str(clean), "color" to J.Str(hue), "icon" to J.Str(icon))) }
            store.toast(t("folderUpdated"), "✓")
        } else {
            store.dispatch { it.addProject(clean, hue, icon) }
            store.toast(t("folderCreated", "name" to clean), iconGlyph(icon))
        }
        onClose()
    }
    SheetShell(if (project == null) t("newFolder") else t("editFolder"), onClose) {
        SetSection {
            T(t("name"), tok.ui(13f, FontWeight.Medium, tok.text2))
            KField(name, { name = it }, t("folderNamePh"), limit = 40, onDone = { submit() })
            T(t("color"), tok.ui(13f, FontWeight.Medium, tok.text2))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                PROJECT_COLORS.forEach { c ->
                    Box(Modifier.size(32.dp).background(color(c), CircleShape).border(2.dp, if (hue == c) tok.text else Color.Transparent, CircleShape).tap(label = t("useColor", "color" to c)) { hue = c })
                }
            }
            T(t("icon"), tok.ui(13f, FontWeight.Medium, tok.text2))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                PROJECT_ICONS.forEach { i ->
                    Box(
                        Modifier.size(40.dp).background(if (icon == i) tok.panelHover else Color.Transparent, R9).border(1.dp, if (icon == i) color(hue, 0.7f) else tok.border, R9).tap { icon = i },
                        contentAlignment = Alignment.Center,
                    ) { T(iconGlyph(i), tok.ui(16f, c = if (icon == i) color(hue) else tok.text2)) }
                }
            }
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                if (project != null) {
                    MiniButton(if (confirmDelete) t("deleteFolderConfirm") else t("delete"), danger = true) {
                        if (!confirmDelete) {
                            confirmDelete = true
                            return@MiniButton
                        }
                        val s = store.state
                        val index = s.projects.indexOfFirst { it.id == project.id }
                        val ids = s.tasks.filter { it.projectId == project.id }.map { it.id }
                        store.dispatch { it.deleteProject(project.id) }
                        store.toast(if (ids.isEmpty()) t("folderDeleted") else tn("folderDeletedTasks", ids.size), "🗑", t("undo")) { store.dispatch { it.restoreProject(project, index, ids) } }
                        onClose()
                    }
                }
                Spacer(Modifier.weight(1f))
                GhostButton(t("cancel"), onClick = onClose)
                PrimaryButton(if (project == null) t("createFolder") else t("save"), onClick = ::submit)
            }
        }
    }
}

private class PRow(val id: String, val icon: String? = null, val glyph: Pair<String, String>? = null, val label: String, val hint: String, val fn: () -> Unit)

@Composable
fun PaletteView(close: () -> Unit, openSheet: (SheetKind) -> Unit, newFolder: () -> Unit, openAmbient: () -> Unit, openTask: (KTask) -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val scope = rememberCoroutineScope()
    var q by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    BackHandler(onBack = close)
    val s = store.state
    val action = t("hintAction")
    fun go(type: String, icon: String, key: String) = PRow("go-$type", icon, label = t("goTo", "name" to t(key)), hint = t("hintView")) { store.dispatch { it.copy(view = Screen(type)) } }
    val base = buildList {
        add(go("today", "Sun", "nav_today"))
        add(go("upcoming", "Clock", "nav_upcoming"))
        add(go("calendar", "Calendar", "nav_calendar"))
        add(go("all", "Layers", "nav_all"))
        add(go("insights", "Chart", "nav_insights"))
        add(go("archive", "Archive", "nav_archive"))
        add(go("trash", "Trash", "nav_trash"))
        s.projects.forEach { p -> add(PRow("folder-${p.id}", glyph = iconGlyph(p.icon) to p.color, label = t("goTo", "name" to p.name), hint = t("folder")) { store.dispatch { it.copy(view = Screen("project", p.id)) } }) }
        add(PRow("ambient", "Flame", label = t("openAmbient"), hint = action, fn = openAmbient))
        add(PRow("newfolder", "Plus", label = t("newFolder"), hint = action, fn = newFolder))
        add(PRow("settings", "Settings", label = t("openSettings"), hint = action) { openSheet(SheetKind.Settings) })
        add(PRow("help", "Keyboard", label = t("helpKeyboard"), hint = "?") { openSheet(SheetKind.Help) })
        add(PRow("feedback", "Mail", label = t("sendFeedback"), hint = action) { openSheet(SheetKind.Feedback) })
        add(PRow("whatsnew", "Gift", label = t("whatsNew"), hint = action) { openSheet(SheetKind.WhatsNew) })
        add(PRow("tour", "Info", label = t("replayTour"), hint = action) { store.dispatch { it.copy(onboarded = false, replayTour = true) } })
        add(PRow("theme", if (s.theme == "dark") "Sun" else "Moon", label = if (s.theme == "dark") t("switchToLight") else t("switchToDark"), hint = action) { store.dispatch { it.copy(theme = if (it.theme == "dark") "light" else "dark") } })
        add(PRow("sound", if (s.sound) "BellOff" else "Bell", label = if (s.sound) t("muteSounds") else t("unmuteSounds"), hint = action) { store.dispatch { it.copy(sound = !it.sound) } })
        add(PRow("clear", "Broom", label = t("clearAllCompleted"), hint = action) {
            val ids = store.state.tasks.filter { it.done && !it.archived }.map { it.id }
            if (ids.isEmpty()) store.toast(t("nothingToClear"), "🧹")
            else {
                store.dispatch { it.deleteTasks(ids) }
                store.toast(tn("clearedCompletedTasks", ids.size), "🧹", t("undo")) { store.dispatch { it.restoreTasks(ids) } }
            }
        })
        add(PRow("backup", "Download", label = t("downloadBackup"), hint = t("hintAccount")) { openSheet(SheetKind.Settings) })
        add(PRow("reminders", "Bell", label = if (store.remindersOn) t("disableReminders") else t("enableReminders"), hint = action) {
            if (store.remindersOn) {
                store.disableReminders()
                store.toast(t("remindersOff"), "🔕")
            } else store.scope.launch { store.turnOnReminders() }
        })
        add(PRow("signout", "X", label = t("signOut"), hint = t("hintAccount")) {
            if (!store.state.isCloud) store.dispatch { it.copy(profile = null) }
            else store.scope.launch {
                // couldn't sync first — Settings explains and offers the choices
                if (!store.signOut()) {
                    store.toast(t("signOutFromSettings"), "⚠")
                    openSheet(SheetKind.Settings)
                }
            }
        })
    }
    val ql = q.trim().lowercase()
    val rows = if (ql.isEmpty()) base else buildList {
        val colors = s.projects.associateBy { it.id }
        s.tasks.filter { !it.archived && (it.title.lowercase().contains(ql) || it.notes.lowercase().contains(ql)) }.sortedBy { if (it.done) 1 else 0 }.take(6).forEach { x ->
            val p = colors[x.projectId]
            val hint = listOfNotNull(p?.name, if (x.due != null && !x.done) fmtDue(x.due) else null, if (x.done) t("doneLower") else null).joinToString(" · ")
            add(PRow("task-${x.id}", glyph = (if (x.done) "✓" else "○") to (p?.color ?: tok.accentHex), label = x.title, hint = hint) { openTask(x) })
        }
        addAll(base.filter { it.label.lowercase().contains(ql) })
        // nothing typed matches exactly? one Enter turns it into a task
        val parsed = store.parse(q)
        val title = parsed.title.trim()
        if (title.isNotEmpty()) add(PRow("add", "Plus", label = t("addTaskNamed", "title" to title), hint = if (parsed.due != null) fmtDue(parsed.due) else t("task")) {
            val st = store.state
            val pid = parsed.projectId ?: if (st.view.type == "project") st.view.projectId else st.projects.firstOrNull()?.id
            val due = parsed.due ?: store.newTaskDue(st.view)
            val time = parsed.time ?: st.settings["defaultTime"]?.string?.takeIf { it.isNotEmpty() }
            val prio = parsed.priority ?: st.settings["defaultPriority"]?.string
            store.dispatch { it.addTask(title, pid, due, time, prio, parsed.newFolder) }
            store.sound.add()
            val folder = parsed.newFolder ?: st.projects.firstOrNull { it.id == pid }?.name ?: t("inbox")
            store.toast(if (parsed.due != null) t("addedTo", "folder" to folder, "when" to fmtDue(parsed.due)) else t("addedToFolder", "folder" to folder), "✓")
        })
    }
    fun run(r: PRow) {
        r.fn()
        close()
    }
    Box(Modifier.fillMaxSize().background(tok.scrim).tap(onClick = close).windowInsetsPadding(WindowInsets.systemBars).imePadding().padding(start = 14.dp, end = 14.dp, top = 40.dp), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 560.dp).heightIn(max = 460.dp).fillMaxWidth().card(tok, RoundedCornerShape(16.dp), tok.raise).tap {}) {
            Row(Modifier.height(54.dp).padding(horizontal = 15.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KIcon("Search", 15.dp, tok.text3)
                Input(q, { q = it }, t("paletteSearchPh"), tok.ui(15.5f), Modifier.weight(1f).focusRequester(focus), onDone = { rows.firstOrNull()?.let(::run) })
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(tok.border))
            if (rows.isEmpty()) T(t("nothingMatches"), tok.ui(14f, c = tok.text3), Modifier.padding(24.dp))
            LazyColumn(contentPadding = PaddingValues(6.dp)) {
                itemsIndexed(rows, key = { _, r -> r.id }) { i, r ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 42.dp).background(if (i == 0 && ql.isNotEmpty()) tok.accent.copy(alpha = 0.12f) else Color.Transparent, R9).tap { run(r) }.padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp),
                    ) {
                        Box(Modifier.width(18.dp), contentAlignment = Alignment.Center) {
                            if (r.glyph != null) T(r.glyph.first, tok.ui(13f, c = color(r.glyph.second)))
                            else if (r.icon != null) KIcon(r.icon, 14.dp)
                        }
                        T(r.label, tok.ui(14f), Modifier.weight(1f), maxLines = 1)
                        T(r.hint, tok.mono(11f), maxLines = 1)
                    }
                }
            }
        }
    }
}
