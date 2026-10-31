import XCTest
@testable import KilnCore

final class StateTests: XCTestCase {
    override func setUp() { Clock.override = makeDate(2026, 9, 31, 10, 30) }
    override func tearDown() { Clock.override = nil }

    private func state(_ tasks: [Item] = [], projects: [Item] = [["id": "p", "name": "P"]]) -> AppState {
        var s = AppState()
        s.projects = projects.map(Project.init)
        s.tasks = tasks.map(KTask.init)
        return s
    }

    func testRepeatSpawnsThenUndoTakesItBack() {
        var s = state([["id": "t", "projectId": "p", "title": "x", "repeat": "weekly", "due": "2026-10-26", "done": false, "pomos": 3,
                        "subs": .arr([.obj(["id": "s", "text": "a", "done": true])])]])
        s.toggleTask("t")
        XCTAssertEqual(s.tasks.count, 2)
        let next = s.tasks[0], old = s.tasks[1]
        XCTAssertEqual(next.due, "2026-11-02")
        XCTAssertFalse(next.done)
        XCTAssertEqual(next.pomos, 0)
        XCTAssertFalse(next.subs[0].done)
        XCTAssertEqual(next.repeatKind, "weekly")
        XCTAssertEqual(old.repeatKind, "none")
        XCTAssertEqual(old.nextId, next.id)
        XCTAssertEqual(s.insights.days.last?.count, 1)

        s.toggleTask("t")
        XCTAssertEqual(s.tasks.map(\.id), ["t"])
        XCTAssertEqual(s.tasks[0].repeatKind, "weekly")
        XCTAssertNil(s.tasks[0].j["nextId"])
        XCTAssertEqual(s.insights.days.last?.count, 0)
    }

    func testEditedNextOccurrenceIsKeptOnUndo() {
        var s = state([["id": "t", "projectId": "p", "title": "x", "repeat": "daily", "due": "2026-10-31", "done": false]])
        s.toggleTask("t")
        let nextId = s.tasks[0].id
        Clock.override = makeDate(2026, 9, 31, 10, 31)
        s.updateTask(nextId, ["title": "edited"])
        s.toggleTask("t")
        XCTAssertEqual(s.tasks.count, 2)
    }

    func testTrashRoundTripAndRehome() {
        var s = state([["id": "t", "projectId": "gone", "title": "x", "done": false]], projects: [["id": "p", "name": "P"]])
        s.deleteTask("t")
        XCTAssertTrue(s.tasks.isEmpty)
        XCTAssertEqual(s.trash[0].deletedAt, Clock.ms)
        s.restoreTasks(["t"])
        XCTAssertEqual(s.tasks[0].projectId, "p")
        XCTAssertNil(s.tasks[0].j["deletedAt"])
        XCTAssertTrue(s.trash.isEmpty)
    }

    func testPurgeOnlyExpired() {
        var s = state()
        s.trash = [KTask(["id": "old", "deletedAt": .num(Clock.ms - TRASH_TTL - 1)]), KTask(["id": "new", "deletedAt": .num(Clock.ms - 5)])]
        s.purgeTrash()
        XCTAssertEqual(s.trash.map(\.id), ["new"])
    }

    func testReorderKeepsOtherSlots() {
        var s = state(["a", "b", "c", "d"].map { ["id": .str($0), "projectId": "p", "title": .str($0), "done": false] })
        s.reorderTasks(["c", "a"])
        XCTAssertEqual(s.tasks.map(\.id), ["c", "b", "a", "d"])
    }

    func testDeleteFolderAndUndo() {
        var s = state([["id": "t", "projectId": "p", "title": "x", "done": false]], projects: [["id": "p", "name": "P"], ["id": "q", "name": "Q"]])
        s.view = Screen(type: "project", projectId: "p")
        let folder = s.projects[0]
        s.deleteProject("p")
        XCTAssertEqual(s.view.type, "today")
        XCTAssertEqual(s.trash.count, 1)
        s.restoreProject(folder, index: 0, taskIds: ["t"])
        XCTAssertEqual(s.projects.map(\.id), ["p", "q"])
        XCTAssertEqual(s.tasks.map(\.id), ["t"])
    }

    func testAddTaskCreatesInboxWhenNoFolders() {
        I18n.lang = "en"
        var s = state(projects: [])
        s.addTask(title: " hi ", projectId: nil, due: nil, time: nil, priority: nil)
        XCTAssertEqual(s.projects.count, 1)
        XCTAssertEqual(s.tasks[0].projectId, s.projects[0].id)
        XCTAssertEqual(s.tasks[0].title, "hi")
    }

