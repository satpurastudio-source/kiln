package com.satpurastudio.kiln

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.text.format.DateFormat
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.satpurastudio.kiln.core.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class Toast(val message: String, val icon: String, val actionLabel: String?, val action: (() -> Unit)?, val sticky: Boolean) {
    val id = uid()
}

/** The running app: state, persistence, auth, sync, and the transient UI they drive. One per process. */
class Store private constructor(context: Context) {
    val app: Context = context.applicationContext
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    val prefs = Prefs(app)
    private val disk = Disk(app)
    val sound = Sound(app)
    val cloud: Cloud

    var state by mutableStateOf(AppState())
        private set
    var syncStatus by mutableStateOf(SyncStatus.Idle)
    val toasts = mutableStateListOf<Toast>()
    var focus by mutableStateOf<FocusSession?>(null)
        private set
    var focusOpen by mutableStateOf(false)
    var day by mutableStateOf("")
    var dragging by mutableStateOf(false)
    var dragHot by mutableStateOf(false)
    var confetti by mutableIntStateOf(0)
    var remindersOn by mutableStateOf(false)
    /** Lets the activity ask for the notification permission on the store's behalf. */
    var askNotificationPermission: (suspend () -> Boolean)? = null

    private var sync: SyncEngine? = null
    private var realtime: RealtimeChannel? = null
    private var lastUser: String? = null
    private var saveJob: Job? = null
    private var pushJob: Job? = null
    private var purgeJob: Job? = null
    private var focusJob: Job? = null
    private var midnightJob: Job? = null
    private var remindJob: Job? = null
    private var online = true
    private var foreground = false
    private var awaitingSettings = false
    private var offered = false

    init {
        I18n.loader = { code ->
            try {
                app.assets.open("locales/$code.json").bufferedReader().use { it.readText() }
            } catch (_: Exception) {
                null
            }
        }
        I18n.bestPattern = { locale, skeleton -> DateFormat.getBestDateTimePattern(locale, skeleton) }
        cloud = Cloud(KeystoreSessionStore(app), scope)
        state = disk.loadState()
        I18n.lang = state.language
        day = todayStr()
        remindersOn = prefs.string("kiln-reminders") == "1"
        focus = FocusSession.of(prefs.string("kiln-focus")?.let(J::parse))
        lastUser = if (state.isCloud) state.profile?.get("userId")?.string else null
        sound.enabled = state.sound
        cloud.onSessionChange = { event, s ->
            scope.launch {
                if (event == "SIGNED_IN" && s != null) applySession(s)
                if (event == "SIGNED_OUT") sessionEnded()
            }
        }
        val s = cloud.session
        if (s != null) applySession(s)
        else if (state.isCloud) state = state.copy(profile = null) // the session didn't come with them (new phone)
        val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                scope.launch { networkChanged(true) }
            }

