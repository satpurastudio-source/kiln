import { useState } from 'react'

const TICKS = Array.from({ length: 60 }, (_, i) => i)

// A 3-hand watch face. Hour/minute hands move on the parent's minute tick;
// the second hand sweeps via a pure CSS animation set once at mount, so it
// never touches React after that — no per-second JS cost.
// Sized by CSS (.amb-clock-face) so it scales with the screen; pass `size`
// only to pin it to an exact pixel width.
export default function AnalogClock({ now, reducedEffects = false, size }) {
  const hours = now.getHours() % 12
  const minutes = now.getMinutes()
  const hourDeg = (hours + minutes / 60) * 30
  const minuteDeg = minutes * 6

  const [secondStartDeg] = useState(() => {
    const d = new Date()
    return (d.getSeconds() + d.getMilliseconds() / 1000) * 6
  })

  // Lives on its own HTML layer: CSS transform animations on SVG children
  // aren't GPU-composited in Chrome and would restyle the dial 60x/sec.
  // The center pin rides along — it's round, so rotation doesn't show.
  const secondLayer = (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <line x1="100" y1="122" x2="100" y2="22" className="amb-hand-second" />
      <circle cx="100" cy="118" r="3.6" className="amb-hand-second-weight" />
      <circle cx="100" cy="100" r="5.5" className="amb-clock-pin" />
      <circle cx="100" cy="100" r="2" className="amb-clock-pin-cap" />
    </svg>
  )

  return (
    <div className="amb-clock-face" style={size ? { width: size, height: size } : undefined}>
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        <circle cx="100" cy="100" r="97" className="amb-clock-dial" />
        <circle cx="100" cy="100" r="97" className="amb-clock-rim" />

        {TICKS.map((i) => {
          const hour = i % 5 === 0
          const quarter = i % 15 === 0
          return (
            <line
              key={i}
              x1="100"
              y1={quarter ? 10 : hour ? 13 : 14}
              x2="100"
              y2={quarter ? 26 : hour ? 23 : 18}
              className={`amb-clock-tick ${hour ? 'hour' : ''} ${quarter ? 'quarter' : ''}`}
              transform={`rotate(${i * 6} 100 100)`}
            />
          )
        })}

        <g className="amb-hands-shadow">
          <line
            x1="100"
            y1="110"
            x2="100"
            y2="56"
            className="amb-hand amb-hand-hour"
            style={{ transform: `rotate(${hourDeg}deg)` }}
          />
          <line
            x1="100"
            y1="112"
            x2="100"
            y2="30"
            className="amb-hand amb-hand-minute"
            style={{ transform: `rotate(${minuteDeg}deg)` }}
          />
        </g>

      </svg>

      {reducedEffects ? (
        <div className="amb-second-layer" style={{ transform: `rotate(${now.getSeconds() * 6}deg)` }}>
          {secondLayer}
        </div>
      ) : (
        <div className="amb-second-layer sweep" style={{ '--amb-sec-start': `${secondStartDeg}deg` }}>
          {secondLayer}
        </div>
      )}
    </div>
  )
}
