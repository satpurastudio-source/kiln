import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import {
  uid,
  todayStr,
  addDaysStr,
  toDateStr,
  isOverdue,
  isToday,
  priorityRank,
  nextDue,
  resolveAccent,
  DEFAULT_SETTINGS,
  PROJECT_COLORS,
  PROJECT_ICONS,
} from './utils'
import { setSoundEnabled } from './sound'
import { setFxLite } from './fx'
import { supabase, pullCloud, pushCloud } from './supabase'

const STORAGE_KEY = 'zenith-v1'
// Deleted tasks linger here before being purged.
export const TRASH_TTL = 30 * 24 * 60 * 60 * 1000
const StoreCtx = createContext(null)

/* ---------------------------------- seed ---------------------------------- */

function seed() {
  const p1 = { id: uid(), name: 'Getting Started', color: '#d85a30', icon: '✦' }
  const p2 = { id: uid(), name: 'Work', color: '#5f7c8a', icon: '◆' }
  const p3 = { id: uid(), name: 'Personal', color: '#8a5a7c', icon: '❋' }
  const t = (projectId, title, extra = {}) => ({
    id: uid(),
    projectId,
    title,
    notes: '',
    priority: 'none',
    due: null,
    done: false,
    doneAt: null,
    createdAt: Date.now(),
    ...extra,
  })
  return {
    projects: [p1, p2, p3],
    tasks: [
      t(p1.id, 'Tap the circle to complete me — watch what happens ✨', { priority: 'high' }),
      t(p1.id, 'Drag the ⋮⋮ grip to reorder me'),
      t(p1.id, 'Tap me to edit notes, dates, time & priority', {
        priority: 'medium',
        notes: 'Everything is editable inline. Try moving me to another folder.',
      }),
      t(p1.id, 'Add a task using the bar above'),
      t(p1.id, 'Explore Calendar, Focus & the ⚙ Settings menu', { priority: 'low' }),
      t(p1.id, 'Finish every task in a folder for a surprise 🎉'),
    ],
    habits: [],
    stats: emptyStats(),
    trash: [],
    theme: 'light', // light is the default face of kiln; dark is one toggle away
    sound: true,
    view: { type: 'today', projectId: null },
    profile: null,
    settings: { ...DEFAULT_SETTINGS },
    onboarded: false,
    seedV: 3,
  }
}

// Demo tasks removed from the seed in v2 — cleaned out of existing data once.
const RETIRED_SEED_TASKS = new Set([
  'Review quarterly roadmap',
  'Ship the design system update',
  'Book weekend trip',
  'Call home',
])

// v3: tutorial tasks no longer carry due dates (they were showing up as
// "overdue" and reading like real deadlines)
const TUTORIAL_TITLES = new Set([
  'Complete me — watch what happens ✨',
  'Hover me, then drag the ⋮⋮ grip to reorder',
  'Click me to edit notes, dates & priority',
  'Press N to add a task, / to search',
  'Open the command palette with Ctrl + K',
  'Finish every task in a project for a surprise 🎉',
])

const stripTutorialDues = (tasks) =>
  tasks.map((t) => (t.due && TUTORIAL_TITLES.has(t.title) ? { ...t, due: null } : t))

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

// Colors from the old violet theme → warm portfolio palette
const COLOR_MIGRATION = {
  '#8b7cf8': '#d85a30',
  '#5ad1e6': '#5f7c8a',
  '#f472b6': '#8a5a7c',
  '#4ade80': '#7c8a4d',
  '#f5a54b': '#d9a441',
  '#f4536e': '#a03c1c',
  '#facc15': '#d9a441',
  '#60a5fa': '#5f7c8a',
}

/* ------------------------------ completion log ----------------------------- */
// A persistent record of finished work so Insights survive clearing/deleting
// tasks. Kept device-local (not synced) and keyed by day.
//   stats = { days: { 'YYYY-MM-DD': { done, folders: {pid:n}, hours: {h:n} } }, pomos }

const emptyStats = () => ({ days: {}, pomos: 0 })

function withRecord(stats, ds, pid, hour) {
  const s = { days: { ...stats.days }, pomos: stats.pomos }
  const prev = s.days[ds] || { done: 0, folders: {}, hours: {} }
  const day = { done: prev.done + 1, folders: { ...prev.folders }, hours: { ...prev.hours } }
  if (pid) day.folders[pid] = (day.folders[pid] || 0) + 1
  day.hours[hour] = (day.hours[hour] || 0) + 1
  s.days[ds] = day
  return s
}

