import { useState } from 'react'

const MINUTE_TICKS = Array.from({ length: 60 }, (_, i) => i)
const NUMERALS = [
  { n: '12', x: 100, y: 38 },
  { n: '3', x: 164, y: 108 },
  { n: '6', x: 100, y: 178 },
  { n: '9', x: 36, y: 108 },
]

// Seconds elapsed in each hand's cycle, read once. Each hand then runs as a
// plain CSS rotation started that far "in the past" (negative delay), so it
// sits at the exact angle and keeps gliding with zero JS. The parent remounts
// this (key) when the tab wakes, to resync after sleep.
const cycleOffsets = () => {
  const d = new Date()
  const s = d.getSeconds() + d.getMilliseconds() / 1000
  const m = d.getMinutes() * 60 + s
  const h = (d.getHours() % 12) * 3600 + m
  return { s, m, h }
}

function Hand({ cls, period, offset, steps, staticDeg, children }) {
  const style =
    staticDeg != null
      ? { transform: `rotate(${staticDeg}deg)` }
      : {
          animationDuration: `${period}s`,
          animationDelay: `-${offset}s`,
          animationTimingFunction: steps ? 'steps(60, end)' : 'linear',
        }
  return (
    <div className={`amb-hand-layer ${cls} ${staticDeg != null ? '' : 'spin'}`} style={style}>
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        {children}
      </svg>
    </div>
  )
}

export default function AnalogClock({ now, face = 'classic', seconds = 'sweep', reducedEffects = false }) {
  const [off] = useState(cycleOffsets)

  // reduced effects: hands snap once a minute from the parent's clock instead
  const still = reducedEffects
  const hourDeg = ((now.getHours() % 12) + now.getMinutes() / 60) * 30
  const minDeg = now.getMinutes() * 6

  const ticks = face === 'minimal' ? MINUTE_TICKS.filter((i) => i % 5 === 0) : MINUTE_TICKS

  return (
    <div className={`amb-clock-face face-${face}`}>
      <svg viewBox="0 0 200 200" width="100%" height="100%" className="amb-dial-svg">
        <circle cx="100" cy="100" r="97" className="amb-clock-dial" />
        <circle cx="100" cy="100" r="97" className="amb-clock-rim" />
        {ticks.map((i) => {
          const hour = i % 5 === 0
          const quarter = i % 15 === 0
          if (face === 'numerals' && quarter) return null
          return (
            <line
              key={i}
              x1="100"
              y1={quarter ? 10 : hour ? 12 : 14}
              x2="100"
              y2={quarter ? 26 : hour ? 23 : 18}
              className={`amb-clock-tick ${hour ? 'hour' : ''} ${quarter ? 'quarter' : ''}`}
              transform={`rotate(${i * 6} 100 100)`}
            />
          )
        })}
        {face === 'numerals' &&
          NUMERALS.map((p) => (
            <text key={p.n} x={p.x} y={p.y} className="amb-clock-numeral" textAnchor="middle" dominantBaseline="middle">
              {p.n}
            </text>
          ))}
      </svg>

      <Hand cls="hour" period={43200} offset={off.h} staticDeg={still ? hourDeg : null}>
        <line x1="100" y1="113" x2="100" y2="57" className="amb-hand-shade" strokeWidth="9" />
        <line x1="100" y1="112" x2="100" y2="56" className="amb-hand amb-hand-hour" />
      </Hand>
      <Hand cls="minute" period={3600} offset={off.m} staticDeg={still ? minDeg : null}>
        <line x1="100" y1="115" x2="100" y2="29" className="amb-hand-shade" strokeWidth="6.5" />
        <line x1="100" y1="114" x2="100" y2="28" className="amb-hand amb-hand-minute" />
      </Hand>
      {seconds !== 'off' && (
        <Hand
          cls="second"
          period={60}
          offset={off.s}
          steps={seconds === 'tick'}
          staticDeg={still ? now.getSeconds() * 6 : null}
        >
          <line x1="100" y1="124" x2="100" y2="20" className="amb-hand-second" />
          <circle cx="100" cy="119" r="3.6" className="amb-hand-second-weight" />
        </Hand>
      )}

      <svg viewBox="0 0 200 200" width="100%" height="100%" className="amb-pin-svg">
        <circle cx="100" cy="100" r="5.5" className="amb-clock-pin" />
        <circle cx="100" cy="100" r="2" className="amb-clock-pin-cap" />
      </svg>
    </div>
  )
}
