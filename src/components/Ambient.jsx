import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useStore, todayProgress, selectInsights, taskInView } from '../store'
import { isOverdue, priorityRank, PRIORITIES, fmtTime, greeting, ambientConfig } from '../utils'
import { FOCUS_KEY, resolveMode } from './Focus'
import { emberMood, EMBER_MOODS, isNightHour } from '../ember'
import Checkbox from './Checkbox'
import ProgressRing from './ProgressRing'
import Ember from './Ember'
import AnalogClock from './AnalogClock'
import AmbientEditor from './AmbientEditor'
import AmbientQuickAdd from './AmbientQuickAdd'
import { XIcon, FlameIcon, SettingsIcon, PlusIcon } from './Icons'
import { t, tn, fmtDate, currentLang } from '../i18n'

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MO = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const WIDGET_H = 104 // px reserved per slot (≥ the tallest widget) so one leaving can't shift the clock
const CONTROLS_MS = 2600
// phones (either orientation) get a one-screen layout that never scrolls
const COMPACT_MQ = '(max-width: 700px), (max-height: 500px)'
const LANDSCAPE_MQ = '(orientation: landscape)'
const MORE_H = 28 // room for the "+N more" line

function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

// How many rows fit in the list box — measured, so row size, fonts and the
// customizer's settings all just work. Falls back to `max` until measured.
function useFitRows(ref, total, max, active) {
  const [fit, setFit] = useState(max)
  useEffect(() => {
    if (!active) return setFit(max)
    const el = ref.current
    if (!el) return
    const measure = () => {
      const row = el.querySelector('.amb-row')
      if (!row) return setFit(max)
      const rowH = row.offsetHeight
      const avail = el.clientHeight
      let n = Math.max(1, Math.floor(avail / rowH))
      if (total > n) n = Math.max(1, Math.floor((avail - MORE_H) / rowH))
      setFit(Math.min(max, n))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, total, max, active])
  return fit
}

// English keeps its "TUE 27 OCT" stamp; other languages get their own order + names
const dateLabel = (d) =>
  currentLang() === 'en'
    ? `${WD[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MO[d.getMonth()]}`
    : fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })
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

