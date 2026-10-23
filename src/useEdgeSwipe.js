import { useEffect, useRef } from 'react'

// Mobile drawer gestures: swipe right from the left edge to open the sidebar,
// swipe left to close it. The drawer tracks the finger, then snaps open/shut
// by distance or flick speed; the CSS transition handles the snap.
//
// Edge zone is wider than the usual 20px because Android's gesture-nav "back"
// swallows touches that start right at the bezel.

const EDGE = 40
const LOCK = 10 // px of movement before we decide horizontal vs vertical
const FLICK = 0.45 // px/ms
// anything covering the app (modals, palette, focus timer) owns the screen
const COVERED = '.overlay, .palette-wrap, .focus-overlay, .minical-backdrop'

export default function useEdgeSwipe({ open, setOpen, enabled }) {
  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    if (!enabled) return
    const mq = window.matchMedia('(max-width: 860px)')
    let g = null // active gesture

    const sidebar = () => document.querySelector('.sidebar')
    const backdrop = () => document.querySelector('.mobile-backdrop')

    const reset = () => {
      const s = sidebar()
      if (s) {
        s.style.transition = ''
        s.style.transform = ''
      }
      const b = backdrop()
      if (b) b.style.opacity = ''
    }

    const onStart = (e) => {
      if (!mq.matches || e.touches.length !== 1) return
      if (document.querySelector(COVERED)) return
      const t = e.touches[0]
      const isOpen = openRef.current
      if (!isOpen && t.clientX > EDGE) return
      const s = sidebar()
      if (!s) return
      g = { x0: t.clientX, y0: t.clientY, t0: e.timeStamp, isOpen, width: s.offsetWidth, locked: null, dx: 0 }
    }

    const onMove = (e) => {
      if (!g) return
      const t = e.touches[0]
      const dx = t.clientX - g.x0
      const dy = t.clientY - g.y0
      if (g.locked === null) {
        if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return
        // must be mostly horizontal and in the useful direction
        const horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
        const rightWay = g.isOpen ? dx < 0 : dx > 0
        g.locked = horizontal && rightWay
        if (!g.locked) {
          g = null
          return
        }
        sidebar().style.transition = 'none'
      }
      e.preventDefault() // stop the page scrolling under the drag
      g.dx = dx
      g.tLast = e.timeStamp
      const offset = g.isOpen
        ? Math.min(0, dx) // open: drag back toward -width
        : Math.min(0, dx - g.width) // closed: pull out from -width
      sidebar().style.transform = `translateX(${offset}px)`
      const b = backdrop()
      if (b) b.style.opacity = String(1 + offset / g.width)
    }

    const onEnd = (e) => {
      if (!g) return
      const done = g
      g = null
      if (!done.locked) return
      const dist = Math.abs(done.dx)
      const speed = dist / Math.max(1, (done.tLast ?? e.timeStamp) - done.t0)
      const commit = dist > done.width * 0.35 || speed > FLICK
      // let the CSS transition run from where the finger left it
      reset()
      if (commit) setOpen(!done.isOpen)
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
      reset()
    }
  }, [enabled, setOpen])
}
