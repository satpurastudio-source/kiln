import { useState } from 'react'
import Sheet from './Sheet'
import { toast } from '../store'
import { MailIcon } from './Icons'
import { platform } from '../native'
import { t } from '../i18n'

// Static app, no backend for this: feedback opens the person's own mail app
// with everything filled in, and the address is shown to copy as a fallback.
export const FEEDBACK_EMAIL = 'satpurastudio@gmail.com'

const KINDS = [
  // `en` labels the email subject, so the inbox reads the same whatever the language
  { id: 'bug', en: 'Something’s broken', key: 'fbBug' },
  { id: 'idea', en: 'An idea', key: 'fbIdea' },
  { id: 'other', en: 'Something else', key: 'fbOther' },
]

const deviceInfo = () =>
  [
    `kiln ${__APP_VERSION__} (${platform})`,
    navigator.userAgent,
    `screen ${window.screen.width}×${window.screen.height}, window ${window.innerWidth}×${window.innerHeight}`,
  ].join('\n')

export default function Feedback({ onClose }) {
  const [kind, setKind] = useState('bug')
  const [text, setText] = useState('')
  const [withDevice, setWithDevice] = useState(true)

  const send = () => {
    const label = KINDS.find((k) => k.id === kind).en
    const subject = `[kiln] ${label}`
    const body = `${text.trim()}\n\n${withDevice ? `---\n${deviceInfo()}\n` : ''}`
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    toast(t('openingMail'), '✉')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL)
      toast(t('emailCopied'), '✓')
    } catch {
      toast(FEEDBACK_EMAIL, '✉')
    }
  }

  return (
    <Sheet
      title={t('sendFeedbackTitle')}
      onClose={onClose}
      actions={
        <button className="btn primary btn-icon" onClick={send} disabled={!text.trim()}>
          <MailIcon size={14} /> {t('send')}
        </button>
      }
    >
      <section className="set-section">
        <label className="set-label">{t('fbWhatAbout')}</label>
        <div className="seg seg-wrap">
          {KINDS.map((k) => (
            <button key={k.id} className={`seg-btn ${kind === k.id ? 'on' : ''}`} onClick={() => setKind(k.id)}>
              {t(k.key)}
            </button>
          ))}
        </div>
        <label className="set-label" style={{ marginTop: 14 }}>
          {kind === 'bug' ? t('fbWhatHappened') : t('fbTellUs')}
        </label>
        <textarea
          className="set-input set-textarea"
          rows={5}
          value={text}
          maxLength={4000}
          autoFocus
          placeholder={kind === 'bug' ? t('fbBugPh') : t('fbIdeaPh')}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="set-row">
          <span>
            {t('fbDevice')}
            <span className="set-sub">{t('fbDeviceSub')}</span>
          </span>
          <button
            className={`switch ${withDevice ? 'on' : ''}`}
            role="switch"
            aria-checked={withDevice}
            onClick={() => setWithDevice(!withDevice)}
          >
            <span className="switch-knob" />
          </button>
        </div>
        <p className="set-hint">
          {t('fbOpensMail')}{' '}
          <button className="link-btn" onClick={copy}>
            {FEEDBACK_EMAIL}
          </button>
          .
        </p>
      </section>
    </Sheet>
  )
}
