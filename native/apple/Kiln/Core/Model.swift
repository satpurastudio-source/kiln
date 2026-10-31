import Foundation

/// Records are JSON underneath (see JSON.swift); these give them names.
struct KTask: Identifiable, Equatable {
    var j: Item
    init(_ j: Item) { self.j = j }

    var id: String { j["id"]?.string ?? "" }
    var projectId: String { j["projectId"]?.string ?? "" }
    var title: String { j["title"]?.string ?? "" }
    var notes: String { j["notes"]?.string ?? "" }
    var priority: String { j["priority"]?.string ?? "none" }
    var due: String? { j["due"]?.string }
    var time: String? { j["time"]?.string.flatMap { $0.isEmpty ? nil : $0 } }
    var done: Bool { j["done"]?.boolean ?? false }
    var doneAt: Double? { j["doneAt"]?.number }
    var archived: Bool { j["archived"]?.boolean ?? false }
    var repeatKind: String { j["repeat"]?.string ?? "none" }
    var repeats: Bool { repeatKind != "none" }
    var pomos: Int { Int(j["pomos"]?.number ?? 0) }
    var createdAt: Double { j["createdAt"]?.number ?? 0 }
    var updatedAt: Double? { j["updatedAt"]?.number }
    var deletedAt: Double { j["deletedAt"]?.number ?? 0 }
    var nextId: String? { j["nextId"]?.string }
    var subs: [Sub] { (j["subs"]?.array ?? []).compactMap { $0.object.map(Sub.init) } }
}

struct Sub: Identifiable, Equatable {
    var j: Item
    init(_ j: Item) { self.j = j }
    init(text: String) { j = ["id": .str(uid()), "text": .str(text), "done": false] }
    var id: String { j["id"]?.string ?? "" }
    var text: String { j["text"]?.string ?? "" }
    var done: Bool { j["done"]?.boolean ?? false }
}

struct Project: Identifiable, Equatable {
    var j: Item
    init(_ j: Item) { self.j = j }
    var id: String { j["id"]?.string ?? "" }
    var name: String { j["name"]?.string ?? "" }
    var color: String { j["color"]?.string ?? "#d85a30" }
    var icon: String { j["icon"]?.string ?? "✦" }
}

struct Habit: Identifiable, Equatable {
    var j: Item
    init(_ j: Item) { self.j = j }
    var id: String { j["id"]?.string ?? "" }
    var name: String { j["name"]?.string ?? "" }
    var color: String { j["color"]?.string ?? "#d85a30" }
    var log: Item { j["log"]?.object ?? [:] }
    func done(on day: String) -> Bool { log[day]?.boolean ?? false }

    /// Consecutive days done, ending today (or yesterday if today isn't logged yet).
    var streak: Int {
        var d = parseDateStr(todayStr())
        if !done(on: toDateStr(d)) { d = d.addingDays(-1) }
        var n = 0
        while done(on: toDateStr(d)) {
            n += 1
            d = d.addingDays(-1)
        }
        return n
    }
}

struct Screen: Equatable {
    var type: String
    var projectId: String?
    var date: String?
    static let today = Screen(type: "today")

    init(type: String, projectId: String? = nil, date: String? = nil) {
        self.type = type
        self.projectId = projectId
        self.date = date
    }
    var json: JSON {
        var o: Item = ["type": .str(type), "projectId": projectId.json]
        if let date { o["date"] = .str(date) }
        return .obj(o)
    }
    var key: String { "\(type)-\(projectId ?? "")" }
}

