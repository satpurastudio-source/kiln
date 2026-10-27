import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { toDateStr, todayStr, parseDateStr, parseQuickAdd, iconGlyph } from '../utils'
import { playAdd } from '../sound'
import TaskItem from './TaskItem'
import Tip from './Tip'
import { ChevronIcon, PlusIcon } from './Icons'
import { t, fmtDate, fmtNum } from '../i18n'

// Monday-first short weekday names in the reader's language (1 Jan 2024 was a Monday)
const weekdays = () => [0, 1, 2, 3, 4, 5, 6].map((i) => fmtDate(new Date(2024, 0, 1 + i), { weekday: 'short' }))
const monthName = (y, m) => fmtDate(new Date(y, m, 1), { month: 'long' })

function monthCells(year, month) {
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function Calendar() {
  const { state, dispatch } = useStore()
  // the mini calendar can deep-link a date via view.date
  const initial = state.view.date ? parseDateStr(state.view.date) : new Date()
  const [cursor, setCursor] = useState({ y: initial.getFullYear(), m: initial.getMonth() })
  const [selected, setSelected] = useState(state.view.date ?? todayStr())
  const now = new Date()
  const [dir, setDir] = useState(0) // month slide direction
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '')

  const byDue = useMemo(() => {
    const map = {}
    for (const t of state.tasks) {
      if (!t.due || t.archived) continue
      ;(map[t.due] ??= []).push(t)
    }
    return map
  }, [state.tasks])

  const cells = monthCells(cursor.y, cursor.m)
  const today = todayStr()

  const move = (delta) => {
    setDir(delta)
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const goToday = () => {
    setDir(0)
    setCursor({ y: now.getFullYear(), m: now.getMonth() })
    setSelected(today)
  }

  const dayTasks = (byDue[selected] ?? []).slice().sort((a, b) => Number(a.done) - Number(b.done))
  const selDate = parseDateStr(selected)
  const selLabel = fmtDate(selDate, { weekday: 'short', month: 'short', day: 'numeric' })

  // same smart parsing as the main add bar ("call mom 6pm !high #home");
  // the date is the selected day unless one is typed
  const addTask = () => {
    const p = parseQuickAdd(title, state.projects)
    if (!p.title.trim()) return
    dispatch({
      type: 'ADD_TASK',
      title: p.title,
      projectId: p.projectId ?? projectId,
      newFolder: p.newFolder,
      due: p.due ?? selected,
      time: p.time ?? (state.settings.defaultTime || null),
      priority: p.priority ?? state.settings.defaultPriority,
    })
    if (p.due && p.due !== selected) {
      // jump to where it went so it doesn't look lost
      const d = parseDateStr(p.due)
      setCursor({ y: d.getFullYear(), m: d.getMonth() })
      setSelected(p.due)
    }
    setTitle('')
    playAdd()
  }

  return (
    <div className="calendar">
      <Tip id="calendar">
        {t('tipCalendar')}
      </Tip>
      <div className="cal-head">
        <div className="cal-title">
          <AnimatePresence mode="wait">
            <motion.span
              key={`${cursor.y}-${cursor.m}`}
              initial={{ opacity: 0, y: dir ? dir * 10 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: dir ? dir * -10 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {monthName(cursor.y, cursor.m)} <b>{cursor.y}</b>
            </motion.span>
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" onClick={() => move(-1)} title={t('prevMonth')}>
            <ChevronIcon size={13} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button className="chip" onClick={goToday}>
            {t('today')}
          </button>
          <button className="icon-btn" onClick={() => move(1)} title={t('nextMonth')}>
            <ChevronIcon size={13} />
          </button>
        </div>
      </div>

      <div className="cal-weekdays">
        {weekdays().map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${cursor.y}-${cursor.m}`}
          className="cal-grid"
          initial={{ opacity: 0, x: dir * 26 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -26 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {cells.map((date, i) => {
            if (!date) return <span key={`b${i}`} className="cal-cell blank" />
            const ds = toDateStr(date)
            const tasks = byDue[ds] ?? []
            const active = tasks.filter((t) => !t.done)
            const isPast = ds < today
            return (
              <motion.button
                key={ds}
                className={`cal-cell ${ds === selected ? 'selected' : ''} ${ds === today ? 'today' : ''} ${isPast ? 'past' : ''}`}
                onClick={() => setSelected(ds)}
                whileTap={{ scale: 0.93 }}
              >
                <span className="cal-daynum">{date.getDate()}</span>
                {tasks.length > 0 && (
                  <span className="cal-dots">
                    {active.slice(0, 3).map((t) => {
                      const p = state.projects.find((x) => x.id === t.projectId)
                      return (
                        <span
                          key={t.id}
                          className="cal-dot"
                          style={{ background: isPast ? 'var(--danger)' : (p?.color ?? 'var(--accent)') }}
                        />
                      )
                    })}
                    {active.length > 3 && <span className="cal-more">+{active.length - 3}</span>}
                    {active.length === 0 && <span className="cal-done-mark">✓</span>}
                  </span>
                )}
              </motion.button>
            )
          })}
        </motion.div>
      </AnimatePresence>

      <div className="cal-daypanel">
        <div className="group-label" style={{ paddingTop: 26 }}>
          {selLabel}
          {selected === today && <span className="n">{t('todayLower')}</span>}
          <span className="n">
            {dayTasks.length === 0 ? t('nothingScheduled') : t('nOpen', { n: fmtNum(dayTasks.filter((x) => !x.done).length) })}
          </span>
        </div>

        <div className="cal-add-row">
          <span className="quickadd-plus" style={{ width: 22, height: 22 }}>
            <PlusIcon size={12} sw={2.2} />
          </span>
          <input
            value={title}
            placeholder={t('addTaskFor', { date: selLabel })}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            enterKeyHint="done"
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
          />
          <select
            className="select"
            value={state.projects.some((p) => p.id === projectId) ? projectId : (state.projects[0]?.id ?? '')}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {iconGlyph(p.icon)} {p.name}
              </option>
            ))}
          </select>
        </div>

        <ul className="task-list" style={{ marginTop: 10 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {dayTasks.map((t, i) => (
              <TaskItem key={t.id} task={t} index={i} showProject />
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  )
}
