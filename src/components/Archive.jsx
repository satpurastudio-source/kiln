import { AnimatePresence, motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { ArchiveIcon } from './Icons'

export default function Archive() {
  const { state, dispatch } = useStore()
  const items = state.tasks
    .filter((t) => t.archived)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const projectOf = (id) => state.projects.find((p) => p.id === id)

  const unarchive = (t) => {
    dispatch({ type: 'UNARCHIVE_TASK', id: t.id })
    toast('Restored from archive', '↩')
  }
  const remove = (t) => {
    dispatch({ type: 'DELETE_TASK', id: t.id })
    toast('Moved to trash', '🗑')
  }

  if (items.length === 0) {
    return (
      <div className="ins-empty archive-empty">
        <ArchiveIcon size={22} />
        <p>Nothing archived. Archive a task to tuck it away without deleting it.</p>
      </div>
    )
  }

  return (
    <ul className="archive-list">
      <AnimatePresence initial={false}>
        {items.map((t) => {
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
                <span className={`archive-title ${t.done ? 'done' : ''}`}>{t.title}</span>
                {p && (
                  <span className="proj-chip">
                    <span className="project-dot" style={{ background: p.color }} />
                    {p.name}
                  </span>
                )}
              </div>
              <div className="archive-actions">
                <button className="mini-btn" onClick={() => unarchive(t)}>Restore</button>
                <button className="mini-btn danger" onClick={() => remove(t)}>Delete</button>
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
