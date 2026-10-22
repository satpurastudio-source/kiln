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

// Glyphs that reliably render as monochrome text. iconGlyph() below appends a
// text-presentation selector so a system emoji font can't colorize them
// (that's what turned the star green on some setups).
export const PROJECT_ICONS = ['✦', '◆', '❋', '●', '▲', '✚', '✳', '✶', '☾', '⬡']

// U+FE0E forces text (non-emoji) presentation of an otherwise ambiguous glyph.
export const iconGlyph = (g) => (g ? `${g}\uFE0E` : g)

// Accent themes — retint the whole app. rgb feeds rgba(var(--accent-rgb), …).
export const ACCENTS = [
  { id: 'terracotta', name: 'Terracotta', accent: '#d85a30', accent2: '#ea6840', deep: '#c24a24', rgb: '216, 90, 48' },
  { id: 'ember', name: 'Ember', accent: '#c43d2b', accent2: '#e0553f', deep: '#a8331f', rgb: '196, 61, 43' },
  { id: 'amber', name: 'Amber', accent: '#c98a1e', accent2: '#dda23a', deep: '#a8720f', rgb: '201, 138, 30' },
  { id: 'sage', name: 'Sage', accent: '#6f9b7a', accent2: '#84b28f', deep: '#588364', rgb: '111, 155, 122' },
  { id: 'ocean', name: 'Ocean', accent: '#5f7c8a', accent2: '#74929f', deep: '#4c6570', rgb: '95, 124, 138' },
  { id: 'plum', name: 'Plum', accent: '#8a5a7c', accent2: '#a06f92', deep: '#704764', rgb: '138, 90, 124' },
]

export const accentById = (id) => ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]

// Device-local preferences (not synced): personalization + new-task defaults.
export const DEFAULT_SETTINGS = {
  accent: 'terracotta',
  customAccent: '#d85a30', // hex used when accent === 'custom'
  defaultDue: 'today', // 'none' | 'today' | 'tomorrow'
  defaultPriority: 'none',
  defaultTime: '', // '' or 'HH:MM'
  reducedEffects: false, // lighter, faster: no blur / aurora / confetti
  focusWork: 25, // custom pomodoro work minutes
  focusBreak: 5, // custom pomodoro break minutes
  ambientShowEmber: true,
  ambientNightDim: true,
  ambientWidget1: 'streak', // 'none' | 'streak' | 'progress' | 'focus'
  ambientWidget2: 'focus',
}

export const AMBIENT_WIDGETS = [
  { id: 'none', label: 'Off' },
  { id: 'streak', label: 'Streak' },
  { id: 'progress', label: 'Progress' },
  { id: 'focus', label: 'Focus' },
]

/* -------------------------- accent color helpers -------------------------- */

export function hexToRgbStr(hex) {
  let h = (hex || '').replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return `${r}, ${g}, ${b}`
}

