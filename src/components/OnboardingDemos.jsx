import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PlusIcon, CalendarIcon, ClockIcon, FlagIcon, FlameIcon } from './Icons'
import { fmtTime } from '../utils'
import { t, fmtDate } from '../i18n'

// Small looping animations that show each feature in action inside onboarding.
// All are decorative and self-contained (their own timers, cleaned up on unmount).

const useCycle = (n, ms) => {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % n), ms)
    return () => clearInterval(id)
  }, [n, ms])
  return i
}

/* type naturally → tokens become pills → collapses into a filed task.
   Alternates a relative date ("tomorrow") with a real one ("26 oct") so
   both read as things you can type. */
// The typed text stays English (that's what the parser reads); what it turns
// into is shown in the reader's language.
const nlExamples = () => {
  const oct26 = fmtDate(new Date(2026, 9, 26), { month: 'short', day: 'numeric' })
  return [
    {
      text: 'gym tomorrow 7am !high #fitness',
      title: 'gym',
      meta: `${t('tomorrow')} · ${fmtTime('07:00')}`,
      pills: [
        { key: 'd', icon: <CalendarIcon size={11} />, label: t('tomorrow') },
        { key: 't', icon: <ClockIcon size={11} />, label: fmtTime('07:00') },
        { key: 'p', icon: <FlagIcon size={10} filled />, label: t('prio_high') },
        { key: 'f', dot: true, label: t('p_fitness') },
      ],
    },
    {
      text: 'pay rent 26 oct 6pm #home',
      title: 'pay rent',
      meta: `${oct26} · ${fmtTime('18:00')}`,
      pills: [
        { key: 'd', icon: <CalendarIcon size={11} />, label: oct26 },
        { key: 't', icon: <ClockIcon size={11} />, label: fmtTime('18:00') },
        { key: 'f', dot: true, label: t('home') },
      ],
    },
  ]
}

export function NLDemo() {
  const examples = nlExamples()
  const tick = useCycle(examples.length * 3, 1700)
  const ex = examples[Math.floor(tick / 3)]
  const phase = tick % 3
  const text = phase === 2 ? ex.title : ex.text
  return (
    <div className="demo demo-nl">
      <div className="demo-nl-bar">
        <span className="demo-nl-plus"><PlusIcon size={12} sw={2.4} /></span>
        <span className="demo-nl-text">
          {text}
          <i className="demo-caret" />
        </span>
      </div>
      <div className="demo-nl-below">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.div
              key={`pills-${ex.title}`}
              className="demo-nl-pills"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {ex.pills.map((p, i) => (
                <motion.span
                  key={p.key}
                  className="demo-pill"
                  initial={{ opacity: 0, y: 6, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.11, type: 'spring', stiffness: 420, damping: 24 }}
                >
                  {p.dot ? <span className="demo-pill-dot" /> : p.icon}
                  {p.label}
                </motion.span>
              ))}
            </motion.div>
          )}
          {phase === 2 && (
            <motion.div
              key={`card-${ex.title}`}
              className="demo-mini-card"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            >
              <span className="demo-mini-check on">✓</span>
              <span className="demo-mini-title">{ex.title}</span>
              <span className="demo-mini-meta">{ex.meta}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* tap to complete: circle fills, check draws, title strikes through */
export function TapDemo({ accent }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setDone((d) => !d), 1700)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="demo demo-tap">
      <button
        className={`demo-check ${done ? 'on' : ''}`}
        style={done ? { background: accent, borderColor: accent } : undefined}
        onClick={() => setDone((d) => !d)}
        aria-label="demo"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <motion.path
            d="M6.5 12.5 L10.5 16.2 L17.5 8.2"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
            transition={{ duration: 0.3, ease: [0.65, 0, 0.35, 1] }}
          />
        </svg>
      </button>
      <span className="demo-tap-title">
        {t('demoFinishReport')}
        <motion.span
          className="demo-strike"
          initial={false}
          animate={{ scaleX: done ? 1 : 0 }}
          transition={{ duration: 0.35, ease: [0.65, 0, 0.35, 1] }}
        />
      </span>
    </div>
  )
}

/* mini month with due-dots popping over time */
export function CalendarDemo() {
  const dots = { 3: '#d85a30', 8: '#5f7c8a', 13: '#8a5a7c', 17: '#6f9b7a', 21: '#d9a441', 25: '#d85a30' }
  const today = 13
  return (
    <div className="demo demo-cal">
      <div className="demo-cal-head">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => fmtDate(new Date(2024, 0, 1 + i), { weekday: 'narrow' })).map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="demo-cal-grid">
        {Array.from({ length: 28 }).map((_, i) => (
          <div key={i} className={`demo-cal-cell ${i === today ? 'today' : ''}`}>
            {i + 1}
            {dots[i] && (
              <motion.span
                className="demo-cal-dot"
                style={{ background: dots[i] }}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1, 1, 0] }}
                transition={{ duration: 3, times: [0, 0.15, 0.8, 1], repeat: Infinity, delay: (i % 6) * 0.25 }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* pomodoro ring sweeping */
export function FocusDemo() {
  const R = 34
  const C = 2 * Math.PI * R
  return (
    <div className="demo demo-focus">
      <svg viewBox="0 0 80 80" className="demo-focus-ring">
        <circle cx="40" cy="40" r={R} stroke="var(--border)" strokeWidth="5" fill="none" />
        <motion.circle
          cx="40"
          cy="40"
          r={R}
          stroke="var(--accent)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          transform="rotate(-90 40 40)"
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: [C, C * 0.12] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
        />
      </svg>
      <div className="demo-focus-label">
        <b>24:31</b>
        <span>{t('demoFocusLabel')}</span>
      </div>
    </div>
  )
}

/* momentum: a habit streak building + a weekly bar chart growing */
export function MomentumDemo({ accent }) {
  const n = useCycle(15, 320) // 0..14 filling dots + streak counter
  const cycle = useCycle(100, 2600) // remount bars to regrow
  const bars = [45, 68, 34, 88, 58, 78, 100]
  return (
    <div className="demo demo-momentum">
      <div className="demo-habit">
        <div className="demo-habit-top">
          <span className="demo-habit-name">{t('demoHabit')}</span>
          <span className="demo-habit-streak" style={{ color: accent }}>
            <FlameIcon size={12} /> {n}
          </span>
        </div>
        <div className="demo-habit-track">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="demo-habit-dot" style={i < n ? { background: accent } : undefined} />
          ))}
        </div>
      </div>
      <div className="demo-chart">
        {bars.map((h, i) => (
          <div key={i} className="demo-chart-col">
            <motion.div
              key={cycle}
              className="demo-chart-bar"
              initial={{ height: '6%' }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 130, damping: 16 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
