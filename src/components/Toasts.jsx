import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { onToast } from '../store'

export default function Toasts() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return onToast((t) => {
      setToasts((prev) => [...prev.slice(-2), t])
      if (t.sticky) return
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id))
      }, 2800)
    })
  }, [])

  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className="toast"
            style={{ pointerEvents: t.action ? 'auto' : 'none' }}
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
                  fontSize: 12.5,
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
