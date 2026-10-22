import { useState } from 'react'
import { motion } from 'framer-motion'
import { heavyFxOff } from '../fx'

const PARTICLES = 7

export default function Checkbox({ checked, color = '#d85a30', onToggle }) {
  const [burst, setBurst] = useState(0)

  const handle = (e) => {
    e.stopPropagation()
    // the particle burst is the main jank source on phones — skip it there
    if (!checked && !heavyFxOff()) setBurst(Date.now())
    onToggle()
  }

  return (
    <motion.button
      className="checkbox"
      onClick={handle}
      aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
      whileTap={{ scale: 0.82 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
    >
      <svg viewBox="0 0 24 24" fill="none">
        <motion.circle
          cx="12"
          cy="12"
          r="10"
          strokeWidth="1.7"
          initial={false}
          animate={{
            stroke: checked ? color : 'rgba(142,132,120,0.55)',
            fill: checked ? color : 'rgba(142,132,120,0)',
            scale: checked ? [1, 0.8, 1.08, 1] : 1,
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ originX: '12px', originY: '12px' }}
        />
        <motion.path
          d="M7.5 12.6 L10.4 15.5 L16.5 9.2"
          stroke="#fff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.3, delay: checked ? 0.08 : 0, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
      {burst > 0 &&
        Array.from({ length: PARTICLES }).map((_, i) => {
          const angle = (i / PARTICLES) * Math.PI * 2 - Math.PI / 2
          return (
            <motion.span
              key={`${burst}-${i}`}
              className="burst"
              style={{ background: color }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos(angle) * 22,
                y: Math.sin(angle) * 22,
                opacity: 0,
                scale: 0.3,
              }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              onAnimationComplete={i === 0 ? () => setBurst(0) : undefined}
            />
          )
        })}
    </motion.button>
  )
}