// amt > 0 lightens toward white, amt < 0 darkens toward black
function shadeHex(hex, amt) {
  const [r, g, b] = hexToRgbStr(hex).split(',').map((x) => parseInt(x, 10))
  const t = amt < 0 ? 0 : 255
  const p = Math.abs(amt)
  const mix = (c) => Math.max(0, Math.min(255, Math.round((t - c) * p + c)))
  return '#' + [mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')
}

// derive a full accent theme from a single custom hex
export function deriveAccent(hex) {
  return {
    id: 'custom',
    name: 'Custom',
    accent: hex,
    accent2: shadeHex(hex, 0.16),
    deep: shadeHex(hex, -0.18),
    rgb: hexToRgbStr(hex),
  }
}

export function resolveAccent(settings) {
  if (settings?.accent === 'custom' && settings.customAccent) return deriveAccent(settings.customAccent)
  return accentById(settings?.accent)
}

/* --------------------------------- habits --------------------------------- */

// consecutive days done, ending today (or yesterday if today isn't logged yet,
// so a not-yet-checked habit doesn't read as a broken streak mid-day)
export function habitStreak(habit, today = todayStr()) {
  const log = habit?.log || {}
  let d = parseDateStr(today)
  if (!log[toDateStr(d)]) d.setDate(d.getDate() - 1)
  let n = 0
  while (log[toDateStr(d)]) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

// last `days` dates (oldest → newest) as YYYY-MM-DD, for the mini trackers
export function recentDays(days = 14) {
  const out = []
  for (let i = days - 1; i >= 0; i--) out.push(addDaysStr(-i))
  return out
}

export const HABIT_COLORS = ['#d85a30', '#d9a441', '#6f9b7a', '#5f7c8a', '#8a5a7c', '#7c8a4d']

// Onboarding "what will you use kiln for?" → starter folders.
export const PURPOSES = [
  { id: 'work', label: 'Work', name: 'Work', color: '#5f7c8a', icon: '◆' },
  { id: 'study', label: 'Study', name: 'Study', color: '#8a5a7c', icon: '❋' },
  { id: 'personal', label: 'Personal', name: 'Personal', color: '#7c8a4d', icon: '●' },
  { id: 'fitness', label: 'Fitness', name: 'Fitness', color: '#6f9b7a', icon: '▲' },
  { id: 'side', label: 'Side project', name: 'Side Project', color: '#d9a441', icon: '✳' },
  { id: 'errands', label: 'Errands', name: 'Errands', color: '#b0a18c', icon: '✚' },
]

// 'HH:MM' (24h) → friendly 12h label, e.g. '14:30' → '2:30 PM'
export function fmtTime(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

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

/* --------------------------- natural-language add --------------------------- */
// Turn "gym tomorrow 7am !high #fitness" into structured fields, stripping the
// recognized tokens out of the title. Only fields it finds are returned; the
// caller falls back to its own defaults for the rest.
const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

export function parseQuickAdd(raw, projects = []) {
  const original = (raw || '').trim()
  if (!original) return { title: original }
  const res = { title: original }
  let s = ` ${raw} `
  const remove = (m) => {
    s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)
  }

  // --- folder: #name → use the matching folder, or flag a new one to create ---
  let m = s.match(/\s#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/u)
  if (m) {
    const q = m[1].toLowerCase()
    const p = projects.find((pr) => {
      const n = pr.name.toLowerCase()
      return n.replace(/\s+/g, '').startsWith(q) || n.startsWith(q) || n.includes(q)
    })
    if (p) res.projectId = p.id
    else res.newFolder = m[1].charAt(0).toUpperCase() + m[1].slice(1) // e.g. #fitness → Fitness
    remove(m)
  }

  // --- priority: p1..p3, !1..!3, !high/!med/!low ---
  m = s.match(/\s(p1|!1|!high|!hi|p2|!2|!medium|!med|p3|!3|!low)\b/i)
  if (m) {
    const t = m[1].toLowerCase()
    res.priority = /1|high|hi/.test(t) ? 'high' : /2|med/.test(t) ? 'medium' : 'low'
    remove(m)
  }

  // --- time: 5pm, 7:30 am, at 14:00, noon, midnight ---
  if ((m = s.match(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i))) {
    let h = parseInt(m[1], 10) % 12
    if (/pm/i.test(m[3])) h += 12
    res.time = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`
    remove(m)
  } else if ((m = s.match(/\s(?:at\s+)?noon\b/i))) {
    res.time = '12:00'
    remove(m)
  } else if ((m = s.match(/\s(?:at\s+)?midnight\b/i))) {
    res.time = '00:00'
    remove(m)
  } else if ((m = s.match(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/))) {
    res.time = `${String(+m[1]).padStart(2, '0')}:${m[2]}`
    remove(m)
  }

  // --- date ---
  if ((m = s.match(/\s(today|tonight)\b/i))) {
    res.due = todayStr()
    remove(m)
  } else if ((m = s.match(/\s(tomorrow|tmrw|tmr)\b/i))) {
    res.due = addDaysStr(1)
    remove(m)
  } else if ((m = s.match(/\snext week\b/i))) {
    res.due = addDaysStr(7)
    remove(m)
  } else if ((m = s.match(/\sin (\d{1,3}) days?\b/i))) {
    res.due = addDaysStr(Math.min(365, +m[1]))
    remove(m)
  } else if (
    // anchored to the end of the phrase (time is already stripped) so a stray
    // "sat"/"wed" mid-sentence isn't mistaken for a weekday
    (m = s.match(
      /\s(next\s+|this\s+|on\s+|by\s+)?(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)\s*$/i
    ))
  ) {
    const target = DOW[m[2].toLowerCase().slice(0, 3)]
    let off = (target - new Date().getDay() + 7) % 7
    if (off === 0) off = 7 // a weekday name means the upcoming one, not today
    if (/next/i.test(m[1] || '') && off < 7) off += 7 // "next monday" → a full week out
    res.due = addDaysStr(off)
    remove(m)
  }

  const title = s.replace(/\s+/g, ' ').trim()
  // if the tokens ate the whole title, treat the text as literal instead
  if (!title) return { title: original }
  res.title = title
  return res
}
