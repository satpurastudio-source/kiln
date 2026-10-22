import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useStore, todayProgress, selectInsights, taskInView } from '../store'
import { isOverdue, priorityRank, PRIORITIES, fmtTime, greeting } from '../utils'
import { FOCUS_KEY, resolveMode } from './Focus'
import { emberMood, EMBER_MOODS, isNightHour } from '../ember'
import Checkbox from './Checkbox'
import ProgressRing from './ProgressRing'
import Ember from './Ember'
import AnalogClock from './AnalogClock'
import { XIcon, FlameIcon } from './Icons'

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MO = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const ROW_CAP = 10

const dateLabel = (d) => `${WD[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MO[d.getMonth()]}`
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

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

// A widget with nothing worth showing renders nothing — an idle box is
// just visual noise on a screen meant to be glanced at.
function Widget({ kind, progress, streak, focusSession, focusTask, focusSecsLeft, focusPct }) {
  if (kind === 'streak') {
    if (streak <= 0) return null
    return (
      <div className="amb-widget">
        <span className="amb-widget-label">STREAK</span>
        <div className="amb-widget-row">
          <FlameIcon size={22} className="amb-widget-flame" />
          <span className="amb-widget-value">
            {streak} day{streak === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    )
  }
  if (kind === 'progress') {
    return (
      <div className="amb-widget">
        <span className="amb-widget-label">TODAY</span>
        <div className="amb-widget-row">
          <ProgressRing size={38} stroke={4} pct={progress.pct} />
          <span className="amb-widget-value">{progress.pct}%</span>
        </div>
      </div>
    )
  }
  if (kind === 'focus') {
    if (!focusSession) return null
    return (
      <div className="amb-widget amb-widget-live">
        <span className="amb-widget-label">{focusSession.phase === 'work' ? 'FOCUS' : 'BREAK'}</span>
        <div className="amb-widget-row">
          <ProgressRing
            size={38}
            stroke={4}
            pct={focusPct}
            color={focusSession.phase === 'work' ? 'var(--accent)' : '#7c8a4d'}
          />
          <div className="amb-widget-focus-info">
            <span className="amb-widget-value">{fmtCountdown(focusSecsLeft)}</span>
            <span className="amb-widget-sub">{focusTask?.title ?? 'Focus session'}</span>
          </div>
        </div>
      </div>
    )
  }
  return null
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

  const visibleTodo = activeToday.slice(0, ROW_CAP)
  const todoOverflow = activeToday.length - visibleTodo.length
  const visibleDone = completedToday.slice(0, ROW_CAP)
  const doneOverflow = completedToday.length - visibleDone.length

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

  const widgetProps = { progress, streak: insights.streak, focusSession, focusTask, focusSecsLeft, focusPct }

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

  const toggle = (id) => dispatch({ type: 'TOGGLE_TASK', id })

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

      <div className="amb-layout">
        <div className="amb-left">
          <AnalogClock now={now} reducedEffects={!!settings.reducedEffects} />
          <div className="amb-date">
            {dateLabel(now)} <span className="amb-date-time">{hhmm(now)}</span>
          </div>
          <div className="amb-widgets">
            <Widget kind={settings.ambientWidget1 ?? 'streak'} {...widgetProps} />
            <Widget kind={settings.ambientWidget2 ?? 'focus'} {...widgetProps} />
          </div>
        </div>

        <div className="amb-right">
          <div className="amb-head">
            <div className="amb-greet">
              {greeting()}
              {state.profile?.name ? `, ${state.profile.name.split(/\s+/)[0]}` : ''}
              <span className="dot">.</span>
            </div>
            <div className="amb-progress">
              <div className="amb-progress-track">
                <motion.div
                  className="amb-progress-fill"
                  initial={false}
                  animate={{ width: `${progress.pct}%` }}
                  transition={{ type: 'spring', stiffness: 60, damping: 18 }}
                />
              </div>
              <span className="amb-progress-label">
                {progress.done}/{progress.total} · {progress.pct}%
              </span>
            </div>
          </div>

          <LayoutGroup>
            <div className="amb-board">
              <div className="amb-col">
                <div className="amb-col-head">
                  <span className="amb-col-dot todo" />
                  TODO <span className="amb-col-count">{activeToday.length}</span>
                </div>
                {visibleTodo.length === 0 ? (
                  <div className="amb-empty">Nothing due. Rest or plan tomorrow.</div>
                ) : (
                  <AnimatePresence initial={false}>
                    {visibleTodo.map((t) => (
                      <motion.div
                        key={t.id}
                        layoutId={`amb-${t.id}`}
                        className="amb-row"
                        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                      >
                        <Checkbox checked={false} color="var(--accent)" onToggle={() => toggle(t.id)} />
                        {isOverdue(t.due) && <span className="amb-overdue-dot" />}
                        <span className="amb-row-title">{t.title}</span>
                        {t.time && <span className="amb-row-tag">{fmtTime(t.time)}</span>}
                        {t.priority !== 'none' && (
                          <span className={`amb-row-tag prio-${t.priority}`}>
                            {PRIORITIES.find((p) => p.id === t.priority)?.label}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                {todoOverflow > 0 && <div className="amb-more">+{todoOverflow} more</div>}
              </div>

              <div className="amb-col">
                <div className="amb-col-head">
                  <span className="amb-col-dot done" />
                  DONE <span className="amb-col-count">{completedToday.length}</span>
                </div>
                {visibleDone.length === 0 ? (
                  <div className="amb-empty">Nothing finished yet.</div>
                ) : (
                  <AnimatePresence initial={false}>
                    {visibleDone.map((t) => (
                      <motion.div
                        key={t.id}
                        layoutId={`amb-${t.id}`}
                        className="amb-row done"
                        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                      >
                        <Checkbox checked color="var(--accent)" onToggle={() => toggle(t.id)} />
                        <span className="amb-row-title">{t.title}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                {doneOverflow > 0 && <div className="amb-more">+{doneOverflow} more</div>}
              </div>
            </div>
          </LayoutGroup>

          {settings.ambientShowEmber !== false && (
            <Ember
              mood={mood}
              streak={insights.streak}
              overdueCount={overdueCount}
              reducedEffects={!!settings.reducedEffects}
              size={128}
            />
          )}
        </div>
      </div>
    </div>
  )
}
