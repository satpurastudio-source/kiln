package com.satpurastudio.kiln

import com.satpurastudio.kiln.core.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class StateTest {
    @Before fun fix() {
        Clock.override = D.make(2026, 9, 31, 10, 30).ms
    }

    @After fun reset() {
        Clock.override = null
    }

    private fun task(id: String, vararg extra: Pair<String, J>): Item =
        itemOf("id" to J.Str(id), "projectId" to J.Str("p"), "title" to J.Str(id), "done" to J.Bool(false)) + extra

    private fun state(tasks: List<Item> = emptyList(), projects: List<Item> = listOf(itemOf("id" to J.Str("p"), "name" to J.Str("P")))) =
        AppState(projects = projects.map(::Project), tasks = tasks.map(::KTask))

    @Test fun repeatSpawnsThenUndoTakesItBack() {
        var s = state(listOf(task("t", "repeat" to J.Str("weekly"), "due" to J.Str("2026-10-26"), "pomos" to 3.j(), "subs" to J.Arr(listOf(jsonOf("id" to J.Str("s"), "text" to J.Str("a"), "done" to J.Bool(true)))))))
        s = s.toggleTask("t")
        assertEquals(2, s.tasks.size)
        val next = s.tasks[0]
        val old = s.tasks[1]
        assertEquals("2026-11-02", next.due)
        assertFalse(next.done)
        assertEquals(0, next.pomos)
        assertFalse(next.subs[0].done)
        assertEquals("none", old.repeatKind)
        assertEquals(next.id, old.nextId)
        s = s.toggleTask("t")
        assertEquals(listOf("t"), s.tasks.map { it.id })
        assertEquals("weekly", s.tasks[0].repeatKind)
        assertNull(s.tasks[0].j["nextId"])
    }

    @Test fun trashAndRehome() {
        var s = state(listOf(task("t", "projectId" to J.Str("gone"))))
        s = s.deleteTask("t")
        assertTrue(s.tasks.isEmpty())
        s = s.restoreTasks(listOf("t"))
        assertEquals("p", s.tasks[0].projectId)
        assertNull(s.tasks[0].j["deletedAt"])
    }

    @Test fun reorderKeepsOtherSlots() {
        val s = state(listOf("a", "b", "c", "d").map { task(it) }).reorderTasks(listOf("c", "a"))
        assertEquals(listOf("c", "b", "a", "d"), s.tasks.map { it.id })
    }

    @Test fun deleteFolderAndUndo() {
        var s = state(listOf(task("t")), listOf(itemOf("id" to J.Str("p"), "name" to J.Str("P")), itemOf("id" to J.Str("q"), "name" to J.Str("Q")))).copy(view = Screen("project", "p"))
        val folder = s.projects[0]
        s = s.deleteProject("p")
        assertEquals("today", s.view.type)
        assertEquals(1, s.trash.size)
        s = s.restoreProject(folder, 0, listOf("t"))
        assertEquals(listOf("p", "q"), s.projects.map { it.id })
        assertEquals(listOf("t"), s.tasks.map { it.id })
    }

    @Test fun webStateRoundTripKeepsUnknownFields() {
        val web = """{"projects":[{"id":"p","name":"P","color":"#8b7cf8","icon":"✦","future":1}],
         "tasks":[{"id":"t","projectId":"p","title":"x","done":false,"newField":{"a":[1]}}],
         "habits":[],"stats":{"days":{},"pomos":2},"trash":[],"theme":"dark","sound":false,
         "view":{"type":"project","projectId":"gone"},"profile":{"name":"A"},"settings":{"accent":"sage","language":"hi"},"seedV":3}"""
        val s = AppState.decode(J.parse(web)!!)!!
        assertEquals("today", s.view.type)
        assertEquals("#d85a30", s.projects[0].color)
        assertEquals(J.Str("sage"), s.settings["accent"])
        assertEquals(25.j(), s.settings["focusWork"])
        assertTrue(s.onboarded)
        assertEquals(jsonOf("a" to J.Arr(listOf(1.j()))), s.encoded["tasks"]!!.array!![0]["newField"])
        assertNull(AppState.decode(jsonOf("tasks" to J.Arr(emptyList()))))
    }

    @Test fun reminderPlan() {
        val tasks = listOf(
            KTask(task("a", "due" to J.Str("2026-10-31"), "time" to J.Str("18:00"))),
            KTask(task("b", "due" to J.Str("2026-10-31"), "time" to J.Str("08:00"))),
            KTask(task("c", "due" to J.Str("2026-11-01"), "time" to J.Str("08:00"), "done" to J.Bool(true))),
            KTask(task("d", "due" to J.Str("2026-11-01"))),
        )
        val plan = planReminders(tasks)
        assertEquals(listOf("a", "kiln"), plan.map { it.title })
        assertEquals(reminderId("a"), plan[0].id)
        assertEquals(DIGEST_ID + 1, plan[1].id)
        assertEquals(D.make(2026, 10, 1, 9, 0).ms, plan[1].atMs)
    }

    @Test fun reminderIdMatchesJs() {
        assertEquals(10000 + 96354, reminderId("abc"))
    }
}

