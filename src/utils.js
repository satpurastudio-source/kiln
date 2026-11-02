import { t, fmtDate, fmtClock, currentLang } from './i18n'

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


export function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fmtDue(due) {
  if (!due) return ''
  if (isToday(due)) return t('today')
  if (isTomorrow(due)) return t('tomorrow')
  const d = parseDateStr(due)
  // within the next 6 days → weekday name
  if (!isOverdue(due)) {
    for (let i = 2; i <= 6; i++) {
      if (due === addDaysStr(i)) return fmtDate(d, { weekday: 'long' })
    }
  }
  return fmtDate(d, { month: 'short', day: 'numeric' })
}

export function fmtLongDate(d = new Date()) {
  return fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return t('greetLate')
  if (h < 12) return t('greetMorning')
  if (h < 17) return t('greetAfternoon')
  if (h < 22) return t('greetEvening')
  return t('greetWinding')
}

export const PRIORITIES = [
  { id: 'high', get label() { return t('prio_high') }, color: '#c43d2b' },
  { id: 'medium', get label() { return t('prio_medium') }, color: '#d98e32' },
  { id: 'low', get label() { return t('prio_low') }, color: '#5f7c8a' },
  { id: 'none', get label() { return t('prio_none') }, color: 'transparent' },
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
  { id: 'terracotta', get name() { return t('accent_terracotta') }, accent: '#d85a30', accent2: '#ea6840', deep: '#c24a24', rgb: '216, 90, 48' },
  { id: 'ember', get name() { return t('accent_ember') }, accent: '#c43d2b', accent2: '#e0553f', deep: '#a8331f', rgb: '196, 61, 43' },
  { id: 'amber', get name() { return t('accent_amber') }, accent: '#c98a1e', accent2: '#dda23a', deep: '#a8720f', rgb: '201, 138, 30' },
  { id: 'sage', get name() { return t('accent_sage') }, accent: '#6f9b7a', accent2: '#84b28f', deep: '#588364', rgb: '111, 155, 122' },
  { id: 'ocean', get name() { return t('accent_ocean') }, accent: '#5f7c8a', accent2: '#74929f', deep: '#4c6570', rgb: '95, 124, 138' },
  { id: 'plum', get name() { return t('accent_plum') }, accent: '#8a5a7c', accent2: '#a06f92', deep: '#704764', rgb: '138, 90, 124' },
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
  textScale: 1, // multiplies every font size (Settings → Text size), 0.9–1.4
  focusWork: 25, // custom pomodoro work minutes
  focusBreak: 5, // custom pomodoro break minutes
  ambient: {}, // partial overrides of AMBIENT_DEFAULTS — always read via ambientConfig()
}

export const TEXT_SCALE = { min: 0.9, max: 1.4, step: 0.05 }

export const AMBIENT_WIDGETS = [
  { id: 'none', get label() { return t('widget_none') } },
  { id: 'streak', get label() { return t('widget_streak') } },
  { id: 'progress', get label() { return t('widget_progress') } },
  { id: 'focus', get label() { return t('widget_focus') } },
]

// Every ambient-mode knob. Sizes are literal px so a given monitor can be
// tuned exactly; the CSS still caps them so nothing can overflow the screen.
export const AMBIENT_DEFAULTS = {
  theme: 'app', // 'app' | 'light' | 'dark'
  side: 'left', // which side the clock sits on
  clockSize: 480, // px
  clockFace: 'classic', // 'minimal' | 'classic' | 'numerals'
  seconds: 'sweep', // 'sweep' | 'tick' | 'off'
  showDigital: true,
  showDate: true,
  showGreeting: true,
  showProgress: true,
  quickAdd: true, // N / + adds a task without leaving ambient
  widget1: 'streak',
  widget2: 'focus',
  columns: 'both', // 'both' | 'todo'
  rowSize: 22, // px, task text
  maxRows: 10,
  padding: 56, // px, screen edge
  gap: 96, // px, between clock and board
  radius: 18, // px, card corners
  glow: 100, // %, background warmth
  showEmber: true,
  emberSize: 128, // px
  emberCorner: 'right', // 'right' | 'left'
  emberEyes: true, // eyes follow the cursor
  night: 'off', // 'off' | 'dim' | 'dark'
  nightStart: 23,
  nightEnd: 6,
  nightLevel: 55, // % brightness while dimmed
  drift: 12, // px, burn-in nudge every 3 min (0 = off)
}

