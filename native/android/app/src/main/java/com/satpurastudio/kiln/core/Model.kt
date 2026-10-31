package com.satpurastudio.kiln.core

import androidx.compose.runtime.Immutable

/** Records are JSON underneath (see Json.kt); these give them names. */
@Immutable
data class KTask(val j: Item) {
    val id get() = j["id"]?.string ?: ""
    val projectId get() = j["projectId"]?.string ?: ""
    val title get() = j["title"]?.string ?: ""
    val notes get() = j["notes"]?.string ?: ""
    val priority get() = j["priority"]?.string ?: "none"
    val due get() = j["due"]?.string
    val time get() = j["time"]?.string?.takeIf { it.isNotEmpty() }
    val done get() = j["done"]?.boolean ?: false
    val doneAt get() = j["doneAt"]?.number
    val archived get() = j["archived"]?.boolean ?: false
    val repeatKind get() = j["repeat"]?.string ?: "none"
    val repeats get() = repeatKind != "none"
    val pomos get() = (j["pomos"]?.number ?: 0.0).toInt()
    val createdAt get() = j["createdAt"]?.number ?: 0.0
    val updatedAt get() = j["updatedAt"]?.number
    val deletedAt get() = j["deletedAt"]?.number ?: 0.0
    val nextId get() = j["nextId"]?.string
    val subs get() = j["subs"]?.array.orEmpty().mapNotNull { it.obj?.let(::Sub) }
}

@Immutable
data class Sub(val j: Item) {
    constructor(text: String) : this(itemOf("id" to J.Str(uid()), "text" to J.Str(text), "done" to J.Bool(false)))
    val id get() = j["id"]?.string ?: ""
    val text get() = j["text"]?.string ?: ""
    val done get() = j["done"]?.boolean ?: false
}

@Immutable
data class Project(val j: Item) {
    val id get() = j["id"]?.string ?: ""
    val name get() = j["name"]?.string ?: ""
    val color get() = j["color"]?.string ?: "#d85a30"
    val icon get() = j["icon"]?.string ?: "✦"
}

@Immutable
data class Habit(val j: Item) {
    val id get() = j["id"]?.string ?: ""
    val name get() = j["name"]?.string ?: ""
    val color get() = j["color"]?.string ?: "#d85a30"
    val log get() = j["log"]?.obj ?: emptyMap()
    fun doneOn(day: String) = log[day]?.boolean ?: false

    /** Consecutive days done, ending today (or yesterday if today isn't logged yet). */
    val streak: Int
        get() {
            var d = parseDateStr(todayStr())
            if (!doneOn(toDateStr(d))) d = d.addDays(-1)
            var n = 0
            while (doneOn(toDateStr(d))) {
                n++
                d = d.addDays(-1)
            }
            return n
        }
}

@Immutable
data class Screen(val type: String, val projectId: String? = null, val date: String? = null) {
    val json: J
        get() {
            val o = linkedMapOf("type" to J.Str(type), "projectId" to projectId.j())
            if (date != null) o["date"] = J.Str(date)
            return J.Obj(o)
        }
    val key get() = "$type-${projectId ?: ""}"

    companion object {
        val today = Screen("today")
    }
}

private val RETIRED_SEED_TASKS = setOf("Review quarterly roadmap", "Ship the design system update", "Book weekend trip", "Call home")
private val TUTORIAL_TITLES = setOf(
    "Complete me — watch what happens ✨", "Hover me, then drag the ⋮⋮ grip to reorder",
    "Click me to edit notes, dates & priority", "Press N to add a task, / to search",
    "Open the command palette with Ctrl + K", "Finish every task in a project for a surprise 🎉",
)
private val COLOR_MIGRATION = mapOf(
    "#8b7cf8" to "#d85a30", "#5ad1e6" to "#5f7c8a", "#f472b6" to "#8a5a7c", "#4ade80" to "#7c8a4d",
    "#f5a54b" to "#d9a441", "#f4536e" to "#a03c1c", "#facc15" to "#d9a441", "#60a5fa" to "#5f7c8a",
)

