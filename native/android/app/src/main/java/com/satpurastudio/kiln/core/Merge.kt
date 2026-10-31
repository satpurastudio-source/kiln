package com.satpurastudio.kiln.core

/**
 * Three-way merge for cross-device sync — a port of src/merge.js. Whatever changed on
 * one side is taken from that side; where both changed the same item, fields merge one
 * by one and only a true clash goes to the newer edit.
 */
data class Snapshot(
    val projects: List<Item> = emptyList(),
    val tasks: List<Item> = emptyList(),
    val habits: List<Item> = emptyList(),
    val seedV: Double = 3.0,
) {
    val json: J
        get() = jsonOf(
            "projects" to J.Arr(projects.map { J.Obj(it) }),
            "tasks" to J.Arr(tasks.map { J.Obj(it) }),
            "habits" to J.Arr(habits.map { J.Obj(it) }),
            "seedV" to J.Num(seedV),
        )
    val fingerprint get() = json.stable

    companion object {
        /** syncShape: tolerates missing keys. */
        fun of(j: J?): Snapshot {
            fun list(k: String) = j?.get(k)?.array.orEmpty().mapNotNull { it.obj }
            return Snapshot(list("projects"), list("tasks"), list("habits"), j?.get("seedV")?.number ?: 3.0)
        }
    }
}

private fun idOf(x: Item) = x["id"]?.string ?: ""
private fun updatedAt(x: Item) = x["updatedAt"]?.number ?: 0.0

private fun mergeObject(b: Item, l: Item, r: Item, localWins: Boolean): Item {
    val out = LinkedHashMap<String, J>()
    for (k in b.keys + l.keys + r.keys) {
        val bv = b[k]
        val lv = l[k]
        val rv = r[k]
        val lo = lv?.obj
        val ro = rv?.obj
        val v = when {
            lv == rv || rv == bv -> lv
            lv == bv -> rv
            // both edited a nested map (a habit's day log) → merge it key by key too
            lo != null && ro != null -> J.Obj(mergeObject(bv?.obj ?: emptyMap(), lo, ro, localWins))
            else -> if (localWins) lv else rv
        }
        if (v != null) out[k] = v
    }
    return out
}

fun mergeList(base: List<Item>, local: List<Item>, remote: List<Item>): List<Item> {
    val B = base.associateBy(::idOf)
    val L = local.associateBy(::idOf)
    val R = remote.associateBy(::idOf)

    fun pick(id: String): Item? {
        val b = B[id]
        val l = L[id]
        val r = R[id]
        if (b == null) return if (l != null && r != null) mergeObject(emptyMap(), l, r, updatedAt(l) >= updatedAt(r)) else l ?: r
        if (l == b) return r // edited or deleted over there
        if (r == b) return l // edited or deleted here
        if (l == null) return r // deleted here but edited there → keep the edit
        if (r == null) return l
        return mergeObject(b, l, r, updatedAt(l) >= updatedAt(r))
    }

    // If this device didn't reorder anything, follow the other side's order; otherwise keep
    // ours. Items only the other side has are slotted in right after their neighbour there.
    fun order(list: List<Item>, other: Map<String, Item>) = list.map(::idOf).filter { other.containsKey(it) }
    val localReordered = order(local, B) != order(base, L)
    val primary = if (localReordered) local else remote
    val secondary = if (localReordered) remote else local
    val ids = primary.map(::idOf).toMutableList()
    val seen = ids.toMutableSet()
    secondary.forEachIndexed { i, x ->
        val id = idOf(x)
        if (id in seen) return@forEachIndexed
        val at = if (i > 0) ids.indexOf(idOf(secondary[i - 1])) else -1
        ids.add(at + 1, id)
        seen.add(id)
    }
    return ids.mapNotNull(::pick)
}

fun mergeSnapshots(b: Snapshot, l: Snapshot, r: Snapshot): Snapshot {
    val projects = mergeList(b.projects, l.projects, r.projects)
    var tasks = mergeList(b.tasks, l.tasks, r.tasks)
    // a task added here into a folder deleted over there → keep the task, move it to the
    // first folder rather than orphaning it
    val pids = projects.map(::idOf).toSet()
    if (projects.isNotEmpty()) {
        tasks = tasks.map { t ->
            if ((t["projectId"]?.string ?: "") in pids) t else t + ("projectId" to (projects[0]["id"] ?: J.Null))
        }
    }
    return Snapshot(projects, tasks, mergeList(b.habits, l.habits, r.habits), maxOf(l.seedV, r.seedV))
}