    func testWebStateRoundTripKeepsUnknownFields() throws {
        let web = """
        {"projects":[{"id":"p","name":"P","color":"#8b7cf8","icon":"✦","future":1}],
         "tasks":[{"id":"t","projectId":"p","title":"x","done":false,"newField":{"a":[1]}}],
         "habits":[],"stats":{"days":{},"pomos":2},"trash":[],"theme":"dark","sound":false,
         "view":{"type":"project","projectId":"gone"},"profile":{"name":"A"},"settings":{"accent":"sage","language":"hi"},"seedV":3}
        """
        let s = try XCTUnwrap(AppState.decode(XCTUnwrap(JSON.parse(web))))
        XCTAssertEqual(s.view.type, "today")
        XCTAssertEqual(s.projects[0].color, "#d85a30") // migrated from the old violet theme
        XCTAssertEqual(s.settings["accent"], "sage")
        XCTAssertEqual(s.settings["focusWork"], 25) // defaulted
        XCTAssertTrue(s.onboarded)
        XCTAssertEqual(s.encoded["tasks"]?.array?[0]["newField"], .obj(["a": .arr([1])]))
        XCTAssertEqual(s.encoded["projects"]?.array?[0]["future"], 1)
        XCTAssertNil(AppState.decode(.obj(["tasks": .arr([])])))
    }

    func testInsightsStreak() {
        var s = state([["id": "t", "projectId": "p", "title": "x", "done": false]])
        s.stats = ["days": .obj([
            "2026-10-30": .obj(["done": 2, "folders": .obj(["p": 2]), "hours": .obj(["9": 2])]),
            "2026-10-29": .obj(["done": 1, "folders": .obj(["p": 1]), "hours": .obj(["14": 1])]),
        ]), "pomos": 4]
        let i = s.insights
        XCTAssertEqual(i.streak, 2)
        XCTAssertEqual(i.totalWeek, 3)
        XCTAssertEqual(i.bestHour, 9)
        XCTAssertEqual(i.totalPomos, 4)
        XCTAssertEqual(i.byFolder.first?.count, 3)
    }

    func testReminderPlan() {
        I18n.lang = "en"
        let tasks = [
            KTask(["id": "a", "title": "soon", "due": "2026-10-31", "time": "18:00", "done": false]),
            KTask(["id": "b", "title": "past", "due": "2026-10-31", "time": "08:00", "done": false]),
            KTask(["id": "c", "title": "done", "due": "2026-11-01", "time": "08:00", "done": true]),
            KTask(["id": "d", "title": "tomorrow", "due": "2026-11-01", "done": false]),
        ]
        let plan = planReminders(tasks)
        XCTAssertEqual(plan.map(\.title), ["soon", "kiln"])
        XCTAssertEqual(plan[0].id, reminderId("a"))
        XCTAssertEqual(plan[1].id, DIGEST_ID + 1) // today's 9:00 already passed
        XCTAssertEqual(plan[1].at, makeDate(2026, 10, 1, 9, 0))
    }

    func testReminderIdMatchesJS() {
        // h = (h * 31 + c) | 0 ; 10000 + abs(h) % 2e9
        XCTAssertEqual(reminderId("abc"), 10000 + 96354)
        XCTAssertEqual(reminderId("mkq8r2z1a2b3c"), Int32(10000 + (abs(Int64(jsHash("mkq8r2z1a2b3c"))) % 2_000_000_000)))
    }

    private func jsHash(_ s: String) -> Int32 {
        var h: Int32 = 0
        for u in s.utf16 { h = h &* 31 &+ Int32(u) }
        return h
    }
}

/// A cloud that can be raced: `other` writes as a second device would.
@MainActor
final class FakeCloud: CloudTransport {
    var row: (data: JSON, at: String)?
    var failNext = false
    var beforeWrite: (() -> Void)?
    private var n = 0
    private func stamp() -> String {
        n += 1
        return "cloud-\(n)"
    }

    func other(_ s: Snapshot) { row = (s.json, stamp()) }

    func pull(userId: String) async throws -> (data: JSON, at: String?)? {
        if failNext { failNext = false; throw CloudError(message: "offline", isNetwork: true) }
        return row.map { ($0.data, $0.at) }
    }

    func update(userId: String, data: JSON, at: String, ifAt: String) async throws -> String? {
        if failNext { failNext = false; throw CloudError(message: "offline", isNetwork: true) }
        beforeWrite?()
        beforeWrite = nil
        guard row?.at == ifAt else { return nil }
        let a = stamp()
        row = (data, a)
        return a
    }

    func insert(userId: String, data: JSON, at: String) async throws -> String? {
        beforeWrite?()
        beforeWrite = nil
        if row != nil { return nil }
        let a = stamp()
        row = (data, a)
        return a
    }

    func upsert(userId: String, data: JSON, at: String) async throws { row = (data, stamp()) }
}

final class MemoryBase: BaseStore {
    var saved: (at: String?, data: Snapshot)?
    func read(userId: String) -> (at: String?, data: Snapshot)? { saved }
    func write(userId: String, at: String?, data: Snapshot) { saved = (at, data) }
}

@MainActor
final class SyncTests: XCTestCase {
    private func task(_ id: String, _ extra: Item = [:]) -> Item {
        var t: Item = ["id": .str(id), "projectId": "p", "title": .str(id), "done": false, "updatedAt": 1]
        t.merge(extra) { _, n in n }
        return t
    }
    private let folder: [Item] = [["id": "p", "name": "P"]]
    private func snap(_ tasks: [Item]) -> Snapshot { Snapshot(projects: folder, tasks: tasks) }

