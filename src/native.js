import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

// True inside the iOS / Android app shell, false on the web and the PWA.
export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'

// A light tap of feedback in the app shell; the web build stays silent.
export function tick(style = ImpactStyle.Light) {
  if (isNative) Haptics.impact({ style }).catch(() => {})
}