// A widget with nothing worth showing returns null — an idle box is just
// visual noise on a screen meant to be glanced at. Plain render helper (no
// hooks) so the caller can tell "nothing to show" apart before animating.
function renderWidget(kind, { progress, streak, focusSession, focusTask, focusSecsLeft, focusPct }) {
  if (kind === 'streak') {
    if (streak <= 0) return null
    return (
      <div className="amb-widget">
        <span className="amb-widget-label">{t('ambStreak')}</span>
        <div className="amb-widget-row">
          <FlameIcon size={22} className="amb-widget-flame" />
          <span className="amb-widget-value">
            {tn('days', streak)}
          </span>
        </div>
      </div>
    )
  }
  if (kind === 'progress') {
    return (
      <div className="amb-widget">
        <span className="amb-widget-label">{t('ambToday')}</span>
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
        <span className="amb-widget-label">{focusSession.phase === 'work' ? t('ambFocus') : t('ambBreak')}</span>
        <div className="amb-widget-row">
          <ProgressRing
            size={38}
            stroke={4}
            pct={focusPct}
            color={focusSession.phase === 'work' ? 'var(--accent)' : '#7c8a4d'}
          />
          <div className="amb-widget-focus-info">
            <span className="amb-widget-value">{fmtCountdown(focusSecsLeft)}</span>
            <span className="amb-widget-sub">{focusTask?.title ?? t('focusSession')}</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

const widgetMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
}

export default function Ambient({ onExit }) {
  const { state, dispatch } = useStore()
  const now = useMinuteClock()
  const focusSession = useFocusSession()
  const settings = state.settings
  const cfg = ambientConfig(settings)

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const moodOverride =
    import.meta.env.DEV && EMBER_MOODS.includes(params.get('mood')) ? params.get('mood') : null

  const [editing, setEditing] = useState(() => params.has('customize'))
  const [adding, setAdding] = useState(false)
  const setCfg = (patch) =>
    dispatch({ type: 'SET_SETTINGS', patch: { ambient: { ...(settings.ambient ?? {}), ...patch } } })
  const resetCfg = () => dispatch({ type: 'SET_SETTINGS', patch: { ambient: {} } })

  // Fade in only once the web fonts are in, so nothing re-flows (the "pop")
  // after first paint. Capped so a slow network can't hold the screen blank.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    const timeout = new Promise((r) => setTimeout(r, 1500))
    Promise.race([document.fonts?.ready ?? Promise.resolve(), timeout]).then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  // remount the watch when the tab wakes so its CSS hands resync after sleep
  const [clockKey, setClockKey] = useState(0)
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && setClockKey((k) => k + 1)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // forces a re-render 8s after a completion so the 'celebrate' mood (which
  // reads a live Date.now() inside emberMood) has a chance to expire even
  // with nothing else happening
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

  const compact = useMedia(COMPACT_MQ)
  const landscape = useMedia(LANDSCAPE_MQ)
  // phones show one column at a time behind a Todo/Done switch
  const [tab, setTab] = useState('todo')
  const phoneTab = cfg.columns === 'todo' ? 'todo' : tab
  const listRef = useRef(null)
  const phoneTotal = phoneTab === 'todo' ? activeToday.length : completedToday.length
  const fitRows = useFitRows(listRef, phoneTotal, cfg.maxRows, compact)
  const maxRows = compact ? fitRows : cfg.maxRows

  const visibleTodo = activeToday.slice(0, maxRows)
  const todoOverflow = activeToday.length - visibleTodo.length
  const visibleDone = completedToday.slice(0, maxRows)
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
  const slots = [cfg.widget1, cfg.widget2].filter((k) => k !== 'none').length

  // burn-in protection: nudge the whole layout a little every 3 minutes
  const [drift, setDrift] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (!cfg.drift) {
      setDrift({ x: 0, y: 0 })
      return
    }
    const id = setInterval(() => {
      setDrift({ x: Math.random() * cfg.drift, y: Math.random() * cfg.drift })
    }, 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [cfg.drift])

  const isNight = cfg.night !== 'off' && isNightHour(now, cfg.nightStart, cfg.nightEnd)
  const forcedTheme = isNight && cfg.night === 'dark' ? 'dark' : cfg.theme === 'app' ? null : cfg.theme

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

  // N opens quick add (same shortcut as the main app). Esc peels back one
  // layer at a time: quick add → customize panel → leave ambient.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
      if (e.key === 'Escape') {
        if (adding) setAdding(false)
        else if (editing) setEditing(false)
        else onExit()
        return
      }
      if ((e.key === 'n' || e.key === 'N') && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && cfg.quickAdd) {
        e.preventDefault()
        setAdding(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, editing, adding, cfg.quickAdd])

  // Controls (× and ⚙) show on mouse movement OR a tap — phones have no
  // hover and no Esc key, so a tap anywhere has to reveal the way out.
  const [controls, setControls] = useState(false)
  const shownRef = useRef(false)
  const hideTimer = useRef(null)
  // only touches state when visibility actually flips — pointermove fires
  // dozens of times a second and must not re-render the whole view
  const poke = useCallback(() => {
    if (!shownRef.current) {
      shownRef.current = true
      setControls(true)
    }
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      shownRef.current = false
      setControls(false)
    }, CONTROLS_MS)
  }, [])
  useEffect(() => {
    window.addEventListener('pointermove', poke)
    window.addEventListener('pointerdown', poke)
    return () => {
      window.removeEventListener('pointermove', poke)
      window.removeEventListener('pointerdown', poke)
      clearTimeout(hideTimer.current)
    }
  }, [poke])
  const showControls = controls || editing

  const toggle = (id) => dispatch({ type: 'TOGGLE_TASK', id })

  const rootStyle = {
    transform: `translate(${drift.x}px, ${drift.y}px)`,
    '--amb-pad': `${cfg.padding}px`,
    '--amb-gap': `${cfg.gap}px`,
    '--amb-clock': `${cfg.clockSize}px`,
    '--amb-row': `${cfg.rowSize}px`,
    '--amb-radius': `${cfg.radius}px`,
    '--amb-glow': cfg.glow / 100,
    '--amb-dim': cfg.nightLevel / 100,
    '--amb-ember-space': cfg.showEmber ? `${Math.round(cfg.emberSize * 0.85)}px` : '0px',
    '--amb-slots': slots,
  }

  const todoRows =
    visibleTodo.length === 0 ? (
      <div className="amb-empty">{t('ember_sleepy_0')}</div>
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
    )

  const doneRows =
    visibleDone.length === 0 ? (
      <div className="amb-empty">{t('nothingFinished')}</div>
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
    )

  const ember = cfg.showEmber && (
    <Ember
      mood={mood}
      streak={insights.streak}
      overdueCount={overdueCount}
      reducedEffects={!!settings.reducedEffects}
      eyesFollow={cfg.emberEyes}
      size={compact ? Math.min(cfg.emberSize, 52) : cfg.emberSize}
    />
  )

  return (
    <div
      className={[
        'amb-root',
        ready && 'ready',
        isNight && 'amb-night',
        forcedTheme && `amb-force-${forcedTheme}`,
        cfg.side === 'right' && 'flip',
        editing && 'editing',
        compact && 'compact',
        compact && landscape && 'landscape',
      ]
        .filter(Boolean)
        .join(' ')}
      style={rootStyle}
    >
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="amb-controls"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {cfg.quickAdd && (
              <button
                className={`amb-ctl ${adding ? 'on' : ''}`}
                onClick={() => setAdding((v) => !v)}
                aria-label={t('addTask')}
                title={t('addTaskN')}
              >
                <PlusIcon size={16} sw={2.2} />
              </button>
            )}
            <button
              className={`amb-ctl ${editing ? 'on' : ''}`}
              onClick={() => setEditing((v) => !v)}
              aria-label={t('customizeAmbient')}
              title={t('customize')}
            >
              <SettingsIcon size={16} />
            </button>
            <button className="amb-ctl" onClick={onExit} aria-label={t('exitAmbient')} title={t('exitEsc')}>
              <XIcon size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="amb-layout">
        <div className="amb-left">
          <AnalogClock
            key={clockKey}
            now={now}
            face={cfg.clockFace}
            seconds={cfg.seconds}
            reducedEffects={!!settings.reducedEffects}
          />
          <div className="amb-left-info">
            {(cfg.showDate || cfg.showDigital) && (
              <div className="amb-date">
                {cfg.showDate && dateLabel(now)}
                {cfg.showDigital && <span className="amb-date-time">{hhmm(now)}</span>}
              </div>
            )}
            {slots > 0 && (
              <div
                className="amb-widgets"
                style={compact ? undefined : { minHeight: slots * WIDGET_H + (slots - 1) * 12 }}
              >
                <AnimatePresence initial={false}>
                  {[cfg.widget1, cfg.widget2].map((kind, i) => {
                    const el = renderWidget(kind, widgetProps)
                    return el ? (
                      <motion.div key={`${i}-${kind}`} {...widgetMotion}>
                        {el}
                      </motion.div>
                    ) : null
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        <div className="amb-right">
          {(cfg.showGreeting || cfg.showProgress) && (
            <div className="amb-head">
              {cfg.showGreeting && (
                <div className="amb-greet">
                  {greeting()}
                  {state.profile?.name ? `, ${state.profile.name.split(/\s+/)[0]}` : ''}
                  <span className="dot">.</span>
                </div>
              )}
              {cfg.showProgress && (
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
              )}
              {compact && ember && <div className="amb-head-ember">{ember}</div>}
            </div>
          )}

          <LayoutGroup>
            {compact ? (
              <div className="amb-board">
                <div className="amb-col">
                  <div className="amb-col-head amb-tabs" role="tablist">
                    <button
                      role="tab"
                      aria-selected={phoneTab === 'todo'}
                      className={`amb-tab ${phoneTab === 'todo' ? 'on' : ''}`}
                      onClick={() => setTab('todo')}
                    >
                      <span className="amb-col-dot todo" />
                      {t('colTodo')} <span className="amb-col-count">{activeToday.length}</span>
                    </button>
                    {cfg.columns !== 'todo' && (
                      <button
                        role="tab"
                        aria-selected={phoneTab === 'done'}
                        className={`amb-tab ${phoneTab === 'done' ? 'on' : ''}`}
                        onClick={() => setTab('done')}
                      >
                        <span className="amb-col-dot done" />
                        {t('colDone')} <span className="amb-col-count">{completedToday.length}</span>
                      </button>
                    )}
                  </div>
                  <div className="amb-list" ref={listRef}>
                    {phoneTab === 'todo' ? todoRows : doneRows}
                    {phoneTab === 'todo'
                      ? todoOverflow > 0 && <div className="amb-more">{t('nMore', { n: todoOverflow })}</div>
                      : doneOverflow > 0 && <div className="amb-more">{t('nMore', { n: doneOverflow })}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`amb-board ${cfg.columns === 'todo' ? 'single' : ''}`}>
                <div className="amb-col">
                  <div className="amb-col-head">
                    <span className="amb-col-dot todo" />
                    {t('colTodo')} <span className="amb-col-count">{activeToday.length}</span>
                  </div>
                  {todoRows}
                  {todoOverflow > 0 && <div className="amb-more">{t('nMore', { n: todoOverflow })}</div>}
                </div>

                {cfg.columns !== 'todo' && (
                  <div className="amb-col">
                    <div className="amb-col-head">
                      <span className="amb-col-dot done" />
                      {t('colDone')} <span className="amb-col-count">{completedToday.length}</span>
                    </div>
                    {doneRows}
                    {doneOverflow > 0 && <div className="amb-more">{t('nMore', { n: doneOverflow })}</div>}
                  </div>
                )}
              </div>
            )}
          </LayoutGroup>
        </div>
      </div>

      {ember && !(compact && (cfg.showGreeting || cfg.showProgress)) && (
        <div className={`amb-ember-dock corner-${cfg.emberCorner}`}>{ember}</div>
      )}

      <AnimatePresence>{adding && <AmbientQuickAdd onClose={() => setAdding(false)} />}</AnimatePresence>

      <AnimatePresence>
        {editing && (
          <AmbientEditor cfg={cfg} onChange={setCfg} onReset={resetCfg} onClose={() => setEditing(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