private class FakeCloud : CloudTransport {
    var row: CloudRow? = null
    var failNext = false
    var beforeWrite: (() -> Unit)? = null
    private var n = 0
    private fun stamp() = "cloud-${++n}"
    fun other(s: Snapshot) {
        row = CloudRow(s.json, stamp())
    }

    override suspend fun pull(userId: String): CloudRow? {
        if (failNext) {
            failNext = false
            throw CloudException("offline", isNetwork = true)
        }
        return row
    }

    override suspend fun update(userId: String, data: J, at: String, ifAt: String): String? {
        if (failNext) {
            failNext = false
            throw CloudException("offline", isNetwork = true)
        }
        beforeWrite?.invoke()
        beforeWrite = null
        if (row?.at != ifAt) return null
        return stamp().also { row = CloudRow(data, it) }
    }

    override suspend fun insert(userId: String, data: J, at: String): String? {
        beforeWrite?.invoke()
        beforeWrite = null
        if (row != null) return null
        return stamp().also { row = CloudRow(data, it) }
    }

    override suspend fun upsert(userId: String, data: J, at: String) {
        row = CloudRow(data, stamp())
    }
}

private class MemoryBase : BaseStore {
    var saved: Base? = null
    override fun read(userId: String) = saved
    override fun write(userId: String, at: String?, data: Snapshot) {
        saved = Base(at, data)
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SyncTest {
    private fun task(id: String, vararg extra: Pair<String, J>): Item =
        itemOf("id" to J.Str(id), "projectId" to J.Str("p"), "title" to J.Str(id), "done" to J.Bool(false), "updatedAt" to 1.j()) + extra

    private val folder = listOf(itemOf("id" to J.Str("p"), "name" to J.Str("P")))
    private fun snap(vararg ids: String) = Snapshot(folder, ids.map { task(it) })
    private fun ids(s: Snapshot) = s.tasks.map { it["id"]!!.string!! }.toSet()

    private fun TestScope.engine(cloud: FakeCloud, base: MemoryBase, get: () -> Snapshot, set: (Snapshot) -> Unit, status: (SyncStatus) -> Unit = {}) =
        SyncEngine("u", cloud, base, this, get, set, status, retryDelays = listOf(10))

    @Test fun firstSyncAdoptsCloud() = runTest {
        val cloud = FakeCloud()
        cloud.other(snap("c"))
        var local = snap("seed")
        val e = engine(cloud, MemoryBase(), { local }, { local = it })
        e.start()
        assertEquals(setOf("c"), ids(local))
        assertFalse(e.pending)
    }

    @Test fun newAccountAdoptsLocal() = runTest {
        val cloud = FakeCloud()
        val local = snap("mine")
        var last = SyncStatus.Idle
        val e = engine(cloud, MemoryBase(), { local }, {}, { last = it })
        e.start()
        assertEquals(setOf("mine"), ids(Snapshot.of(cloud.row!!.data)))
        assertEquals(SyncStatus.Synced, last)
    }

    @Test fun offlineEditsSurviveRestartAndMerge() = runTest {
        val cloud = FakeCloud()
        val base = MemoryBase()
        cloud.other(snap("a"))
        var local = Snapshot()
        var e = engine(cloud, base, { local }, { local = it })
        e.start()
        e.stop()
        local = local.copy(tasks = local.tasks + task("mine"))
        cloud.other(snap("a", "theirs"))
        e = engine(cloud, base, { local }, { local = it })
        e.start()
        assertEquals(setOf("a", "mine", "theirs"), ids(local))
        assertEquals(setOf("a", "mine", "theirs"), ids(Snapshot.of(cloud.row!!.data)))
    }

    @Test fun pushLosingARaceMerges() = runTest {
        val cloud = FakeCloud()
        cloud.other(snap("a"))
        var local = Snapshot()
        val e = engine(cloud, MemoryBase(), { local }, { local = it })
        e.start()
        local = local.copy(tasks = local.tasks + task("mine"))
        cloud.beforeWrite = { cloud.other(snap("a", "theirs")) }
        e.push()
        advanceUntilIdle()
        assertEquals(setOf("a", "mine", "theirs"), ids(Snapshot.of(cloud.row!!.data)))
        assertFalse(e.pending)
    }

    @Test fun ownEchoIgnored() = runTest {
        val cloud = FakeCloud()
        var applied = 0
        val local = snap("a")
        val e = engine(cloud, MemoryBase(), { local }, { applied++ })
        e.start()
        e.remoteChanged(cloud.row!!.data, cloud.row!!.at)
        assertEquals(0, applied)
    }

    @Test fun failureRetriesAndRecovers() = runTest {
        val cloud = FakeCloud()
        var local = snap("a")
        val seen = ArrayList<SyncStatus>()
        val e = engine(cloud, MemoryBase(), { local }, { local = it }, { seen.add(it) })
        e.start()
        local = local.copy(tasks = local.tasks + task("b"))
        cloud.failNext = true
        e.push()
        assertEquals(SyncStatus.Error, seen.last())
        advanceUntilIdle()
        assertFalse(e.pending)
        assertEquals(SyncStatus.Synced, seen.last())
    }
}