function withUnrecord(stats, ds, pid, hour) {
  if (!stats.days[ds]) return stats
  const s = { days: { ...stats.days }, pomos: stats.pomos }
  const prev = s.days[ds]
  const day = { done: Math.max(0, prev.done - 1), folders: { ...prev.folders }, hours: { ...prev.hours } }
  if (pid && day.folders[pid]) day.folders[pid] = Math.max(0, day.folders[pid] - 1)
  if (day.hours[hour]) day.hours[hour] = Math.max(0, day.hours[hour] - 1)
  s.days[ds] = day
  return s
}

// one-time backfill for users who completed tasks before the log existed
function buildStatsFromTasks(tasks) {
  let stats = emptyStats()
  for (const t of tasks) {
    if (t.done && t.doneAt) {
      const dt = new Date(t.doneAt)
      stats = withRecord(stats, toDateStr(dt), t.projectId, dt.getHours())
    }
    stats.pomos += t.pomos || 0
  }
  return stats
}

/* --------------------------------- reducer -------------------------------- */

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TASK': {
      // `newFolder` (from typing "#name" for a folder that doesn't exist yet)
      // creates the folder on the fly and drops the task into it
      let projects = state.projects
      let projectId = action.projectId
      if (action.newFolder?.trim()) {
        const n = state.projects.length
        const folder = {
          id: uid(),
          name: action.newFolder.trim(),
          color: PROJECT_COLORS[n % PROJECT_COLORS.length],
          icon: PROJECT_ICONS[n % PROJECT_ICONS.length],
        }
        projects = [...state.projects, folder]
        projectId = folder.id
      }
      if (!projectId) return state
      const task = {
        id: uid(),
        projectId,
        title: action.title.trim(),
        notes: '',
        priority: action.priority || 'none',
        due: action.due ?? null,
        time: action.time ?? null,
        done: false,
        doneAt: null,
        createdAt: Date.now(),
      }
      return { ...state, projects, tasks: [task, ...state.tasks] }
    }
    case 'TOGGLE_TASK': {
      const target = state.tasks.find((t) => t.id === action.id)
      if (!target) return state
      const completing = !target.done
      let tasks = state.tasks.map((t) =>
        t.id === action.id
          ? {
              ...t,
              done: completing,
              doneAt: completing ? Date.now() : null,
              // completed copy stops repeating so un-toggling can't double-spawn
              repeat: completing ? 'none' : t.repeat,
            }
          : t
      )
      // repeating task: completing it forges the next occurrence
      if (completing && target.repeat && target.repeat !== 'none') {
        tasks = [
          {
            ...target,
            id: uid(),
            done: false,
            doneAt: null,
            createdAt: Date.now(),
            due: nextDue(target.due, target.repeat),
            pomos: 0,
            subs: (target.subs ?? []).map((s) => ({ ...s, done: false })),
          },
          ...tasks,
        ]
      }
      // record into the persistent log so Insights outlive the task itself
      let stats = state.stats
      if (completing) {
        const now = new Date()
        stats = withRecord(stats, toDateStr(now), target.projectId, now.getHours())
      } else if (target.doneAt) {
        const dt = new Date(target.doneAt)
        stats = withUnrecord(stats, toDateStr(dt), target.projectId, dt.getHours())
      }
      return { ...state, tasks, stats }
    }
    case 'UPDATE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      }
    }
    case 'ARCHIVE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, archived: true } : t)),
      }
    }
    case 'UNARCHIVE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, archived: false } : t)),
      }
    }
    case 'DELETE_TASK': {
      // move to trash (recoverable) instead of destroying immediately
      const target = state.tasks.find((t) => t.id === action.id)
      if (!target) return state
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        trash: [{ ...target, deletedAt: Date.now() }, ...state.trash],
      }
    }
    case 'RESTORE_TASK': {
      // pull a task back out of the trash
      const item = state.trash.find((t) => t.id === action.id)
      if (!item) return state
      const { deletedAt, ...task } = item
      return {
        ...state,
        tasks: [task, ...state.tasks],
        trash: state.trash.filter((t) => t.id !== action.id),
      }
    }
    case 'PURGE_TRASH': {
      // one id → delete forever; no id → drop everything past its TTL window
      if (action.id) return { ...state, trash: state.trash.filter((t) => t.id !== action.id) }
      const now = Date.now()
      return { ...state, trash: state.trash.filter((t) => now - t.deletedAt < TRASH_TTL) }
    }
    case 'EMPTY_TRASH': {
      return { ...state, trash: [] }
    }
    case 'REORDER_TASKS': {
      // action.ids = visible active task ids in their new order.
      // Rebuild the global list: slots that held one of these ids get refilled
      // in the new sequence; everything else stays put.
      const idSet = new Set(action.ids)
      const queue = [...action.ids]
      const byId = Object.fromEntries(state.tasks.map((t) => [t.id, t]))
      return {
        ...state,
        tasks: state.tasks.map((t) => (idSet.has(t.id) ? byId[queue.shift()] : t)),
      }
    }
    case 'CLEAR_COMPLETED': {
      const now = Date.now()
      const cleared = state.tasks.filter((t) => t.done && !t.archived)
      return {
        ...state,
        tasks: state.tasks.filter((t) => !(t.done && !t.archived)),
        trash: [...cleared.map((t) => ({ ...t, deletedAt: now })), ...state.trash],
      }
    }
    case 'DELETE_TASKS': {
      const ids = new Set(action.ids)
      const now = Date.now()
      const removed = state.tasks.filter((t) => ids.has(t.id))
      return {
        ...state,
        tasks: state.tasks.filter((t) => !ids.has(t.id)),
        trash: [...removed.map((t) => ({ ...t, deletedAt: now })), ...state.trash],
      }
    }
    case 'ADD_PROJECT': {
      const project = { id: uid(), name: action.name.trim(), color: action.color, icon: action.icon }
      return {
        ...state,
        projects: [...state.projects, project],
        view: { type: 'project', projectId: project.id },
      }
    }
    case 'UPDATE_PROJECT': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      }
    }
    case 'SET_PROJECTS': {
      // wholesale replace (used by onboarding to tailor starter folders)
      if (!Array.isArray(action.projects) || action.projects.length === 0) return state
      return { ...state, projects: action.projects, view: sanitizeView(state.view, action.projects) }
    }
    case 'ADD_HABIT': {
      const habit = {
        id: uid(),
        name: action.name.trim(),
        color: action.color,
        createdAt: Date.now(),
        log: {},
      }
      return { ...state, habits: [...state.habits, habit] }
    }
    case 'TOGGLE_HABIT': {
      const date = action.date ?? todayStr()
      return {
        ...state,
        habits: state.habits.map((h) => {
          if (h.id !== action.id) return h
          const log = { ...h.log }
          if (log[date]) delete log[date]
          else log[date] = true
          return { ...h, log }
        }),
      }
    }
    case 'UPDATE_HABIT': {
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)),
      }
    }
    case 'DELETE_HABIT': {
      return { ...state, habits: state.habits.filter((h) => h.id !== action.id) }
    }
    case 'LOG_FOCUS': {
      // a completed pomodoro — counted for all time, survives clearing tasks
      return { ...state, stats: { ...state.stats, pomos: (state.stats?.pomos || 0) + 1 } }
    }
    case 'DELETE_PROJECT': {
      const view =
        state.view.type === 'project' && state.view.projectId === action.id
          ? { type: 'today', projectId: null }
          : state.view
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        tasks: state.tasks.filter((t) => t.projectId !== action.id),
        view,
      }
    }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'SET_PROFILE':
      return { ...state, profile: action.profile }
    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...(state.profile ?? {}), ...action.patch } }
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'SET_ONBOARDED':
      return { ...state, onboarded: action.value }
    case 'SIGN_OUT':
      return { ...state, profile: null }
    case 'HYDRATE': {
      // replace local projects/tasks with the cloud copy
      if (!Array.isArray(action.data?.projects) || !Array.isArray(action.data?.tasks)) return state
      const cloudSeedV = action.data.seedV ?? 1
      return {
        ...state,
        projects: action.data.projects,
        tasks: cloudSeedV < 3 ? stripTutorialDues(action.data.tasks) : action.data.tasks,
        // habits arrived with sync in a later version — keep local ones if an
        // older cloud payload doesn't carry the key yet
        habits: Array.isArray(action.data.habits) ? action.data.habits : state.habits,
        // the current view may point at a project that doesn't exist in the
        // cloud copy (different device, different ids) — fall back to Today
        view: sanitizeView(state.view, action.data.projects),
      }
    }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SET_SOUND':
      return { ...state, sound: action.sound }
    default:
      return state
  }
}

