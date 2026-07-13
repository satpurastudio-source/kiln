import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { uid, todayStr, addDaysStr, isOverdue, isToday, priorityRank } from './utils'
import { setSoundEnabled } from './sound'
import { supabase, pullCloud, pushCloud } from './supabase'

const STORAGE_KEY = 'zenith-v1'
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
      t(p1.id, 'Complete me — watch what happens ✨', { due: todayStr(), priority: 'high' }),
      t(p1.id, 'Hover me, then drag the ⋮⋮ grip to reorder', { due: todayStr() }),
      t(p1.id, 'Click me to edit notes, dates & priority', {
        due: todayStr(),
        priority: 'medium',
        notes: 'Everything is editable inline. Try moving me to another project.',
      }),
      t(p1.id, 'Press N to add a task, / to search', { due: addDaysStr(1) }),
      t(p1.id, 'Open the command palette with Ctrl + K', { due: addDaysStr(1), priority: 'low' }),
      t(p1.id, 'Finish every task in a project for a surprise 🎉', { due: addDaysStr(2) }),
    ],
    theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    sound: true,
    view: { type: 'today', projectId: null },
    profile: null,
    seedV: 2,
  }
}

// Demo tasks removed from the seed in v2 — cleaned out of existing data once.
const RETIRED_SEED_TASKS = new Set([
  'Review quarterly roadmap',
  'Ship the design system update',
  'Book weekend trip',
  'Call home',
])

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

/* --------------------------------- reducer -------------------------------- */

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TASK': {
      const task = {
        id: uid(),
        projectId: action.projectId,
        title: action.title.trim(),
        notes: '',
        priority: action.priority || 'none',
        due: action.due ?? null,
        done: false,
        doneAt: null,
        createdAt: Date.now(),
      }
      return { ...state, tasks: [task, ...state.tasks] }
    }
    case 'TOGGLE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : null }
            : t
        ),
      }
    }
    case 'UPDATE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      }
    }
    case 'DELETE_TASK': {
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) }
    }
    case 'RESTORE_TASK': {
      return { ...state, tasks: [action.task, ...state.tasks] }
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
      return { ...state, tasks: state.tasks.filter((t) => !t.done) }
    }
    case 'DELETE_TASKS': {
      const ids = new Set(action.ids)
      return { ...state, tasks: state.tasks.filter((t) => !ids.has(t.id)) }
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
    case 'SIGN_OUT':
      return { ...state, profile: null }
    case 'HYDRATE': {
      // replace local projects/tasks with the cloud copy
      if (!Array.isArray(action.data?.projects) || !Array.isArray(action.data?.tasks)) return state
      return { ...state, projects: action.data.projects, tasks: action.data.tasks }
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

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seed()
    const data = JSON.parse(raw)
    if (!Array.isArray(data.projects) || !Array.isArray(data.tasks)) return seed()
    const seedV = data.seedV ?? 1
    return {
      ...data,
      projects: data.projects.map((p) => ({
        ...p,
        color: COLOR_MIGRATION[p.color] ?? p.color,
      })),
      tasks: seedV < 2 ? data.tasks.filter((t) => !RETIRED_SEED_TASKS.has(t.title)) : data.tasks,
      seedV: 2,
      profile: data.profile ?? null,
      view: data.view?.type ? data.view : { type: 'today', projectId: null },
    }
  } catch {
    return seed()
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load)

  useEffect(() => {
    const { projects, tasks, theme, sound, view, profile, seedV } = state
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projects, tasks, theme, sound, view, profile, seedV })
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

  /* ------------------------- cloud auth + sync ------------------------- */

  // Always-fresh snapshot of what should be synced, without re-running effects.
  const snapshotRef = useRef(null)
  snapshotRef.current = { projects: state.projects, tasks: state.tasks }

  useEffect(() => {
    let alive = true

    const applySession = async (session) => {
      const u = session?.user
      if (!u) return
      const name = u.user_metadata?.name || u.email?.split('@')[0] || 'there'
      dispatch({
        type: 'SET_PROFILE',
        profile: { name, email: u.email, userId: u.id, cloud: true },
      })
      try {
        const cloud = await pullCloud(u.id)
        if (!alive) return
        if (cloud) {
          dispatch({ type: 'HYDRATE', data: cloud })
        } else {
          // first sign-in on this account: adopt whatever is on this device
          await pushCloud(u.id, snapshotRef.current)
        }
      } catch (e) {
        console.warn('[kiln] cloud sync unavailable:', e.message)
        toast('Cloud sync unavailable — working locally', '⚠')
      }
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') applySession(session)
      if (event === 'SIGNED_OUT') dispatch({ type: 'SIGN_OUT' })
    })
    return () => {
      alive = false
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
      pushCloud(p.userId, snapshotRef.current).catch((e) =>
        console.warn('[kiln] sync push failed:', e.message)
      )
    }, 1200)
    return () => clearTimeout(pushTimer.current)
  }, [state.projects, state.tasks, state.profile])

  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

export const useStore = () => useContext(StoreCtx)

/* -------------------------------- selectors ------------------------------- */

export function taskInView(task, view) {
  switch (view.type) {
    case 'today':
      return isToday(task.due) || isOverdue(task.due)
    case 'upcoming':
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
  return state.tasks.filter((t) => !t.done && taskInView(t, state.view) && matches(t, query))
}

export function selectCompleted(state, query = '') {
  const doneToday = (t) => {
    if (state.view.type !== 'today') return true
    return t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString()
  }
  return state.tasks
    .filter((t) => t.done && taskInView(t, state.view) && matches(t, query) && doneToday(t))
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
}

export function projectProgress(state, projectId) {
  const tasks = state.tasks.filter((t) => t.projectId === projectId)
  if (tasks.length === 0) return { total: 0, done: 0, pct: 0 }
  const done = tasks.filter((t) => t.done).length
  return { total: tasks.length, done, pct: Math.round((done / tasks.length) * 100) }
}

export function todayProgress(state) {
  const active = state.tasks.filter((t) => !t.done && (isToday(t.due) || isOverdue(t.due))).length
  const doneToday = state.tasks.filter(
    (t) => t.done && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString()
  ).length
  const total = active + doneToday
  return { active, done: doneToday, total, pct: total === 0 ? 0 : Math.round((doneToday / total) * 100) }
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
