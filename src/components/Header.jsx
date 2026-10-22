import { AnimatePresence, motion } from 'framer-motion'
import { useStore, selectActive, projectProgress, todayProgress } from '../store'
import { fmtLongDate, greeting, iconGlyph } from '../utils'
import { SearchIcon, CommandIcon } from './Icons'

export default function Header({ query, setQuery, searchRef, openPalette }) {
  const { state } = useStore()
  const { view } = state
  const project = view.type === 'project' ? state.projects.find((p) => p.id === view.projectId) : null
  const activeCount = selectActive(state).length
  const prog = project ? projectProgress(state, project.id) : null

  // progress bar shown on Today (day's load) and inside a folder — always the
  // accent color so every progress indicator matches the current theme
  const today = view.type === 'today' ? todayProgress(state) : null
  const bar =
    project && prog.total > 0
      ? { pct: prog.pct, done: prog.done, total: prog.total, color: 'var(--accent)' }
      : today && today.total > 0
        ? { pct: today.pct, done: today.done, total: today.total, color: 'var(--accent)' }
        : null

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
  else if (view.type === 'calendar')
    title = (
      <>
        Calendar<em>.</em>
      </>
    )
  else if (view.type === 'insights')
    title = (
      <>
        Insights<em>.</em>
      </>
    )
  else if (view.type === 'archive')
    title = (
      <>
        Archive<em>.</em>
      </>
    )
  else if (view.type === 'trash')
    title = (
      <>
        Trash<em>.</em>
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
        {project?.name ?? 'Folder'}
        <em>.</em>
      </>
    )

  const milestone = bar
    ? bar.pct >= 100
      ? 'cleared — nice work ✦'
      : bar.pct >= 80
        ? 'so close — one more push ✦'
        : bar.pct >= 50
          ? 'halfway there'
          : null
    : null

  const sub =
    view.type === 'today'
      ? `${fmtLongDate()} — ${activeCount === 0 ? 'all clear' : `${activeCount} task${activeCount === 1 ? '' : 's'} to go`}`
      : view.type === 'project' && prog
        ? `${prog.done} of ${prog.total} complete`
        : view.type === 'calendar'
          ? `${activeCount} scheduled task${activeCount === 1 ? '' : 's'}`
          : view.type === 'insights'
            ? 'your habits & weekly progress'
            : view.type === 'archive'
              ? 'tucked away, out of your way'
              : view.type === 'trash'
                ? 'recently deleted — auto-erased after 30 days'
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
                      {iconGlyph(project.icon)}
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

      {bar && (
        <div className={`goal-bar ${bar.pct >= 100 ? 'complete' : ''}`}>
          <div className="goal-track">
            <motion.div
              className="goal-fill"
              style={{
                background: `linear-gradient(90deg, ${bar.color}, var(--accent-2))`,
                // glow blooms as you approach the finish line
                boxShadow: `0 0 ${8 + bar.pct * 0.16}px ${bar.pct * 0.02}px ${bar.color}`,
              }}
              initial={false}
              animate={{ width: `${bar.pct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            >
              {bar.pct >= 8 && <span className="goal-shimmer" />}
            </motion.div>
          </div>
          <div className="goal-meta">
            <AnimatePresence mode="wait">
              {milestone && (
                <motion.span
                  key={milestone}
                  className="goal-milestone"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                >
                  {milestone}
                </motion.span>
              )}
            </AnimatePresence>
            <span className="goal-pct">
              {bar.done}/{bar.total} · {bar.pct}%
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
