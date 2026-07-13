import { AnimatePresence, motion } from 'framer-motion'
import { useStore, selectActive, projectProgress } from '../store'
import { fmtLongDate, greeting } from '../utils'
import { SearchIcon, CommandIcon } from './Icons'

export default function Header({ query, setQuery, searchRef, openPalette }) {
  const { state } = useStore()
  const { view } = state
  const project = view.type === 'project' ? state.projects.find((p) => p.id === view.projectId) : null
  const activeCount = selectActive(state).length
  const prog = project ? projectProgress(state, project.id) : null

  const firstName = state.profile?.name?.trim().split(/\s+/)[0] || 'Capt'

  let title
  if (view.type === 'today') {
    title = (
      <>
        {greeting()}, {firstName}
        <em>.</em>
      </>
    )
  } else if (view.type === 'upcoming')
    title = (
      <>
        Upcoming<em>.</em>
      </>
    )
  else if (view.type === 'all')
    title = (
      <>
        All Tasks<em>.</em>
      </>
    )
  else
    title = (
      <>
        {project?.name ?? 'Project'}
        <em>.</em>
      </>
    )

  const sub =
    view.type === 'today'
      ? `${fmtLongDate()} — ${activeCount === 0 ? 'all clear' : `${activeCount} task${activeCount === 1 ? '' : 's'} to go`}`
      : view.type === 'project'
        ? `${prog.done} of ${prog.total} complete`
        : `${activeCount} open task${activeCount === 1 ? '' : 's'}`

  const viewKey = `${view.type}-${view.projectId ?? ''}`

  return (
    <header className="header">
      <div className="header-top">
        <div style={{ minWidth: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={viewKey} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
              <div className="reveal-wrap">
                <motion.h1
                  initial={{ y: '108%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                >
                  {project && (
                    <span
                      style={{
                        color: project.color,
                        marginRight: 12,
                        fontSize: '0.72em',
                        display: 'inline-block',
                        transform: 'translateY(-0.15em)',
                      }}
                    >
                      {project.icon}
                    </span>
                  )}
                  {title}
                </motion.h1>
              </div>
              <motion.div
                className="sub"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                {view.type === 'today' && <span className="pulse-dot" />}
                <span>{sub}</span>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="header-tools">
          <label className={`search ${query ? 'open' : ''}`}>
            <span className="glass">
              <SearchIcon size={14} />
            </span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('')
                  e.target.blur()
                }
              }}
            />
          </label>
          <button className="icon-btn" onClick={openPalette} title="Command palette (Ctrl+K)">
            <CommandIcon size={14} />
          </button>
        </div>
      </div>

      {project && prog.total > 0 && (
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              flex: 1,
              height: 5,
              borderRadius: 99,
              background: 'var(--panel-hover)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                borderRadius: 99,
                background: `linear-gradient(90deg, ${project.color}, var(--accent-2))`,
                boxShadow: `0 0 12px 0 ${project.color}`,
              }}
              initial={false}
              animate={{ width: `${prog.pct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-3)',
              minWidth: 34,
              textAlign: 'right',
            }}
          >
            {prog.pct}%
          </span>
        </div>
      )}
    </header>
  )
}
