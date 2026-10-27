import { useState } from 'react'
import { supabase } from '../supabase'
import { toast } from '../store'
import { linkBase } from '../native'
import { MailIcon, LockIcon } from './Icons'
import { t } from '../i18n'

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
      if (!/^\S+@\S+\.\S+$/.test(next)) return setError(t('errEmailInvalid'))
      if (next === email?.toLowerCase()) return setError(t('errSameEmail'))
      setBusy(true)
      const { error: err } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: `${linkBase()}?verified=1` }
      )
      setBusy(false)
      if (err) return setError(err.message)
      toast(t('checkInboxNewEmail'), '✉')
    } else {
      if (value.length < 6) return setError(t('errPwShort'))
      if (value !== confirm) return setError(t('errPwMismatch'))
      setBusy(true)
      const { error: err } = await supabase.auth.updateUser({ password: value })
      setBusy(false)
      if (err) {
        // projects with "secure password change" want a recent sign-in first
        return setError(
          /reauth|recent/i.test(err.message)
            ? t('errReauth')
            : err.message
        )
      }
      toast(t('passwordChanged'), '✓')
    }
    toggle(null)
  }

  return (
    <div className="account">
      <button className="set-action" onClick={() => toggle('email')} aria-expanded={open === 'email'}>
        <MailIcon size={14} /> {t('changeEmail')}
      </button>
      {open === 'email' && (
        <form className="account-form" onSubmit={save}>
          <input
            className="set-input"
            type="email"
            autoComplete="email"
            placeholder={t('newEmail')}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="set-hint">{t('newEmailHint')}</p>
          {error && <p className="set-error">{error}</p>}
          <div className="danger-confirm-row">
            <button type="button" className="mini-btn" onClick={() => toggle(null)}>
              {t('cancel')}
            </button>
            <button type="submit" className="mini-btn primary" disabled={busy}>
              {busy ? t('sending') : t('sendLink')}
            </button>
          </div>
        </form>
      )}

      <button className="set-action" onClick={() => toggle('password')} aria-expanded={open === 'password'}>
        <LockIcon size={14} /> {t('changePassword')}
      </button>
      {open === 'password' && (
        <form className="account-form" onSubmit={save}>
          <input
            className="set-input"
            type="password"
            autoComplete="new-password"
            placeholder={t('newPassword')}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
          <input
            className="set-input"
            type="password"
            autoComplete="new-password"
            placeholder={t('typeAgain')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="set-error">{error}</p>}
          <div className="danger-confirm-row">
            <button type="button" className="mini-btn" onClick={() => toggle(null)}>
              {t('cancel')}
            </button>
            <button type="submit" className="mini-btn primary" disabled={busy}>
              {busy ? t('saving') : t('changePassword')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
