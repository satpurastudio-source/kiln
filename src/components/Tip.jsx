import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XIcon, SparkleIcon } from './Icons'

// A one-time coaching hint shown the first time a user reaches a view/feature.
// Dismissed tips are remembered in localStorage so they never nag again.
const KEY = 'kiln-tips'
const readSeen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export default function Tip({ id, children }) {
  const [show, setShow] = useState(() => !readSeen().has(id))

  const dismiss = () => {
    const seen = readSeen()
    seen.add(id)
    try {
      localStorage.setItem(KEY, JSON.stringify([...seen]))
    } catch {
      /* private mode: fine, it just won't persist */
    }
    setShow(false)
  }

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          className="tip"
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="tip-icon">
            <SparkleIcon size={12} />
          </span>
          <span className="tip-text">{children}</span>
          <button className="tip-x" onClick={dismiss} aria-label="Dismiss tip">
            <XIcon size={12} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