// Saved settings only hold what the user changed, so new keys added here
// later still reach returning users.
export const ambientConfig = (settings) => ({ ...AMBIENT_DEFAULTS, ...(settings?.ambient ?? {}) })

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
    get name() {
      return t('accentCustom')
    },
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
  { id: 'work', get label() { return t('p_work') }, name: 'Work', color: '#5f7c8a', icon: '◆' },
  { id: 'study', get label() { return t('p_study') }, name: 'Study', color: '#8a5a7c', icon: '❋' },
  { id: 'personal', get label() { return t('p_personal') }, name: 'Personal', color: '#7c8a4d', icon: '●' },
  { id: 'fitness', get label() { return t('p_fitness') }, name: 'Fitness', color: '#6f9b7a', icon: '▲' },
  { id: 'side', get label() { return t('p_side') }, name: 'Side Project', color: '#d9a441', icon: '✳' },
  { id: 'errands', get label() { return t('p_errands') }, name: 'Errands', color: '#b0a18c', icon: '✚' },
]

// 'HH:MM' (24h) → friendly 12h label, e.g. '14:30' → '2:30 PM'
export function fmtTime(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (currentLang() !== 'en') return fmtClock(new Date(2000, 0, 1, h, m), { hour: 'numeric', minute: '2-digit' })
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export const REPEATS = [
  { id: 'none', get label() { return t('repeat_none') } },
  { id: 'daily', get label() { return t('repeat_daily') } },
  { id: 'weekly', get label() { return t('repeat_weekly') } },
  { id: 'monthly', get label() { return t('repeat_monthly') } },
]

// Next occurrence of a repeating task. Keeps the original rhythm (a Monday
// task stays on Mondays, the 31st stays month-end) but never lands in the
// past — finishing a daily task that was 5 days overdue queues today's, not
// another overdue one.
export function nextDue(due, repeat) {
  const anchor = due ? parseDateStr(due) : new Date()
  anchor.setHours(0, 0, 0, 0)
  const day = anchor.getDate()
  const today = parseDateStr(todayStr())
  const step = (d, n) => {
    if (repeat === 'daily') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
    if (repeat === 'weekly') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n)
    // monthly: clamp so 31 jan → 28/29 feb, not 3 march
    const m = new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
    return new Date(m.getFullYear(), m.getMonth(), Math.min(day, last))
  }
  let n = 1
  let next = step(anchor, n)
  while (next < today && n < 1000) next = step(anchor, ++n)
  return toDateStr(next)
}

/* ------------------------------ backup / restore ----------------------------- */

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoking right away can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportData(state) {
  downloadJSON(
    {
      app: 'kiln',
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: state.projects,
      tasks: state.tasks,
      habits: state.habits,
    },
    `kiln-backup-${todayStr()}.json`
  )
}

// Validate a backup file's contents. Returns { projects, tasks, habits } or
// throws with a human-readable reason.
export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(t('backupNotJson'))
  }
  if (!Array.isArray(data?.projects) || !Array.isArray(data?.tasks)) {
    throw new Error(t('backupNotKiln'))
  }
  const projects = data.projects.filter((p) => p && p.id && p.name)
  if (!projects.length) throw new Error(t('backupNoFolders'))
  const ids = new Set(projects.map((p) => p.id))
  const tasks = data.tasks
    .filter((t) => t && t.id && typeof t.title === 'string')
    .map((t) => ({ ...t, projectId: ids.has(t.projectId) ? t.projectId : projects[0].id }))
  const habits = Array.isArray(data.habits) ? data.habits.filter((h) => h && h.id) : []
  return { projects, tasks, habits }
}

