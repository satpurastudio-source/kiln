import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XIcon, SparkleIcon } from './Icons'
import { t, tn } from '../i18n'

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

const SEEN_EVENT = 'kiln-tip-seen'

export const tipSeen = (id) => readSeen().has(id)

// Retire a tip from anywhere — e.g. once someone actually uses the gesture
// it describes, there's nothing left to teach.
export function markTipSeen(id) {
  const seen = readSeen()
  if (seen.has(id)) return
  seen.add(id)
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen]))
  } catch {
    /* private mode: fine, it just won't persist */
  }
  window.dispatchEvent(new CustomEvent(SEEN_EVENT, { detail: id }))
}

export default function Tip({ id, children }) {
  const [show, setShow] = useState(() => !readSeen().has(id))

  useEffect(() => {
    const on = (e) => e.detail === id && setShow(false)
    window.addEventListener(SEEN_EVENT, on)
    return () => window.removeEventListener(SEEN_EVENT, on)
  }, [id])

  const dismiss = () => markTipSeen(id)

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
          <button className="tip-x" onClick={dismiss} aria-label={t('dismissTip')}>
            <XIcon size={12} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
