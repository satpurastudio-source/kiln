import { useState } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import TaskItem from './TaskItem'
import EmptyState from './EmptyState'
import { useStore, selectActive, selectCompleted, groupUpcoming, toast } from '../store'
import { isOverdue, isToday, priorityRank } from '../utils'
import { ChevronIcon } from './Icons'

const byPriority = (a, b) => priorityRank[a.priority] - priorityRank[b.priority]

function Group({ label, tasks, overdue = false, startIndex = 0, showProject }) {
  if (tasks.length === 0) return null
  return (
    <div>
      <motion.div
        className={`group-label ${overdue ? 'overdue' : ''}`}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {label} <span className="n">{tasks.length}</span>
      </motion.div>
      <ul className="task-list">
        <AnimatePresence mode="popLayout" initial={true}>
          {tasks.map((t, i) => (
            <TaskItem key={t.id} task={t} index={startIndex + i} showProject={showProject} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

export default function TaskList({ query }) {
  const { state, dispatch } = useStore()
  const { view } = state
  const [showCompleted, setShowCompleted] = useState(false)

  const active = selectActive(state, query)
  const completed = selectCompleted(state, query)
  const reorderable = (view.type === 'all' || view.type === 'project') && !query
  const showProject = view.type !== 'project'

  let content
  if (active.length === 0) {
    content = <EmptyState kind={query ? 'search' : view.type} />
  } else if (view.type === 'today') {
    const overdue = active.filter((t) => isOverdue(t.due)).sort(byPriority)
    const today = active.filter((t) => !isOverdue(t.due)).sort(byPriority)
    content = (
      <>
        <Group label="Overdue" tasks={overdue} overdue showProject={showProject} />
        <Group label="Today" tasks={today} startIndex={overdue.length} showProject={showProject} />
      </>
    )
  } else if (view.type === 'upcoming') {
    let idx = 0
    content = groupUpcoming(active).map((g) => {
      const el = (
        <Group
          key={g.id}
          label={g.label}
          tasks={g.tasks}
          overdue={g.id === 'overdue'}
          startIndex={idx}
          showProject={showProject}
        />
      )
      idx += g.tasks.length
      return el
    })
  } else {
    content = (
      <Reorder.Group
        as="ul"
        axis="y"
        className="task-list"
        values={active.map((t) => t.id)}
        onReorder={(ids) => dispatch({ type: 'REORDER_TASKS', ids })}
      >
        <AnimatePresence mode="popLayout" initial={true}>
          {active.map((t, i) =>
            reorderable ? (
              <TaskItem key={t.id} task={t} index={i} showProject={showProject} reorderable />
            ) : (
              <TaskItem key={t.id} task={t} index={i} showProject={showProject} />
            )
          )}
        </AnimatePresence>
      </Reorder.Group>
    )
  }

  return (
    <div>
      {content}

      {completed.length > 0 && (
        <>
          <button className="completed-toggle" onClick={() => setShowCompleted(!showCompleted)}>
            <span className={`chev ${showCompleted ? 'open' : ''}`}>
              <ChevronIcon size={12} />
            </span>
            Completed{view.type === 'today' ? ' today' : ''} · {completed.length}
            <span
              role="button"
              className="clear-btn"
              onClick={(e) => {
                e.stopPropagation()
                const ids = completed.map((t) => t.id)
                dispatch({ type: 'DELETE_TASKS', ids })
                toast(`Cleared ${ids.length} completed`, '🧹', {
                  label: 'Undo',
                  fn: () => dispatch({ type: 'RESTORE_TASKS', ids }),
                })
              }}
            >
              Clear
            </span>
          </button>
          <AnimatePresence initial={false}>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <ul className="task-list" style={{ paddingTop: 4 }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {completed.map((t, i) => (
                      <TaskItem key={t.id} task={t} index={i} showProject={showProject} />
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