private let RETIRED_SEED_TASKS: Set<String> = ["Review quarterly roadmap", "Ship the design system update", "Book weekend trip", "Call home"]
private let TUTORIAL_TITLES: Set<String> = [
    "Complete me — watch what happens ✨", "Hover me, then drag the ⋮⋮ grip to reorder",
    "Click me to edit notes, dates & priority", "Press N to add a task, / to search",
    "Open the command palette with Ctrl + K", "Finish every task in a project for a surprise 🎉",
]
private let COLOR_MIGRATION: [String: String] = [
    "#8b7cf8": "#d85a30", "#5ad1e6": "#5f7c8a", "#f472b6": "#8a5a7c", "#4ade80": "#7c8a4d",
    "#f5a54b": "#d9a441", "#f4536e": "#a03c1c", "#facc15": "#d9a441", "#60a5fa": "#5f7c8a",
]

/// The app's whole state and every way it changes — the reducer in store.jsx.
struct AppState: Equatable {
    var projects: [Project] = []
    var tasks: [KTask] = []
    var habits: [Habit] = []
    var stats: Item = ["days": .obj([:]), "pomos": 0]
    var trash: [KTask] = []
    var theme = "light"
    var sound = true
    var view = Screen.today
    var profile: Item?
    var settings: Item = DEFAULT_SETTINGS
    var onboarded = false
    var replayTour = false

    // MARK: seed / load / save

    static func seed() -> AppState {
        var s = AppState()
        let p1: Item = ["id": .str(uid()), "name": "Getting Started", "color": "#d85a30", "icon": "✦"]
        let p2: Item = ["id": .str(uid()), "name": "Work", "color": "#5f7c8a", "icon": "◆"]
        let p3: Item = ["id": .str(uid()), "name": "Personal", "color": "#8a5a7c", "icon": "❋"]
        func task(_ title: String, _ extra: Item = [:]) -> KTask {
            var o: Item = ["id": .str(uid()), "projectId": p1["id"]!, "title": .str(title), "notes": "", "priority": "none",
                           "due": nil, "done": false, "doneAt": nil, "createdAt": .num(Clock.ms)]
            o.merge(extra) { _, new in new }
            return KTask(o)
        }
        s.projects = [p1, p2, p3].map(Project.init)
        s.tasks = [
            task("Tap the circle to complete me — watch what happens ✨", ["priority": "high"]),
            task("Drag the ⋮⋮ grip to reorder me"),
            task("Tap me to edit notes, dates, time & priority", ["priority": "medium", "notes": "Everything is editable inline. Try moving me to another folder."]),
            task("Add a task using the bar above"),
            task("Explore Calendar, Focus & the ⚙ Settings menu", ["priority": "low"]),
            task("Finish every task in a folder for a surprise 🎉"),
        ]
        return s
    }

    private static func cleanTask(_ t: Item) -> KTask {
        var o = t
        for (k, v) in ["notes": JSON.str(""), "priority": "none", "due": nil, "done": false] where o[k] == nil { o[k] = v }
        if o["title"]?.string == nil { o["title"] = .str("") }
        return KTask(o)
    }

    private static func stripTutorialDues(_ tasks: [KTask]) -> [KTask] {
        tasks.map { t in
            guard t.due != nil, TUTORIAL_TITLES.contains(t.title) else { return t }
            var t = t
            t.j["due"] = JSON.null
            return t
        }
    }

