// Opt-in local notifications: "N tasks due today", once per day, while the
// app is open. Real background push arrives with the desktop/mobile wrap.
const PREF_KEY = 'kiln-reminders'
const DAY_KEY = 'kiln-reminded-on'

export const remindersEnabled = () =>
  localStorage.getItem(PREF_KEY) === '1' &&
  'Notification' in window &&
  Notification.permission === 'granted'

export const remindersOptedIn = () => localStorage.getItem(PREF_KEY) === '1'

export async function enableReminders() {
  if (!('Notification' in window)) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  localStorage.setItem(PREF_KEY, '1')
  return true
}

export function disableReminders() {
  localStorage.setItem(PREF_KEY, '0')
}

export function maybeNotifyDueToday(count) {
  if (!remindersEnabled() || count === 0) return
  const today = new Date().toDateString()
  if (localStorage.getItem(DAY_KEY) === today) return
  localStorage.setItem(DAY_KEY, today)
  try {
    new Notification('kiln', {
      body: `${count} task${count === 1 ? '' : 's'} due today — go shape something.`,
    })
  } catch {
    /* some platforms require a service worker; fine to skip */
  }
}
