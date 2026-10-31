import Foundation
import Network
import Observation
import SwiftUI

struct Toast: Identifiable, Equatable {
    let id = uid()
    let message: String
    let icon: String
    var actionLabel: String?
    var action: (() -> Void)?
    var sticky = false
    static func == (a: Toast, b: Toast) -> Bool { a.id == b.id }
}

/// The running app: state, persistence, auth, sync, and the transient UI they drive.
@MainActor
@Observable
final class Store {
    var state: AppState
    var syncStatus = SyncEngine.Status.idle
    var toasts: [Toast] = []
    var focus: FocusSession?
    var focusOpen = false
    var day = todayStr()
    var dragging = false
    var dragHot = false
    var windowHeight: CGFloat = 800
    var confetti = 0
    /// Reminders the OS will actually show, as Settings displays them.
    var remindersOn = Prefs.string("kiln-reminders") == "1"

    @ObservationIgnored let cloud: Cloud
    @ObservationIgnored private var sync: SyncEngine?
    @ObservationIgnored private var realtime: RealtimeChannel?
    @ObservationIgnored private var lastUser: String?
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var pushTask: Task<Void, Never>?
    @ObservationIgnored private var purgeTask: Task<Void, Never>?
    @ObservationIgnored private var focusTask: Task<Void, Never>?
    @ObservationIgnored private var midnightTask: Task<Void, Never>?
    @ObservationIgnored private let monitor = NWPathMonitor()
    @ObservationIgnored private var online = true
    @ObservationIgnored private var foreground = true
    @ObservationIgnored private var lastSynced: Snapshot?

    init() {
        cloud = Cloud()
        state = Disk.loadState()
        let language = state.language
        I18n.lang = language
        focus = Prefs.string("kiln-focus").flatMap { try? JSONDecoder().decode(FocusSession.self, from: Data($0.utf8)) }
        lastUser = state.profile?["cloud"]?.boolean == true ? state.profile?["userId"]?.string : nil
        Sound.enabled = state.sound
        cloud.onSessionChange = { [weak self] event, session in
            guard let self else { return }
            Task { @MainActor in
                if event == "SIGNED_IN", let session { self.applySession(session) }
                if event == "SIGNED_OUT" { self.sessionEnded() }
            }
        }
        if let s = cloud.session { applySession(s) }
        else if state.profile?["cloud"]?.boolean == true { state.profile = nil } // the session didn't come with them (new phone)
        monitor.pathUpdateHandler = { [weak self] path in
            let up = path.status == .satisfied
            Task { @MainActor in self?.networkChanged(up) }
        }
        monitor.start(queue: .global(qos: .utility))
        schedulePurge()
        scheduleMidnight()
        startFocusLoop()
        Analytics.countOpen()
        Reminders.shared.schedule(state.tasks)
    }

    // MARK: state changes

    /// Every change goes through here, so saving, syncing and reminders follow.
    func dispatch(_ change: (inout AppState) -> Void) {
        let before = state
        change(&state)
        guard state != before else { return }
        afterChange(before)
    }