/* --------------------------- natural-language add --------------------------- */
// Turn "gym tomorrow 7am !high #fitness" into structured fields, stripping the
// recognized tokens out of the title. Only fields it finds are returned; the
// caller falls back to its own defaults for the rest.
const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
const MONTH_RE =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const WEEKDAY_RE =
  '(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)'
const LEAD = '(?:on\\s+|by\\s+|due\\s+)?' // "on 26 oct", "by oct 26", "due 26/10"
const ORD = '(?:st|nd|rd|th)?'

// A calendar date. With no year it means the next time that date comes round
// (typing "5 jan" in December is next January, not ten months ago).
function calendarDate(month, day, year) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let y = year == null ? today.getFullYear() : year < 100 ? 2000 + year : year
  let d = new Date(y, month, day)
  if (d.getMonth() !== month) return null // 31 feb, 31 apr…
  if (year == null && d < today) {
    d = new Date(y + 1, month, day)
    if (d.getMonth() !== month) return null // 29 feb into a non-leap year
  }
  return toDateStr(d)
}

// "the 30th" → the next 30th: this month if it hasn't passed, else next month
function nextDayOfMonth(day) {
  const now = new Date()
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, day)
    if (d.getDate() !== day) continue // month too short
    if (i === 0 && day < now.getDate()) continue
    return toDateStr(d)
  }
  return null
}

// Hinglish and Hindi: "mummy ko kal 6 baje call", "kal subah 7 baje gym",
// "शुक्रवार शाम 5 बजे किराया". Spoken forms that are safe to read as dates and
// times. Words after a date or time ("kal ko", "6 baje ko") go with it, but "ko"
// before one stays in the title, because "mummy ko" is part of the task.
const NUM = '([\\d\\u0966-\\u096f]{1,2})'
const toNum = (x) => +String(x).replace(/[०-९]/g, (c) => c.charCodeAt(0) - 0x0966)
const END = ',?(?=\\s)'
const BAJE = '(?:baje|bje|bajay|bajey|bajhe|baaje|बजे)'
const KO = '(?:\\s+(?:ko|को))?'
const PART_HI = 'subah|subha|subh|suba|savere|sawere|savera|sawera|dopahar|dopehar|dupahar|dopaher|dophar|dopahr|duphar|sham|shaam|raat|raath|सुबह|सवेरे|सवेरा|दोपहर|शाम|रात'
// Only safe right next to "baje": "9 baje night", but not "rat poison 9" or "10 morning pages"
const PART_ANY = `${PART_HI}|morning|mrng|evening|eve|night|nite|afternoon|noon|rat`
const LINK_BEFORE = '(?:ko|ke|ki|mein|me|mai|main|को|के|की|में)'
const LINK_AFTER = '(?:\\s+(?:ko|mein|me|mai|main|को|में))?'
const MINUTES = '(?:[:.](?<min>[0-5]\\d))?'
// "din mein 2 baje" is daytime, but "2 din mein" means in two days
const BEFORE_BAJE = `(?:(?<pb>${PART_ANY})(?:\\s+\\k<pb>)?\\s*(?:${LINK_BEFORE}\\s+)?|(?<![\\d\\u0966-\\u096f]\\s)(?<db>din|दिन)\\s+(?:mein|me|ke|में|के)\\s+)?`
const AFTER_BAJE = `(?:\\s+(?<pa>${PART_ANY})${LINK_AFTER}|\\s+(?<da>din|दिन)\\s+(?:mein|me|में))?`
const HALF = '\\u0922\\u093c|\\u095d' // ढ़ arrives in either of two Unicode spellings
const QUARTERS = `(saade|sade|saadhe|sadhe|सा(?:${HALF})े|sawa|sava|सवा|paune|pone|पौने)`
const WHOLE_HALF = `(dedh|deadh|डे(?:${HALF})|dhai|dhaai|ढाई)`
const PART_KIND = {
  subah: 'am', subha: 'am', subh: 'am', suba: 'am', savere: 'am', sawere: 'am', savera: 'am', sawera: 'am',
  'सुबह': 'am', 'सवेरे': 'am', 'सवेरा': 'am', morning: 'am', mrng: 'am', breakfast: 'am', nashta: 'am', 'नाश्ता': 'am',
  dopahar: 'noon', dopehar: 'noon', dupahar: 'noon', dopaher: 'noon', dophar: 'noon', dopahr: 'noon', duphar: 'noon',
  'दोपहर': 'noon', din: 'noon', 'दिन': 'noon', afternoon: 'noon', noon: 'noon', lunch: 'noon',
  sham: 'pm', shaam: 'pm', 'शाम': 'pm', evening: 'pm', eve: 'pm', dinner: 'pm',
  raat: 'night', raath: 'night', rat: 'night', 'रात': 'night', night: 'night', nite: 'night',
}
const HI_DOW = {
  somvar: 1, somwar: 1, 'सोमवार': 1,
  mangalvar: 2, mangalwar: 2, 'मंगलवार': 2,
  budhvar: 3, budhwar: 3, 'बुधवार': 3,
  guruvar: 4, guruwar: 4, veervar: 4, brihaspativar: 4, 'गुरुवार': 4, 'वीरवार': 4, 'बृहस्पतिवार': 4,
  shukravar: 5, shukrawar: 5, 'शुक्रवार': 5,
  shanivar: 6, shaniwar: 6, 'शनिवार': 6,
  ravivar: 0, raviwar: 0, itwar: 0, itvar: 0, 'रविवार': 0, 'इतवार': 0,
}
const HI_DOW_RE = `(${Object.keys(HI_DOW).join('|')})`
const EN_DOW_FULL = '(monday|tuesday|wednesday|thursday|friday|saturday|sunday)'
const AFTER_DAY = '(?:\\s+(?:ko|tak|ka|ki|को|तक|का|की))?'
const NEXT_WORD = '(?:agle|agla|next|अगले|अगला)'
const WEEK_WORDS = 'hafte|hafta|week|हफ्ते|हफ़्ते|हफ्ता|हफ़्ता'
const WEEK_WORD = `(?:${WEEK_WORDS})`

