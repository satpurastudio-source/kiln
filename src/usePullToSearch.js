import { useEffect } from 'react'
import { markTipSeen } from './components/Tip'

// Mobile: pull down on the header (title area) to open the command palette —
// search + jump-anywhere, the touch stand-in for Ctrl+K. The header stretches
// with the finger (damped) and springs back; past the threshold it opens.

const LOCK = 10
const PULL = 64 // px of finger travel to trigger
const DAMP = 0.4
const MAX_STRETCH = 44
const FLICK = 0.5 // px/ms
const COVERED = '.overlay, .palette-wrap, .focus-overlay, .minical-backdrop, .sidebar.mobile-open'

export default function usePullToSearch({ onPull, enabled }) {
  useEffect(() => {
    if (!enabled) return
    const mq = window.matchMedia('(max-width: 860px)')
    let g = null

    const header = () => document.querySelector('.header')

    const onStart = (e) => {
      if (!mq.matches || e.touches.length !== 1) return
      if (document.querySelector(COVERED)) return
      const h = header()
      // the search field and palette button keep their normal taps
      if (!h || !h.contains(e.target) || e.target.closest('input, button')) return
      const t = e.touches[0]
      g = { y0: t.clientY, x0: t.clientX, t0: e.timeStamp, dy: 0, locked: null }
    }

    const onMove = (e) => {
      if (!g) return
      const t = e.touches[0]
      const dy = t.clientY - g.y0
      const dx = t.clientX - g.x0
      if (g.locked === null) {
        if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return
        g.locked = dy > 0 && dy > Math.abs(dx) * 1.2
        if (!g.locked) {
          g = null
          return
        }
        header().style.transition = 'none'
      }
      e.preventDefault()
      g.dy = Math.max(0, dy)
      g.tLast = e.timeStamp
      header().style.transform = `translateY(${Math.min(MAX_STRETCH, g.dy * DAMP)}px)`
    }

    const onEnd = (e) => {
      if (!g) return
      const done = g
      g = null
      if (!done.locked) return
      const h = header()
      if (h) {
        h.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
        h.style.transform = ''
        h.addEventListener('transitionend', () => (h.style.transition = ''), { once: true })
      }
      const speed = done.dy / Math.max(1, (done.tLast ?? e.timeStamp) - done.t0)
      if (done.dy > PULL || (done.dy > LOCK * 2 && speed > FLICK)) {
        navigator.vibrate?.(8)
        markTipSeen('pull-search')
        onPull()
      }
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
      const h = header()
      if (h) h.style.transform = h.style.transition = ''
    }
  }, [enabled, onPull])
}
