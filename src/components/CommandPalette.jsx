import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { supabase } from '../supabase'
import {
  SunIcon,
  MoonIcon,
  CalendarIcon,
  LayersIcon,
  PlusIcon,
  BellIcon,
  BellOffIcon,
  SearchIcon,
  BroomIcon,
  XIcon,
} from './Icons'

export default function CommandPalette({ onClose, onNewProject }) {
  const { state, dispatch } = useStore()
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
      { icon: <CalendarIcon size={14} />, label: 'Go to Upcoming', hint: 'View', fn: go({ type: 'upcoming', projectId: null }) },
      { icon: <LayersIcon size={14} />, label: 'Go to All Tasks', hint: 'View', fn: go({ type: 'all', projectId: null }) },
      ...state.projects.map((p) => ({
        icon: <span style={{ color: p.color }}>{p.icon}</span>,
        label: `Go to ${p.name}`,
        hint: 'Project',
        fn: go({ type: 'project', projectId: p.id }),
      })),
      { icon: <PlusIcon size={14} />, label: 'New project', hint: 'Action', fn: onNewProject },
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
          const n = state.tasks.filter((t) => t.done).length
          dispatch({ type: 'CLEAR_COMPLETED' })
          toast(n > 0 ? `Cleared ${n} completed task${n === 1 ? '' : 's'}` : 'Nothing to clear', '🧹')
        },
      },
      {
        icon: <XIcon size={14} />,
        label: 'Sign out',
        hint: 'Account',
        fn: () => {
          supabase.auth.signOut()
          dispatch({ type: 'SIGN_OUT' })
        },
      },
    ]
    const ql = q.trim().toLowerCase()
    return ql ? base.filter((i) => i.label.toLowerCase().includes(ql)) : base
  }, [q, state.projects, state.theme, state.sound, state.tasks, dispatch, onNewProject])

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
            placeholder="Type a command…"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="palette-list" ref={listRef}>
          {items.length === 0 && <div className="palette-empty">No commands match.</div>}
          {items.map((item, i) => (
            <button
              key={item.label}
              className={`palette-item ${i === sel ? 'sel' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => run(item)}
            >
              <span className="pi-icon">{item.icon}</span>
              {item.label}
              <span className="pi-hint">{item.hint}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