            override fun onLost(network: Network) {
                scope.launch { networkChanged(false) }
            }
        })
        schedulePurge()
        scheduleMidnight()
        startFocusLoop()
        scheduleReminders()
        sound.prepare()
        Analytics.countOpen(app, prefs, cloud)
    }

    // state changes

    /** Every change goes through here, so saving, syncing and reminders follow. */
    fun dispatch(change: (AppState) -> AppState) {
        val before = state
        val after = change(before)
        if (after == before) return
        state = after
        scheduleSave()
        if (after.settings != before.settings) I18n.lang = after.language
        if (after.sound != before.sound) sound.enabled = after.sound
        if (after.tasks != before.tasks || after.projects != before.projects || after.habits != before.habits) schedulePush()
        if (after.tasks != before.tasks) scheduleReminders()
        if (after.trash != before.trash) schedulePurge()
    }

    private fun scheduleSave() {
        saveJob?.cancel()
        saveJob = scope.launch {
            delay(250)
            saveNow()
        }
    }

    private suspend fun saveNow() {
        val s = state
        withContext(Dispatchers.IO) { disk.write(disk.stateFile, s.encoded.stable) }
    }

    private fun schedulePush() {
        val e = sync ?: return
        pushJob?.cancel()
        pushJob = scope.launch {
            delay(800)
            if (e.pending) e.push()
        }
    }

    /** Fire exactly when the soonest trash item expires, then reschedule. */
    private fun schedulePurge() {
        purgeJob?.cancel()
        val soonest = state.trash.minOfOrNull { it.deletedAt + TRASH_TTL } ?: return
        purgeJob = scope.launch {
            delay(maxOf(0.0, soonest - Clock.ms).toLong() + 80)
            dispatch { it.purgeTrash() }
        }
    }

    /** A phone app resumed the next morning must not keep showing yesterday's Today. */
    private fun scheduleMidnight() {
        midnightJob?.cancel()
        val n = D.now
        val next = D.make(n.year, n.month0, n.day + 1).ms + 5000
        midnightJob = scope.launch {
            delay(maxOf(1000L, next - Clock.ms))
            day = todayStr()
            scheduleMidnight()
        }
    }

    private fun scheduleReminders() {
        remindJob?.cancel()
        remindJob = scope.launch {
            delay(1000)
            val tasks = state.tasks
            withContext(Dispatchers.Default) { Reminders.rebuild(app, prefs, tasks) }
        }
    }

    // lifecycle

    fun onForeground() {
        foreground = true
        day = todayStr()
        scheduleMidnight()
        realtime?.start()
        scope.launch { sync?.refresh() }
        if (awaitingSettings) {
            awaitingSettings = false
            if (Reminders.granted(app)) {
                prefs.set("kiln-reminders", "1")
                remindersOn = true
                scheduleReminders()
                toast(t("remindersOnNudge"), "🔔")
            }
        }
    }

    fun onBackground() {
        foreground = false
        saveJob?.cancel()
        val s = state
        // phones kill backgrounded apps without warning, so this write happens now
        disk.write(disk.stateFile, s.encoded.stable)
        realtime?.stop()
        if (sync?.pending == true) scope.launch { sync?.push() }
    }

    private fun networkChanged(up: Boolean) {
        val was = online
        online = up
        if (up == was || sync == null) return
        if (up) scope.launch { sync?.refresh() } else syncStatus = SyncStatus.Offline
    }

    // auth + sync

    private fun applySession(s: AuthSession) {
        // SIGNED_IN also fires on token refresh — don't restart
        if (sync?.userId == s.userId) {
            scope.launch { sync?.refresh() }
            return
        }
        stopSync()
        val name = s.name ?: s.email?.substringBefore("@") ?: "there"
        // a different account than last time: don't hand them the previous person's tasks
        val last = lastUser
        if (last != null && last != s.userId) {
            state = state.resetContent()
            disk.baseFile.delete()
        }
        lastUser = s.userId
        // keep a display name changed in Settings rather than resetting it
        val prev = if (state.profile?.get("userId")?.string == s.userId) state.profile?.get("name")?.string else null
        dispatch {
            it.copy(
                profile = itemOf("name" to J.Str(prev ?: name), "email" to s.email.j(), "userId" to J.Str(s.userId), "cloud" to J.Bool(true)),
                // a real account means they're not a first-run user — skip the tour
                onboarded = true, replayTour = false,
            )
        }
        val engine = SyncEngine(
            s.userId, cloud, disk.BaseFile(), scope,
            getLocal = { state.snapshot },
            applyRemote = { snap -> dispatch { it.hydrate(snap) } },
            onStatus = { syncStatus = it },
            isOnline = { online },
        )
        sync = engine
        val channel = RealtimeChannel(s.userId, cloud.http, scope, {
            try {
                cloud.validToken()
            } catch (_: CloudException) {
                null
            }
        }) { data, at -> scope.launch { sync?.remoteChanged(data, at) } }
        realtime = channel
        if (foreground) channel.start()
        scope.launch { engine.start() }
    }

    private fun stopSync() {
        sync?.stop()
        sync = null
        realtime?.stop()
        realtime = null
    }

    private fun sessionEnded() {
        stopSync()
        syncStatus = SyncStatus.Idle
        dispatch { it.copy(profile = null) }
    }

    /** Sign out without stranding unsynced work, then clear this person's tasks off the
     *  device. False = couldn't sync first, and nothing was changed. */
    suspend fun signOut(force: Boolean = false): Boolean {
        val e = sync
        if (e != null && !force && !e.flush()) return false
        stopSync()
        disk.baseFile.delete()
        lastUser = null
        syncStatus = SyncStatus.Idle
        dispatch { it.resetContent() }
        cloud.signOut()
        return true
    }

    /** Permanently delete the account + all cloud data, then reset this device. */
    suspend fun deleteAccount(): Boolean {
        if (state.isCloud) {
            try {
                cloud.deleteAccount()
            } catch (_: CloudException) {
                return false
            }
        }
        stopSync()
        cloud.signOut()
        disk.wipe()
        prefs.wipeLocal()
        lastUser = null
        focus = null
        state = AppState.seed().copy(theme = state.theme)
        saveNow()
        return true
    }

    // toasts

    fun toast(message: String, icon: String = "✓", actionLabel: String? = null, sticky: Boolean = false, action: (() -> Unit)? = null) {
        val new = Toast(message, icon, actionLabel, action, sticky)
        // the same message twice in a row just refreshes it; at most 3 on screen,
        // and sticky ones are never pushed out
        val rest = toasts.filter { !(it.message == message && !it.sticky) }
        val stuck = rest.filter { it.sticky }
        val loose = rest.filter { !it.sticky }.takeLast(maxOf(0, 2 - stuck.size))
        toasts.clear()
        toasts.addAll(stuck + loose + new)
        if (sticky) return
        // give undo a fair chance — a reading-speed window, not a blink
        scope.launch {
            delay(if (action != null) 5000 else 2800)
            toasts.removeAll { it.id == new.id }
        }
    }

    // focus

    fun updateFocus(s: FocusSession?) {
        focus = s
        if (s != null) prefs.set("kiln-focus", s.json.stable) else prefs.remove("kiln-focus")
        startFocusLoop()
    }

    fun startFocus(taskId: String) {
        val m = focus?.mode ?: "classic"
        updateFocus(FocusSession(taskId, m, "work", Clock.ms + focusDurations(m, state.settings).work * 1000.0, null, 0))
        focusOpen = true
        sound.pop()
    }

    val focusSecondsLeft: Double
        get() {
            val f = focus ?: return 0.0
            return f.remaining ?: ((f.endsAt - Clock.ms) / 1000)
        }

    /** Only runs while a session is actually ticking. */
    private fun startFocusLoop() {
        focusJob?.cancel()
        val f = focus ?: return
        if (f.remaining != null) return
        focusJob = scope.launch {
            while (isActive) {
                delay(500)
                if (focusSecondsLeft <= 0) {
                    focusPhaseEnded()
                    return@launch
                }
            }
        }
    }

    private fun focusPhaseEnded() {
        val s = focus ?: return
        val m = focusDurations(s.mode, state.settings)
        if (s.phase == "work") {
            val count = s.count + 1
            sound.fanfare()
            toast(t("pomodoroDone", "n" to fmtNum(count)), "🔥")
            dispatch { st ->
                val logged = st.logFocus() // counted for Insights, survives clearing tasks
                val task = logged.tasks.firstOrNull { it.id == s.taskId }
                if (task != null) logged.updateTask(s.taskId, itemOf("pomos" to (task.pomos + 1).j())) else logged
            }
            val brk = if (count % 4 == 0) m.brk * 3 else m.brk
            updateFocus(s.copy(phase = "break", count = count, endsAt = Clock.ms + brk * 1000.0))
        } else {
            sound.complete()
            toast(t("breakOver"), "⚒")
            updateFocus(s.copy(phase = "work", endsAt = Clock.ms + m.work * 1000.0))
        }
    }

    // reminders

    /** First launch: ask straight away. Asked once; a no can be undone in Settings. */
    suspend fun askRemindersOnFirstLaunch() {
        if (prefs.string("kiln-reminders") != null) return
        if (enableReminders()) remindersOn = true else prefs.set("kiln-reminders", "0")
    }

    private suspend fun enableReminders(): Boolean {
        val ok = Reminders.granted(app) || (askNotificationPermission?.invoke() ?: false)
        if (!ok) return false
        prefs.set("kiln-reminders", "1")
        scheduleReminders()
        return true
    }

    /** Asks if Android still will; otherwise sends them to its settings to allow it there. */
    suspend fun turnOnReminders() {
        if (enableReminders()) {
            remindersOn = true
            toast(t("remindersOnNudge"), "🔔")
            return
        }
        awaitingSettings = true
        Reminders.openSettings(app)
        toast(t("notifAllowThenBack"), "🔔")
    }

    fun disableReminders() {
        prefs.set("kiln-reminders", "0")
        remindersOn = false
        scheduleReminders()
    }

    /** A task with a time is when reminders matter. Once per launch, so it never nags. */
    fun offerReminders() {
        if (offered || (prefs.string("kiln-reminders") == "1" && Reminders.granted(app))) return
        offered = true
        toast(t("remindOffer"), "🔔", t("turnOn")) { scope.launch { turnOnReminders() } }
    }

    // shared task actions

    fun completeWithFlourish(task: KTask) {
        val rep = if (task.repeats) task.repeatKind else null
        val remaining = state.tasks.count { it.projectId == task.projectId && !it.done && !it.archived && it.id != task.id }
        dispatch { it.toggleTask(task.id) }
        if (rep != null) {
            toast(t("repeatQueued", "repeat" to t("repeat_$rep")), "↻")
        } else if (remaining > 0) {
            toast(t("completed"), "✓", t("undo")) { dispatch { it.toggleTask(task.id) } }
        } else {
            val project = state.projects.firstOrNull { it.id == task.projectId }
            sound.fanfare()
            if (!state.reducedEffects) confetti++
            toast(t("folderComplete", "name" to (project?.name ?: t("folder"))), "🎉")
        }
    }

    fun remove(task: KTask) {
        dispatch { it.deleteTask(task.id) }
        sound.pop()
        toast(t("taskDeleted"), "🗑", t("undo")) { dispatch { it.restoreTasks(listOf(task.id)) } }
    }

    fun newTaskDue(view: Screen): String? = when {
        view.type == "today" -> todayStr()
        view.type == "upcoming" -> addDaysStr(1)
        state.settings["defaultDue"]?.string == "today" -> todayStr()
        state.settings["defaultDue"]?.string == "tomorrow" -> addDaysStr(1)
        else -> null
    }

    fun parse(text: String) = parseQuickAdd(text, state.projects.map { it.id to it.name })

    companion object {
        @Volatile private var instance: Store? = null
        fun get(context: Context): Store = instance ?: synchronized(this) { instance ?: Store(context).also { instance = it } }
    }
}
