import { Capacitor } from '@capacitor/core'

// Imperative gate for heavy visual flourishes (confetti, particle bursts).
// Read at event time so no React re-render is needed. Kept in sync with the
// reducedEffects setting by a store effect.
let lite = false

// Coarse pointers (phones/tablets) are where the completion animation was
// stuttering — skip the most expensive flourishes there by default.
export const COARSE =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(pointer: coarse)').matches

// Weak hardware, detected once at boot: little RAM, few cores, or Data Saver.
// deviceMemory is Chromium-only (rounded GB), so iPhones never land here by
// accident. These devices get the full look with the motion held still — see
// .fx-low in index.css — instead of the stripped-down reduced-effects mode.
const nav = typeof navigator !== 'undefined' ? navigator : {}
export const LOW_END =
  nav.deviceMemory <= 2 ||
  (nav.deviceMemory <= 4 && nav.hardwareConcurrency <= 4) ||
  !!nav.connection?.saveData

const root = typeof document !== 'undefined' ? document.documentElement : null
if (LOW_END) root?.classList.add('fx-low')

// ── light mode: full effects only where the phone can carry them ──────────
//
// Mid-range Android phones (a Samsung A-series, say) stutter under the
// motion and compositing an iPhone or a flagship shrugs off. So the Android
// app starts light unless the hardware looks flagship-class, and on any
// phone a watchdog over the first seconds of use switches to light if frames
// actually drop. The verdict is remembered per device. Light keeps the look
// and drops the costly parts: .fx-light in index.css, fades-only motion in
// <Motion> (main.jsx), no layout animation on task rows.

export const ANDROID_APP = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
const FLAGSHIP = nav.deviceMemory >= 8 && nav.hardwareConcurrency >= 8 // Chromium caps deviceMemory at 8
const TIER_KEY = 'kiln-fx-tier'

let saved = null
try {
  saved = localStorage.getItem(TIER_KEY)
} catch {
  /* storage blocked — decide from the hardware alone */
}

let light = saved ? saved === 'light' : LOW_END || (ANDROID_APP && !FLAGSHIP)
const listeners = new Set()

function apply() {
  root?.classList.toggle('fx-light', light)
  listeners.forEach((fn) => fn())
}
apply()

export const isLight = () => light
export function onLightChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function settle(next) {
  try {
    localStorage.setItem(TIER_KEY, next ? 'light' : 'full')
  } catch {
    /* not remembered; the watchdog runs again next launch */
  }
  if (next !== light) {
    light = next
    apply()
  }
}

// Watch real frames while the app boots and gets its first taps. Six or more
// frames over 50ms (a visible hitch each) in those seconds means this phone
// can't carry the full effects.
function watchdog() {
  if (light || saved || !COARSE || typeof requestAnimationFrame === 'undefined') return
  const GRACE = 1500 // first paint and font loading always hitch
  const WINDOW = 20000
  let start = 0
  let last = 0
  let slow = 0
  const frame = (now) => {
    if (document.hidden) return void (last = 0, requestAnimationFrame(frame))
    if (!start) start = now
    if (last && now - start > GRACE && now - last > 50) slow++
    last = now
    if (slow >= 6) return settle(true)
    if (now - start < WINDOW) requestAnimationFrame(frame)
    else settle(false)
  }
  requestAnimationFrame(frame)
}
watchdog()

export function setFxLite(v) {
  lite = !!v
}

// True when we should skip confetti / bursts entirely.
export const heavyFxOff = () => lite || COARSE || LOW_END || light