/* -------------------------------- provider -------------------------------- */

// A view is only valid if the project it points at actually exists.
function sanitizeView(view, projects) {
  if (view?.type === 'project' && !projects.some((p) => p.id === view.projectId)) {
    return { type: 'today', projectId: null }
  }
  return view?.type ? view : { type: 'today', projectId: null }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seed()
    const data = JSON.parse(raw)
    if (!Array.isArray(data.projects) || !Array.isArray(data.tasks)) return seed()
    const seedV = data.seedV ?? 1
    let tasks = data.tasks
    if (seedV < 2) tasks = tasks.filter((t) => !RETIRED_SEED_TASKS.has(t.title))
    if (seedV < 3) tasks = stripTutorialDues(tasks)
    return {
      ...data,
      projects: data.projects.map((p) => ({
        ...p,
        color: COLOR_MIGRATION[p.color] ?? p.color,
      })),
      tasks,
      habits: Array.isArray(data.habits) ? data.habits : [],
      // backfill the completion log once from existing done tasks (older saves)
      stats: data.stats && data.stats.days ? data.stats : buildStatsFromTasks(tasks),
      // drop anything that already outlived its trash window while closed
      trash: (Array.isArray(data.trash) ? data.trash : []).filter(
        (t) => Date.now() - t.deletedAt < TRASH_TTL
      ),
      seedV: 3,
      profile: data.profile ?? null,
      settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
      // anyone who already has a profile has clearly used the app before —
      // don't push returning users back through the first-run tour
      onboarded: data.onboarded ?? !!data.profile,
      view: sanitizeView(data.view, data.projects),
    }
  } catch {
    return seed()
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load)

  useEffect(() => {
    const { projects, tasks, habits, stats, trash, theme, sound, view, profile, settings, onboarded, seedV } = state
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projects, tasks, habits, stats, trash, theme, sound, view, profile, settings, onboarded, seedV })
    )
  }, [state])

  // Smooth theme switch: briefly turn on transitions for every element,
  // then remove the class so it doesn't fight other animations.
  const firstTheme = useRef(true)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = state.theme
    if (firstTheme.current) {
      firstTheme.current = false
      return
    }
    root.classList.add('theme-transitioning')
    const t = setTimeout(() => root.classList.remove('theme-transitioning'), 420)
    return () => {
      clearTimeout(t)
      root.classList.remove('theme-transitioning')
    }
  }, [state.theme])

  useEffect(() => {
    setSoundEnabled(state.sound)
  }, [state.sound])

  // Personalization: retint the whole app from the chosen accent.
  useEffect(() => {
    const a = resolveAccent(state.settings)
    const s = document.documentElement.style
    s.setProperty('--accent', a.accent)
    s.setProperty('--accent-2', a.accent2)
    s.setProperty('--accent-deep', a.deep)
    s.setProperty('--accent-rgb', a.rgb)
  }, [state.settings.accent, state.settings.customAccent])

  // Reduced-effects mode: kill blur/aurora/confetti for a lighter, faster feel.
  useEffect(() => {
    const on = !!state.settings.reducedEffects
    document.documentElement.classList.toggle('fx-lite', on)
    setFxLite(on)
  }, [state.settings.reducedEffects])

  // Trash auto-purge: fire exactly when the soonest item expires, then reschedule.
  useEffect(() => {
    if (!state.trash.length) return
    const soonest = Math.min(...state.trash.map((t) => t.deletedAt + TRASH_TTL))
    const id = setTimeout(() => dispatch({ type: 'PURGE_TRASH' }), Math.max(0, soonest - Date.now()) + 80)
    return () => clearTimeout(id)
  }, [state.trash])

  /* ------------------------- cloud auth + sync ------------------------- */

  // Always-fresh snapshot of what should be synced, without re-running effects.
  const snapshotRef = useRef(null)
  snapshotRef.current = { projects: state.projects, tasks: state.tasks, habits: state.habits, seedV: 3 }

  // Fingerprint of the last state we know the cloud has — used to skip
  // no-op pushes and to recognize our own realtime echoes.
  const lastSyncedRef = useRef('')
  const channelRef = useRef(null)

  const hasPendingLocalChanges = () =>
    stableStringify(snapshotRef.current) !== lastSyncedRef.current

  const applyIncoming = (incoming) => {
    if (!incoming?.projects || !incoming?.tasks) return
    const json = stableStringify({
      projects: incoming.projects,
      tasks: incoming.tasks,
      habits: incoming.habits ?? [],
      seedV: incoming.seedV ?? 3,
    })
    if (json === lastSyncedRef.current) return // our own echo
    // local edits not yet pushed win (they'll overwrite the cloud shortly)
    if (hasPendingLocalChanges() && lastSyncedRef.current !== '') return
    lastSyncedRef.current = json
    dispatch({ type: 'HYDRATE', data: incoming })
  }

  useEffect(() => {
    let alive = true

    const startRealtime = (userId) => {
      if (channelRef.current) return
      channelRef.current = supabase
        .channel(`kiln-sync-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'kiln_data', filter: `user_id=eq.${userId}` },
          (payload) => applyIncoming(payload.new?.data)
        )
        .subscribe()
    }

    const stopRealtime = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }

    const applySession = async (session) => {
      const u = session?.user
      if (!u) return
      const name = u.user_metadata?.name || u.email?.split('@')[0] || 'there'
      dispatch({
        type: 'SET_PROFILE',
        profile: { name, email: u.email, userId: u.id, cloud: true },
      })
      // a real account means they're not a first-run user — skip the tour
      dispatch({ type: 'SET_ONBOARDED', value: true })
      try {
        const cloud = await pullCloud(u.id)
        if (!alive) return
        if (cloud) {
          lastSyncedRef.current = stableStringify({
            projects: cloud.projects,
            tasks: cloud.tasks,
            habits: cloud.habits ?? [],
            seedV: cloud.seedV ?? 3,
          })
          dispatch({ type: 'HYDRATE', data: cloud })
        } else {
          // first sign-in on this account: adopt whatever is on this device
          await pushCloud(u.id, snapshotRef.current)
          lastSyncedRef.current = stableStringify(snapshotRef.current)
        }
        startRealtime(u.id)
      } catch (e) {
        console.warn('[kiln] cloud sync unavailable:', e.message)
        toast('Cloud sync unavailable — working locally', '⚠')
      }
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // deferred: calling other supabase APIs synchronously inside this
      // callback can deadlock the client's internal auth lock
      setTimeout(() => {
        if (event === 'SIGNED_IN') applySession(session)
        if (event === 'SIGNED_OUT') {
          stopRealtime()
          lastSyncedRef.current = ''
          dispatch({ type: 'SIGN_OUT' })
        }
      }, 0)
    })
    return () => {
      alive = false
      stopRealtime()
      sub.subscription.unsubscribe()
    }
  }, [])

  // Debounced push: any task/project change lands in the cloud ~1s later.
  const pushTimer = useRef(null)
  useEffect(() => {
    const p = state.profile
    if (!p?.cloud || !p.userId) return
    clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      const json = stableStringify(snapshotRef.current)
      if (json === lastSyncedRef.current) return // nothing actually changed
      pushCloud(p.userId, snapshotRef.current)
        .then(() => {
          lastSyncedRef.current = json
        })
        .catch((e) => console.warn('[kiln] sync push failed:', e.message))
    }, 1200)
    return () => clearTimeout(pushTimer.current)
  }, [state.projects, state.tasks, state.habits, state.profile])

  // Fallback freshness: re-pull when the tab regains focus (covers devices
  // where realtime isn't enabled and long-suspended phone tabs).
  useEffect(() => {
    const p = state.profile
    if (!p?.cloud || !p.userId) return
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      if (hasPendingLocalChanges()) return // our push will win — don't clobber
      pullCloud(p.userId)
        .then((cloud) => cloud && applyIncoming(cloud))
        .catch(() => {})
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [state.profile])

  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

export const useStore = () => useContext(StoreCtx)

/* -------------------------------- selectors ------------------------------- */

export function taskInView(task, view) {
  switch (view.type) {
    case 'today':
      return isToday(task.due) || isOverdue(task.due)
    case 'upcoming':
    case 'calendar':
      return !!task.due
    case 'all':
      return true
    case 'project':
      return task.projectId === view.projectId
    default:
      return true
  }
}

function matches(task, query) {
  if (!query) return true
  const q = query.toLowerCase()
  return task.title.toLowerCase().includes(q) || task.notes.toLowerCase().includes(q)
}

export function selectActive(state, query = '') {
  return state.tasks.filter(
    (t) => !t.done && !t.archived && taskInView(t, state.view) && matches(t, query)
  )
}

export function selectCompleted(state, query = '') {
  const doneToday = (t) => {
    if (state.view.type !== 'today') return true
    return t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString()
  }
  return state.tasks
    .filter((t) => t.done && !t.archived && taskInView(t, state.view) && matches(t, query) && doneToday(t))
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
}

export function projectProgress(state, projectId) {
  const tasks = state.tasks.filter((t) => t.projectId === projectId && !t.archived)
  if (tasks.length === 0) return { total: 0, done: 0, pct: 0 }
  const done = tasks.filter((t) => t.done).length
  return { total: tasks.length, done, pct: Math.round((done / tasks.length) * 100) }
}

export function todayProgress(state) {
  const active = state.tasks.filter(
    (t) => !t.done && !t.archived && (isToday(t.due) || isOverdue(t.due))
  ).length
  const doneToday = state.tasks.filter(
    (t) => t.done && !t.archived && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString()
  ).length
  const total = active + doneToday
  return { active, done: doneToday, total, pct: total === 0 ? 0 : Math.round((doneToday / total) * 100) }
}

// Analytics for the Insights view — reads the persistent completion log so it
// survives clearing/deleting the tasks themselves.
export function selectInsights(state) {
  const log = state.stats || { days: {}, pomos: 0 }
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = toDateStr(d)
    days.push({
      ds,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      count: log.days[ds]?.done || 0,
    })
  }

  const folderCount = {}
  for (const day of days) {
    const f = log.days[day.ds]?.folders || {}
    for (const pid in f) folderCount[pid] = (folderCount[pid] || 0) + f[pid]
  }
  const byFolder = state.projects
    .map((p) => ({ name: p.name, color: p.color, count: folderCount[p.id] || 0 }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count)

  // best hour across all recorded history
  const hours = new Array(24).fill(0)
  for (const ds in log.days) {
    const h = log.days[ds].hours || {}
    for (const k in h) hours[k] += h[k]
  }
  const bestHour = hours.some((x) => x > 0) ? hours.indexOf(Math.max(...hours)) : null

  const totalWeek = days.reduce((s, d) => s + d.count, 0)
  const bestDay = days.reduce((a, b) => (b.count > a.count ? b : a), days[0])

  // day streak: consecutive days with ≥1 completion, ending today or yesterday
  let d = new Date()
  const hasDone = (dt) => (log.days[toDateStr(dt)]?.done || 0) > 0
  if (!hasDone(d)) d.setDate(d.getDate() - 1)
  let streak = 0
  while (hasDone(d)) {
    streak++
    d.setDate(d.getDate() - 1)
  }

  return {
    days,
    totalWeek,
    byFolder,
    bestHour,
    bestDay,
    totalPomos: log.pomos || 0,
    streak,
    maxDay: Math.max(1, ...days.map((x) => x.count)),
  }
}

// Group tasks for the Upcoming view
export function groupUpcoming(tasks) {
  const groups = [
    { id: 'overdue', label: 'Overdue', tasks: [] },
    { id: 'today', label: 'Today', tasks: [] },
    { id: 'tomorrow', label: 'Tomorrow', tasks: [] },
    { id: 'week', label: 'Next 7 days', tasks: [] },
    { id: 'later', label: 'Later', tasks: [] },
  ]
  const week = addDaysStr(7)
  for (const t of tasks) {
    if (isOverdue(t.due)) groups[0].tasks.push(t)
    else if (t.due === todayStr()) groups[1].tasks.push(t)
    else if (t.due === addDaysStr(1)) groups[2].tasks.push(t)
    else if (t.due <= week) groups[3].tasks.push(t)
    else groups[4].tasks.push(t)
  }
  for (const g of groups) {
    g.tasks.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : priorityRank[a.priority] - priorityRank[b.priority]))
  }
  return groups.filter((g) => g.tasks.length > 0)
}

/* ------------------------------- toast bus -------------------------------- */

const listeners = new Set()

export function toast(message, icon = '✓', action = null) {
  const t = { id: uid(), message, icon, action }
  listeners.forEach((fn) => fn(t))
}

export function onToast(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/* ------------------------------- focus bus -------------------------------- */
// Lets any task row start a pomodoro session without prop drilling.

const focusListeners = new Set()

export function startFocus(taskId) {
  focusListeners.forEach((fn) => fn(taskId))
}

export function onFocusRequest(fn) {
  focusListeners.add(fn)
  return () => focusListeners.delete(fn)
}

/* -------------------------------- drag bus --------------------------------- */
// Task rows broadcast drag lifecycle so the drop-to-complete zone can react.

const dragListeners = new Set()

export function emitDrag(evt) {
  dragListeners.forEach((fn) => fn(evt))
}

export function onDrag(fn) {
  dragListeners.add(fn)
  return () => dragListeners.delete(fn)
}
