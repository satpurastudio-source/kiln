import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, onFocusRequest, toast } from '../store'
import { playComplete, playFanfare, playPop } from '../sound'
import { PauseIcon, PlayIcon, SkipIcon, XIcon, FlameIcon } from './Icons'

const FOCUS_KEY = 'kiln-focus'
const MODES = {
  classic: { work: 25 * 60, brk: 5 * 60, label: '25 · 5' },
  deep: { work: 50 * 60, brk: 10 * 60, label: '50 · 10' },
}

const loadSession = () => {
  try {
    const s = JSON.parse(localStorage.getItem(FOCUS_KEY))
    return s?.taskId ? s : null
  } catch {
    return null
  }
}

const fmt = (secs) => {
  const s = Math.max(0, Math.ceil(secs))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Focus() {
  const { state, dispatch } = useStore()
  const [session, setSession] = useState(loadSession)
  const [open, setOpen] = useState(false)
  const [, forceTick] = useState(0)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const task = session ? state.tasks.find((t) => t.id === session.taskId) : null
  const mode = MODES[session?.mode ?? 'classic']

  // a task row asked to start focusing
  useEffect(
    () =>
      onFocusRequest((taskId) => {
        const m = sessionRef.current?.mode ?? 'classic'
        setSession({
          taskId,
          mode: m,
          phase: 'work',
          endsAt: Date.now() + MODES[m].work * 1000,
          remaining: null, // null = running; number = paused seconds
          count: 0,
        })
        setOpen(true)
        playPop()
      }),
    []
  )

  useEffect(() => {
    if (session) localStorage.setItem(FOCUS_KEY, JSON.stringify(session))
    else localStorage.removeItem(FOCUS_KEY)
  }, [session])

  const running = session && session.remaining === null
  const secsLeft = !session
    ? 0
    : session.remaining !== null
      ? session.remaining
      : (session.endsAt - Date.now()) / 1000

  // ticking + phase transitions
  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      const s = sessionRef.current
      if (!s) return
      const left = (s.endsAt - Date.now()) / 1000
      if (left > 0) {
        forceTick((n) => n + 1)
        return
      }
      if (s.phase === 'work') {
        const count = s.count + 1
        playFanfare()
        toast(`Pomodoro ${count} done — take a break`, '🔥')
        if (taskIdRef.current) {
          dispatch({
            type: 'UPDATE_TASK',
            id: taskIdRef.current,
            patch: { pomos: (pomosRef.current ?? 0) + 1 },
          })
        }
        const brkLen = count % 4 === 0 ? MODES[s.mode].brk * 3 : MODES[s.mode].brk
        setSession({ ...s, phase: 'break', count, endsAt: Date.now() + brkLen * 1000 })
      } else {
        playComplete()
        toast('Break over — back to it', '⚒')
        setSession({ ...s, phase: 'work', endsAt: Date.now() + MODES[s.mode].work * 1000 })
      }
    }, 500)
    return () => clearInterval(iv)
  }, [running, dispatch])

  // refs so the interval reads fresh task info without re-subscribing
  const taskIdRef = useRef(null)
  const pomosRef = useRef(0)
  taskIdRef.current = task?.id ?? null
  pomosRef.current = task?.pomos ?? 0

  if (!session) return null

  const duration =
    session.phase === 'work'
      ? mode.work
      : session.count % 4 === 0 && session.count > 0
        ? mode.brk * 3
        : mode.brk
  const frac = Math.min(1, Math.max(0, secsLeft / duration))
  const isWork = session.phase === 'work'

  const pause = () => setSession({ ...session, remaining: secsLeft })
  const resume = () => setSession({ ...session, remaining: null, endsAt: Date.now() + secsLeft * 1000 })
  const skip = () => {
    if (isWork) {
      setSession({ ...session, phase: 'break', endsAt: Date.now() + mode.brk * 1000, remaining: null })
    } else {
      setSession({ ...session, phase: 'work', endsAt: Date.now() + mode.work * 1000, remaining: null })
    }
    playPop()
  }
  const end = () => {
    setSession(null)
    setOpen(false)
    playPop()
  }
  const setMode = (m) => {
    setSession({
      ...session,
      mode: m,
      endsAt: Date.now() + MODES[m][isWork ? 'work' : 'brk'] * 1000,
      remaining: session.remaining === null ? null : MODES[m][isWork ? 'work' : 'brk'],
    })
  }
  const completeTask = () => {
    if (task && !task.done) {
      dispatch({ type: 'TOGGLE_TASK', id: task.id })
      playFanfare()
      toast('Task forged 🔥', '✓')
    }
    end()
  }

  const R = 88
  const C = 2 * Math.PI * R

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="focus-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="focus-card"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              <div className="focus-top">
                <span className={`focus-phase ${isWork ? 'work' : 'brk'}`}>
                  {isWork ? '⚒ focus' : '☕ break'}
                </span>
                <div className="focus-modes">
                  {Object.entries(MODES).map(([id, m]) => (
                    <button
                      key={id}
                      className={`chip ${session.mode === id ? 'on' : ''}`}
                      onClick={() => setMode(id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <button className="icon-btn" onClick={() => setOpen(false)} title="Minimize">
                  —
                </button>
              </div>

              <div className="focus-ring">
                <svg viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r={R} stroke="var(--border)" strokeWidth="6" fill="none" />
                  <motion.circle
                    cx="100"
                    cy="100"
                    r={R}
                    stroke={isWork ? 'var(--accent)' : '#7c8a4d'}
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    animate={{ strokeDashoffset: C * (1 - frac) }}
                    transition={{ duration: 0.5, ease: 'linear' }}
                    transform="rotate(-90 100 100)"
                  />
                </svg>
                <div className="focus-time">
                  <span className="focus-clock">{fmt(secsLeft)}</span>
                  <span className="focus-task-name">{task?.title ?? 'Focus session'}</span>
                </div>
              </div>

              <div className="focus-pomos">
                {Array.from({ length: 4 }).map((_, i) => (
                  <FlameIcon
                    key={i}
                    size={13}
                    style={{
                      color: i < session.count % 4 || (session.count > 0 && session.count % 4 === 0)
                        ? 'var(--accent)'
                        : 'var(--border-strong)',
                    }}
                  />
                ))}
                {session.count > 0 && <span className="focus-count">{session.count} done</span>}
              </div>

              <div className="focus-controls">
                <button className="icon-btn focus-ctl" onClick={skip} title="Skip phase">
                  <SkipIcon size={15} />
                </button>
                <motion.button
                  className="focus-main-btn"
                  onClick={running ? pause : resume}
                  whileTap={{ scale: 0.92 }}
                >
                  {running ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
                </motion.button>
                <button className="icon-btn focus-ctl" onClick={end} title="End session">
                  <XIcon size={15} />
                </button>
              </div>

              {task && !task.done && (
                <button className="focus-complete" onClick={completeTask}>
                  ✓ Complete “{task.title.slice(0, 34)}
                  {task.title.length > 34 ? '…' : ''}”
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!open && (
          <motion.button
            className="focus-pill"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            title="Open focus session"
          >
            <span className={`focus-pill-dot ${isWork ? 'work' : 'brk'} ${running ? 'running' : ''}`} />
            <span className="focus-pill-time">{fmt(secsLeft)}</span>
            <span className="focus-pill-label">{isWork ? 'focus' : 'break'}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}