private fun cleanTask(t: Item): KTask {
    val o = LinkedHashMap(t)
    if ("notes" !in o) o["notes"] = J.Str("")
    if ("priority" !in o) o["priority"] = J.Str("none")
    if ("due" !in o) o["due"] = J.Null
    if ("done" !in o) o["done"] = J.Bool(false)
    if (o["title"]?.string == null) o["title"] = J.Str("")
    return KTask(o)
}

private fun stripTutorialDues(list: List<KTask>) =
    list.map { if (it.due != null && it.title in TUTORIAL_TITLES) KTask(it.j + ("due" to J.Null)) else it }

private fun stamped(j: Item): Item = j + ("updatedAt" to J.Num(Clock.ms.toDouble()))

private fun record(stats: Item, ds: String, pid: String?, hour: Int, delta: Double): Item {
    val days = stats["days"]?.obj.orEmpty()
    if (delta < 0 && ds !in days) return stats
    val day = days[ds]?.obj ?: itemOf("done" to 0.j(), "folders" to J.Obj(emptyMap()), "hours" to J.Obj(emptyMap()))
    val folders = day["folders"]?.obj.orEmpty().toMutableMap()
    if (!pid.isNullOrEmpty() && (delta > 0 || (folders[pid]?.number ?: 0.0) > 0)) {
        folders[pid] = J.Num(maxOf(0.0, (folders[pid]?.number ?: 0.0) + delta))
    }
    val hours = day["hours"]?.obj.orEmpty().toMutableMap()
    val key = hour.toString()
    if (delta > 0 || (hours[key]?.number ?: 0.0) > 0) hours[key] = J.Num(maxOf(0.0, (hours[key]?.number ?: 0.0) + delta))
    val next = day + mapOf("done" to J.Num(maxOf(0.0, (day["done"]?.number ?: 0.0) + delta)), "folders" to J.Obj(folders), "hours" to J.Obj(hours))
    return stats + ("days" to J.Obj(days + (ds to J.Obj(next))))
}

private fun buildStats(tasks: List<KTask>): Item {
    var stats = itemOf("days" to J.Obj(emptyMap()), "pomos" to 0.j())
    for (t in tasks) {
        val at = t.doneAt
        if (t.done && at != null) {
            val d = D(at.toLong())
            stats = record(stats, toDateStr(d), t.projectId, d.hour, 1.0)
        }
        stats = stats + ("pomos" to J.Num((stats["pomos"]?.number ?: 0.0) + t.pomos))
    }
    return stats
}

