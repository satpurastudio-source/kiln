import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, selectInsights, toast } from '../store'
import { habitStreak, recentDays, todayStr, HABIT_COLORS } from '../utils'
import { TargetIcon, ChartIcon, FlameIcon, PlusIcon, XIcon, LayersIcon, ClockIcon } from './Icons'
import Tip from './Tip'

const hourLabel = (h) => {
  if (h == null) return '—'
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12} ${ap}`
}

function HabitRow({ habit, days }) {
  const { dispatch } = useStore()
  const today = todayStr()
  const doneToday = !!habit.log?.[today]
  const streak = habitStreak(habit)

  return (
    <motion.div
      className="habit-row"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      <button
        className={`habit-check ${doneToday ? 'on' : ''}`}
        style={doneToday ? { background: habit.color, borderColor: habit.color } : { borderColor: habit.color }}
        onClick={() => dispatch({ type: 'TOGGLE_HABIT', id: habit.id })}
        aria-label={doneToday ? 'Mark not done today' : 'Mark done today'}
      >
        {doneToday && '✓'}
      </button>
      <div className="habit-main">
        <div className="habit-name-row">
          <span className="habit-name">{habit.name}</span>
          {streak > 0 && (
            <span className="habit-streak" style={{ color: habit.color }}>
              <FlameIcon size={11} /> {streak}
            </span>
          )}
        </div>
        <div className="habit-track">
          {days.map((ds) => (
            <span
              key={ds}
              className={`habit-dot ${habit.log?.[ds] ? 'on' : ''}`}
              style={habit.log?.[ds] ? { background: habit.color } : undefined}
              title={ds}
            />
          ))}
        </div>
      </div>
      <button
        className="icon-btn habit-del"
        onClick={() => {
          dispatch({ type: 'DELETE_HABIT', id: habit.id })
          toast('Habit removed', '🗑')
        }}
        title="Remove habit"
      >
        <XIcon size={12} />
      </button>
    </motion.div>
  )
}

export default function Insights() {
  const { state, dispatch } = useStore()
  const stats = selectInsights(state)
  const days14 = recentDays(14)
  const [name, setName] = useState('')
  const [color, setColor] = useState(HABIT_COLORS[0])

  const addHabit = () => {
    if (!name.trim()) return
    dispatch({ type: 'ADD_HABIT', name, color })
    setName('')
    toast('Habit added — check it off daily', '✦')
  }

  const cards = [
    { label: 'Done this week', value: stats.totalWeek },
    { label: 'Day streak', value: stats.streak, flame: true },
    { label: 'Focus sessions', value: stats.totalPomos },
    { label: 'Best day', value: stats.bestDay.count > 0 ? stats.bestDay.label : '—' },
  ]

  return (
    <div className="insights">
      <Tip id="insights">
        Add daily habits to build streaks, and watch your week come together in the charts below.
        Completed tasks and focus sessions feed these numbers automatically.
      </Tip>
      {/* ------------------------------- habits ------------------------------- */}
      <section className="ins-section">
        <h2 className="ins-title">
          <TargetIcon size={16} /> Habits
        </h2>

        <div className="habit-add">
          <input
            className="habit-input"
            value={name}
            maxLength={40}
            placeholder="New habit — e.g. Read 20 min"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHabit()}
          />
          <div className="habit-colors">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                className={`habit-color ${color === c ? 'on' : ''}`}
                style={{ background: c, color: c }}
                onClick={() => setColor(c)}
                aria-label={`Use ${c}`}
              />
            ))}
          </div>
          <button className="btn primary habit-add-btn" onClick={addHabit}>
            <PlusIcon size={13} sw={2.4} /> Add
          </button>
        </div>

        {state.habits.length === 0 ? (
          <div className="ins-empty">
            <TargetIcon size={22} />
            <p>Track a daily habit and build a streak. Add one above to start.</p>
          </div>
        ) : (
          <div className="habit-list">
            {state.habits.map((h) => (
              <HabitRow key={h.id} habit={h} days={days14} />
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------- this week ------------------------------ */}
      <section className="ins-section">
        <h2 className="ins-title">
          <ChartIcon size={16} /> This week
        </h2>

        <div className="stat-cards">
          {cards.map((c) => (
            <div key={c.label} className="stat-card">
              <div className="stat-value">
                {c.flame && c.value > 0 && <FlameIcon size={15} style={{ color: 'var(--accent)' }} />}
                {c.value}
              </div>
              <div className="stat-label">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="week-chart">
          {stats.days.map((d, i) => (
            <div key={d.ds} className="wc-col">
              <div className="wc-bar-wrap">
                <motion.div
                  className="wc-bar"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.count / stats.maxDay) * 100}%` }}
                  transition={{ delay: 0.05 * i, type: 'spring', stiffness: 120, damping: 18 }}
                >
                  {d.count > 0 && <span className="wc-count">{d.count}</span>}
                </motion.div>
              </div>
              <span className="wc-label">{d.label}</span>
            </div>
          ))}
        </div>

        {stats.byFolder.length > 0 && (
          <div className="folder-bars">
            <div className="fb-head">
              <LayersIcon size={13} /> By folder
            </div>
            {stats.byFolder.map((f) => (
              <div key={f.name} className="fb-row">
                <span className="fb-name">{f.name}</span>
                <div className="fb-track">
                  <motion.div
                    className="fb-fill"
                    style={{ background: f.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(f.count / stats.byFolder[0].count) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
                <span className="fb-count">{f.count}</span>
              </div>
            ))}
          </div>
        )}

        {stats.bestHour != null && (
          <p className="ins-foot">
            <ClockIcon size={12} /> You finish the most around <b>{hourLabel(stats.bestHour)}</b>.
          </p>
        )}
      </section>
    </div>
  )
}
