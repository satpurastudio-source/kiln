import { useEffect, useId, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { emberScale, randomLine } from '../ember'

// The exact glyph used for the "kiln." brand mark (src/components/Icons.jsx
// FlameIcon) — Ember is that same mark, brought to life, not a new shape.
const FLAME_PATH =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'

const SPARKS = 7
const HOLD_MS = 1500
const POKE_MS = 250 // pointer-down shorter than this counts as a tap, not a hold
const EYE_RANGE = 0.55 // how far (in 24-unit glyph space) the eyes can glance
// the flame is always accent-colored, so the eyes stay dark in either theme
const EYE = '#1d1612'

export default function Ember({
  mood = 'idle',
  streak = 0,
  overdueCount = 0,
  reducedEffects = false,
  size = 100,
}) {
  const gradId = useId()
  const rootRef = useRef(null)
  const [blink, setBlink] = useState(false)
  const [hover, setHover] = useState(false)
  const [line, setLine] = useState('')
  const [holding, setHolding] = useState(false)
  const [poke, setPoke] = useState(0)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const blinkTimer = useRef(null)
  const downAt = useRef(0)
  const squash = useAnimationControls()

  // idle-only blink, random 5-9s apart
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

  // eyes glance toward the cursor — only fires while the mouse actually
  // moves, rAF-throttled, so it costs nothing on an untouched screen
  useEffect(() => {
    if (reducedEffects) return
    let raf = 0
    const onMove = (e) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const r = rootRef.current?.getBoundingClientRect()
        if (!r) return
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        const d = Math.hypot(dx, dy) || 1
        const k = Math.min(1, d / 400)
        setLook({ x: (dx / d) * EYE_RANGE * k, y: (dy / d) * EYE_RANGE * k })
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [reducedEffects])

  // a quick squash-and-stretch whenever a task completes
  useEffect(() => {
    if (mood === 'celebrate' && !reducedEffects) {
      squash.start({
        scaleY: [1, 0.82, 1.18, 0.96, 1],
        scaleX: [1, 1.14, 0.9, 1.03, 1],
        transition: { duration: 0.7, ease: 'easeOut' },
      })
    }
  }, [mood, reducedEffects, squash])

  const streakScale = emberScale(streak)

  // The per-mood sway/breath loops live in CSS (.amb-ember-body.anim-*) on
  // an HTML wrapper, so the GPU compositor runs them. Driving them from
  // Framer Motion on SVG cost ~60 style+layout passes a second while idle.
  const bodyAnim = `mood-${mood}${reducedEffects || holding ? ' still' : ''}`

  const eyesClosed = mood === 'proud' || mood === 'sleepy' || blink || holding
  const eyesNarrow = mood === 'focus'
  const eyeX = (mood === 'worried' ? -0.4 : look.x) + 0
  const eyeY = mood === 'worried' ? 0 : look.y

  // gradient stops: brighter/hotter for celebrate+proud, dimmer/duller for
  // worried+sleepy, the normal accent pair otherwise
  const [stopA, stopB] =
    mood === 'celebrate' || mood === 'proud'
      ? ['var(--accent-2)', '#ffd9a0']
      : mood === 'worried' || mood === 'sleepy'
        ? ['var(--accent-deep)', 'var(--accent)']
        : ['var(--accent)', 'var(--accent-2)']

  const glowLevel = { celebrate: 'hot', proud: 'warm', focus: 'steady', idle: 'steady', worried: 'low', sleepy: 'low' }[mood]

  const showLine = () => {
    setLine(randomLine(mood, { overdueCount }))
    setHover(true)
  }

  const onDown = () => {
    downAt.current = Date.now()
    setHolding(true)
  }
  const onUp = () => {
    setHolding(false)
    if (Date.now() - downAt.current < POKE_MS) {
      setPoke((n) => n + 1)
      if (!reducedEffects) {
        squash.start({
          scaleY: [1, 0.86, 1.1, 1],
          scaleX: [1, 1.1, 0.95, 1],
          transition: { duration: 0.45, ease: 'easeOut' },
        })
      }
    }
  }
  const onLeave = () => {
    setHover(false)
    setHolding(false)
  }

  const ambientFx = !reducedEffects && !holding

  return (
    <div
      ref={rootRef}
      className={`amb-ember mood-${mood} ${hover ? 'hover' : ''}`}
      style={{ width: size, height: size }}
      onMouseEnter={showLine}
      onMouseLeave={onLeave}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => setHolding(false)}
    >
      <AnimatePresence>
        {hover && (
          <motion.div
            className="amb-ember-bubble"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
          >
            {line}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="amb-ember-hold"
        animate={{ scale: holding ? 0.2 : 1 }}
        transition={{ duration: holding ? HOLD_MS / 1000 : 0.45, ease: holding ? 'easeIn' : [0.34, 1.4, 0.64, 1] }}
        style={{ transformOrigin: '50% 100%' }}
      >
        {/* soft halo behind the flame; brightness follows the mood */}
        <div className={`amb-ember-glow glow-${glowLevel} ${reducedEffects ? 'still' : ''}`} />

        {/* embers drifting up off the flame — slow CSS loops, compositor-only */}
        {ambientFx && mood !== 'sleepy' && (
          <div className={`amb-ember-rise ${mood === 'celebrate' ? 'fast' : ''}`} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        )}

        {/* sleepy little z's */}
        {ambientFx && mood === 'sleepy' && (
          <div className="amb-ember-zzz" aria-hidden="true">
            <span>z</span>
            <span>z</span>
            <span>z</span>
          </div>
        )}

        <motion.div className="amb-ember-squash" animate={squash} style={{ transformOrigin: '50% 90%' }}>
          <div className="amb-ember-streak" style={{ transform: `scale(${streakScale})` }}>
          <div className={`amb-ember-body ${bodyAnim}`}>
          <svg viewBox="0 0 24 24" width="100%" height="100%">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={stopA} />
                <stop offset="1" stopColor={stopB} />
              </linearGradient>
            </defs>

            <g>
              <path d={FLAME_PATH} fill={`url(#${gradId})`} />
              {/* inner highlight — reads as heat at the core */}
              <ellipse cx="11" cy="17.2" rx="3.4" ry="2.6" fill="#fff" opacity={mood === 'celebrate' ? 0.32 : 0.14} />

              {eyesClosed ? (
                <>
                  <path
                    d={`M${7.6 + eyeX} 15.3 q1.1 ${holding ? -0.6 : 1} 2.2 0`}
                    stroke={EYE}
                    strokeWidth="1"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M${11.2 + eyeX} 15.3 q1.1 ${holding ? -0.6 : 1} 2.2 0`}
                    stroke={EYE}
                    strokeWidth="1"
                    fill="none"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <>
                  <ellipse cx={8.7 + eyeX} cy={15.6 + eyeY} rx="1" ry={eyesNarrow ? 0.45 : 1.1} fill={EYE} />
                  <ellipse cx={12.3 + eyeX} cy={15.6 + eyeY} rx="1" ry={eyesNarrow ? 0.45 : 1.1} fill={EYE} />
                  {/* tiny catchlights */}
                  {!eyesNarrow && (
                    <>
                      <circle cx={9 + eyeX} cy={15.2 + eyeY} r="0.28" fill="#fff" opacity="0.85" />
                      <circle cx={12.6 + eyeX} cy={15.2 + eyeY} r="0.28" fill="#fff" opacity="0.85" />
                    </>
                  )}
                </>
              )}

              {/* blush when proud or celebrating */}
              {(mood === 'proud' || mood === 'celebrate') && (
                <>
                  <ellipse cx="7.4" cy="17.3" rx="0.9" ry="0.5" fill="#ff8a7a" opacity="0.55" />
                  <ellipse cx="13.6" cy="17.3" rx="0.9" ry="0.5" fill="#ff8a7a" opacity="0.55" />
                </>
              )}
            </g>
          </svg>
          </div>
          </div>
        </motion.div>
      </motion.div>

      {/* a quick, nominal poke reaction — a few sparks, no loop */}
      <AnimatePresence>
        {poke > 0 && (
          <div className="amb-ember-sparks" key={poke}>
            {Array.from({ length: SPARKS }).map((_, i) => {
              const angle = (i / SPARKS) * Math.PI * 2 - Math.PI / 2
              return (
                <motion.span
                  key={i}
                  className="amb-spark"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: Math.cos(angle) * 30, y: Math.sin(angle) * 30 - 6, opacity: 0, scale: 0.3 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                />
              )
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