    /// nil means the data can't be read as kiln's, and the caller parks a copy.
    static func decode(_ data: JSON) -> AppState? {
        guard let rawProjects = data["projects"]?.array, let rawTasks = data["tasks"]?.array else { return nil }
        var s = AppState()
        let seedV = data["seedV"]?.number ?? 1
        var tasks = rawTasks.compactMap(\.object).filter { $0["id"]?.string != nil }.map(cleanTask)
        if seedV < 2 { tasks = tasks.filter { !RETIRED_SEED_TASKS.contains($0.title) } }
        if seedV < 3 { tasks = stripTutorialDues(tasks) }
        s.tasks = tasks
        s.projects = rawProjects.compactMap(\.object).map { p in
            var p = p
            if let c = p["color"]?.string, let m = COLOR_MIGRATION[c] { p["color"] = .str(m) }
            return Project(p)
        }
        s.habits = (data["habits"]?.array ?? []).compactMap(\.object).map(Habit.init)
        // backfill the completion log once from existing done tasks (older saves)
        if let st = data["stats"]?.object, st["days"] != nil { s.stats = st } else { s.stats = buildStats(tasks) }
        let now = Clock.ms
        s.trash = (data["trash"]?.array ?? []).compactMap(\.object).map(KTask.init).filter { now - $0.deletedAt < TRASH_TTL }
        s.theme = data["theme"]?.string ?? "light"
        s.sound = data["sound"]?.boolean ?? true
        let profile = data["profile"]?.object
        s.profile = profile
        var settings = DEFAULT_SETTINGS
        settings.merge(data["settings"]?.object ?? [:]) { _, new in new }
        s.settings = settings
        // anyone who already has a profile has clearly used the app before
        s.onboarded = data["onboarded"]?.boolean ?? (profile != nil)
        var view = Screen.today
        if let v = data["view"]?.object, let type = v["type"]?.string {
            view = Screen(type: type, projectId: v["projectId"]?.string, date: v["date"]?.string)
        }
        s.view = s.sanitized(view)
        return s
    }

    /// Same shape as the web app's `zenith-v1` localStorage value.
    var encoded: JSON {
        .obj([
            "projects": .arr(projects.map { .obj($0.j) }),
            "tasks": .arr(tasks.map { .obj($0.j) }),
            "habits": .arr(habits.map { .obj($0.j) }),
            "stats": .obj(stats),
            "trash": .arr(trash.map { .obj($0.j) }),
            "theme": .str(theme),
            "sound": .bool(sound),
            "view": view.json,
            "profile": profile.map(JSON.obj) ?? .null,
            "settings": .obj(settings),
            "onboarded": .bool(onboarded),
            "seedV": 3,
        ])
    }

    var snapshot: Snapshot {
        Snapshot(projects: projects.map(\.j), tasks: tasks.map(\.j), habits: habits.map(\.j), seedV: 3)
    }

    func sanitized(_ v: Screen, projects list: [Project]? = nil) -> Screen {
        if v.type == "project", !(list ?? projects).contains(where: { $0.id == v.projectId }) { return .today }
        return v
    }

    // MARK: settings

    func setting(_ k: String) -> JSON? { settings[k] }
    var reducedEffects: Bool { settings["reducedEffects"]?.boolean ?? false }
    var textScale: Double {
        let v = settings["textScale"]?.number ?? 1
        return min(TEXT_SCALE.max, max(TEXT_SCALE.min, v))
    }
    var ambient: Item {
        var c = AMBIENT_DEFAULTS
        c.merge(settings["ambient"]?.object ?? [:]) { _, new in new }
        return c
    }
    var language: String { I18n.resolve(settings["language"]?.string) }

    // MARK: completion log

    private static func record(_ stats: Item, _ ds: String, _ pid: String?, _ hour: Int, _ delta: Double) -> Item {
        var s = stats
        var days = s["days"]?.object ?? [:]
        if delta < 0 && days[ds] == nil { return stats }
        var day = days[ds]?.object ?? ["done": 0, "folders": .obj([:]), "hours": .obj([:])]
        day["done"] = .num(max(0, (day["done"]?.number ?? 0) + delta))
        var folders = day["folders"]?.object ?? [:]
        if let pid, !pid.isEmpty, delta > 0 || (folders[pid]?.number ?? 0) > 0 {
            folders[pid] = .num(max(0, (folders[pid]?.number ?? 0) + delta))
        }
        day["folders"] = .obj(folders)
        var hours = day["hours"]?.object ?? [:]
        let key = String(hour)
        if delta > 0 || (hours[key]?.number ?? 0) > 0 { hours[key] = .num(max(0, (hours[key]?.number ?? 0) + delta)) }
        day["hours"] = .obj(hours)
        days[ds] = .obj(day)
        s["days"] = .obj(days)
        return s
    }

