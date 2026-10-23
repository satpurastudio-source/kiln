// Real screen height → --app-h, used instead of CSS 100% / 100vh.
//
// iPhone home-screen apps (viewport-fit=cover + translucent status bar) get a
// CSS viewport that stops short of the bottom edge, leaving a strip the app
// doesn't paint. There we size to the physical screen; everywhere else
// window.innerHeight is already the true visible height.

const IPHONE = /iPhone|iPod/.test(navigator.userAgent)
const standalone = () =>
  navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches

function measure() {
  let h = window.innerHeight
  if (IPHONE && standalone()) {
    // iOS reports screen size in portrait regardless of rotation
    const portrait = window.matchMedia('(orientation: portrait)').matches
    const full = portrait
      ? Math.max(screen.width, screen.height)
      : Math.min(screen.width, screen.height)
    h = Math.max(h, full)
  }
  document.documentElement.style.setProperty('--app-h', `${h}px`)
}

export function initViewport() {
  measure()
  window.addEventListener('resize', measure)
  // iOS fires resize before the rotation has settled
  window.addEventListener('orientationchange', () => setTimeout(measure, 250))
}
