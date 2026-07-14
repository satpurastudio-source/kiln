export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36)

export function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayStr = () => toDateStr(new Date())

export function addDaysStr(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export const isOverdue = (due) => !!due && due < todayStr()
export const isToday = (due) => due === todayStr()
export const isTomorrow = (due) => due === addDaysStr(1)

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fmtDue(due) {
  if (!due) return ''
  if (isToday(due)) return 'Today'
  if (isTomorrow(due)) return 'Tomorrow'
  if (isOverdue(due)) {
    const d = parseDateStr(due)
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`
  }
  // within the next 6 days → weekday name
  for (let i = 2; i <= 6; i++) {
    if (due === addDaysStr(i)) return WEEKDAYS[parseDateStr(due).getDay()]
  }
  const d = parseDateStr(due)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function fmtLongDate(d = new Date()) {
  const month = d.toLocaleDateString('en-US', { month: 'long' })
  return `${WEEKDAYS[d.getDay()]}, ${month} ${d.getDate()}`
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Winding down'
}

export const PRIORITIES = [
  { id: 'high', label: 'High', color: '#c43d2b' },
  { id: 'medium', label: 'Medium', color: '#d98e32' },
  { id: 'low', label: 'Low', color: '#5f7c8a' },
  { id: 'none', label: 'None', color: 'transparent' },
]

export const priorityColor = (p) =>
  PRIORITIES.find((x) => x.id === p)?.color ?? 'transparent'

export const priorityRank = { high: 0, medium: 1, low: 2, none: 3 }

export const PROJECT_COLORS = [
  '#d85a30', '#d9a441', '#7c8a4d', '#6f9b7a',
  '#5f7c8a', '#8a5a7c', '#a03c1c', '#b0a18c',
]

export const PROJECT_ICONS = ['✦', '◆', '❋', '●', '▲', '♦', '✳', '★', '☾', '⬡']

export const REPEATS = [
  { id: 'none', label: 'No repeat' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

export function nextDue(due, repeat) {
  const base = due ? parseDateStr(due) : new Date()
  if (repeat === 'daily') base.setDate(base.getDate() + 1)
  else if (repeat === 'weekly') base.setDate(base.getDate() + 7)
  else if (repeat === 'monthly') base.setMonth(base.getMonth() + 1)
  return toDateStr(base)
}
