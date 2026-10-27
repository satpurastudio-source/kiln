import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { todayStr, isToday, isOverdue, PRIORITIES, fmtDue, fmtTime, parseQuickAdd } from '../utils'
import { playAdd } from '../sound'
import { PlusIcon, XIcon, CalendarIcon, ClockIcon, FlagIcon } from './Icons'
import { t } from '../i18n'

const prioLabel = (id) => PRIORITIES.find((p) => p.id === id)?.label ?? id

// Add without leaving ambient. Same natural-language parsing as the main
// quick add; with no date typed it defaults to today (this is a today view,
// and that's what the main app's Today view does too). Stays open after
// Enter so several tasks can go in back to back.
export default function AmbientQuickAdd({ onClose }) {
  const { state, dispatch } = useStore()
  const { settings } = state
  const inputRef = useRef(null)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState(null) // { text, key } confirmation line

  useEffect(() => {
    // next frame: let the enter animation mount before stealing focus
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  const parsed = useMemo(() => parseQuickAdd(title, state.projects), [title, state.projects])
  const parsedProject = parsed.projectId ? state.projects.find((p) => p.id === parsed.projectId) : null
  const detected = !!(parsed.due || parsed.time || parsed.priority || parsed.projectId || parsed.newFolder)

  const submit = () => {
    const p = parseQuickAdd(title, state.projects)
    const finalTitle = p.title.trim()
    if (!finalTitle) return
    const due = p.due ?? todayStr()
    const base = {
      type: 'ADD_TASK',
      title: finalTitle,
      due,
      time: p.time ?? (settings.defaultTime || null),
      priority: p.priority ?? settings.defaultPriority,
    }
    if (p.newFolder) dispatch({ ...base, newFolder: p.newFolder })
    else {
      const pid = p.projectId ?? state.projects[0]?.id
      if (!pid) return
      dispatch({ ...base, projectId: pid })
    }
    playAdd()
    setTitle('')
    // say where it went — a future-dated task won't appear on this board
    const where = isToday(due) || isOverdue(due) ? t('ambAddedTodo') : t('ambAddedFor', { date: fmtDue(due) })
    setNote({ text: where, key: Date.now() })
  }

  return (
    <motion.div
      className="amb-qa"
      initial={{ opacity: 0, y: -14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="amb-qa-row">
        <span className="amb-qa-plus">
          <PlusIcon size={15} sw={2.2} />
        </span>
        <input
          ref={inputRef}
          value={title}
          maxLength={140}
          enterKeyHint="done"
          placeholder={t('ambQuickAddPh')}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation() // typing "n" here must not re-trigger anything
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onClose()
          }}
        />
        {title.trim() ? (
          <button className="amb-qa-go" onClick={submit} aria-label={t('addTask')}>
            Add
          </button>
        ) : (
          <button className="amb-qa-close" onClick={onClose} aria-label={t('close')}>
            <XIcon size={14} />
          </button>
        )}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {detected ? (
          <motion.div
            key="parse"
            className="amb-qa-meta"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
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
        ) : note ? (
          <motion.div
            key={note.key}
            className="amb-qa-meta amb-qa-note"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            ✓ {note.text} · {t('ambEnterEsc')}
          </motion.div>
        ) : (
          <motion.div key="hint" className="amb-qa-meta amb-qa-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {t('ambHint')}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
