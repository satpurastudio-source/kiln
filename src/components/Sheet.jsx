import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { t } from '../i18n'

// The settings-style modal shell, shared by Help, Feedback and What's new:
// a title, a scrolling body of .set-section blocks, and a Done button.
export default function Sheet({ title, onClose, children, actions }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="modal settings-modal"
        role="dialog"
        aria-label={title}
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      >
        <h2>{title}</h2>
        <div className="settings-body">{children}</div>
        <div className="modal-actions">
          {/* a sheet with its own main action demotes Done to a quiet Cancel */}
          <motion.button
            className={`btn ${actions ? 'ghost' : 'primary'}`}
            onClick={onClose}
            whileTap={{ scale: 0.96 }}
            data-back-close
          >
            {actions ? t('cancel') : t('done')}
          </motion.button>
          {actions}
        </div>
      </motion.div>
    </motion.div>
  )
}