// With no part of the day, the hour people usually mean: 1 to 6 is the
// afternoon or evening, 7 to 11 the morning. The preview shows the result as it's typed.
function spokenHour(h, kind) {
  if (h === 0 || h > 12) return h
  if (kind === 'am') return h
  if (kind === 'pm') return h === 12 ? 12 : h + 12
  if (kind === 'noon') return h === 12 ? 12 : h <= 5 ? h + 12 : h
  if (kind === 'night') return h === 12 ? 0 : h <= 4 ? h : h + 12
  return h === 12 ? 12 : h <= 6 ? h + 12 : h
}
const clock = (h, min) => `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`

// Reads the time out of s. Returns the text with it removed, and the time.
function hinglishTime(s) {
  const kindOf = (p) => PART_KIND[(p || '').toLowerCase()]
  const done = (m, hour, minute, kind, meridiem) => {
    let rest = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)
    if (!kind && !meridiem && hour >= 1 && hour <= 12) {
      // The part of the day can be further away: "raat ko mummy ko 9 baje call".
      // It leaves the title only if it's plainly about the time, so "raat ka khana" stays.
      const far = rest.match(new RegExp(`\\s(${PART_HI})(\\s+(?:ko|mein|me|mai|main|को|में))?(?=\\s)`, 'i'))
      const hint = rest.match(/\s(morning|evening|night|afternoon|breakfast|nashta|नाश्ता|lunch|dinner)(?=\s)/i)
      if (far) {
        kind = kindOf(far[1])
        const after = rest.slice(far.index + far[0].length)
        if (far[2] || !after.trim()) rest = rest.slice(0, far.index) + ' ' + after
      } else if (hint) kind = kindOf(hint[1])
    }
    const h = meridiem ? (hour % 12) + (/pm/i.test(meridiem) ? 12 : 0) : spokenHour(hour, kind)
    return { rest, time: clock(h, minute) }
  }

  // 9 baje raat · raat ke 9 baje · sham saade 6 baje · 9.30 baje raat ko · din mein 2 baje · 14 baje
  let m = s.match(new RegExp(`\\s(?:at\\s+)?${BEFORE_BAJE}(?:(?<q>${QUARTERS})\\s+)?(?<n>${NUM})${MINUTES}\\s*${BAJE}(?:\\s*(?<mer>am|pm))?${KO}${AFTER_BAJE}${END}`, 'i'))
  if (m) {
    const g = m.groups
    const n = toNum(g.n)
    if (n <= 23 && (!g.q || (n >= 1 && n <= 12))) {
      const kind = kindOf(g.pb || g.db || g.pa || g.da)
      const q = (g.q || '').toLowerCase()
      if (/^(sawa|sava|सवा)/.test(q)) return done(m, n, 15, kind, g.mer)
      if (/^(sa|सा)/.test(q)) return done(m, n, 30, kind, g.mer)
      if (q) return done(m, n === 1 ? 12 : n - 1, 45, kind, g.mer)
      return done(m, n, g.min ? +g.min : 0, kind, g.mer)
    }
  }
  // dedh baje raat (1:30) · sham dhai baje (2:30)
  m = s.match(new RegExp(`\\s(?:at\\s+)?${BEFORE_BAJE}(?<half>${WHOLE_HALF})\\s*${BAJE}${KO}${AFTER_BAJE}${END}`, 'i'))
  if (m) {
    const g = m.groups
    return done(m, /^(de|डे)/i.test(g.half) ? 1 : 2, 30, kindOf(g.pb || g.db || g.pa || g.da))
  }
  // With a part of the day, "baje" is optional: subah 7 · raat ko 9 · sham 6.30 · raat 9pm
  m = s.match(new RegExp(`\\s(?<pb>${PART_HI})(?:\\s+\\k<pb>)?\\s+(?:${LINK_BEFORE}\\s+)?(?<n>${NUM})${MINUTES}\\s*(?<mer>am|pm)?${END}`, 'i'))
  if (m && toNum(m.groups.n) >= 1 && toNum(m.groups.n) <= 12) {
    return done(m, toNum(m.groups.n), m.groups.min ? +m.groups.min : 0, kindOf(m.groups.pb), m.groups.mer)
  }
  // ...and it can come after: 9 raat ko · 6:30 sham · 9pm raat
  m = s.match(new RegExp(`\\s(?<n>${NUM})${MINUTES}\\s*(?<mer>am|pm)?\\s+(?<pa>${PART_HI})${LINK_AFTER}${END}`, 'i'))
  if (m && toNum(m.groups.n) >= 1 && toNum(m.groups.n) <= 12) {
    return done(m, toNum(m.groups.n), m.groups.min ? +m.groups.min : 0, kindOf(m.groups.pa), m.groups.mer)
  }
  return null
}

