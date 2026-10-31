import Foundation

/// Three-way merge for cross-device sync — a port of src/merge.js. Whatever
/// changed on one side is taken from that side; where both changed the same
/// item, fields merge one by one and only a true clash goes to the newer edit.
struct Snapshot: Equatable {
    var projects: [Item] = []
    var tasks: [Item] = []
    var habits: [Item] = []
    var seedV: Double = 3

    init(projects: [Item] = [], tasks: [Item] = [], habits: [Item] = [], seedV: Double = 3) {
        self.projects = projects
        self.tasks = tasks
        self.habits = habits
        self.seedV = seedV
    }

    /// syncShape: tolerates missing keys.
    init(json: JSON?) {
        func list(_ k: String) -> [Item] { (json?[k]?.array ?? []).compactMap(\.object) }
        projects = list("projects")
        tasks = list("tasks")
        habits = list("habits")
        seedV = json?["seedV"]?.number ?? 3
    }

    var json: JSON {
        .obj([
            "projects": .arr(projects.map(JSON.obj)),
            "tasks": .arr(tasks.map(JSON.obj)),
            "habits": .arr(habits.map(JSON.obj)),
            "seedV": .num(seedV),
        ])
    }

    var fingerprint: String { json.stable }
}

private func idOf(_ x: Item) -> String { x["id"]?.string ?? "" }
private func updatedAt(_ x: Item) -> Double { x["updatedAt"]?.number ?? 0 }

private func mergeObject(_ b: Item, _ l: Item, _ r: Item, _ localWins: Bool) -> Item {
    var out: Item = [:]
    for k in Set(b.keys).union(l.keys).union(r.keys) {
        let bv = b[k], lv = l[k], rv = r[k]
        let v: JSON?
        if lv == rv || rv == bv { v = lv }
        else if lv == bv { v = rv }
        // both edited a nested map (a habit's day log) → merge it key by key too
        else if let lo = lv?.object, let ro = rv?.object { v = .obj(mergeObject(bv?.object ?? [:], lo, ro, localWins)) }
        else { v = localWins ? lv : rv }
        if let v { out[k] = v }
    }
    return out
}

func mergeList(_ base: [Item], _ local: [Item], _ remote: [Item]) -> [Item] {
    let B = Dictionary(base.map { (idOf($0), $0) }, uniquingKeysWith: { _, last in last })
    let L = Dictionary(local.map { (idOf($0), $0) }, uniquingKeysWith: { _, last in last })
    let R = Dictionary(remote.map { (idOf($0), $0) }, uniquingKeysWith: { _, last in last })

    func pick(_ id: String) -> Item? {
        let b = B[id], l = L[id], r = R[id]
        guard let b else {
            if let l, let r { return mergeObject([:], l, r, updatedAt(l) >= updatedAt(r)) }
            return l ?? r
        }
        let lChanged = l != b
        let rChanged = r != b
        if !lChanged { return r } // edited or deleted over there
        if !rChanged { return l } // edited or deleted here
        guard let l else { return r } // deleted here but edited there → keep the edit
        guard let r else { return l }
        return mergeObject(b, l, r, updatedAt(l) >= updatedAt(r))
    }

    // If this device didn't reorder anything, follow the other side's order;
    // otherwise keep ours. Items only the other side has are slotted in right
    // after their neighbour there.
    func order(_ list: [Item], _ other: [String: Item]) -> [String] { list.map(idOf).filter { other[$0] != nil } }
    let localReordered = order(local, B) != order(base, L)
    let primary = localReordered ? local : remote
    let secondary = localReordered ? remote : local
    var ids = primary.map(idOf)
    var seen = Set(ids)
    for (i, x) in secondary.enumerated() {
        let id = idOf(x)
        if seen.contains(id) { continue }
        let at = i > 0 ? (ids.firstIndex(of: idOf(secondary[i - 1])) ?? -1) : -1
        ids.insert(id, at: at + 1)
        seen.insert(id)
    }
    return ids.compactMap(pick)
}

func mergeSnapshots(base b: Snapshot, local l: Snapshot, remote r: Snapshot) -> Snapshot {
    let projects = mergeList(b.projects, l.projects, r.projects)
    var tasks = mergeList(b.tasks, l.tasks, r.tasks)
    // a task added here into a folder deleted over there → keep the task, move
    // it to the first folder rather than orphaning it
    let pids = Set(projects.map(idOf))
    if !projects.isEmpty {
        tasks = tasks.map { t in
            var t = t
            if !pids.contains(t["projectId"]?.string ?? "") { t["projectId"] = projects[0]["id"] }
            return t
        }
    }
    return Snapshot(projects: projects, tasks: tasks, habits: mergeList(b.habits, l.habits, r.habits), seedV: max(l.seedV, r.seedV))
}
