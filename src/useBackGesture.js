import { useEffect, useRef } from 'react'
import { App as CapApp } from '@capacitor/app'
import { isNative, platform } from './native'

// Android's system "back" (the edge swipe in gesture navigation, or the back
// button) used to close kiln outright — the app has no history of its own, so
// back left it. Now back works like it does in native Android apps:
//   1. closes whatever is on top (palette, modal, settings, the drawer…)
//   2. on the main screen, opens the drawer — the swipe you were reaching for
//   3. with the drawer already open, leaves the app
//
// `onBack()` returns true when it handled the press, false to let kiln exit.
//
// In the Android app shell this listens to Capacitor's backButton event. On
// the web/PWA we park a guard entry on the history stack so back lands on
// it instead of leaving, and re-arm the guard after each handled press.
// iOS has no system back, so nothing is hooked there.

const GUARD = { kilnBack: true }

export default function useBackGesture(onBack, enabled) {
  const ref = useRef(onBack)
  ref.current = onBack

  useEffect(() => {
    if (!enabled || platform === 'ios') return

    if (isNative) {
      const sub = CapApp.addListener('backButton', () => {
        if (!ref.current()) CapApp.minimizeApp()
      })
      return () => {
        sub.then((s) => s.remove())
      }
    }

    // only phones/tablets have a system back that closes the app
    if (!window.matchMedia('(pointer: coarse)').matches) return
    if (!history.state?.kilnBack) history.pushState(GUARD, '')
    const onPop = () => {
      // handled → re-arm; otherwise stay disarmed so the next back exits
      if (ref.current()) history.pushState(GUARD, '')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [enabled])
}
