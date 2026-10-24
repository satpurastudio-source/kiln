import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { iconGlyph, exportData, parseQuickAdd, fmtDue, todayStr, addDaysStr } from '../utils'
import { playAdd } from '../sound'

// same rule as the main quick add: the Today view means today, otherwise
// the "new task defaults" setting decides
const defaultDue = ({ view, settings }) =>
  view.type === 'today'
    ? todayStr()
    : view.type === 'upcoming'
      ? addDaysStr(1)
      : settings.defaultDue === 'today'
        ? todayStr()
        : settings.defaultDue === 'tomorrow'
          ? addDaysStr(1)
          : null
import { remindersOptedIn, enableReminders, disableReminders } from '../reminders'
import {
  SunIcon,
  MoonIcon,
  CalendarIcon,
  ClockIcon,
  LayersIcon,
  PlusIcon,
  BellIcon,
  BellOffIcon,
  SearchIcon,
  BroomIcon,
  XIcon,
  DownloadIcon,
  SettingsIcon,
  InfoIcon,
  ChartIcon,
  ArchiveIcon,
  TrashIcon,
  FlameIcon,
} from './Icons'

export default function CommandPalette({ onClose, onNewProject, onOpenSettings, onOpenTask }) {
  const { state, dispatch, signOut } = useStore()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const items = useMemo(() => {
    const go = (view) => () => dispatch({ type: 'SET_VIEW', view })
    const base = [
      { icon: <SunIcon size={14} />, label: 'Go to Today', hint: 'View', fn: go({ type: 'today', projectId: null }) },
      { icon: <ClockIcon size={14} />, label: 'Go to Upcoming', hint: 'View', fn: go({ type: 'upcoming', projectId: null }) },
      { icon: <CalendarIcon size={14} />, label: 'Go to Calendar', hint: 'View', fn: go({ type: 'calendar', projectId: null }) },
      { icon: <LayersIcon size={14} />, label: 'Go to All Tasks', hint: 'View', fn: go({ type: 'all', projectId: null }) },
      { icon: <ChartIcon size={14} />, label: 'Go to Insights', hint: 'View', fn: go({ type: 'insights', projectId: null }) },
      { icon: <ArchiveIcon size={14} />, label: 'Go to Archive', hint: 'View', fn: go({ type: 'archive', projectId: null }) },
      { icon: <TrashIcon size={14} />, label: 'Go to Trash', hint: 'View', fn: go({ type: 'trash', projectId: null }) },
      ...state.projects.map((p) => ({
        icon: <span style={{ color: p.color }}>{iconGlyph(p.icon)}</span>,
        label: `Go to ${p.name}`,
        hint: 'Folder',
        fn: go({ type: 'project', projectId: p.id }),
      })),
      {
        icon: <FlameIcon size={14} />,
        label: 'Open Ambient mode',
        hint: 'Action',
        fn: () => window.open(location.pathname + '?ambient=1', 'kiln-ambient', 'popup'),
      },
      { icon: <PlusIcon size={14} />, label: 'New folder', hint: 'Action', fn: onNewProject },
      { icon: <SettingsIcon size={14} />, label: 'Open settings', hint: 'Action', fn: onOpenSettings },
      {
        icon: <InfoIcon size={14} />,
        label: 'Replay welcome tour',
        hint: 'Action',
        fn: () => dispatch({ type: 'START_TOUR_REPLAY' }),
      },
      {
        icon: state.theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />,
        label: `Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme`,
        hint: 'Action',
        fn: () => dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' }),
      },
      {
        icon: state.sound ? <BellOffIcon size={14} /> : <BellIcon size={14} />,
        label: state.sound ? 'Mute sounds' : 'Unmute sounds',
        hint: 'Action',
        fn: () => dispatch({ type: 'SET_SOUND', sound: !state.sound }),
      },
      {
        icon: <BroomIcon size={14} />,
        label: 'Clear all completed tasks',
        hint: 'Action',
        fn: () => {
          const ids = state.tasks.filter((t) => t.done && !t.archived).map((t) => t.id)
          if (!ids.length) return toast('Nothing to clear', '🧹')
          dispatch({ type: 'DELETE_TASKS', ids })
          toast(`Cleared ${ids.length} completed task${ids.length === 1 ? '' : 's'}`, '🧹', {
            label: 'Undo',
            fn: () => dispatch({ type: 'RESTORE_TASKS', ids }),
          })
        },
      },
      {
        icon: <DownloadIcon size={14} />,
        label: 'Download a backup (JSON)',
        hint: 'Account',
        fn: () => {
          exportData(state)
          toast('Backup downloaded', '⬇')
        },
      },
      {
        icon: <BellIcon size={14} />,
        label: remindersOptedIn() ? 'Disable daily reminders' : 'Enable daily reminders',
        hint: 'Action',
        fn: async () => {
          if (remindersOptedIn()) {
            disableReminders()
            toast('Reminders off', '🔕')
          } else {
            const ok = await enableReminders()
            toast(ok ? 'Reminders on — you’ll get a nudge when tasks are due' : 'Notifications are blocked — allow them for kiln in settings', ok ? '🔔' : '⚠')
          }
        },
      },
      {
        icon: <XIcon size={14} />,
        label: 'Sign out',
        hint: 'Account',
        fn: async () => {
          if (!state.profile?.cloud) return dispatch({ type: 'SIGN_OUT' })
          const ok = await signOut()
          // couldn't sync first — Settings explains and offers the choices
          if (!ok) {
            toast('Some changes haven’t synced yet — sign out from Settings', '⚠')
            onOpenSettings()
          }
        },
      },
    ]
    const ql = q.trim().toLowerCase()
    if (!ql) return base
    const commands = base.filter((i) => i.label.toLowerCase().includes(ql))

    // tasks matching the query — the pull-down search on phones lands here,
    // so it has to find tasks, not just commands
    const projectOf = (id) => state.projects.find((p) => p.id === id)
    const tasks = state.tasks
      .filter(
        (t) =>
          !t.archived &&
          ((t.title || '').toLowerCase().includes(ql) || (t.notes || '').toLowerCase().includes(ql))
      )
      .sort((a, b) => Number(a.done) - Number(b.done))
      .slice(0, 6)
      .map((t) => {
        const p = projectOf(t.projectId)
        return {
          key: `task-${t.id}`,
          icon: <span style={{ color: p?.color ?? 'var(--accent)' }}>{t.done ? '✓' : '○'}</span>,
          label: t.title,
          hint: [p?.name, t.due && !t.done ? fmtDue(t.due) : null, t.done ? 'done' : null]
            .filter(Boolean)
            .join(' · '),
          fn: () => onOpenTask(t),
        }
      })

    // nothing typed matches exactly? one Enter turns it into a task
    const parsed = parseQuickAdd(q, state.projects)
    const add = parsed.title.trim()
      ? [
          {
            key: 'add-task',
            icon: <PlusIcon size={14} />,
            label: `Add task “${parsed.title.trim()}”`,
            hint: parsed.due ? fmtDue(parsed.due) : 'Task',
            fn: () => {
              const pid =
                parsed.projectId ??
                (state.view.type === 'project' ? state.view.projectId : state.projects[0]?.id)
              dispatch({
                type: 'ADD_TASK',
                title: parsed.title,
                projectId: pid,
                newFolder: parsed.newFolder,
                due: parsed.due ?? defaultDue(state),
                time: parsed.time ?? (state.settings.defaultTime || null),
                priority: parsed.priority ?? state.settings.defaultPriority,
              })
              playAdd()
              const folder = parsed.newFolder ?? state.projects.find((p) => p.id === pid)?.name ?? 'Inbox'
              toast(`Added to ${folder}${parsed.due ? ` · ${fmtDue(parsed.due)}` : ''}`, '✓')
            },
          },
        ]
      : []
    return [...tasks, ...commands, ...add]
  }, [q, state.projects, state.theme, state.sound, state.tasks, state.view, state.settings, state.profile, dispatch, signOut, onNewProject, onOpenSettings, onOpenTask])

  useEffect(() => {
    setSel(0)
  }, [q])

  const run = (item) => {
    item.fn()
    onClose()
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && items[sel]) {
      run(items[sel])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    listRef.current
      ?.querySelector('.palette-item.sel')
      ?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  return (
    <motion.div
      className="palette-wrap"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="palette"
        initial={{ opacity: 0, scale: 0.94, y: -14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -8 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      >
        <div className="palette-input">
          <span style={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center' }}>
            <SearchIcon size={15} />
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search tasks, run a command, or add a task…"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="palette-list" ref={listRef}>
          {items.length === 0 && <div className="palette-empty">Nothing matches.</div>}
          {items.map((item, i) => (
            <button
              key={item.key ?? item.label}
              className={`palette-item ${i === sel ? 'sel' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => run(item)}
            >
              <span className="pi-icon">{item.icon}</span>
              <span className="pi-label">{item.label}</span>
              <span className="pi-hint">{item.hint}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
