import { AnimatePresence, motion } from 'framer-motion'
import { useStore, selectActive, projectProgress, todayProgress } from '../store'
import { fmtLongDate, greeting, iconGlyph } from '../utils'
import { SearchIcon, CommandIcon } from './Icons'
import { t, tn, fmtNum } from '../i18n'

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

  const firstName = state.profile?.name?.trim().split(/\s+/)[0] || t('friendShort')

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
        {t('nav_upcoming')}<em>.</em>
      </>
    )
  else if (view.type === 'calendar')
    title = (
      <>
        {t('nav_calendar')}<em>.</em>
      </>
    )
  else if (view.type === 'insights')
    title = (
      <>
        {t('nav_insights')}<em>.</em>
      </>
    )
  else if (view.type === 'archive')
    title = (
      <>
        {t('nav_archive')}<em>.</em>
      </>
    )
  else if (view.type === 'trash')
    title = (
      <>
        {t('nav_trash')}<em>.</em>
      </>
    )
  else if (view.type === 'all')
    title = (
      <>
        {t('nav_all')}<em>.</em>
      </>
    )
  else
    title = (
      <>
        {project?.name ?? t('folder')}
        <em>.</em>
      </>
    )

  const milestone = bar
    ? bar.pct >= 100
      ? t('msCleared')
      : bar.pct >= 80
        ? t('msClose')
        : bar.pct >= 50
          ? t('msHalfway')
          : null
    : null

  const sub =
    view.type === 'today'
      ? `${fmtLongDate()} — ${activeCount === 0 ? t('allClearLower') : tn('tasksToGo', activeCount)}`
      : view.type === 'project' && prog
        ? t('doneOfTotal', { done: fmtNum(prog.done), total: fmtNum(prog.total) })
        : view.type === 'calendar'
          ? tn('scheduledTasks', activeCount)
          : view.type === 'insights'
            ? t('subInsights')
            : view.type === 'archive'
              ? t('subArchive')
              : view.type === 'trash'
                ? t('subTrash')
                : tn('openTasks', activeCount)

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
              placeholder={t('searchPh')}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('')
                  e.target.blur()
                }
              }}
            />
          </label>
          <button className="icon-btn" onClick={openPalette} title={t('commandPaletteTitle')}>
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
