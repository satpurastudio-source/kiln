import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, toast, TRASH_TTL } from '../store'
import { TrashIcon } from './Icons'

function formatTimeLeft(ms) {
  if (ms <= 0) return 'now'
  const days = Math.floor(ms / 86400000)
  if (days >= 1) return `${days}d`
  const hours = Math.floor(ms / 3600000)
  if (hours >= 1) return `${hours}h`
  return `${Math.max(1, Math.floor(ms / 60000))}m`
}

export default function Trash() {
  const { state, dispatch } = useStore()
  const [, tick] = useState(0)

  // re-render every minute so the countdowns stay live (TTL is day-granularity, no need for per-second ticks)
  useEffect(() => {
    if (!state.trash.length) return
    const id = setInterval(() => tick((n) => n + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [state.trash.length])

  const items = [...state.trash].sort((a, b) => b.deletedAt - a.deletedAt)
  const projectOf = (id) => state.projects.find((p) => p.id === id)

  if (items.length === 0) {
    return (
      <div className="ins-empty archive-empty">
        <TrashIcon size={22} />
        <p>Trash is empty. Deleted tasks land here and are erased after 30 days.</p>
      </div>
    )
  }

  return (
    <div className="trash-view">
      <div className="trash-head">
        <span>Deleted tasks are erased 30 days after removal.</span>
        <button
          className="mini-btn danger"
          onClick={() => {
            dispatch({ type: 'EMPTY_TRASH' })
            toast('Trash emptied', '🗑')
          }}
        >
          Empty now
        </button>
      </div>
      <ul className="archive-list">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const left = Math.max(0, t.deletedAt + TRASH_TTL - Date.now())
            const p = projectOf(t.projectId)
            return (
              <motion.li
                key={t.id}
                className="archive-row"
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                <div className="archive-main">
                  <span className="archive-title done">{t.title}</span>
                  {p && (
                    <span className="proj-chip">
                      <span className="project-dot" style={{ background: p.color }} />
                      {p.name}
                    </span>
                  )}
                </div>
                <div className="archive-actions">
                  <span className="trash-count">{formatTimeLeft(left)}</span>
                  <button
                    className="mini-btn"
                    onClick={() => {
                      dispatch({ type: 'RESTORE_TASK', id: t.id })
                      toast('Restored', '↩')
                    }}
                  >
                    Restore
                  </button>
                  <button className="mini-btn danger" onClick={() => dispatch({ type: 'PURGE_TRASH', id: t.id })}>
                    Delete now
                  </button>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}
