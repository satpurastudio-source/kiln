import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative, platform } from './native'
import { parseDateStr, addDaysStr } from './utils'
import { t, tn } from './i18n'

// Opt-in reminders.
//   • Web / PWA: "N tasks due today", once per day, while the app is open.
//   • iOS / Android app: real OS notifications that fire even when kiln is
//     closed — one at each timed task's due time, plus a morning digest of
//     what's due that day. The schedule is rebuilt whenever tasks change.
const PREF_KEY = 'kiln-reminders'
const DAY_KEY = 'kiln-reminded-on'

const read = (k) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

export const remindersEnabled = () =>
  read(PREF_KEY) === '1' &&
  'Notification' in window &&
  Notification.permission === 'granted'

export const remindersOptedIn = () => read(PREF_KEY) === '1'

export async function enableReminders() {
  if (isNative) {
    const { display } = await LocalNotifications.requestPermissions()
    if (display !== 'granted') return false
    localStorage.setItem(PREF_KEY, '1')
    scheduleNative(lastTasks)
    return true
  }
  if (!('Notification' in window)) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  localStorage.setItem(PREF_KEY, '1')
  return true
}

// First launch in the app shell: ask for notifications straight away and
// switch reminders on if allowed. Asked once; a no can be undone in Settings.
export async function askOnFirstLaunch() {
  if (!isNative || read(PREF_KEY) !== null) return
  const ok = await enableReminders().catch(() => false)
  if (!ok) localStorage.setItem(PREF_KEY, '0')
}

export function disableReminders() {
  localStorage.setItem(PREF_KEY, '0')
  if (isNative) scheduleNative(lastTasks)
}

export function maybeNotifyDueToday(count) {
  // the app shell gets a scheduled morning digest instead (see scheduleNative)
  if (isNative) return
  if (!remindersEnabled() || count === 0) return
  const today = new Date().toDateString()
  if (localStorage.getItem(DAY_KEY) === today) return
  localStorage.setItem(DAY_KEY, today)
  const body = `${count} task${count === 1 ? '' : 's'} due today — go shape something.`
  const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'kiln-due-today' }
  // Android Chrome (and installed apps generally) only allow notifications
  // through the service worker; `new Notification` throws there.
  const viaSW = () =>
    navigator.serviceWorker?.getRegistration().then((reg) => {
      if (!reg) throw new Error('no service worker')
      return reg.showNotification('kiln', opts)
    })
  Promise.resolve()
    .then(viaSW)
    .catch(() => {
      try {
        new Notification('kiln', opts)
      } catch {
        localStorage.removeItem(DAY_KEY) // didn't show — allow another try
      }
    })
}

// Settings → "Send a test": one notification a few seconds out, so you can
// lock the phone and see that kiln's alerts get through.
export async function sendTestReminder() {
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return false
  const exact = await exactAllowed()
  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID,
        title: 'kiln',
        body: t('testReminderBody'),
        schedule: { at: new Date(Date.now() + 5000) },
        isExactNotification: exact,
      },
    ],
  })
  return true
}

// ── native scheduling ────────────────────────────────────────────────────

// Android 12+ keeps exact alarms behind a separate "Alarms & reminders" switch,
// and asking for an exact one makes the plugin open that settings screen on
// every schedule() — which kiln calls after each task edit. So ask only for
// what's already allowed: without it Android may deliver a reminder a few
// minutes late, but never throws anyone into Settings.
async function exactAllowed() {
  if (platform !== 'android') return true
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'
  } catch {
    return false
  }
}

const DIGEST_HOUR = 9
const DIGEST_DAYS = 7
const DIGEST_ID = 1000 // ids 1000–1006 are the morning digests
const TEST_ID = 999
const MAX_TASK_ALERTS = 50 // iOS keeps at most 64 pending per app

let lastTasks = []
let timer = null
let running = Promise.resolve()

// notification ids must be positive 32-bit ints; keep clear of the digest range
const idFor = (taskId) => {
  let h = 0
  for (const c of String(taskId)) h = (h * 31 + c.charCodeAt(0)) | 0
  return 10000 + (Math.abs(h) % 2_000_000_000)
}

const atTime = (due, time) => {
  const d = parseDateStr(due)
  const [hh, mm] = (time || '').split(':').map(Number)
  d.setHours(hh || 0, mm || 0, 0, 0)
  return d
}

function plan(tasks, exact) {
  const now = Date.now()
  const open = tasks.filter((t) => !t.done && !t.archived && t.due)
  const out = []

  const timed = open
    .filter((t) => t.time)
    .map((task) => ({ task, at: atTime(task.due, task.time) }))
    .filter(({ at }) => at.getTime() > now)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_TASK_ALERTS)
  for (const { task, at } of timed) {
    out.push({
      id: idFor(task.id),
      title: task.title,
      body: t('dueNow'),
      schedule: { at, allowWhileIdle: true },
      isExactNotification: exact,
    })
  }

  for (let i = 0; i < DIGEST_DAYS; i++) {
    const day = addDaysStr(i)
    const at = atTime(day, `${DIGEST_HOUR}:00`)
    if (at.getTime() <= now) continue
    // overdue work rolls into today's count, as it does on the Today view
    const n = open.filter((t) => t.due === day || (i === 0 && t.due < day)).length
    if (!n) continue
    out.push({
      id: DIGEST_ID + i,
      title: 'kiln',
      body: tn('digestBody', n),
      schedule: { at, allowWhileIdle: true },
      isExactNotification: exact,
    })
  }
  return out
}

async function reschedule(tasks) {
  // leave a test notification in flight alone
  const pending = (await LocalNotifications.getPending()).notifications.filter((n) => n.id !== TEST_ID)
  if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) })
  if (!remindersOptedIn()) return
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return
  const notifications = plan(tasks, await exactAllowed())
  if (notifications.length) await LocalNotifications.schedule({ notifications })
}

// Called on every task change; rebuilds the OS schedule shortly after the
// last edit. Runs are chained so two rebuilds never interleave.
export function scheduleNative(tasks) {
  if (!isNative) return
  lastTasks = tasks
  clearTimeout(timer)
  timer = setTimeout(() => {
    running = running
      .then(() => reschedule(lastTasks))
      .catch((e) => console.warn('[kiln] reminders:', e?.message ?? e))
  }, 1000)
}
