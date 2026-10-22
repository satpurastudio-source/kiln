import { useEffect, useRef, useState } from 'react'
import { APP_NAME, APP_LABEL } from '../brand'

const SEEN_KEY = 'kiln-booted-once'

// Typewriter boot screen: types the app name, holds, then fades out while the
// app's entrance animations play underneath. It only runs the FIRST time the
// app is ever opened on this device — after that we boot straight in.
export default function Loader({ onReveal }) {
  const seen = useRef(
    typeof localStorage !== 'undefined' && localStorage.getItem(SEEN_KEY) === '1'
  )
  const [chars, setChars] = useState(0)
  const [phase, setPhase] = useState(seen.current ? 'gone' : 'typing')
  const total = APP_NAME.length + 1 // +1 types the terracotta dot

  // returning visitor: reveal the app immediately, render nothing
  useEffect(() => {
    if (seen.current) onReveal()
  }, [onReveal])

  useEffect(() => {
    if (phase !== 'typing') return
    if (chars >= total) {
      const t = setTimeout(() => setPhase('fading'), 650)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setChars((c) => c + 1), chars === 0 ? 380 : 105)
    return () => clearTimeout(t)
  }, [chars, phase, total])

  useEffect(() => {
    if (phase !== 'fading') return
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* private mode: fine to type it again next time */
    }
    onReveal()
    const t = setTimeout(() => setPhase('gone'), 600)
    return () => clearTimeout(t)
  }, [phase, onReveal])

  if (phase === 'gone') return null

  return (
    <div className={`loader ${phase === 'fading' ? 'hidden' : ''}`} aria-hidden="true">
      <div className="type-label">{APP_LABEL}</div>
      <div className="type-line">
        {APP_NAME.slice(0, Math.min(chars, APP_NAME.length))}
        {chars > APP_NAME.length && <span className="type-dot">.</span>}
        <span className={`type-cursor ${phase === 'fading' ? 'stop' : ''}`} />
      </div>
    </div>
  )
}
