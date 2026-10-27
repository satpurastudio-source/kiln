// Ember's mood — a pure function of app state so it can be unit-reasoned
// and force-overridden in dev without touching any component.
import { todayProgress } from './store'
import { isOverdue, ambientConfig } from './utils'
import { t, tn } from './i18n'

export const EMBER_MOODS = ['focus', 'celebrate', 'worried', 'proud', 'sleepy', 'idle']

// start > end wraps past midnight (e.g. 23 → 6)
export const isNightHour = (now = new Date(), start = 23, end = 6) => {
  const h = now.getHours()
  if (start === end) return false
  return start > end ? h >= start || h < end : h >= start && h < end
}

// focusSession mirrors Focus.jsx's kiln-focus shape: { taskId, mode, phase, endsAt, remaining, count }
// remaining === null means the timer is actively running (see Focus.jsx).
export function emberMood(state, focusSession, now = new Date()) {
  const focusing = !!focusSession && focusSession.remaining === null && focusSession.phase === 'work'
  if (focusing) return 'focus'

  const justCompleted = state.tasks.some(
    (t) => t.done && t.doneAt && now.getTime() - t.doneAt < 8000
  )
  if (justCompleted) return 'celebrate'

  const overdueCount = state.tasks.filter((t) => !t.done && !t.archived && isOverdue(t.due)).length
  if (overdueCount >= 3) return 'worried'

  const progress = todayProgress(state)
  if (progress.total > 0 && progress.active === 0) return 'proud'

  const { nightStart, nightEnd } = ambientConfig(state.settings)
  if (isNightHour(now, nightStart, nightEnd) || progress.total === 0) return 'sleepy'

  return 'idle'
}

// Flame grows a little with a longer streak, capping out at a 14-day one.
export const emberScale = (streak = 0) => 0.85 + Math.min(streak, 14) * 0.02

// three lines per mood, looked up as ember_<mood>_<0-2> in the locale files
const MOODS = ['focus', 'celebrate', 'worried', 'proud', 'sleepy', 'idle']
const lines = (mood) => [0, 1, 2].map((i) => t(`ember_${mood}_${i}`))

// ctx.overdueCount, when given for 'worried', swaps in the real number.
export function randomLine(mood, ctx = {}) {
  const pool = lines(MOODS.includes(mood) ? mood : 'idle')
  if (mood === 'worried' && ctx.overdueCount) {
    const dynamic = tn('emberOverdue', ctx.overdueCount)
    const withDynamic = [dynamic, ...pool.slice(1)]
    return withDynamic[Math.floor(Math.random() * withDynamic.length)]
  }
  return pool[Math.floor(Math.random() * pool.length)]
}