    private func afterChange(_ before: AppState) {
        scheduleSave()
        if state.settings != before.settings {
            let lang = state.language
            if lang != I18n.lang { I18n.lang = lang }
        }
        if state.sound != before.sound { Sound.enabled = state.sound }
        if state.tasks != before.tasks || state.projects != before.projects || state.habits != before.habits { schedulePush() }
        if state.tasks != before.tasks { Reminders.shared.schedule(state.tasks) }
        if state.trash != before.trash { schedulePurge() }
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled, let self else { return }
            Disk.saveState(self.state)
        }
    }

    private func schedulePush() {
        guard let sync, sync.pending else { return }
        pushTask?.cancel()
        pushTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(800))
            guard !Task.isCancelled else { return }
            await self?.sync?.push()
        }
    }

    /// Fire exactly when the soonest trash item expires, then reschedule.
    private func schedulePurge() {
        purgeTask?.cancel()
        guard let soonest = state.trash.map({ $0.deletedAt + TRASH_TTL }).min() else { return }
        let wait = max(0, soonest - Clock.ms) / 1000 + 0.08
        purgeTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(wait))
            guard !Task.isCancelled else { return }
            self?.dispatch { $0.purgeTrash() }
        }
    }

    /// A phone app resumed the next morning must not keep showing yesterday's Today.
    private func scheduleMidnight() {
        midnightTask?.cancel()
        let next = makeDate(Clock.now.year, Clock.now.month0, Clock.now.dayOfMonth + 1, 0, 0).addingTimeInterval(5)
        midnightTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(max(1, next.timeIntervalSinceNow)))
            guard !Task.isCancelled, let self else { return }
            self.day = todayStr()
            self.scheduleMidnight()
        }
    }

    // MARK: lifecycle

    func scenePhase(_ phase: ScenePhase) {
        switch phase {
        case .active:
            foreground = true
            day = todayStr()
            scheduleMidnight()
            realtime?.start()
            Task { await sync?.refresh() }
            Reminders.shared.returnedToForeground(store: self)
        case .background:
            foreground = false
            saveTask?.cancel()
            Disk.saveState(state)
            realtime?.stop()
            if sync?.pending == true { Task { await sync?.push() } }
        default: break
        }
    }

    private func networkChanged(_ up: Bool) {
        let was = online
        online = up
        guard up != was, sync != nil else { return }
        if up { Task { await sync?.refresh() } } else { syncStatus = .offline }
    }

    // MARK: auth + sync

    private func applySession(_ s: AuthSession) {
        // SIGNED_IN also fires on token refresh — don't restart
        if sync?.userId == s.userId {
            Task { await sync?.refresh() }
            return
        }
        stopSync()
        let name = s.name ?? s.email?.split(separator: "@").first.map(String.init) ?? "there"
        // a different account than last time: don't hand them the previous person's tasks
        if let last = lastUser, last != s.userId {
            state.resetContent()
            Disk.clearBase()
        }
        lastUser = s.userId
        // keep a display name changed in Settings rather than resetting it
        let prev = state.profile?["userId"]?.string == s.userId ? state.profile?["name"]?.string : nil
        dispatch {
            $0.profile = ["name": .str(prev ?? name), "email": s.email.json, "userId": .str(s.userId), "cloud": true]
            // a real account means they're not a first-run user — skip the tour
            $0.onboarded = true
            $0.replayTour = false
        }
        let engine = SyncEngine(
            userId: s.userId, cloud: cloud, baseStore: Disk.BaseFile(),
            getLocal: { [weak self] in self?.state.snapshot ?? Snapshot() },
            applyRemote: { [weak self] snap in self?.dispatch { $0.hydrate(snap) } },
            onStatus: { [weak self] in self?.syncStatus = $0 },
            isOnline: { [weak self] in self?.online ?? true }
        )
        sync = engine
        let channel = RealtimeChannel(
            userId: s.userId,
            token: { [weak self] in try? await self?.cloud.validToken() },
            onChange: { [weak self] data, at in Task { await self?.sync?.remoteChanged(data: data, at: at) } }
        )
        realtime = channel
        if foreground { channel.start() }
        Task { await engine.start() }
    }

    private func stopSync() {
        sync?.stop()
        sync = nil
        realtime?.stop()
        realtime = nil
    }

    private func sessionEnded() {
        stopSync()
        syncStatus = .idle
        dispatch { $0.profile = nil }
    }

    /// Sign out without stranding unsynced work, then clear this person's tasks
    /// off the device. False = couldn't sync first, and nothing was changed.
    func signOut(force: Bool = false) async -> Bool {
        if let sync, !force {
            guard await sync.flush() else { return false }
        }
        stopSync()
        Disk.clearBase()
        lastUser = nil
        syncStatus = .idle
        dispatch { $0.resetContent() }
        await cloud.signOut()
        return true
    }

    /// Permanently delete the account + all cloud data, then reset this device.
    func deleteAccount() async -> Bool {
        if state.profile?["cloud"]?.boolean == true {
            do { try await cloud.deleteAccount() } catch { return false }
        }
        stopSync()
        await cloud.signOut()
        Disk.wipe()
        lastUser = nil
        focus = nil
        var fresh = AppState.seed()
        fresh.theme = state.theme
        state = fresh
        Disk.saveState(state)
        return true
    }

    // MARK: toasts

    func toast(_ message: String, _ icon: String = "✓", action: (label: String, fn: () -> Void)? = nil, sticky: Bool = false, holdMs: Int? = nil) {
        let new = Toast(message: message, icon: icon, actionLabel: action?.label, action: action?.fn, sticky: sticky)
        // the same message twice in a row just refreshes it; at most 3 on screen,
        // and sticky ones are never pushed out
        let rest = toasts.filter { !($0.message == message && !$0.sticky) }
        let stuck = rest.filter(\.sticky)
        let loose = rest.filter { !$0.sticky }.suffix(max(0, 2 - stuck.count))
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { toasts = stuck + loose + [new] }
        if sticky { return }
        // give undo a fair chance — a reading-speed window, not a blink
        Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(holdMs ?? (new.action != nil ? 5000 : 2800)))
            self?.dismiss(new.id)
        }
    }

    func dismiss(_ id: String) {
        withAnimation(.easeOut(duration: 0.2)) { toasts.removeAll { $0.id == id } }
    }

    // MARK: focus

    private func saveFocus() {
        if let focus, let data = try? JSONEncoder().encode(focus) { Prefs.set("kiln-focus", String(decoding: data, as: UTF8.self)) }
        else { Prefs.remove("kiln-focus") }
        startFocusLoop()
    }

    func setFocus(_ s: FocusSession?) {
        focus = s
        saveFocus()
    }

    func startFocus(_ taskId: String) {
        let m = focus?.mode ?? "classic"
        setFocus(FocusSession(taskId: taskId, mode: m, phase: "work", endsAt: Clock.ms + Double(focusDurations(m, state.settings).work) * 1000, remaining: nil, count: 0))
        focusOpen = true
        Sound.pop()
    }

    var focusSecondsLeft: Double {
        guard let f = focus else { return 0 }
        return f.remaining ?? (f.endsAt - Clock.ms) / 1000
    }

    /// Only runs while a session is actually ticking.
    private func startFocusLoop() {
        focusTask?.cancel()
        guard let f = focus, f.remaining == nil else { return }
        focusTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(500))
                guard !Task.isCancelled, let self else { return }
                if self.focusSecondsLeft <= 0 {
                    self.focusPhaseEnded()
                    return
                }
            }
        }
    }

    private func focusPhaseEnded() {
        guard var s = focus else { return }
        let m = focusDurations(s.mode, state.settings)
        if s.phase == "work" {
            s.count += 1
            Sound.fanfare()
            toast(t("pomodoroDone", ["n": fmtNum(s.count)]), "🔥")
            let taskId = s.taskId
            dispatch { st in
                st.logFocus() // counted for Insights, survives clearing tasks
                if let task = st.tasks.first(where: { $0.id == taskId }) { st.updateTask(taskId, ["pomos": .num(Double(task.pomos + 1))]) }
            }
            let brk = s.count % 4 == 0 ? m.brk * 3 : m.brk
            s.phase = "break"
            s.endsAt = Clock.ms + Double(brk) * 1000
        } else {
            Sound.complete()
            toast(t("breakOver"), "⚒")
            s.phase = "work"
            s.endsAt = Clock.ms + Double(m.work) * 1000
        }
        setFocus(s)
    }

    // MARK: shared task actions

    func completeWithFlourish(_ task: KTask) {
        let rep = task.repeats ? task.repeatKind : nil
        let remaining = state.tasks.filter { $0.projectId == task.projectId && !$0.done && !$0.archived && $0.id != task.id }.count
        let id = task.id
        dispatch { $0.toggleTask(id) }
        if let rep {
            toast(t("repeatQueued", ["repeat": t("repeat_\(rep)")]), "↻")
        } else if remaining > 0 {
            toast(t("completed"), "✓", action: (t("undo"), { [weak self] in self?.dispatch { $0.toggleTask(id) } }))
        } else {
            let project = state.projects.first { $0.id == task.projectId }
            Sound.fanfare()
            if !state.reducedEffects { confetti += 1 }
            toast(t("folderComplete", ["name": project?.name ?? t("folder")]), "🎉")
        }
    }

    func remove(_ task: KTask) {
        let id = task.id
        dispatch { $0.deleteTask(id) }
        Sound.pop()
        toast(t("taskDeleted"), "🗑", action: (t("undo"), { [weak self] in self?.dispatch { $0.restoreTasks([id]) } }))
    }

    func newTaskDue(for view: Screen) -> String? {
        if view.type == "today" { return todayStr() }
        if view.type == "upcoming" { return addDaysStr(1) }
        switch state.settings["defaultDue"]?.string {
        case "today": return todayStr()
        case "tomorrow": return addDaysStr(1)
        default: return nil
        }
    }

    func parse(_ text: String) -> Parsed { parseQuickAdd(text, projects: state.projects.map { ($0.id, $0.name) }) }
}
