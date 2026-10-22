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

export function setFxLite(v) {
  lite = !!v
}

// True when we should skip confetti / bursts entirely.
export const heavyFxOff = () => lite || COARSE