function nextMonthStr() {
  const d = new Date()
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  // clamp: 31 jan → 28/29 feb, not 3 march
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return toDateStr(d)
}

function upcomingWeekday(target, next) {
  let off = (target - new Date().getDay() + 7) % 7
  if (off === 0) off = 7 // a weekday name means the upcoming one, not today
  if (next && off < 7) off += 7 // "next monday" → a full week out
  return addDaysStr(off)
}

function hinglishDate(s) {
  const find = (p) => s.match(new RegExp(p, 'i'))
  let m
  // aaj · aaj raat · aaj tak · aaj ki
  if ((m = find(`\\s(?:aaj|आज)(?:\\s+(?:raat|रात)${KO})?${AFTER_DAY}${END}`))) return { m, due: todayStr() }
  // kal · kal tak · kal ki (but "kal wala" points back at yesterday)
  if ((m = find(`\\s(?:kal|कल)(?!\\s+(?:wala|wali|wale|वाला|वाली|वाले)\\s)${AFTER_DAY}${END}`))) return { m, due: addDaysStr(1) }
  if ((m = find(`\\s(?:parso|parson|परसों|परसो)${AFTER_DAY}${END}`))) return { m, due: addDaysStr(2) }
  if ((m = find(`\\s(?:narso|narson|नरसों|नरसो)${AFTER_DAY}${END}`))) return { m, due: addDaysStr(3) }
  // agle hafte · agle week · next hafte
  if ((m = find(`\\s${NEXT_WORD}\\s+${WEEK_WORD}(?:\\s+(?:ko|tak|mein|me|को|तक|में))?${END}`))) return { m, due: addDaysStr(7) }
  // agle mahine · agle month · next mahine
  if ((m = find(`\\s${NEXT_WORD}\\s+(?:mahine|mahina|month|महीने|महीना)(?:\\s+(?:ko|tak|mein|me|को|तक|में))?${END}`))) return { m, due: nextMonthStr() }
  // 3 din baad · 2 din mein · 2 hafte baad
  if ((m = find(`\\s${NUM}\\s+(din|dino|dinon|${WEEK_WORDS}|weeks|hafton|दिन|दिनों|हफ्तों)\\s+(?:baad|bad|mein|me|mai|बाद|में)${END}`))) {
    const weeks = /^(h|w|ह)/i.test(m[2])
    return { m, due: addDaysStr(Math.min(365, toNum(m[1]) * (weeks ? 7 : 1))) }
  }
  // is weekend · weekend pe
  if ((m = find(`\\sis\\s+weekend${AFTER_DAY}${END}`)) || (m = find(`\\sweekend\\s+(?:ko|par|pe|tak)${END}`))) {
    return { m, due: addDaysStr((6 - new Date().getDay() + 7) % 7) }
  }
  // agle shukravar · is friday · agle friday ko
  m = find(`\\s(${NEXT_WORD}|is|इस)\\s+(?:${EN_DOW_FULL}|${HI_DOW_RE})${AFTER_DAY}${END}`)
  if (m) {
    const target = m[2] ? DOW[m[2].slice(0, 3).toLowerCase()] : HI_DOW[m[3].toLowerCase()]
    return { m, due: upcomingWeekday(target, !/^(is|इस)$/i.test(m[1])) }
  }
  // shukravar anywhere (the word can't be anything else) · friday ko anywhere
  if ((m = find(`\\s${HI_DOW_RE}${AFTER_DAY}${END}`))) return { m, due: upcomingWeekday(HI_DOW[m[1].toLowerCase()], false) }
  if ((m = find(`\\s${EN_DOW_FULL}\\s+(?:ko|tak|को|तक)${END}`))) return { m, due: upcomingWeekday(DOW[m[1].slice(0, 3).toLowerCase()], false) }
  return null
}

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
    // best match first: exact name, then prefix, then anywhere in the name
    const norm = (pr) => pr.name.toLowerCase().replace(/\s+/g, '')
    const p =
      projects.find((pr) => norm(pr) === q) ||
      projects.find((pr) => norm(pr).startsWith(q) || pr.name.toLowerCase().startsWith(q)) ||
      projects.find((pr) => pr.name.toLowerCase().includes(q))
    if (p) {
      res.projectId = p.id
      remove(m)
    } else if (/^\p{L}/u.test(m[1])) {
      // "#12" in "fix bug #12" is an issue number, not a new folder
      res.newFolder = m[1].charAt(0).toUpperCase() + m[1].slice(1) // e.g. #fitness → Fitness
      remove(m)
    }
  }

  // --- priority: p1..p3, !1..!3, !high/!med/!low ---
  m = s.match(/\s(p1|!1|!high|!hi|p2|!2|!medium|!med|p3|!3|!low)\b/i)
  if (m) {
    const t = m[1].toLowerCase()
    res.priority = /1|high|hi/.test(t) ? 'high' : /2|med/.test(t) ? 'medium' : 'low'
    remove(m)
  }

  // --- time: 6 baje, sham 5 baje, 5pm, 7:30 am, at 14:00, noon, midnight ---
  const spokenTime = hinglishTime(s)
  if (spokenTime) {
    res.time = spokenTime.time
    s = spokenTime.rest
  } else if ((m = s.match(/\s(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i))) {
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
  // Relative words first, then calendar dates, then weekdays. Bare numeric
  // and weekday forms only count at the end of the phrase (or after on/by/
  // due) so "read 1/2 of the book" or "sat exam prep" stay as titles.
  let dm
  const spokenDate = hinglishDate(s)
  if (spokenDate) {
    res.due = spokenDate.due
    remove(spokenDate.m)
  } else if ((m = s.match(/\s(today|tonight)\b/i))) {
    res.due = todayStr()
    remove(m)
  } else if ((m = s.match(/\s(?:the\s+)?(day after tomorrow|overmorrow)\b/i))) {
    res.due = addDaysStr(2)
    remove(m)
  } else if ((m = s.match(/\s(tomorrow|tmrw|tmr)\b/i))) {
    res.due = addDaysStr(1)
    remove(m)
  } else if ((m = s.match(/\snext week\b/i))) {
    res.due = addDaysStr(7)
    remove(m)
  } else if ((m = s.match(/\snext month\b/i))) {
    res.due = nextMonthStr()
    remove(m)
  } else if ((m = s.match(/\s(?:this\s+)?weekend\b/i))) {
    const off = (6 - new Date().getDay() + 7) % 7 // upcoming saturday (today if it is one)
    res.due = addDaysStr(off)
    remove(m)
  } else if ((m = s.match(/\sin (\d{1,3}) (days?|weeks?|wks?)\b/i))) {
    const n = +m[1] * (/^w/i.test(m[2]) ? 7 : 1)
    res.due = addDaysStr(Math.min(365, n))
    remove(m)
  } else if (
    // 26 oct · 26th october · 26 of oct · 26 oct 2027
    (m = s.match(new RegExp(`\\s${LEAD}(?:the\\s+)?(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MONTH_RE}(?:,?\\s+(\\d{4}))?\\b`, 'i'))) &&
    (dm = calendarDate(MON[m[2].slice(0, 3).toLowerCase()], +m[1], m[3] ? +m[3] : null))
  ) {
    res.due = dm
    remove(m)
  } else if (
    // oct 26 · october 26th · oct 26, 2027
    (m = s.match(new RegExp(`\\s${LEAD}${MONTH_RE}\\s+(\\d{1,2})${ORD}(?:,?\\s+(\\d{4}))?\\b`, 'i'))) &&
    (dm = calendarDate(MON[m[1].slice(0, 3).toLowerCase()], +m[2], m[3] ? +m[3] : null))
  ) {
    res.due = dm
    remove(m)
  } else if (
    // 26/10 · 26-10-2026 — day first (Indian/UK order)
    ((m = s.match(/\s(?:on|by|due)\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?\b/i)) ||
      (m = s.match(/\s(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?\s*$/))) &&
    +m[2] >= 1 &&
    +m[2] <= 12 &&
    (dm = calendarDate(+m[2] - 1, +m[1], m[3] ? +m[3] : null))
  ) {
    res.due = dm
    remove(m)
  } else if (
    // the 30th · on the 30th · by the 5th · 30th (at the end)
    ((m = s.match(/\s(?:on\s+|by\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i)) ||
      (m = s.match(/\s(?:on\s+|by\s+)?(\d{1,2})(?:st|nd|rd|th)\s*$/i))) &&
    (dm = nextDayOfMonth(+m[1]))
  ) {
    res.due = dm
    remove(m)
  } else if (
    // "on friday …" anywhere; a bare weekday only at the end, so a stray
    // "sat"/"wed" mid-sentence isn't mistaken for one
    (m = s.match(new RegExp(`\\s(next\\s+|this\\s+|on\\s+|by\\s+)${WEEKDAY_RE}\\b`, 'i'))) ||
    (m = s.match(new RegExp(`\\s()${WEEKDAY_RE}\\s*$`, 'i')))
  ) {
    res.due = upcomingWeekday(DOW[m[2].toLowerCase().slice(0, 3)], /next/i.test(m[1] || ''))
    remove(m)
  }

  const title = s.replace(/\s+/g, ' ').trim()
  // if the tokens ate the whole title, treat the text as literal instead
  if (!title) return { title: original }
  res.title = title
  return res
}