    private static func buildStats(_ tasks: [KTask]) -> Item {
        var stats: Item = ["days": .obj([:]), "pomos": 0]
        for t in tasks {
            if t.done, let at = t.doneAt {
                let d = Date(timeIntervalSince1970: at / 1000)
                stats = record(stats, toDateStr(d), t.projectId, d.hour, 1)
            }
            stats["pomos"] = .num((stats["pomos"]?.number ?? 0) + Double(t.pomos))
        }
        return stats
    }

    // MARK: actions

    private func stamped(_ j: Item) -> Item {
        var j = j
        j["updatedAt"] = .num(Clock.ms)
        return j
    }

    private func newFolder(_ list: [Project], name: String) -> Project {
        let n = list.count
        return Project(["id": .str(uid()), "name": .str(name), "color": .str(PROJECT_COLORS[n % PROJECT_COLORS.count]), "icon": .str(PROJECT_ICONS[n % PROJECT_ICONS.count])])
    }

    /// Its own folder if it still exists, else the first folder, else a fresh Inbox.
    private mutating func home(_ projectId: String?) -> String {
        if projects.contains(where: { $0.id == projectId }) { return projectId! }
        if let first = projects.first { return first.id }
        let inbox = newFolder(projects, name: t("inbox"))
        projects = [inbox]
        return inbox.id
    }

