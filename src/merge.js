// Three-way merge for cross-device sync.
//
// `base` is the copy both sides last agreed on (what the cloud held at our
// last successful sync). Whatever changed on only one side since then is
// taken from that side; where both changed the same task, fields are merged
// one by one and only a true clash (same field, both edited) is settled by
// the newer `updatedAt`. Nothing is lost just because two devices edited
// while apart — that was the old "last write wins" behavior.

// Deterministic serialization (jsonb reorders keys) — used to tell real
// changes apart from our own sync echoes.
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

const S = stableStringify
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v)

// The synced part of the app state, in one canonical shape.
export const syncShape = (d) => ({
  projects: d?.projects ?? [],
  tasks: d?.tasks ?? [],
  habits: d?.habits ?? [],
  seedV: d?.seedV ?? 3,
})

export const fingerprint = (d) => S(syncShape(d))

function mergeObject(b, l, r, localWins) {
  const out = {}
  for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
    const bv = S(b[k])
    const lv = S(l[k])
    const rv = S(r[k])
    let v
    if (lv === rv || rv === bv) v = l[k]
    else if (lv === bv) v = r[k]
    // both edited a nested map (a habit's day log) → merge it key by key too
    else if (isPlain(l[k]) && isPlain(r[k])) v = mergeObject(isPlain(b[k]) ? b[k] : {}, l[k], r[k], localWins)
    else v = localWins ? l[k] : r[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

export function mergeList(base = [], local = [], remote = []) {
  const B = new Map(base.map((x) => [x.id, x]))
  const L = new Map(local.map((x) => [x.id, x]))
  const R = new Map(remote.map((x) => [x.id, x]))

  const pick = (id) => {
    const b = B.get(id)
    const l = L.get(id)
    const r = R.get(id)
    if (!b) return l && r ? mergeObject({}, l, r, (l.updatedAt ?? 0) >= (r.updatedAt ?? 0)) : (l ?? r)
    const bs = S(b)
    const lChanged = !l || S(l) !== bs
    const rChanged = !r || S(r) !== bs
    if (!lChanged) return r // edited or deleted over there
    if (!rChanged) return l // edited or deleted here
    if (!l) return r // deleted here but edited there → keep the edit
    if (!r) return l
    return mergeObject(b, l, r, (l.updatedAt ?? 0) >= (r.updatedAt ?? 0))
  }

  // Order: if this device didn't reorder anything, follow the other side's
  // order; otherwise keep ours. Items only the other side has are slotted in
  // right after their neighbour there.
  const order = (list, other) => list.filter((x) => other.has(x.id)).map((x) => x.id).join('|')
  const localReordered = order(local, B) !== order(base, L)
  const [primary, secondary] = localReordered ? [local, remote] : [remote, local]
  const ids = primary.map((x) => x.id)
  const seen = new Set(ids)
  secondary.forEach((x, i) => {
    if (seen.has(x.id)) return
    const at = i > 0 ? ids.indexOf(secondary[i - 1].id) : -1
    ids.splice(at + 1, 0, x.id)
    seen.add(x.id)
  })
  return ids.map(pick).filter(Boolean)
}

export function mergeSnapshots(base, local, remote) {
  const b = syncShape(base)
  const l = syncShape(local)
  const r = syncShape(remote)
  const projects = mergeList(b.projects, l.projects, r.projects)
  let tasks = mergeList(b.tasks, l.tasks, r.tasks)
  // a task added here into a folder deleted over there → keep the task,
  // move it to the first folder rather than orphaning it
  const pids = new Set(projects.map((p) => p.id))
  if (projects.length && tasks.some((t) => !pids.has(t.projectId))) {
    tasks = tasks.map((t) => (pids.has(t.projectId) ? t : { ...t, projectId: projects[0].id }))
  }
  return {
    projects,
    tasks,
    habits: mergeList(b.habits, l.habits, r.habits),
    seedV: Math.max(l.seedV, r.seedV),
  }
}
