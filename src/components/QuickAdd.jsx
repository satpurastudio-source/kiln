import { forwardRef, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, toast, taskInView } from '../store'
import { todayStr, addDaysStr, PRIORITIES, fmtDue, fmtTime, iconGlyph, parseQuickAdd } from '../utils'
import { playAdd } from '../sound'
import { SunIcon, FlagIcon, PlusIcon, ClockIcon, CalendarIcon } from './Icons'

const prioLabel = (id) => PRIORITIES.find((p) => p.id === id)?.label ?? id

// No physical keyboard on touch, so the "N" shortcut hint becomes a tap target.
const COARSE =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

const QuickAdd = forwardRef(function QuickAdd(_, inputRef) {
  const { state, dispatch } = useStore()
  const { view, settings } = state

  // smart default due date: the view wins, otherwise fall back to the setting
  const settingDue = () =>
    settings.defaultDue === 'today'
      ? todayStr()
      : settings.defaultDue === 'tomorrow'
        ? addDaysStr(1)
        : null
  const defaultDue = () =>
    view.type === 'today' ? todayStr() : view.type === 'upcoming' ? addDaysStr(1) : settingDue()
  const defaultProject = () =>
    view.type === 'project' ? view.projectId : state.projects[0]?.id

  const [title, setTitle] = useState('')
  const [due, setDue] = useState(defaultDue)
  const [time, setTime] = useState(settings.defaultTime || '')
  const [priority, setPriority] = useState(settings.defaultPriority)
  const [projectId, setProjectId] = useState(defaultProject)
  const [focused, setFocused] = useState(false)

  // keep defaults in sync when the view or the defaults change
  useEffect(() => {
    setDue(defaultDue())
    setProjectId(defaultProject())
  }, [view.type, view.projectId]) // eslint-disable-line

  // the picked folder was deleted (here or on another device) → fall back
  useEffect(() => {
    if (!state.projects.some((p) => p.id === projectId)) setProjectId(defaultProject())
  }, [state.projects]) // eslint-disable-line

  // live natural-language parse ("gym tomorrow 7am !high #fitness")
  const parsed = useMemo(() => parseQuickAdd(title, state.projects), [title, state.projects])
  const parsedProject = parsed.projectId
    ? state.projects.find((p) => p.id === parsed.projectId)
    : null
  const detected = !!(parsed.due || parsed.time || parsed.priority || parsed.projectId || parsed.newFolder)

  const submit = () => {
    const p = parseQuickAdd(title, state.projects)
    const finalTitle = p.title.trim()
    if (!finalTitle) return
    const base = {
      type: 'ADD_TASK',
      title: finalTitle,
      due: p.due ?? due,
      time: p.time || time || null,
      priority: p.priority ?? priority,
    }
    if (p.newFolder) {
      // "#name" for a folder that doesn't exist → create it and file the task
      dispatch({ ...base, newFolder: p.newFolder })
      toast(`Created folder “${p.newFolder}”`, '📁')
    } else {
      // with no folders left at all, the store files it into a new Inbox
      const pid = p.projectId ?? projectId
      dispatch({ ...base, projectId: pid })
      // the task went somewhere this view doesn't show — say where, so it
      // doesn't look like it vanished
      if (!taskInView({ due: base.due, projectId: pid }, view)) {
        const folder = state.projects.find((x) => x.id === pid)?.name
        const when = base.due ? fmtDue(base.due) : 'no date'
        toast(`Added to ${folder ?? 'Inbox'} · ${when}`, '✓')
      }
    }
    setTitle('')
    setPriority(settings.defaultPriority)
    playAdd()
  }

  const expanded = focused || title.length > 0

  return (
    <motion.div
      className="quickadd"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 26 }}
    >
      <div className="quickadd-row">
        <motion.span
          className="quickadd-plus"
          animate={{ rotate: expanded ? 45 : 0, scale: expanded ? 1.05 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <PlusIcon size={14} sw={2.2} />
        </motion.span>
        <input
          ref={inputRef}
          className="title"
          value={title}
          maxLength={140}
          placeholder={'Add a task…  try “pay rent friday 5pm”'}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') e.target.blur()
          }}
        />
        <span className="kbd-hint">
          {COARSE ? (
            <button
              className="add-tap"
              aria-label="Add a task"
              onClick={() => (title.trim() ? submit() : inputRef?.current?.focus())}
            >
              <PlusIcon size={15} sw={2.4} />
            </button>
          ) : (
            <kbd>N</kbd>
          )}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <AnimatePresence initial={false}>
              {detected && (
                <motion.div
                  className="qa-parse"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <span className="qa-parse-label">reading:</span>
                  {parsed.due && (
                    <span className="qa-pill">
                      <CalendarIcon size={11} /> {fmtDue(parsed.due)}
                    </span>
                  )}
                  {parsed.time && (
                    <span className="qa-pill">
                      <ClockIcon size={11} /> {fmtTime(parsed.time)}
                    </span>
                  )}
                  {parsed.priority && (
                    <span className="qa-pill">
                      <FlagIcon size={10} filled /> {prioLabel(parsed.priority)}
                    </span>
                  )}
                  {parsedProject && (
                    <span className="qa-pill">
                      <span className="qa-pill-dot" style={{ background: parsedProject.color }} />
                      {parsedProject.name}
                    </span>
                  )}
                  {parsed.newFolder && (
                    <span className="qa-pill qa-pill-new">
                      <PlusIcon size={10} sw={2.4} /> New folder · {parsed.newFolder}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="quickadd-options">
              <button
                className={`chip ${due === todayStr() ? 'on' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setDue(due === todayStr() ? null : todayStr())}
              >
                <SunIcon size={12} /> Today
              </button>
              <button
                className={`chip ${due === addDaysStr(1) ? 'on' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setDue(due === addDaysStr(1) ? null : addDaysStr(1))}
              >
                → Tomorrow
              </button>
              <input
                type="date"
                className="date-input"
                value={due ?? ''}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => setDue(e.target.value || null)}
                title="Pick a date"
              />
              <label className={`time-input ${time ? 'set' : ''}`} title="Set a time">
                <ClockIcon size={12} />
                <input
                  type="time"
                  value={time}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>

              <span style={{ width: 1, height: 18, background: 'var(--border)' }} />

              {PRIORITIES.filter((p) => p.id !== 'none').map((p) => (
                <button
                  key={p.id}
                  className={`chip ${priority === p.id ? 'on' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setPriority(priority === p.id ? 'none' : p.id)}
                >
                  <FlagIcon size={11} filled style={{ color: p.color }} />
                  {p.label}
                </button>
              ))}

              <span style={{ flex: 1 }} />

              <select
                className="select"
                value={projectId ?? ''}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {iconGlyph(p.icon)} {p.name}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export default QuickAdd
