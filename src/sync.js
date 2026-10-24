import { supabase } from './supabase'
import { fingerprint, mergeSnapshots, syncShape } from './merge'

// Cloud sync for one signed-in user.
//
// We remember the last copy the cloud confirmed ("base", persisted so it
// survives reloads and offline stretches). That gives us two guarantees:
//   • changes made while offline are still known to be unsynced after the
//     app is closed and reopened, so they get merged in, not overwritten;
//   • a push only lands if the cloud still holds our base — if another device
//     wrote first, we pull its copy, merge, and push the merge instead.

export const BASE_KEY = 'kiln-sync-base'
const TABLE = 'kiln_data'

export function readBase(userId) {
  try {
    const b = JSON.parse(localStorage.getItem(BASE_KEY))
    if (!b || b.userId !== userId || !b.data) return null
    return { at: b.at ?? null, data: b.data, json: fingerprint(b.data) }
  } catch {
    return null
  }
}

export function clearBase() {
  try {
    localStorage.removeItem(BASE_KEY)
  } catch {
    /* ignore */
  }
}

const RETRY = [3000, 10000, 30000, 60000]

/**
 * getLocal()      → current synced slice of local state
 * applyRemote(d)  → replace local projects/tasks/habits with d
 * onStatus(s)     → 'syncing' | 'synced' | 'offline' | 'error'
 */
export function createSync({ userId, getLocal, applyRemote, onStatus }) {
  let base = readBase(userId)
  let channel = null
  let pushing = null // the in-flight push promise
  let again = false
  let recheck = false // a cloud change arrived mid-push
  let conflicts = 0
  let retryTimer = null
  let retryN = 0
  let started = false
  let stopped = false

  const status = (s) => !stopped && onStatus(s)
  const pending = () => !base || fingerprint(getLocal()) !== base.json

  const setBase = (data, at) => {
    const shaped = syncShape(data)
    base = { at, data: shaped, json: fingerprint(shaped) }
    try {
      localStorage.setItem(BASE_KEY, JSON.stringify({ userId, at, data: shaped }))
    } catch {
      /* storage full — base lives in memory for this session */
    }
  }

  const failed = (e) => {
    console.warn('[kiln] sync:', e?.message ?? e)
    status(navigator.onLine === false ? 'offline' : 'error')
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => (started ? push() : start()), RETRY[Math.min(retryN++, RETRY.length - 1)])
  }

  async function pull() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? { data: data.data, at: data.updated_at } : null
  }

  // Fold a cloud copy into local state.
  function absorb(cloud) {
    if (!Array.isArray(cloud?.data?.projects) || !Array.isArray(cloud?.data?.tasks)) return
    const json = fingerprint(cloud.data)
    const local = getLocal()
    if (base && json === base.json) {
      // nothing new (often our own echo) — just track the cloud's version
      if (cloud.at) setBase(base.data, cloud.at)
      return
    }
    if (!base || fingerprint(local) === base.json) {
      // first sync on this device, or nothing unsynced here → cloud wins
      setBase(cloud.data, cloud.at)
      applyRemote(syncShape(cloud.data))
      return
    }
    // both sides changed since we last agreed
    const merged = mergeSnapshots(base.data, local, cloud.data)
    setBase(cloud.data, cloud.at)
    if (fingerprint(merged) !== fingerprint(local)) applyRemote(merged)
  }

  async function writeOnce(data) {
    const at = new Date().toISOString()
    if (conflicts >= 3) {
      // something keeps racing us (or the version check can't match) — we've
      // merged already, so a plain overwrite is safe enough to break the loop
      const { error } = await supabase.from(TABLE).upsert({ user_id: userId, data, updated_at: at })
      if (error) throw error
      return at
    }
    if (base?.at) {
      // only lands if the cloud still holds the version we merged against
      const { data: rows, error } = await supabase
        .from(TABLE)
        .update({ data, updated_at: at })
        .eq('user_id', userId)
        .eq('updated_at', base.at)
        .select('updated_at')
      if (error) throw error
      return rows?.[0]?.updated_at ?? null
    }
    // no known cloud version: create the row, unless one already exists
    const { data: rows, error } = await supabase
      .from(TABLE)
      .insert({ user_id: userId, data, updated_at: at })
      .select('updated_at')
    if (error?.code === '23505') return null
    if (error) throw error
    return rows?.[0]?.updated_at ?? at
  }

  async function doPush() {
    const local = syncShape(getLocal())
    const json = fingerprint(local)
    if (base && json === base.json) return status('synced')
    status('syncing')
    const at = await writeOnce(local)
    if (at) {
      conflicts = 0
      retryN = 0
      setBase(local, at)
      if (pending()) again = true
      else status('synced')
      return
    }
    // another device got there first: take its copy in, then try again
    conflicts++
    const cloud = await pull()
    if (cloud) absorb(cloud)
    else base = null // row vanished → next write creates it
    again = true
  }

  function push() {
    if (stopped) return Promise.resolve()
    if (pushing) {
      again = true
      return pushing
    }
    clearTimeout(retryTimer)
    pushing = doPush()
      .catch(failed)
      .finally(() => {
        pushing = null
        if (stopped) return
        if (again) {
          again = false
          return push()
        }
        if (recheck) {
          recheck = false
          return refresh()
        }
      })
    return pushing
  }

  function subscribe() {
    if (channel) return
    channel = supabase
      .channel(`kiln-sync-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
        (payload) => {
          if (pushing) {
            recheck = true // look again once our own write has settled
            return
          }
          const row = payload.new
          // large rows can arrive without their payload — fetch it instead
          if (row?.data) absorb({ data: row.data, at: row.updated_at })
          else refresh()
        }
      )
      .subscribe()
  }

  async function start() {
    if (stopped) return
    status('syncing')
    try {
      const cloud = await pull()
      if (stopped) return
      if (cloud) absorb(cloud)
      started = true
      retryN = 0
      subscribe()
      await push() // adopts local on a brand-new account; no-op when in step
    } catch (e) {
      failed(e)
    }
  }

  // Fallback freshness for when realtime is down or the app was asleep.
  function refresh() {
    if (stopped || !started) return start()
    if (pending()) return push()
    if (pushing) return pushing
    return pull()
      .then((cloud) => cloud && absorb(cloud))
      .catch(failed)
  }

  // Resolve once everything local is in the cloud (or it's clear it can't be).
  async function flush(timeoutMs = 6000) {
    const done = (async () => {
      for (let i = 0; i < 4 && pending(); i++) await push()
      return !pending()
    })()
    const timeout = new Promise((res) => setTimeout(() => res(false), timeoutMs))
    return Promise.race([done, timeout])
  }

  function stop() {
    stopped = true
    clearTimeout(retryTimer)
    if (channel) supabase.removeChannel(channel)
    channel = null
  }

  return {
    start,
    push,
    refresh,
    flush,
    stop,
    pending,
    // another tab confirmed a newer base — adopt it so we don't re-push its work
    reloadBase: () => {
      const b = readBase(userId)
      if (b) base = b
    },
  }
}
