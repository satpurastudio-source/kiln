import { registerSW } from 'virtual:pwa-register'
import { toast } from './store'

// When a new deploy lands, the service worker downloads it in the background.
// If the app was just opened/resumed (or is in the background) we swap it in
// silently; if you're mid-use we ask instead of reloading under your fingers.

const CHECK_EVERY = 30 * 60 * 1000
const FRESH_WINDOW = 6000

let resumedAt = Date.now()

// Autofocused-but-empty fields (onboarding, quick add) don't count — only
// a field with something in it would lose work on reload.
const typing = () => {
  const el = document.activeElement
  if (!el) return false
  if (el.isContentEditable) return el.textContent.trim() !== ''
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value.trim() !== ''
  return false
}

export function initPWA() {
  if (!('serviceWorker' in navigator)) return

  let asked = false
  const updateSW = registerSW({
    onNeedRefresh() {
      const hidden = document.visibilityState === 'hidden'
      const justOpened = Date.now() - resumedAt < FRESH_WINDOW
      if (hidden || (justOpened && !typing())) return updateSW(true)
      if (asked) return
      asked = true
      toast('A new version of kiln is ready', '✦', { label: 'Update', fn: () => updateSW(true) }, { sticky: true })
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => {
        if (reg.installing || !navigator.onLine) return
        reg.update().catch(() => {})
      }
      // Home-screen apps resume instead of reloading, so check on every resume.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        resumedAt = Date.now()
        check()
      })
      setInterval(check, CHECK_EVERY)
    },
  })
}
