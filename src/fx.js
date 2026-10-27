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

if (LOW_END && typeof document !== 'undefined') document.documentElement.classList.add('fx-low')

export function setFxLite(v) {
  lite = !!v
}

// True when we should skip confetti / bursts entirely.
export const heavyFxOff = () => lite || COARSE || LOW_END
