import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { toDateStr, todayStr } from '../utils'
import { CalendarIcon, ChevronIcon } from './Icons'

const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function cells(y, m) {
  const start = (new Date(y, m, 1).getDay() + 6) % 7
  const days = new Date(y, m + 1, 0).getDate()
  const out = []
  for (let i = 0; i < start; i++) out.push(null)
  for (let d = 1; d <= days; d++) out.push(new Date(y, m, d))
  return out
}

// Floating peek calendar, bottom-right. Click a day → full calendar view.
export default function MiniCalendar() {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const now = new Date()
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() })

  const dueDays = useMemo(() => {
    const s = new Set()
    for (const t of state.tasks) if (t.due && !t.done) s.add(t.due)
    return s
  }, [state.tasks])

  const today = todayStr()

  const pick = (ds) => {
    dispatch({ type: 'SET_VIEW', view: { type: 'calendar', projectId: null, date: ds } })
    setOpen(false)
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="minical-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="minical"
              initial={{ opacity: 0, scale: 0.85, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            >
              <div className="minical-head">
                <button
                  className="icon-btn"
                  onClick={() => setCur(({ y, m }) => ({ y: m === 0 ? y - 1 : y, m: (m + 11) % 12 }))}
                  aria-label="Previous month"
                >
                  <ChevronIcon size={11} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <span className="minical-title">
                  {MONTHS[cur.m]} {cur.y}
                </span>
                <button
                  className="icon-btn"
                  onClick={() => setCur(({ y, m }) => ({ y: m === 11 ? y + 1 : y, m: (m + 1) % 12 }))}
                  aria-label="Next month"
                >
                  <ChevronIcon size={11} />
                </button>
              </div>
              <div className="minical-grid">
                {WD.map((d, i) => (
                  <span key={`h${i}`} className="minical-wd">
                    {d}
                  </span>
                ))}
                {cells(cur.y, cur.m).map((date, i) => {
                  if (!date) return <span key={`b${i}`} />
                  const ds = toDateStr(date)
                  return (
                    <button
                      key={ds}
                      className={`minical-day ${ds === today ? 'today' : ''} ${dueDays.has(ds) ? 'has' : ''}`}
                      onClick={() => pick(ds)}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
              <button className="minical-open" onClick={() => pick(today)}>
                Open full calendar →
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        className="minical-launcher"
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.9 }}
        title="Peek at the calendar"
        aria-label="Open mini calendar"
      >
        <CalendarIcon size={16} />
        <span className="minical-daynum-badge">{now.getDate()}</span>
      </motion.button>
    </>
  )
}
