import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, todayProgress, selectInsights, taskInView } from '../store'
import { isOverdue, priorityRank, PRIORITIES, fmtTime } from '../utils'
import { FOCUS_KEY, resolveMode } from './Focus'
import { emberMood, EMBER_MOODS, isNightHour } from '../ember'
import Checkbox from './Checkbox'
import ProgressRing from './ProgressRing'
import Ember from './Ember'
import { XIcon } from './Icons'

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MO = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const dateLabel = (d) => `${WD[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MO[d.getMonth()]}`

function formatClock(d, is24) {
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  if (is24) return `${String(h).padStart(2, '0')}:${m}`
  const ap = h < 12 ? 'AM' : 'PM'
  h = h % 12 === 0 ? 12 : h % 12
  return `${h}:${m} ${ap}`
}

const fmtCountdown = (secs) => {
  const s = Math.max(0, Math.ceil(secs))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const sortToday = (a, b) => {
  const ao = isOverdue(a.due) ? 0 : 1
  const bo = isOverdue(b.due) ? 0 : 1
  if (ao !== bo) return ao - bo
  const at = a.time || '99:99'
  const bt = b.time || '99:99'
  if (at !== bt) return at < bt ? -1 : 1
  return priorityRank[a.priority] - priorityRank[b.priority]
}

// Minute-boundary clock: a setTimeout rescheduled each tick, never a
// continuous interval, so idle CPU stays near zero.
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id
    const schedule = () => {
      const msToNext = 60000 - (Date.now() % 60000) + 20
      id = setTimeout(() => {
        setNow(new Date())
        schedule()
      }, msToNext)
    }
    schedule()
    return () => clearTimeout(id)
  }, [])
  return now
}

const readFocusSession = () => {
  try {
    const s = JSON.parse(localStorage.getItem(FOCUS_KEY))
    return s?.taskId ? s : null
  } catch {
    return null
  }
}

// Mirrors kiln-focus read-only — Ambient never owns or controls the timer.
function useFocusSession() {
  const [session, setSession] = useState(readFocusSession)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === FOCUS_KEY) setSession(readFocusSession())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  // only polls while a session actually exists (performance budget)
  useEffect(() => {
    if (!session) return
    const id = setInterval(() => setSession(readFocusSession()), 1000)
    return () => clearInterval(id)
  }, [!!session])
  return session
}

