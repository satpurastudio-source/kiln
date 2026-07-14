import { forwardRef, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import confetti from 'canvas-confetti'
import Checkbox from './Checkbox'
import { useStore, toast, startFocus, emitDrag } from '../store'
import { fmtDue, isOverdue, isToday, priorityColor, PRIORITIES, REPEATS, uid } from '../utils'
import { playComplete, playPop, playFanfare } from '../sound'
import {
  GripIcon,
  NoteIcon,
  FlagIcon,
  XIcon,
  PlayIcon,
  FlameIcon,
  RepeatIcon,
  ChecklistIcon,
  PlusIcon,
} from './Icons'

// full-row dragging only makes sense with a mouse; touch needs to scroll
const FINE_POINTER =
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

export const DROP_ZONE_HEIGHT = 130

const springIn = (index) => ({
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: Math.min(index * 0.04, 0.4), type: 'spring', stiffness: 400, damping: 30 },
  },
  exit: { opacity: 0, x: 60, scale: 0.96, transition: { duration: 0.25, ease: 'easeIn' } },
})

function fireProjectConfetti(color) {
  const colors = [color, '#d85a30', '#d9a441', '#f4efe4']
  confetti({ particleCount: 90, spread: 75, origin: { x: 0.5, y: 0.65 }, colors, scalar: 0.9 })
  setTimeout(() => {
    confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors })
    confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors })
  }, 180)
}

