import { motion } from 'framer-motion'
import { useStore, projectProgress, todayProgress } from '../store'
import { isOverdue, isToday } from '../utils'
import ProgressRing from './ProgressRing'
import {
  SunIcon,
  MoonIcon,
  CalendarIcon,
  ClockIcon,
  LayersIcon,
  PlusIcon,
  PencilIcon,
  BellIcon,
  BellOffIcon,
  FlameIcon,
} from './Icons'
import { APP_NAME, APP_TAG } from '../brand'

function NavItem({ active, onClick, icon, label, right, editBtn, order = 0 }) {
  return (
    <motion.button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08 + order * 0.055, type: 'spring', stiffness: 320, damping: 26 }}
    >
      {active && (
        <motion.span
          className="nav-pill"
          layoutId="nav-pill"
          transition={{ type: 'spring', stiffness: 480, damping: 38 }}
        />
      )}
      <span className="icon">{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {editBtn}
      {right}
    </motion.button>
  )
}

export default function Sidebar({ onNewProject, onEditProject, mobileOpen, closeMobile }) {
  const { state, dispatch } = useStore()
  const { view } = state

  const go = (v) => {
    dispatch({ type: 'SET_VIEW', view: v })
    closeMobile?.()
  }

  const active = state.tasks.filter((t) => !t.done)
  const counts = {
    today: active.filter((t) => isToday(t.due) || isOverdue(t.due)).length,
    upcoming: active.filter((t) => !!t.due).length,
    all: active.length,
  }

  const tp = todayProgress(state)

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand">
        <motion.div
          className="brand-mark"
          initial={{ rotate: -90, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        >
          <FlameIcon size={15} />
        </motion.div>
        <div>
          <div className="brand-name">
            {APP_NAME}
            <span className="dot">.</span>
          </div>
          <div className="brand-tag">{APP_TAG}</div>
        </div>
      </div>

      <NavItem
        order={0}
        active={view.type === 'today'}
        onClick={() => go({ type: 'today', projectId: null })}
        icon={<SunIcon size={15} />}
        label="Today"
        right={counts.today > 0 && <span className="count">{counts.today}</span>}
      />
      <NavItem
        order={1}
        active={view.type === 'upcoming'}
        onClick={() => go({ type: 'upcoming', projectId: null })}
        icon={<ClockIcon size={15} />}
        label="Upcoming"
        right={counts.upcoming > 0 && <span className="count">{counts.upcoming}</span>}
      />
      <NavItem
        order={2}
        active={view.type === 'calendar'}
        onClick={() => go({ type: 'calendar', projectId: null })}
        icon={<CalendarIcon size={15} />}
        label="Calendar"
      />
      <NavItem
        order={3}
        active={view.type === 'all'}
        onClick={() => go({ type: 'all', projectId: null })}
        icon={<LayersIcon size={15} />}
        label="All Tasks"
        right={counts.all > 0 && <span className="count">{counts.all}</span>}
      />

      <div className="section-label">
        Projects
        <motion.button
          onClick={onNewProject}
          whileHover={{ rotate: 90 }}
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          title="New project"
        >
          <PlusIcon size={13} />
        </motion.button>
      </div>

      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        {state.projects.map((p, i) => {
          const prog = projectProgress(state, p.id)
          return (
            <NavItem
              key={p.id}
              order={4 + i}
              active={view.type === 'project' && view.projectId === p.id}
              onClick={() => go({ type: 'project', projectId: p.id })}
              icon={<span className="project-dot" style={{ background: p.color, color: p.color }} />}
              label={p.name}
              editBtn={
                <span
                  role="button"
                  className="icon-btn edit-project"
                  style={{ width: 22, height: 22, marginLeft: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditProject(p)
                  }}
                  title="Edit project"
                >
                  <PencilIcon size={11} />
                </span>
              }
              right={
                prog.total > 0 && (
                  <ProgressRing size={17} stroke={2.4} pct={prog.pct} color={p.color} />
                )
              }
            />
          )
        })}
      </div>

      <div className="sidebar-footer">
        <ProgressRing size={34} stroke={3.4} pct={tp.pct} color="var(--accent)" />
        <div className="footer-stat">
          <b>{tp.done}</b> done today
          <br />
          <b>{tp.active}</b> to go
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <button
            className="icon-btn"
            title={state.sound ? 'Mute sounds' : 'Unmute sounds'}
            onClick={() => dispatch({ type: 'SET_SOUND', sound: !state.sound })}
          >
            {state.sound ? <BellIcon size={14} /> : <BellOffIcon size={14} />}
          </button>
          <button
            className="icon-btn"
            title="Toggle theme"
            onClick={() =>
              dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' })
            }
          >
            {state.theme === 'dark' ? <MoonIcon size={14} /> : <SunIcon size={14} />}
          </button>
        </div>
      </div>
    </aside>
  )
}