export default function Ambient({ onExit }) {
  const { state, dispatch } = useStore()
  const now = useMinuteClock()
  const focusSession = useFocusSession()
  const settings = state.settings

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const moodOverride =
    import.meta.env.DEV && EMBER_MOODS.includes(params.get('mood')) ? params.get('mood') : null

  // forces a re-render 8s after a completion so the 'celebrate' mood (which
  // reads a live Date.now() inside emberMood) has a chance to expire even
  // with nothing else happening — the only extra timer this adds
  const [, bump] = useState(0)
  const prevDoneRef = useRef(todayProgress(state).done)
  useEffect(() => {
    const doneNow = todayProgress(state).done
    if (doneNow > prevDoneRef.current) {
      const id = setTimeout(() => bump((n) => n + 1), 8000)
      prevDoneRef.current = doneNow
      return () => clearTimeout(id)
    }
    prevDoneRef.current = doneNow
  }, [state.tasks])

  const { activeToday, completedToday, overdueCount } = useMemo(() => {
    const active = state.tasks
      .filter((t) => !t.done && !t.archived && taskInView(t, { type: 'today' }))
      .sort(sortToday)
    const todayStr = new Date().toDateString()
    const completed = state.tasks
      .filter((t) => t.done && !t.archived && t.doneAt && new Date(t.doneAt).toDateString() === todayStr)
      .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
    const overdue = active.filter((t) => isOverdue(t.due)).length
    return { activeToday: active, completedToday: completed, overdueCount: overdue }
  }, [state.tasks])

  const combined = [...activeToday, ...completedToday]
  const visibleRows = combined.slice(0, 7)
  const overflowCount = combined.length - visibleRows.length

  const progress = todayProgress(state)
  const insights = selectInsights(state)
  const mood = moodOverride ?? emberMood(state, focusSession, now)

  const focusTask = focusSession ? state.tasks.find((t) => t.id === focusSession.taskId) : null
  const focusSecsLeft = !focusSession
    ? 0
    : focusSession.remaining !== null
      ? focusSession.remaining
      : (focusSession.endsAt - Date.now()) / 1000
  const focusMode = focusSession ? resolveMode(focusSession.mode ?? 'classic', settings) : null
  const focusDuration =
    focusSession && focusMode
      ? focusSession.phase === 'work'
        ? focusMode.work
        : focusSession.count % 4 === 0 && focusSession.count > 0
          ? focusMode.brk * 3
          : focusMode.brk
      : 1
  const focusPct = focusSession ? Math.min(100, Math.max(0, (focusSecsLeft / focusDuration) * 100)) : 0

  // burn-in protection: nudge the whole layout a little every 3 minutes
  const [drift, setDrift] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const id = setInterval(() => {
      setDrift({ x: Math.random() * 12, y: Math.random() * 12 })
    }, 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const isNight = isNightHour(now)
  const nightDim = isNight && settings.ambientNightDim !== false

  // Screen Wake Lock — best-effort; re-acquire whenever the tab regains focus
  // since the browser silently releases it when hidden.
  useEffect(() => {
    let lock = null
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible' && 'wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen')
        }
      } catch {
        /* unsupported, denied, or battery-saver — ambient still works fine */
      }
    }
    acquire()
    const onVis = () => acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release?.().catch(() => {})
    }
  }, [])

  // Esc to exit
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  // the "×" only shows while the mouse is actually moving
  const [mouseActive, setMouseActive] = useState(false)
  const hideTimer = useRef(null)
  useEffect(() => {
    const onMove = () => {
      setMouseActive(true)
      clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setMouseActive(false), 2200)
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      clearTimeout(hideTimer.current)
    }
  }, [])

  return (
    <div
      className={`amb-root ${nightDim ? 'amb-night' : ''}`}
      style={{ transform: `translate(${drift.x}px, ${drift.y}px)` }}
    >
      <AnimatePresence>
        {mouseActive && (
          <motion.button
            className="amb-close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onExit}
            aria-label="Exit ambient mode"
          >
            <XIcon size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="amb-top">
        <div className="amb-date">{dateLabel(now)}</div>
        <div className="amb-chips">
          <div className="amb-chip">
            <ProgressRing size={22} stroke={3} pct={progress.pct} />
            <span>{progress.pct}%</span>
          </div>
          {insights.streak > 0 && <div className="amb-chip amb-streak">🔥 {insights.streak}d</div>}
        </div>
      </div>

      <div className="amb-clock-wrap">
        <div className="amb-clock">{formatClock(now, settings.ambientClock24 !== false)}</div>
      </div>

      <div className="amb-bottom">
        <div className="amb-today">
          <div className="amb-section-label">
            TODAY <span>· {progress.active} left</span>
          </div>
          {visibleRows.length === 0 ? (
            <div className="amb-empty">Nothing due. Rest or plan tomorrow.</div>
          ) : (
            <>
              {visibleRows.map((t) => (
                <div key={t.id} className={`amb-row ${t.done ? 'done' : ''}`}>
                  <Checkbox
                    checked={t.done}
                    color="var(--accent)"
                    onToggle={() => dispatch({ type: 'TOGGLE_TASK', id: t.id })}
                  />
                  {!t.done && isOverdue(t.due) && <span className="amb-overdue-dot" />}
                  <span className="amb-row-title">{t.title}</span>
                  {!t.done && t.time && <span className="amb-row-time">{fmtTime(t.time)}</span>}
                  {!t.done && t.priority !== 'none' && (
                    <span className="amb-row-priority">
                      {PRIORITIES.find((p) => p.id === t.priority)?.label}
                    </span>
                  )}
                </div>
              ))}
              {overflowCount > 0 && <div className="amb-more">+{overflowCount} more</div>}
            </>
          )}
        </div>

        <div className="amb-bottom-right">
          {focusSession && (
            <div className="amb-focus">
              <div className="amb-section-label">FOCUS</div>
              <div className="amb-focus-body">
                <ProgressRing size={54} stroke={4} pct={focusPct} color={focusSession.phase === 'work' ? 'var(--accent)' : '#7c8a4d'} />
                <div className="amb-focus-info">
                  <span className="amb-focus-time">{fmtCountdown(focusSecsLeft)}</span>
                  <span className="amb-focus-task">{focusTask?.title ?? 'Focus session'}</span>
                  <span className="amb-focus-phase">{focusSession.phase === 'work' ? 'focus' : 'break'}</span>
                </div>
              </div>
            </div>
          )}

          {settings.ambientShowEmber !== false && (
            <Ember
              mood={mood}
              streak={insights.streak}
              overdueCount={overdueCount}
              reducedEffects={!!settings.reducedEffects}
            />
          )}
        </div>
      </div>
    </div>
  )
}