    mutating func addTask(title: String, projectId: String?, due: String?, time: String?, priority: String?, newFolder folder: String? = nil) {
        let clean = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.isEmpty { return }
        var pid = home(projectId)
        if let name = folder?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            let f = newFolder(projects, name: name)
            projects.append(f)
            pid = f.id
        }
        let now = Clock.ms
        let task: Item = ["id": .str(uid()), "projectId": .str(pid), "title": .str(clean), "notes": "",
                          "priority": .str(priority ?? "none"), "due": due.json, "time": (time?.isEmpty == false ? time : nil).json,
                          "done": false, "doneAt": nil, "createdAt": .num(now), "updatedAt": .num(now)]
        tasks.insert(KTask(task), at: 0)
    }

    mutating func toggleTask(_ id: String) {
        guard let target = tasks.first(where: { $0.id == id }) else { return }
        let completing = !target.done
        let repeats = completing && target.repeats
        let nextId = repeats ? uid() : nil
        // un-completing a repeating task by mistake takes back the occurrence it
        // spawned (if untouched) and makes it repeat again — no duplicates
        let spawned = !completing ? target.nextId.flatMap { n in tasks.first { $0.id == n } } : nil
        let takeBack = spawned.map { !$0.done && $0.updatedAt == $0.createdAt } ?? false
        var list = tasks.filter { !(takeBack && $0.id == spawned?.id) }
        for i in list.indices where list[i].id == id {
            var j = list[i].j
            if completing {
                j["done"] = true
                j["doneAt"] = .num(Clock.ms)
                // completed copy stops repeating so un-toggling can't double-spawn
                if repeats {
                    j["repeat"] = "none"
                    j["repeatWas"] = .str(target.repeatKind)
                    j["nextId"] = .str(nextId!)
                }
            } else {
                let was = j["repeatWas"]
                j["repeatWas"] = nil
                j["nextId"] = nil
                j["done"] = false
                j["doneAt"] = JSON.null
                if takeBack { if let was { j["repeat"] = was } else { j["repeat"] = nil } }
            }
            list[i].j = stamped(j)
        }
        // repeating task: completing it forges the next occurrence
        if repeats {
            let now = Clock.ms
            var next = target.j
            next["repeatWas"] = nil
            next["nextId"] = nil
            next["id"] = .str(nextId!)
            next["done"] = false
            next["doneAt"] = JSON.null
            next["createdAt"] = .num(now)
            next["updatedAt"] = .num(now)
            next["due"] = .str(nextDue(target.due, target.repeatKind))
            next["pomos"] = 0
            next["subs"] = .arr(target.subs.map { s in
                var s = s.j
                s["done"] = false
                return .obj(s)
            })
            list.insert(KTask(next), at: 0)
        }
        tasks = list
        // record into the persistent log so Insights outlive the task itself
        if completing {
            let now = Clock.now
            stats = Self.record(stats, toDateStr(now), target.projectId, now.hour, 1)
        } else if let at = target.doneAt {
            let d = Date(timeIntervalSince1970: at / 1000)
            stats = Self.record(stats, toDateStr(d), target.projectId, d.hour, -1)
        }
    }

    mutating func updateTask(_ id: String, _ patch: Item) {
        guard let i = tasks.firstIndex(where: { $0.id == id }) else { return }
        var j = tasks[i].j
        j.merge(patch) { _, new in new }
        tasks[i].j = stamped(j)
    }

    mutating func deleteTask(_ id: String) { deleteTasks([id]) }

    mutating func deleteTasks(_ ids: [String]) {
        let set = Set(ids)
        let now = Clock.ms
        let removed = tasks.filter { set.contains($0.id) }.map { t -> KTask in
            var t = t
            t.j["deletedAt"] = .num(now)
            return t
        }
        tasks.removeAll { set.contains($0.id) }
        trash = removed + trash
    }

    mutating func restoreTasks(_ ids: [String]) {
        let set = Set(ids)
        let items = trash.filter { set.contains($0.id) }
        if items.isEmpty { return }
        let restored = items.map { item -> KTask in
            var j = item.j
            j["deletedAt"] = nil
            // its folder may have been deleted since — rehome instead of orphaning
            j["projectId"] = .str(home(item.projectId))
            return KTask(stamped(j))
        }
        tasks = restored + tasks.filter { !set.contains($0.id) }
        trash.removeAll { set.contains($0.id) }
    }

    mutating func restoreTrash(_ items: [KTask]) {
        let have = Set(trash.map(\.id))
        trash += items.filter { !have.contains($0.id) }
    }

    /// One id → delete forever; no id → drop everything past its TTL window.
    mutating func purgeTrash(_ id: String? = nil) {
        if let id { trash.removeAll { $0.id == id }; return }
        let now = Clock.ms
        trash.removeAll { now - $0.deletedAt >= TRASH_TTL }
    }

    /// `ids` = visible active task ids in their new order. Slots that held one of
    /// these ids get refilled in the new sequence; everything else stays put.
    mutating func reorderTasks(_ ids: [String]) {
        let set = Set(ids)
        let byId = Dictionary(tasks.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var queue = ids[...]
        tasks = tasks.map { t in
            guard set.contains(t.id), let next = queue.popFirst(), let v = byId[next] else { return t }
            return v
        }
    }

    mutating func addProject(name: String, color: String, icon: String) {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.isEmpty { return }
        let p = Project(["id": .str(uid()), "name": .str(clean), "color": .str(color), "icon": .str(icon)])
        projects.append(p)
        view = Screen(type: "project", projectId: p.id)
    }

    mutating func updateProject(_ id: String, _ patch: Item) {
        guard let i = projects.firstIndex(where: { $0.id == id }) else { return }
        var j = projects[i].j
        j.merge(patch) { _, new in new }
        projects[i].j = stamped(j)
    }

    mutating func setProjects(_ list: [Project]) {
        if list.isEmpty { return }
        projects = list
        view = sanitized(view)
    }

    /// The folder's tasks go to the trash (recoverable), never straight to oblivion.
    mutating func deleteProject(_ id: String) {
        if view.type == "project" && view.projectId == id { view = .today }
        projects.removeAll { $0.id == id }
        deleteTasks(tasks.filter { $0.projectId == id }.map(\.id))
    }

    /// Undo a folder delete: the folder back in its old slot, its tasks out of the trash.
    mutating func restoreProject(_ project: Project, index: Int, taskIds: [String]) {
        if projects.contains(where: { $0.id == project.id }) { return }
        projects.insert(project, at: min(index, projects.count))
        let set = Set(taskIds)
        let back = trash.filter { set.contains($0.id) }.map { t -> KTask in
            var t = t
            t.j["deletedAt"] = nil
            return t
        }
        tasks = back + tasks
        trash.removeAll { set.contains($0.id) }
    }

    mutating func addHabit(name: String, color: String) {
        habits.append(Habit(["id": .str(uid()), "name": .str(name.trimmingCharacters(in: .whitespacesAndNewlines)), "color": .str(color), "createdAt": .num(Clock.ms), "log": .obj([:])]))
    }

    mutating func toggleHabit(_ id: String, date: String = todayStr()) {
        guard let i = habits.firstIndex(where: { $0.id == id }) else { return }
        var log = habits[i].log
        if log[date]?.boolean == true { log[date] = nil } else { log[date] = true }
        var j = habits[i].j
        j["log"] = .obj(log)
        habits[i].j = stamped(j)
    }

    mutating func logFocus() { stats["pomos"] = .num((stats["pomos"]?.number ?? 0) + 1) }

    mutating func setSettings(_ patch: Item) { settings.merge(patch) { _, new in new } }

    mutating func setAmbient(_ patch: Item) {
        var a = settings["ambient"]?.object ?? [:]
        a.merge(patch) { _, new in new }
        settings["ambient"] = .obj(a)
    }

    /// A deliberate sign-out: clear this person's tasks off the device, keep look & feel.
    mutating func resetContent() {
        let fresh = AppState.seed()
        projects = fresh.projects
        tasks = fresh.tasks
        habits = []
        trash = []
        stats = fresh.stats
        view = fresh.view
        profile = nil
    }

    /// Replace local projects/tasks/habits with a cloud copy (or a backup).
    mutating func hydrate(_ s: Snapshot, hasHabits: Bool = true) {
        projects = s.projects.map(Project.init)
        var list = s.tasks.filter { $0["id"]?.string != nil }.map(Self.cleanTask)
        if s.seedV < 3 { list = Self.stripTutorialDues(list) }
        tasks = list
        if hasHabits { habits = s.habits.map(Habit.init) }
        view = sanitized(view)
    }

    // MARK: selectors

    static func inView(due: String?, projectId: String, view: Screen) -> Bool {
        switch view.type {
        case "today": return isToday(due) || isOverdue(due)
        case "upcoming", "calendar": return due != nil
        case "project": return projectId == view.projectId
        default: return true
        }
    }

    private func matches(_ t: KTask, _ query: String) -> Bool {
        if query.isEmpty { return true }
        let q = query.lowercased()
        return t.title.lowercased().contains(q) || t.notes.lowercased().contains(q) || t.subs.contains { $0.text.lowercased().contains(q) }
    }

    func active(query: String = "") -> [KTask] {
        tasks.filter { !$0.done && !$0.archived && Self.inView(due: $0.due, projectId: $0.projectId, view: view) && matches($0, query) }
    }

    func completed(query: String = "") -> [KTask] {
        tasks.filter { t in
            guard t.done, !t.archived, Self.inView(due: t.due, projectId: t.projectId, view: view), matches(t, query) else { return false }
            if view.type != "today" { return true }
            return t.doneAt.map { sameDay($0, Clock.now) } ?? false
        }.sorted { ($0.doneAt ?? 0) > ($1.doneAt ?? 0) }
    }

    func projectProgress(_ id: String) -> (total: Int, done: Int, pct: Int) {
        let list = tasks.filter { $0.projectId == id && !$0.archived }
        if list.isEmpty { return (0, 0, 0) }
        let done = list.filter(\.done).count
        return (list.count, done, Int((Double(done) / Double(list.count) * 100).rounded()))
    }

    var todayProgress: (active: Int, done: Int, total: Int, pct: Int) {
        let active = tasks.filter { !$0.done && !$0.archived && (isToday($0.due) || isOverdue($0.due)) }.count
        let done = tasks.filter { t in t.done && !t.archived && (t.doneAt.map { sameDay($0, Clock.now) } ?? false) }.count
        let total = active + done
        return (active, done, total, total == 0 ? 0 : Int((Double(done) / Double(total) * 100).rounded()))
    }

    struct InsightDay: Identifiable { let ds: String, label: String, count: Int; var id: String { ds } }
    struct Insights {
        var days: [InsightDay], totalWeek: Int, byFolder: [(name: String, color: String, count: Int)]
        var bestHour: Int?, bestDay: InsightDay, totalPomos: Int, streak: Int, maxDay: Int
    }

    var insights: Insights {
        let log = stats["days"]?.object ?? [:]
        func done(_ ds: String) -> Int { Int(log[ds]?["done"]?.number ?? 0) }
        let days = (0...6).reversed().map { i -> InsightDay in
            let d = Clock.now.addingDays(-i)
            return InsightDay(ds: toDateStr(d), label: fmtDate(d, "EEE"), count: done(toDateStr(d)))
        }
        var folderCount: [String: Int] = [:]
        for day in days {
            for (pid, n) in log[day.ds]?["folders"]?.object ?? [:] { folderCount[pid, default: 0] += Int(n.number ?? 0) }
        }
        let byFolder = projects.map { (name: $0.name, color: $0.color, count: folderCount[$0.id] ?? 0) }
            .filter { $0.count > 0 }.sorted { $0.count > $1.count }
        var hours = Array(repeating: 0, count: 24)
        for (_, day) in log {
            for (k, n) in day["hours"]?.object ?? [:] {
                if let h = Int(k), hours.indices.contains(h) { hours[h] += Int(n.number ?? 0) }
            }
        }
        let peak = hours.max() ?? 0
        let bestHour = peak > 0 ? hours.firstIndex(of: peak) : nil
        var d = Clock.now
        if done(toDateStr(d)) == 0 { d = d.addingDays(-1) }
        var streak = 0
        while done(toDateStr(d)) > 0 {
            streak += 1
            d = d.addingDays(-1)
        }
        let bestDay = days.dropFirst().reduce(days[0]) { $1.count > $0.count ? $1 : $0 }
        return Insights(days: days, totalWeek: days.reduce(0) { $0 + $1.count }, byFolder: byFolder, bestHour: bestHour, bestDay: bestDay,
                        totalPomos: Int(stats["pomos"]?.number ?? 0), streak: streak, maxDay: max(1, days.map(\.count).max() ?? 1))
    }

    func groupUpcoming(_ list: [KTask]) -> [(id: String, label: String, tasks: [KTask])] {
        var buckets: [(id: String, label: String, tasks: [KTask])] = [
            ("overdue", t("overdue"), []), ("today", t("today"), []), ("tomorrow", t("tomorrow"), []),
            ("week", t("next7days"), []), ("later", t("later"), []),
        ]
        let week = addDaysStr(7), today = todayStr(), tomorrow = addDaysStr(1)
        for x in list {
            let due = x.due ?? ""
            if isOverdue(due) { buckets[0].tasks.append(x) }
            else if due == today { buckets[1].tasks.append(x) }
            else if due == tomorrow { buckets[2].tasks.append(x) }
            else if due <= week { buckets[3].tasks.append(x) }
            else { buckets[4].tasks.append(x) }
        }
        for i in buckets.indices {
            buckets[i].tasks.sort { a, b in
                let ad = a.due ?? "", bd = b.due ?? ""
                if ad != bd { return ad < bd }
                return (priorityRank[a.priority] ?? 3) < (priorityRank[b.priority] ?? 3)
            }
        }
        return buckets.filter { !$0.tasks.isEmpty }
    }

    func emberMood(focus: FocusSession?, now: Date = Clock.now) -> String {
        if let focus, focus.remaining == nil, focus.phase == "work" { return "focus" }
        let nowMs = now.timeIntervalSince1970 * 1000
        if tasks.contains(where: { $0.done && ($0.doneAt.map { nowMs - $0 < 8000 } ?? false) }) { return "celebrate" }
        if tasks.filter({ !$0.done && !$0.archived && isOverdue($0.due) }).count >= 3 { return "worried" }
        let p = todayProgress
        if p.total > 0 && p.active == 0 { return "proud" }
        let start = Int(ambient["nightStart"]?.number ?? 23), end = Int(ambient["nightEnd"]?.number ?? 6)
        if isNightHour(now, start, end) || p.total == 0 { return "sleepy" }
        return "idle"
    }
}