    private func engine(_ cloud: FakeCloud, _ base: MemoryBase, local: @escaping () -> Snapshot, set: @escaping (Snapshot) -> Void, status: @escaping (SyncEngine.Status) -> Void = { _ in }) -> SyncEngine {
        SyncEngine(userId: "u", cloud: cloud, baseStore: base, getLocal: local, applyRemote: set, onStatus: status, retryDelays: [0.01])
    }

    func testFirstSyncAdoptsCloud() async {
        let cloud = FakeCloud(), base = MemoryBase()
        cloud.other(snap([task("c")]))
        var local = snap([task("seed")])
        let e = engine(cloud, base, local: { local }, set: { local = $0 })
        await e.start()
        XCTAssertEqual(local.tasks.map { $0["id"]?.string }, ["c"])
        XCTAssertFalse(e.pending)
    }

    func testNewAccountAdoptsLocal() async {
        let cloud = FakeCloud(), base = MemoryBase()
        var local = snap([task("mine")])
        var last = SyncEngine.Status.idle
        let e = engine(cloud, base, local: { local }, set: { local = $0 }, status: { last = $0 })
        await e.start()
        XCTAssertEqual(Snapshot(json: cloud.row?.data).tasks.map { $0["id"]?.string }, ["mine"])
        XCTAssertEqual(last, .synced)
        XCTAssertEqual(base.saved?.at, cloud.row?.at)
    }

    func testOfflineEditsSurviveRestartAndMerge() async {
        let cloud = FakeCloud(), base = MemoryBase()
        cloud.other(snap([task("a")]))
        var local = Snapshot()
        var e = engine(cloud, base, local: { local }, set: { local = $0 })
        await e.start()
        e.stop()
        // offline here, another device adds a task, then the app restarts
        local.tasks.append(task("mine"))
        cloud.other(snap([task("a"), task("theirs")]))
        e = engine(cloud, base, local: { local }, set: { local = $0 })
        await e.start()
        XCTAssertEqual(Set(local.tasks.compactMap { $0["id"]?.string }), ["a", "mine", "theirs"])
        XCTAssertEqual(Set(Snapshot(json: cloud.row?.data).tasks.compactMap { $0["id"]?.string }), ["a", "mine", "theirs"])
    }

    func testPushLosingARaceMergesInsteadOfOverwriting() async {
        let cloud = FakeCloud(), base = MemoryBase()
        cloud.other(snap([task("a")]))
        var local = Snapshot()
        let e = engine(cloud, base, local: { local }, set: { local = $0 })
        await e.start()
        local.tasks.append(task("mine"))
        cloud.beforeWrite = { cloud.other(self.snap([self.task("a"), self.task("theirs")])) }
        await e.push()
        XCTAssertEqual(Set(Snapshot(json: cloud.row?.data).tasks.compactMap { $0["id"]?.string }), ["a", "mine", "theirs"])
        XCTAssertFalse(e.pending)
    }

    func testOwnEchoIsIgnored() async {
        let cloud = FakeCloud(), base = MemoryBase()
        var local = snap([task("a")])
        var applied = 0
        let e = engine(cloud, base, local: { local }, set: { local = $0; applied += 1 })
        await e.start()
        await e.remoteChanged(data: cloud.row?.data, at: cloud.row?.at)
        XCTAssertEqual(applied, 0)
    }

    func testRemoteEditApplies() async {
        let cloud = FakeCloud(), base = MemoryBase()
        var local = snap([task("a")])
        let e = engine(cloud, base, local: { local }, set: { local = $0 })
        await e.start()
        cloud.other(snap([task("a", ["title": "changed", "updatedAt": 2])]))
        await e.remoteChanged(data: cloud.row?.data, at: cloud.row?.at)
        XCTAssertEqual(local.tasks[0]["title"], "changed")
    }

    func testFailureRetriesAndRecovers() async throws {
        let cloud = FakeCloud(), base = MemoryBase()
        var local = snap([task("a")])
        var seen: [SyncEngine.Status] = []
        let e = engine(cloud, base, local: { local }, set: { local = $0 }, status: { seen.append($0) })
        await e.start()
        local.tasks.append(task("b"))
        cloud.failNext = true
        await e.push()
        XCTAssertEqual(seen.last, .error)
        try await Task.sleep(for: .milliseconds(150))
        XCTAssertFalse(e.pending)
        XCTAssertEqual(seen.last, .synced)
    }

    func testFlushPushesWhatIsPending() async {
        let cloud = FakeCloud(), base = MemoryBase()
        var local = snap([task("a")])
        let e = engine(cloud, base, local: { local }, set: { local = $0 })
        await e.start()
        let idle = await e.flush()
        XCTAssertTrue(idle)
        local.tasks.append(task("b"))
        let flushed = await e.flush()
        XCTAssertTrue(flushed)
        XCTAssertFalse(e.pending)
    }
}
