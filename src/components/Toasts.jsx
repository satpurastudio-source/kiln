import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { onToast } from '../store'

export default function Toasts() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return onToast((t) => {
      setToasts((prev) => {
        // the same message twice in a row just refreshes it instead of stacking
        const rest = prev.filter((x) => !(x.message === t.message && !x.sticky))
        // at most 3 on screen; sticky ones (e.g. "update ready") are never pushed out
        const sticky = rest.filter((x) => x.sticky)
        const loose = rest.filter((x) => !x.sticky).slice(-Math.max(0, 2 - sticky.length))
        return [...sticky, ...loose, t]
      })
      if (t.sticky) return
      // give undo a fair chance — a reading-speed window, not a blink
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id))
      }, t.action ? 5000 : 2800)
    })
  }, [])

  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className="toast"
            style={{ pointerEvents: t.action || t.sticky ? 'auto' : 'none' }}
            // a sticky notice without a button is dismissed by tapping it
            onClick={t.sticky && !t.action ? () => setToasts((prev) => prev.filter((x) => x.id !== t.id)) : undefined}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 480, damping: 30 }}
            layout
          >
            <span className="t-icon">{t.icon}</span>
            {t.message}
            {t.action && (
              <button
                onClick={() => {
                  t.action.fn()
                  setToasts((prev) => prev.filter((x) => x.id !== t.id))
                }}
                style={{
                  color: 'var(--accent)',
                  fontWeight: 600,
                  fontSize: 'calc(13.25px * var(--text-scale))',
                  marginLeft: 4,
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
