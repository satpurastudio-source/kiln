// Opt-in local notifications: "N tasks due today", once per day, while the
// app is open. Real background push arrives with the desktop/mobile wrap.
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