const TaskItem = forwardRef(function TaskItem(
  { task, index = 0, showProject = true, reorderable = false },
  ref
) {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [dragging, setDragging] = useState(false)
  // where the card was grabbed: pivot for the dangle rotation
  const [grab, setGrab] = useState({ origin: '50% 50%', tilt: 0 })
  const controls = useDragControls()
  const timer = useRef(null)
  const tiltRef = useRef(null)

  const project = state.projects.find((p) => p.id === task.projectId)
  const visualDone = task.done || checking

  useEffect(() => () => clearTimeout(timer.current), [])

  const toggle = () => {
    if (task.done) {
      dispatch({ type: 'TOGGLE_TASK', id: task.id })
      playPop()
      return
    }
    if (checking) return
    setChecking(true)
    playComplete()
    const rep = task.repeat && task.repeat !== 'none' ? task.repeat : null
    const remaining = state.tasks.filter(
      (t) => t.projectId === task.projectId && !t.done && t.id !== task.id
    ).length
    timer.current = setTimeout(() => {
      dispatch({ type: 'TOGGLE_TASK', id: task.id })
      if (rep) toast(`Repeats ${rep} — next one queued`, '↻')
      if (remaining === 0 && !rep) {
        playFanfare()
        fireProjectConfetti(project?.color ?? '#d85a30')
        toast(`${project?.name ?? 'Project'} — 100% complete!`, '🎉')
      }
    }, 620)
  }

  // Subtle 3D tilt following the pointer (matches the portfolio's card hover)
  const tiltMove = (e) => {
    if (open || dragging || !tiltRef.current) return
    const r = tiltRef.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    tiltRef.current.style.transform = `perspective(700px) rotateY(${(x * 2.4).toFixed(2)}deg) rotateX(${(-y * 3.5).toFixed(2)}deg)`
  }
  const tiltReset = () => {
    if (tiltRef.current) tiltRef.current.style.transform = ''
  }
  useEffect(() => {
    if (open || dragging) tiltReset()
  }, [open, dragging])

  const remove = () => {
    const snapshot = { ...task }
    dispatch({ type: 'DELETE_TASK', id: task.id })
    playPop()
    toast('Task deleted', '🗑', {
      label: 'Undo',
      fn: () => dispatch({ type: 'RESTORE_TASK', task: snapshot }),
    })
  }

  /* ------------------------- drag: dangle + drop zone ------------------------- */

  // remember the grab point so the card hangs from it like it's pinched there
  const onGrab = (e) => {
    const el = tiltRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setGrab({
      origin: `${(fx * 100).toFixed(1)}% ${(fy * 100).toFixed(1)}%`,
      // grabbed left of center → the free right side droops (and vice versa)
      tilt: Math.max(-12, Math.min(12, (0.5 - fx) * 20)),
    })
  }

  const onDragStart = () => {
    setDragging(true)
    if (!task.done) emitDrag({ phase: 'start' })
  }
  const onDragMove = (e, info) => {
    emitDrag({ phase: 'move', y: e.clientY ?? info.point.y })
  }
  const onDragEnd = (e, info) => {
    setDragging(false)
    emitDrag({ phase: 'end' })
    const y = e.clientY ?? info.point.y
    if (!task.done && !checking && y > window.innerHeight - DROP_ZONE_HEIGHT) {
      toggle()
    }
  }

  const pColor = priorityColor(task.priority)

  const inner = (
    <>
      <div className="task-row" onClick={() => setOpen(!open)}>
        {reorderable && (
          <span
            className="grip"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              controls.start(e)
            }}
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <GripIcon size={14} />
          </span>
        )}
        <Checkbox checked={visualDone} color={project?.color ?? 'var(--accent)'} onToggle={toggle} />
        <div className="task-title-wrap">
          <span className="task-title">
            {task.title}
            <motion.span
              className="strike"
              initial={false}
              animate={{ scaleX: visualDone ? 1 : 0 }}
              transition={{ duration: 0.35, ease: [0.65, 0, 0.35, 1] }}
            />
          </span>
          {(task.due ||
            task.notes ||
            (showProject && project) ||
            task.priority !== 'none' ||
            task.pomos > 0 ||
            (task.repeat && task.repeat !== 'none') ||
            task.subs?.length > 0) && (
            <div className="task-meta">
              {task.priority !== 'none' && (
                <span className="flag-dot" style={{ background: pColor, color: pColor }} />
              )}
              {task.due && !task.done && (
                <span
                  className={`due ${isOverdue(task.due) ? 'overdue' : isToday(task.due) ? 'today' : ''}`}
                >
                  {isOverdue(task.due) ? `Overdue — ${fmtDue(task.due)}` : fmtDue(task.due)}
                </span>
              )}
              {task.repeat && task.repeat !== 'none' && (
                <span className="notes-hint">
                  <RepeatIcon size={10} /> {task.repeat}
                </span>
              )}
              {task.subs?.length > 0 && (
                <span className="notes-hint">
                  <ChecklistIcon size={11} /> {task.subs.filter((s) => s.done).length}/
                  {task.subs.length}
                </span>
              )}
              {task.notes && (
                <span className="notes-hint">
                  <NoteIcon size={11} /> note
                </span>
              )}
              {task.pomos > 0 && (
                <span className="pomos" title={`${task.pomos} pomodoro${task.pomos === 1 ? '' : 's'}`}>
                  <FlameIcon size={10} style={{ color: 'var(--accent)' }} /> ×{task.pomos}
                </span>
              )}
              {showProject && project && (
                <span className="proj-chip">
                  <span className="project-dot" style={{ background: project.color }} />
                  {project.name}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="task-actions">
          {!task.done && (
            <button
              className="icon-btn row-focus"
              title="Focus on this task"
              onClick={(e) => {
                e.stopPropagation()
                startFocus(task.id)
              }}
            >
              <PlayIcon size={11} />
            </button>
          )}
          <button
            className="icon-btn row-del"
            title="Delete task"
            onClick={(e) => {
              e.stopPropagation()
              remove()
            }}
          >
            <XIcon size={12} />
          </button>
        </span>
      </div>

      <AnimatePresence initial={false}>
        {open && <Editor task={task} project={project} onDelete={remove} />}
      </AnimatePresence>
    </>
  )

  // dangle wrapper: rotation pivots around the grab point with a loose spring
  const card = (
    <motion.div
      className="dangle"
      style={{ transformOrigin: grab.origin }}
      animate={{ rotate: dragging ? grab.tilt : 0, scale: dragging ? 1.03 : 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 9, mass: 0.9 }}
    >
      <div
        ref={tiltRef}
        className={`task-card ${visualDone ? 'done' : ''} ${dragging ? 'dragging' : ''}`}
        onMouseMove={tiltMove}
        onMouseLeave={tiltReset}
      >
        {inner}
      </div>
    </motion.div>
  )

  if (reorderable) {
    return (
      <Reorder.Item
        ref={ref}
        as="li"
        value={task.id}
        className="task-shell"
        dragListener={FINE_POINTER && !open}
        dragControls={controls}
        onPointerDown={onGrab}
        onDragStart={onDragStart}
        onDrag={onDragMove}
        onDragEnd={onDragEnd}
        {...springIn(index)}
        layout
      >
        {card}
      </Reorder.Item>
    )
  }

  return (
    <motion.li
      ref={ref}
      className="task-shell"
      drag={FINE_POINTER && !open && !task.done}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={0.25}
      onPointerDown={onGrab}
      onDragStart={onDragStart}
      onDrag={onDragMove}
      onDragEnd={onDragEnd}
      {...springIn(index)}
      layout
    >
      {card}
    </motion.li>
  )
})

export default TaskItem

function Editor({ task, project, onDelete }) {
  const { state, dispatch } = useStore()
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [subText, setSubText] = useState('')

  const patch = (p) => dispatch({ type: 'UPDATE_TASK', id: task.id, patch: p })
  const subs = task.subs ?? []

  const commitTitle = () => {
    if (title.trim() && title !== task.title) patch({ title: title.trim() })
    else setTitle(task.title)
  }

  const addSub = () => {
    const v = subText.trim()
    if (!v) return
    patch({ subs: [...subs, { id: uid(), text: v, done: false }] })
    setSubText('')
  }

  return (
    <motion.div
      className="task-editor"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="task-editor-inner" onClick={(e) => e.stopPropagation()}>
        <textarea
          className="editor-title"
          value={title}
          rows={1}
          onChange={(e) => {
            setTitle(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
          onFocus={(e) => {
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.target.blur()
            }
          }}
        />

        {subs.length > 0 && (
          <div className="subs">
            {subs.map((s) => (
              <div key={s.id} className="sub-row">
                <button
                  className={`sub-check ${s.done ? 'on' : ''}`}
                  onClick={() =>
                    patch({ subs: subs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })
                  }
                  aria-label={s.done ? 'Mark step not done' : 'Mark step done'}
                >
                  {s.done ? '✓' : ''}
                </button>
                <span className={`sub-text ${s.done ? 'done' : ''}`}>{s.text}</span>
                <button
                  className="icon-btn sub-del"
                  onClick={() => patch({ subs: subs.filter((x) => x.id !== s.id) })}
                  aria-label="Remove step"
                >
                  <XIcon size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="sub-add">
          <PlusIcon size={11} style={{ color: 'var(--text-3)' }} />
          <input
            value={subText}
            maxLength={80}
            placeholder="Add a step…"
            onChange={(e) => setSubText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSub()}
          />
        </div>

        <textarea
          placeholder="Add a note…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== task.notes && patch({ notes })}
        />
        <div className="editor-row">
          <input
            type="date"
            className="date-input"
            value={task.due ?? ''}
            onChange={(e) => patch({ due: e.target.value || null })}
          />
          <select
            className="select"
            value={task.repeat ?? 'none'}
            onChange={(e) => patch({ repeat: e.target.value })}
            title="Repeat"
          >
            {REPEATS.map((r) => (
              <option key={r.id} value={r.id}>
                ↻ {r.label}
              </option>
            ))}
          </select>
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              className={`chip ${task.priority === p.id ? 'on' : ''}`}
              onClick={() => patch({ priority: p.id })}
            >
              {p.id !== 'none' && <FlagIcon size={11} filled style={{ color: p.color }} />}
              {p.label}
            </button>
          ))}
          <span className="spacer" />
          <select
            className="select"
            value={task.projectId}
            onChange={(e) => patch({ projectId: e.target.value })}
          >
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
          <button className="danger-btn" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  )
}