/** The app's whole state and every way it changes — the reducer in store.jsx. */
@Immutable
data class AppState(
    val projects: List<Project> = emptyList(),
    val tasks: List<KTask> = emptyList(),
    val habits: List<Habit> = emptyList(),
    val stats: Item = itemOf("days" to J.Obj(emptyMap()), "pomos" to 0.j()),
    val trash: List<KTask> = emptyList(),
    val theme: String = "light",
    val sound: Boolean = true,
    val view: Screen = Screen.today,
    val profile: Item? = null,
    val settings: Item = DEFAULT_SETTINGS,
    val onboarded: Boolean = false,
    val replayTour: Boolean = false,
) {
    /** Same shape as the web app's `zenith-v1` localStorage value. */
    val encoded: J
        get() = jsonOf(
            "projects" to J.Arr(projects.map { J.Obj(it.j) }),
            "tasks" to J.Arr(tasks.map { J.Obj(it.j) }),
            "habits" to J.Arr(habits.map { J.Obj(it.j) }),
            "stats" to J.Obj(stats),
            "trash" to J.Arr(trash.map { J.Obj(it.j) }),
            "theme" to J.Str(theme),
            "sound" to J.Bool(sound),
            "view" to view.json,
            "profile" to (profile?.let { J.Obj(it) } ?: J.Null),
            "settings" to J.Obj(settings),
            "onboarded" to J.Bool(onboarded),
            "seedV" to 3.j(),
        )

    val snapshot get() = Snapshot(projects.map { it.j }, tasks.map { it.j }, habits.map { it.j }, 3.0)

    fun sanitized(v: Screen, list: List<Project> = projects) =
        if (v.type == "project" && list.none { it.id == v.projectId }) Screen.today else v

    val isCloud get() = profile?.get("cloud")?.boolean == true
    val reducedEffects get() = settings["reducedEffects"]?.boolean ?: false
    val textScale get() = (settings["textScale"]?.number ?: 1.0).coerceIn(TEXT_SCALE_MIN, TEXT_SCALE_MAX)
    val ambient: Item get() = AMBIENT_DEFAULTS + settings["ambient"]?.obj.orEmpty()
    val language get() = I18n.resolve(settings["language"]?.string)

    private fun newFolder(list: List<Project>, name: String): Project {
        val n = list.size
        return Project(itemOf("id" to J.Str(uid()), "name" to J.Str(name), "color" to J.Str(PROJECT_COLORS[n % PROJECT_COLORS.size]), "icon" to J.Str(PROJECT_ICONS[n % PROJECT_ICONS.size])))
    }

    /** Its own folder if it still exists, else the first folder, else a fresh Inbox. */
    private fun home(list: List<Project>, id: String?): Pair<List<Project>, String> {
        if (list.any { it.id == id }) return list to id!!
        if (list.isNotEmpty()) return list to list[0].id
        val inbox = newFolder(list, t("inbox"))
        return listOf(inbox) to inbox.id
    }

    fun addTask(title: String, projectId: String?, due: String?, time: String?, priority: String?, newFolder: String? = null): AppState {
        val clean = title.trim()
        if (clean.isEmpty()) return this
        var (list, pid) = home(projects, projectId)
        val folderName = newFolder?.trim()
        if (!folderName.isNullOrEmpty()) {
            val f = newFolder(list, folderName)
            list = list + f
            pid = f.id
        }
        val now = J.Num(Clock.ms.toDouble())
        val task = itemOf(
            "id" to J.Str(uid()), "projectId" to J.Str(pid), "title" to J.Str(clean), "notes" to J.Str(""),
            "priority" to J.Str(priority ?: "none"), "due" to due.j(), "time" to time?.takeIf { it.isNotEmpty() }.j(),
            "done" to J.Bool(false), "doneAt" to J.Null, "createdAt" to now, "updatedAt" to now,
        )
        return copy(projects = list, tasks = listOf(KTask(task)) + tasks)
    }

    fun toggleTask(id: String): AppState {
        val target = tasks.firstOrNull { it.id == id } ?: return this
        val completing = !target.done
        val repeats = completing && target.repeats
        val nextId = if (repeats) uid() else null
        // un-completing a repeating task by mistake takes back the occurrence it spawned
        // (if untouched) and makes it repeat again — no duplicates
        val spawned = if (!completing) target.nextId?.let { n -> tasks.firstOrNull { it.id == n } } else null
        val takeBack = spawned != null && !spawned.done && spawned.updatedAt == spawned.createdAt
        var list = tasks.filter { !(takeBack && it.id == spawned?.id) }.map { x ->
            if (x.id != id) return@map x
            val j = LinkedHashMap(x.j)
            if (completing) {
                j["done"] = J.Bool(true)
                j["doneAt"] = J.Num(Clock.ms.toDouble())
                // completed copy stops repeating so un-toggling can't double-spawn
                if (repeats) {
                    j["repeat"] = J.Str("none")
                    j["repeatWas"] = J.Str(target.repeatKind)
                    j["nextId"] = J.Str(nextId!!)
                }
            } else {
                val was = j.remove("repeatWas")
                j.remove("nextId")
                j["done"] = J.Bool(false)
                j["doneAt"] = J.Null
                if (takeBack) {
                    if (was != null) j["repeat"] = was else j.remove("repeat")
                }
            }
            KTask(stamped(j))
        }
        // repeating task: completing it forges the next occurrence
        if (repeats) {
            val now = J.Num(Clock.ms.toDouble())
            val next = LinkedHashMap(target.j)
            next.remove("repeatWas")
            next.remove("nextId")
            next["id"] = J.Str(nextId!!)
            next["done"] = J.Bool(false)
            next["doneAt"] = J.Null
            next["createdAt"] = now
            next["updatedAt"] = now
            next["due"] = J.Str(nextDue(target.due, target.repeatKind))
            next["pomos"] = 0.j()
            next["subs"] = J.Arr(target.subs.map { J.Obj(it.j + ("done" to J.Bool(false))) })
            list = listOf(KTask(next)) + list
        }
        // record into the persistent log so Insights outlive the task itself
        var st = stats
        val at = target.doneAt
        if (completing) {
            val now = D.now
            st = record(st, toDateStr(now), target.projectId, now.hour, 1.0)
        } else if (at != null) {
            val d = D(at.toLong())
            st = record(st, toDateStr(d), target.projectId, d.hour, -1.0)
        }
        return copy(tasks = list, stats = st)
    }

    fun updateTask(id: String, patch: Item) = copy(tasks = tasks.map { if (it.id == id) KTask(stamped(it.j + patch)) else it })

    fun deleteTask(id: String) = deleteTasks(listOf(id))

    fun deleteTasks(ids: List<String>): AppState {
        val set = ids.toSet()
        val now = J.Num(Clock.ms.toDouble())
        val removed = tasks.filter { it.id in set }.map { KTask(it.j + ("deletedAt" to now)) }
        return copy(tasks = tasks.filter { it.id !in set }, trash = removed + trash)
    }

    fun restoreTasks(ids: List<String>): AppState {
        val set = ids.toSet()
        val items = trash.filter { it.id in set }
        if (items.isEmpty()) return this
        var list = projects
        val restored = items.map { item ->
            // its folder may have been deleted since — rehome instead of orphaning
            val (l, pid) = home(list, item.projectId)
            list = l
            KTask(stamped((item.j - "deletedAt") + ("projectId" to J.Str(pid))))
        }
        return copy(projects = list, tasks = restored + tasks.filter { it.id !in set }, trash = trash.filter { it.id !in set })
    }

    fun restoreTrash(items: List<KTask>): AppState {
        val have = trash.map { it.id }.toSet()
        return copy(trash = trash + items.filter { it.id !in have })
    }

    /** One id → delete forever; no id → drop everything past its TTL window. */
    fun purgeTrash(id: String? = null): AppState {
        if (id != null) return copy(trash = trash.filter { it.id != id })
        val now = Clock.ms
        return copy(trash = trash.filter { now - it.deletedAt < TRASH_TTL })
    }

    /** `ids` = visible active task ids in their new order. Slots that held one of these ids
     *  get refilled in the new sequence; everything else stays put. */
    fun reorderTasks(ids: List<String>): AppState {
        val set = ids.toSet()
        val byId = tasks.associateBy { it.id }
        val queue = ArrayDeque(ids)
        return copy(tasks = tasks.map { if (it.id in set) queue.removeFirstOrNull()?.let(byId::get) ?: it else it })
    }

    fun addProject(name: String, color: String, icon: String): AppState {
        val clean = name.trim()
        if (clean.isEmpty()) return this
        val p = Project(itemOf("id" to J.Str(uid()), "name" to J.Str(clean), "color" to J.Str(color), "icon" to J.Str(icon)))
        return copy(projects = projects + p, view = Screen("project", p.id))
    }

    fun updateProject(id: String, patch: Item) = copy(projects = projects.map { if (it.id == id) Project(stamped(it.j + patch)) else it })

    fun setProjects(list: List<Project>): AppState {
        if (list.isEmpty()) return this
        return copy(projects = list, view = sanitized(view, list))
    }

    /** The folder's tasks go to the trash (recoverable), never straight to oblivion. */
    fun deleteProject(id: String): AppState {
        val s = copy(projects = projects.filter { it.id != id }, view = if (view.type == "project" && view.projectId == id) Screen.today else view)
        return s.deleteTasks(tasks.filter { it.projectId == id }.map { it.id })
    }

    /** Undo a folder delete: the folder back in its old slot, its tasks out of the trash. */
    fun restoreProject(project: Project, index: Int, taskIds: List<String>): AppState {
        if (projects.any { it.id == project.id }) return this
        val list = projects.toMutableList().also { it.add(minOf(index, it.size), project) }
        val set = taskIds.toSet()
        val back = trash.filter { it.id in set }.map { KTask(it.j - "deletedAt") }
        return copy(projects = list, tasks = back + tasks, trash = trash.filter { it.id !in set })
    }

    fun addHabit(name: String, color: String) = copy(
        habits = habits + Habit(itemOf("id" to J.Str(uid()), "name" to J.Str(name.trim()), "color" to J.Str(color), "createdAt" to J.Num(Clock.ms.toDouble()), "log" to J.Obj(emptyMap()))),
    )

    fun toggleHabit(id: String, date: String = todayStr()) = copy(
        habits = habits.map { h ->
            if (h.id != id) return@map h
            val log = if (h.log[date]?.boolean == true) h.log - date else h.log + (date to J.Bool(true))
            Habit(stamped(h.j + ("log" to J.Obj(log))))
        },
    )

    fun logFocus() = copy(stats = stats + ("pomos" to J.Num((stats["pomos"]?.number ?: 0.0) + 1)))
    fun setSettings(patch: Item) = copy(settings = settings + patch)
    fun setAmbient(patch: Item) = copy(settings = settings + ("ambient" to J.Obj(settings["ambient"]?.obj.orEmpty() + patch)))

    /** A deliberate sign-out: clear this person's tasks off the device, keep look & feel. */
    fun resetContent(): AppState {
        val fresh = seed()
        return copy(projects = fresh.projects, tasks = fresh.tasks, habits = emptyList(), trash = emptyList(), stats = fresh.stats, view = fresh.view, profile = null)
    }

    /** Replace local projects/tasks/habits with a cloud copy (or a backup). */
    fun hydrate(s: Snapshot): AppState {
        val list = s.projects.map(::Project)
        var ts = s.tasks.filter { it["id"]?.string != null }.map(::cleanTask)
        if (s.seedV < 3) ts = stripTutorialDues(ts)
        return copy(projects = list, tasks = ts, habits = s.habits.map(::Habit), view = sanitized(view, list))
    }

    // selectors

    private fun matches(t: KTask, query: String): Boolean {
        if (query.isEmpty()) return true
        val q = query.lowercase()
        return t.title.lowercase().contains(q) || t.notes.lowercase().contains(q) || t.subs.any { it.text.lowercase().contains(q) }
    }

    fun active(query: String = "") = tasks.filter { !it.done && !it.archived && inView(it.due, it.projectId, view) && matches(it, query) }

    fun completed(query: String = "") = tasks.filter { x ->
        if (!x.done || x.archived || !inView(x.due, x.projectId, view) || !matches(x, query)) return@filter false
        view.type != "today" || (x.doneAt?.let { sameDay(it, D.now) } ?: false)
    }.sortedByDescending { it.doneAt ?: 0.0 }

    data class Progress(val total: Int, val done: Int, val pct: Int)

    fun projectProgress(id: String): Progress {
        val list = tasks.filter { it.projectId == id && !it.archived }
        if (list.isEmpty()) return Progress(0, 0, 0)
        val done = list.count { it.done }
        return Progress(list.size, done, Math.round(done.toDouble() / list.size * 100).toInt())
    }

    data class Today(val active: Int, val done: Int, val total: Int, val pct: Int)

    val todayProgress: Today
        get() {
            val now = D.now
            val active = tasks.count { !it.done && !it.archived && (isToday(it.due) || isOverdue(it.due)) }
            val done = tasks.count { x -> x.done && !x.archived && (x.doneAt?.let { sameDay(it, now) } ?: false) }
            val total = active + done
            return Today(active, done, total, if (total == 0) 0 else Math.round(done.toDouble() / total * 100).toInt())
        }

    data class InsightDay(val ds: String, val label: String, val count: Int)
    data class FolderCount(val name: String, val color: String, val count: Int)
    data class Insights(
        val days: List<InsightDay>, val totalWeek: Int, val byFolder: List<FolderCount>, val bestHour: Int?,
        val bestDay: InsightDay, val totalPomos: Int, val streak: Int, val maxDay: Int,
    )

    val insights: Insights
        get() {
            val log = stats["days"]?.obj.orEmpty()
            fun done(ds: String) = (log[ds]?.get("done")?.number ?: 0.0).toInt()
            val now = D.now
            val days = (6 downTo 0).map { i ->
                val d = now.addDays(-i)
                InsightDay(toDateStr(d), fmtDate(d, "EEE"), done(toDateStr(d)))
            }
            val folderCount = HashMap<String, Int>()
            for (day in days) for ((pid, n) in log[day.ds]?.get("folders")?.obj.orEmpty()) {
                folderCount[pid] = (folderCount[pid] ?: 0) + (n.number ?: 0.0).toInt()
            }
            val byFolder = projects.map { FolderCount(it.name, it.color, folderCount[it.id] ?: 0) }.filter { it.count > 0 }.sortedByDescending { it.count }
            val hours = IntArray(24)
            for (day in log.values) for ((k, n) in day["hours"]?.obj.orEmpty()) {
                k.toIntOrNull()?.takeIf { it in 0..23 }?.let { hours[it] += (n.number ?: 0.0).toInt() }
            }
            val peak = hours.max()
            var d = now
            if (done(toDateStr(d)) == 0) d = d.addDays(-1)
            var streak = 0
            while (done(toDateStr(d)) > 0) {
                streak++
                d = d.addDays(-1)
            }
            var best = days[0]
            for (x in days.drop(1)) if (x.count > best.count) best = x
            return Insights(
                days, days.sumOf { it.count }, byFolder, if (peak > 0) hours.indexOf(peak) else null, best,
                (stats["pomos"]?.number ?: 0.0).toInt(), streak, maxOf(1, days.maxOf { it.count }),
            )
        }

    data class Group(val id: String, val label: String, val tasks: List<KTask>)

    fun groupUpcoming(list: List<KTask>): List<Group> {
        val week = addDaysStr(7)
        val today = todayStr()
        val tomorrow = addDaysStr(1)
        val buckets = list.groupBy { x ->
            val due = x.due ?: ""
            when {
                isOverdue(due) -> "overdue"
                due == today -> "today"
                due == tomorrow -> "tomorrow"
                due <= week -> "week"
                else -> "later"
            }
        }
        val cmp = compareBy<KTask>({ it.due ?: "" }, { priorityRank[it.priority] ?: 3 })
        return listOf("overdue" to t("overdue"), "today" to t("today"), "tomorrow" to t("tomorrow"), "week" to t("next7days"), "later" to t("later"))
            .mapNotNull { (id, label) -> buckets[id]?.let { Group(id, label, it.sortedWith(cmp)) } }
    }

    fun emberMood(focus: FocusSession?, nowMs: Long = Clock.ms): String {
        if (focus != null && focus.remaining == null && focus.phase == "work") return "focus"
        if (tasks.any { x -> x.done && (x.doneAt?.let { nowMs - it < 8000 } ?: false) }) return "celebrate"
        if (tasks.count { !it.done && !it.archived && isOverdue(it.due) } >= 3) return "worried"
        val p = todayProgress
        if (p.total > 0 && p.active == 0) return "proud"
        val cfg = ambient
        if (isNightHour(D(nowMs), (cfg["nightStart"]?.number ?: 23.0).toInt(), (cfg["nightEnd"]?.number ?: 6.0).toInt()) || p.total == 0) return "sleepy"
        return "idle"
    }

    companion object {
        fun inView(due: String?, projectId: String, view: Screen) = when (view.type) {
            "today" -> isToday(due) || isOverdue(due)
            "upcoming", "calendar" -> due != null
            "project" -> projectId == view.projectId
            else -> true
        }

        fun seed(): AppState {
            val p1 = itemOf("id" to J.Str(uid()), "name" to J.Str("Getting Started"), "color" to J.Str("#d85a30"), "icon" to J.Str("✦"))
            val p2 = itemOf("id" to J.Str(uid()), "name" to J.Str("Work"), "color" to J.Str("#5f7c8a"), "icon" to J.Str("◆"))
            val p3 = itemOf("id" to J.Str(uid()), "name" to J.Str("Personal"), "color" to J.Str("#8a5a7c"), "icon" to J.Str("❋"))
            fun task(title: String, vararg extra: Pair<String, J>) = KTask(
                itemOf(
                    "id" to J.Str(uid()), "projectId" to p1.getValue("id"), "title" to J.Str(title), "notes" to J.Str(""), "priority" to J.Str("none"),
                    "due" to J.Null, "done" to J.Bool(false), "doneAt" to J.Null, "createdAt" to J.Num(Clock.ms.toDouble()),
                ) + extra,
            )
            return AppState(
                projects = listOf(p1, p2, p3).map(::Project),
                tasks = listOf(
                    task("Tap the circle to complete me — watch what happens ✨", "priority" to J.Str("high")),
                    task("Drag the ⋮⋮ grip to reorder me"),
                    task("Tap me to edit notes, dates, time & priority", "priority" to J.Str("medium"), "notes" to J.Str("Everything is editable inline. Try moving me to another folder.")),
                    task("Add a task using the bar above"),
                    task("Explore Calendar, Focus & the ⚙ Settings menu", "priority" to J.Str("low")),
                    task("Finish every task in a folder for a surprise 🎉"),
                ),
            )
        }

        /** null means the data can't be read as kiln's, and the caller parks a copy. */
        fun decode(data: J): AppState? {
            val rawProjects = data["projects"]?.array ?: return null
            val rawTasks = data["tasks"]?.array ?: return null
            val seedV = data["seedV"]?.number ?: 1.0
            var tasks = rawTasks.mapNotNull { it.obj }.filter { it["id"]?.string != null }.map(::cleanTask)
            if (seedV < 2) tasks = tasks.filter { it.title !in RETIRED_SEED_TASKS }
            if (seedV < 3) tasks = stripTutorialDues(tasks)
            val projects = rawProjects.mapNotNull { it.obj }.map { p ->
                val m = p["color"]?.string?.let(COLOR_MIGRATION::get)
                Project(if (m != null) p + ("color" to J.Str(m)) else p)
            }
            val now = Clock.ms
            val profile = data["profile"]?.obj
            var view = Screen.today
            data["view"]?.obj?.let { v -> v["type"]?.string?.let { view = Screen(it, v["projectId"]?.string, v["date"]?.string) } }
            val s = AppState(
                projects = projects,
                tasks = tasks,
                habits = data["habits"]?.array.orEmpty().mapNotNull { it.obj }.map(::Habit),
                // backfill the completion log once from existing done tasks (older saves)
                stats = data["stats"]?.obj?.takeIf { "days" in it } ?: buildStats(tasks),
                trash = data["trash"]?.array.orEmpty().mapNotNull { it.obj }.map(::KTask).filter { now - it.deletedAt < TRASH_TTL },
                theme = data["theme"]?.string ?: "light",
                sound = data["sound"]?.boolean ?: true,
                profile = profile,
                settings = DEFAULT_SETTINGS + data["settings"]?.obj.orEmpty(),
                // anyone who already has a profile has clearly used the app before
                onboarded = data["onboarded"]?.boolean ?: (profile != null),
            )
            return s.copy(view = s.sanitized(view))
        }
    }
}

