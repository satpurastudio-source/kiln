import { useEffect, useState } from 'react'
import Tip, { tipSeen } from './Tip'
import { t, tn } from '../i18n'

// Phone-only hints for the touch gestures, one at a time: drawer swipe first,
// then pull-to-search once that's learned. Each retires itself the moment
// the gesture is used (see useEdgeSwipe / usePullToSearch) or on ×.
const PHONE = '(max-width: 860px) and (pointer: coarse)'

export default function GestureTips() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches)
  const [, rerender] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia(PHONE)
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    // advance to the next tip when one is retired
    const seen = () => rerender((n) => n + 1)
    window.addEventListener('kiln-tip-seen', seen)
    return () => {
      mq.removeEventListener('change', on)
      window.removeEventListener('kiln-tip-seen', seen)
    }
  }, [])

  if (!phone) return null
  if (!tipSeen('swipe-nav'))
    return (
      <Tip key="swipe-nav" id="swipe-nav">
        {t('tipSwipe')}
      </Tip>
    )
  if (!tipSeen('pull-search'))
    return (
      <Tip key="pull-search" id="pull-search">
        {t('tipPull')}
      </Tip>
    )
  return null
}
