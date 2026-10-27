import Sheet from './Sheet'
import { CHANGELOG, LATEST } from '../changelog'
import { GiftIcon } from './Icons'
import { t, fmtDate } from '../i18n'

const KEY = 'kiln-whatsnew-seen'

const seen = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return LATEST // storage blocked: never nag
  }
}

export const markWhatsNewSeen = () => {
  try {
    localStorage.setItem(KEY, LATEST)
  } catch {
    /* ignore */
  }
}

// Show the latest notes once, to people who were here before them. Someone
// opening kiln for the first time has nothing to compare against, so they're
// quietly marked as up to date instead.
export function shouldShowWhatsNew(tasks) {
  const s = seen()
  if (s === LATEST) return false
  const returning = s !== null || tasks.some((t) => t.createdAt && Date.now() - t.createdAt > 864e5)
  if (!returning) markWhatsNewSeen()
  return returning
}

export default function WhatsNew({ onClose }) {
  const close = () => {
    markWhatsNewSeen()
    onClose()
  }
  return (
    <Sheet title={t('whatsNew')} onClose={close}>
      {CHANGELOG.map((r) => {
        const key = `cl_${r.id.replaceAll('-', '')}`
        const [y, m, d] = r.id.split('-').map(Number)
        return (
          <section className="set-section" key={r.id}>
            <div className="set-head">
              <GiftIcon size={13} /> {fmtDate(new Date(y, m - 1, d), { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <h3 className="wn-title">{t(`${key}_title`)}</h3>
            <ul className="wn-list">
              {Array.from({ length: r.items }, (_, i) => (
                <li key={i}>{t(`${key}_${i}`)}</li>
              ))}
            </ul>
          </section>
        )
      })}
    </Sheet>
  )
}