/** start > end wraps past midnight (e.g. 23 → 6). */
fun isNightHour(now: D, start: Int, end: Int): Boolean {
    val h = now.hour
    if (start == end) return false
    return if (start > end) h >= start || h < end else h in start until end
}

/** Mirrors the web's kiln-focus value. remaining == null means running. */
@Immutable
data class FocusSession(val taskId: String, val mode: String, val phase: String, val endsAt: Double, val remaining: Double?, val count: Int) {
    val json: J
        get() = jsonOf("taskId" to J.Str(taskId), "mode" to J.Str(mode), "phase" to J.Str(phase), "endsAt" to J.Num(endsAt), "remaining" to (remaining?.let { J.Num(it) } ?: J.Null), "count" to count.j())

    companion object {
        fun of(j: J?): FocusSession? {
            val id = j?.get("taskId")?.string ?: return null
            return FocusSession(id, j["mode"]?.string ?: "classic", j["phase"]?.string ?: "work", j["endsAt"]?.number ?: 0.0, j["remaining"]?.number, (j["count"]?.number ?: 0.0).toInt())
        }
    }
}

data class FocusMode(val work: Int, val brk: Int, val label: String)

fun focusDurations(id: String, settings: Item): FocusMode {
    fun clamp(n: Double?, hi: Int) = Math.round(n ?: 1.0).toInt().coerceIn(1, hi)
    return when (id) {
        "deep" -> FocusMode(50 * 60, 10 * 60, "50 · 10")
        "custom" -> {
            val w = clamp(settings["focusWork"]?.number, 180)
            val b = clamp(settings["focusBreak"]?.number, 60)
            FocusMode(w * 60, b * 60, "$w · $b")
        }
        else -> FocusMode(25 * 60, 5 * 60, "25 · 5")
    }
}

