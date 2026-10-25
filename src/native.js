import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

// True inside the iOS / Android app shell, false on the web and the PWA.
export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'

// where links in kiln's emails (verify, reset, email change) land: the app
// shell has no URL of its own, so it points at the web build
export const WEB_URL = 'https://kiln.satpurastudio.com/'
export const linkBase = () => (isNative ? WEB_URL : `${window.location.origin}${window.location.pathname}`)

// A light tap of feedback in the app shell; the web build stays silent.
export function tick(style = ImpactStyle.Light) {
  if (isNative) Haptics.impact({ style }).catch(() => {})
}
