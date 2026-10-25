import { useState } from 'react'
import Sheet from './Sheet'
import { toast } from '../store'
import { MailIcon } from './Icons'
import { platform } from '../native'

// Static app, no backend for this: feedback opens the person's own mail app
// with everything filled in, and the address is shown to copy as a fallback.
export const FEEDBACK_EMAIL = 'satpurastudio@gmail.com'

const KINDS = [
  { id: 'bug', label: 'Something’s broken' },
  { id: 'idea', label: 'An idea' },
  { id: 'other', label: 'Something else' },
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
    const label = KINDS.find((k) => k.id === kind).label
    const subject = `[kiln] ${label}`
    const body = `${text.trim()}\n\n${withDevice ? `---\n${deviceInfo()}\n` : ''}`
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    toast('Opening your mail app…', '✉')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL)
      toast('Email address copied', '✓')
    } catch {
      toast(FEEDBACK_EMAIL, '✉')
    }
  }

  return (
    <Sheet
      title="Send feedback"
      onClose={onClose}
      actions={
        <button className="btn primary btn-icon" onClick={send} disabled={!text.trim()}>
          <MailIcon size={14} /> Send
        </button>
      }
    >
      <section className="set-section">
        <label className="set-label">What’s it about?</label>
        <div className="seg seg-wrap">
          {KINDS.map((k) => (
            <button key={k.id} className={`seg-btn ${kind === k.id ? 'on' : ''}`} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <label className="set-label" style={{ marginTop: 14 }}>
          {kind === 'bug' ? 'What happened, and what did you expect?' : 'Tell us'}
        </label>
        <textarea
          className="set-input set-textarea"
          rows={5}
          value={text}
          maxLength={4000}
          autoFocus
          placeholder={kind === 'bug' ? 'I tapped… and then…' : 'It would be great if…'}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="set-row">
          <span>
            Include device details
            <span className="set-sub">App version, browser and screen size. Helps us find bugs faster.</span>
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
          Opens your mail app. No mail app? Write to{' '}
          <button className="link-btn" onClick={copy}>
            {FEEDBACK_EMAIL}
          </button>
          .
        </p>
      </section>
    </Sheet>
  )
}
