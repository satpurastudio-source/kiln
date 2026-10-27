import { registerSW } from 'virtual:pwa-register'
import { toast } from './store'
import { isNative } from './native'
import { t } from './i18n'

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

// Signed-out screens (sign-in, sign-up code, email verified) have no work to
// lose, and an old build there can break sign-up — so they always take the
// new version. Signed in, a late update still asks first.
const signedOut = () => {
  try {
    return !Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  } catch {
    return false
  }
}

export function initPWA() {
  // the app shell ships its web files inside the app — updates come via the stores
  if (isNative || !('serviceWorker' in navigator)) return

  let asked = false
  const updateSW = registerSW({
    onNeedRefresh() {
      const hidden = document.visibilityState === 'hidden'
      const justOpened = Date.now() - resumedAt < FRESH_WINDOW
      if (hidden || ((justOpened || signedOut()) && !typing())) return updateSW(true)
      if (asked) return
      asked = true
      toast(t('newVersion'), '✦', { label: t('update'), fn: () => updateSW(true) }, { sticky: true })
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

/* ------------------------------ install prompt ------------------------------ */
// Chrome/Android fire `beforeinstallprompt` once, early, so it's caught at
// startup and held until the UI asks for it. iOS has no such event — there
// the UI shows Share → Add to Home Screen instructions instead.

let deferredPrompt = null
const installListeners = new Set()
const notifyInstall = () => installListeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own button instead of the mini-infobar
    deferredPrompt = e
    notifyInstall()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyInstall()
  })
}

export const isStandalone = () =>
  navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches

export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS reports as Mac

export const canPromptInstall = () => !!deferredPrompt

export function onInstallChange(fn) {
  installListeners.add(fn)
  return () => installListeners.delete(fn)
}

// Shows the browser's install dialog. Resolves true if the user accepted.
export async function promptInstall() {
  if (!deferredPrompt) return false
  const e = deferredPrompt
  deferredPrompt = null // a prompt event can only be used once
  e.prompt()
  const { outcome } = await e.userChoice
  notifyInstall()
  return outcome === 'accepted'
}