/// start > end wraps past midnight (e.g. 23 → 6).
func isNightHour(_ now: Date, _ start: Int, _ end: Int) -> Bool {
    let h = now.hour
    if start == end { return false }
    return start > end ? (h >= start || h < end) : (h >= start && h < end)
}

/// Mirrors the web's kiln-focus value. remaining == nil means running.
struct FocusSession: Equatable, Codable {
    var taskId: String
    var mode: String
    var phase: String
    var endsAt: Double
    var remaining: Double?
    var count: Int
}

func focusDurations(_ id: String, _ settings: Item) -> (work: Int, brk: Int, label: String) {
    func clampMin(_ n: Double?, _ hi: Int) -> Int { min(hi, max(1, Int((n ?? 1).rounded()))) }
    switch id {
    case "deep": return (50 * 60, 10 * 60, "50 · 10")
    case "custom":
        let w = clampMin(settings["focusWork"]?.number, 180), b = clampMin(settings["focusBreak"]?.number, 60)
        return (w * 60, b * 60, "\(w) · \(b)")
    default: return (25 * 60, 5 * 60, "25 · 5")
    }
}

/// Validate a backup file: projects, tasks and habits, or a readable reason.
struct BackupError: Error { let message: String }

func parseBackup(_ data: Data) throws -> Snapshot {
    guard let json = JSON.parse(data) else { throw BackupError(message: t("backupNotJson")) }
    guard let rp = json["projects"]?.array, let rt = json["tasks"]?.array else { throw BackupError(message: t("backupNotKiln")) }
    let projects = rp.compactMap(\.object).filter { truthy($0["id"]) && truthy($0["name"]) }
    if projects.isEmpty { throw BackupError(message: t("backupNoFolders")) }
    let ids = Set(projects.compactMap { $0["id"]?.string })
    let tasks = rt.compactMap(\.object).filter { truthy($0["id"]) && $0["title"]?.string != nil }.map { t -> Item in
        var t = t
        if !ids.contains(t["projectId"]?.string ?? "") { t["projectId"] = projects[0]["id"] }
        return t
    }
    let habits = (json["habits"]?.array ?? []).compactMap(\.object).filter { truthy($0["id"]) }
    return Snapshot(projects: projects, tasks: tasks, habits: habits, seedV: 3)
}

private func truthy(_ v: JSON?) -> Bool {
    switch v {
    case .none, .some(.null): return false
    case .some(.str(let s)): return !s.isEmpty
    case .some(.bool(let b)): return b
    case .some(.num(let n)): return n != 0
    default: return true
    }
}

func backupFile(_ s: AppState) -> Data {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return JSON.obj([
        "app": "kiln", "version": 1, "exportedAt": .str(f.string(from: Clock.now)),
        "projects": .arr(s.projects.map { .obj($0.j) }),
        "tasks": .arr(s.tasks.map { .obj($0.j) }),
        "habits": .arr(s.habits.map { .obj($0.j) }),
    ]).data
}
