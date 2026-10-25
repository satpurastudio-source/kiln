import { useState } from 'react'
import { supabase } from '../supabase'
import { toast } from '../store'
import { linkBase } from '../native'
import { MailIcon, LockIcon } from './Icons'

// Settings → You: change the sign-in email or password (signed-in accounts).
// Email changes are confirmed from the inbox before they take effect.
export default function Account({ email }) {
  const [open, setOpen] = useState(null) // 'email' | 'password' | null
  const [value, setValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (which) => {
    setOpen(open === which ? null : which)
    setValue('')
    setConfirm('')
    setError('')
  }

  const save = async (e) => {
    e.preventDefault()
    setError('')
    if (open === 'email') {
      const next = value.trim().toLowerCase()
      if (!/^\S+@\S+\.\S+$/.test(next)) return setError('That doesn’t look like an email address.')
      if (next === email?.toLowerCase()) return setError('That’s already your email.')
      setBusy(true)
      const { error: err } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: `${linkBase()}?verified=1` }
      )
      setBusy(false)
      if (err) return setError(err.message)
      toast('Check your inbox to confirm the new email', '✉')
    } else {
      if (value.length < 6) return setError('Password needs at least 6 characters.')
      if (value !== confirm) return setError('The two passwords don’t match.')
      setBusy(true)
      const { error: err } = await supabase.auth.updateUser({ password: value })
      setBusy(false)
      if (err) {
        // projects with "secure password change" want a recent sign-in first
        return setError(
          /reauth|recent/i.test(err.message)
            ? 'For safety, sign out and back in, then change your password.'
            : err.message
        )
      }
      toast('Password changed', '✓')
    }
    toggle(null)
  }

  return (
    <div className="account">
      <button className="set-action" onClick={() => toggle('email')} aria-expanded={open === 'email'}>
        <MailIcon size={14} /> Change email
      </button>
      {open === 'email' && (
        <form className="account-form" onSubmit={save}>
          <input
            className="set-input"
            type="email"
            autoComplete="email"
            placeholder="New email"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="set-hint">We’ll send a confirmation link. Your email changes once you tap it.</p>
          {error && <p className="set-error">{error}</p>}
          <div className="danger-confirm-row">
            <button type="button" className="mini-btn" onClick={() => toggle(null)}>
              Cancel
            </button>
            <button type="submit" className="mini-btn primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send link'}
            </button>
          </div>
        </form>
      )}

      <button className="set-action" onClick={() => toggle('password')} aria-expanded={open === 'password'}>
        <LockIcon size={14} /> Change password
      </button>
      {open === 'password' && (
        <form className="account-form" onSubmit={save}>
          <input
            className="set-input"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
          <input
            className="set-input"
            type="password"
            autoComplete="new-password"
            placeholder="Type it again"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="set-error">{error}</p>}
          <div className="danger-confirm-row">
            <button type="button" className="mini-btn" onClick={() => toggle(null)}>
              Cancel
            </button>
            <button type="submit" className="mini-btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