class BackupError(message: String) : Exception(message)

private fun truthy(v: J?) = when (v) {
    null, J.Null -> false
    is J.Str -> v.v.isNotEmpty()
    is J.Bool -> v.v
    is J.Num -> v.v != 0.0
    else -> true
}

/** Validate a backup file: projects, tasks and habits, or a readable reason. */
fun parseBackup(text: String): Snapshot {
    val json = J.parse(text) ?: throw BackupError(t("backupNotJson"))
    val rp = json["projects"]?.array
    val rt = json["tasks"]?.array
    if (rp == null || rt == null) throw BackupError(t("backupNotKiln"))
    val projects = rp.mapNotNull { it.obj }.filter { truthy(it["id"]) && truthy(it["name"]) }
    if (projects.isEmpty()) throw BackupError(t("backupNoFolders"))
    val ids = projects.mapNotNull { it["id"]?.string }.toSet()
    val tasks = rt.mapNotNull { it.obj }.filter { truthy(it["id"]) && it["title"]?.string != null }.map { x ->
        if ((x["projectId"]?.string ?: "") in ids) x else x + ("projectId" to projects[0].getValue("id"))
    }
    return Snapshot(projects, tasks, json["habits"]?.array.orEmpty().mapNotNull { it.obj }.filter { truthy(it["id"]) }, 3.0)
}

fun backupFile(s: AppState): String {
    val f = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.ROOT).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
    return jsonOf(
        "app" to J.Str("kiln"), "version" to 1.j(), "exportedAt" to J.Str(f.format(D.now.date)),
        "projects" to J.Arr(s.projects.map { J.Obj(it.j) }), "tasks" to J.Arr(s.tasks.map { J.Obj(it.j) }), "habits" to J.Arr(s.habits.map { J.Obj(it.j) }),
    ).stable
}
