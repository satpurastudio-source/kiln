import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { emberScale, randomLine } from '../ember'

// A small flame/coal creature. Pure SVG + Framer Motion, no image assets.
// Mood is handed in from Ambient.jsx (via ember.js's emberMood()) so this
// component stays a dumb, unit-reasonable renderer of a mood string.
export default function Ember({
  mood = 'idle',
  streak = 0,
  overdueCount = 0,
  reducedEffects = false,
  size = 100,
}) {
  const [blink, setBlink] = useState(false)
  const [hover, setHover] = useState(false)
  const [line, setLine] = useState('')
  const blinkTimer = useRef(null)

  // idle-only blink, random 5-9s apart; fully off when effects are reduced
  // or another mood already controls the eyes.
  useEffect(() => {
    clearTimeout(blinkTimer.current)
    if (mood !== 'idle' || reducedEffects) return
    const schedule = () => {
      blinkTimer.current = setTimeout(() => {
        setBlink(true)
        setTimeout(() => setBlink(false), 140)
        schedule()
      }, 5000 + Math.random() * 4000)
    }
    schedule()
    return () => clearTimeout(blinkTimer.current)
  }, [mood, reducedEffects])

  const scale = emberScale(streak)
  const still = reducedEffects
  const t = (anim) => (still ? { duration: 0 } : anim)

  const flameAnim = {
    focus: { scaleY: [1, 1.04, 1], scaleX: [1, 0.98, 1] },
    celebrate: { scaleY: [1, 1.22, 1], scaleX: [1, 1.1, 1] },
    worried: { rotate: [-3, 3, -2, 2, 0], scaleY: [1, 0.96, 1] },
    proud: { scaleY: [1.12, 1.16, 1.12], scaleX: [1.08, 1.1, 1.08] },
    sleepy: { scaleY: [0.78, 0.74, 0.78], scaleX: [0.78, 0.8, 0.78] },
    idle: { scaleY: [1, 1.05, 1], scaleX: [1, 0.97, 1] },
  }[mood]

  const flameDur = { focus: 2.6, celebrate: 0.5, worried: 0.6, proud: 3.4, sleepy: 4, idle: 3.2 }[mood]
  const flameRepeat = mood === 'celebrate' ? 0 : Infinity

  const bodyLean =
    mood === 'worried' ? { rotate: [-2, 2, -1, 0] } : mood === 'celebrate' ? { y: [0, -10, 0] } : { y: 0, rotate: 0 }

  const eyesClosed = mood === 'proud' || mood === 'sleepy' || blink
  const eyesNarrow = mood === 'focus'
  const eyesSide = mood === 'worried'

  const eyeOffsetX = eyesSide ? -3 : 0

  const flameColor = mood === 'celebrate' || mood === 'proud' ? 'var(--accent-2)' : 'var(--accent)'

  const showLine = () => {
    setLine(randomLine(mood, { overdueCount }))
    setHover(true)
  }

  return (
    <div
      className={`amb-ember ${hover ? 'hover' : ''}`}
      style={{ width: size, height: size }}
      onMouseEnter={showLine}
      onMouseLeave={() => setHover(false)}
    >
      {hover && <div className="amb-ember-bubble">{line}</div>}
      <motion.svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        initial={false}
        animate={{ scale, ...bodyLean }}
        transition={t({
          scale: { type: 'spring', stiffness: 120, damping: 14 },
          y: { duration: 0.5, ease: 'easeOut' },
          rotate: { duration: 1.8, repeat: mood === 'worried' ? Infinity : 0, ease: 'easeInOut' },
        })}
      >
        {/* coal base */}
        <ellipse cx="50" cy="76" rx="26" ry="13" fill="var(--accent-deep)" opacity="0.9" />

        {/* flame */}
        <motion.path
          d="M50 20
             C 34 34, 28 50, 38 62
             C 30 58, 26 70, 38 78
             C 44 82, 56 82, 62 78
             C 74 70, 70 58, 62 62
             C 72 50, 66 34, 50 20 Z"
          fill={flameColor}
          style={{ transformOrigin: '50px 60px' }}
          animate={flameAnim}
          transition={t({ duration: flameDur, repeat: flameRepeat, ease: 'easeInOut' })}
        />

        {/* eyes */}
        {eyesClosed ? (
          <>
            <path d="M40 58 Q44 61 48 58" stroke="var(--bg)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M52 58 Q56 61 60 58" stroke="var(--bg)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx={44 + eyeOffsetX} cy="58" rx="2.6" ry={eyesNarrow ? 1.2 : 2.8} fill="var(--bg)" />
            <ellipse cx={56 + eyeOffsetX} cy="58" rx="2.6" ry={eyesNarrow ? 1.2 : 2.8} fill="var(--bg)" />
          </>
        )}
      </motion.svg>
    </div>
  )
}
