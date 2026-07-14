import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from '../store'
import { supabase } from '../supabase'
import { APP_NAME } from '../brand'

// Landing page for the password-recovery email link (?reset=1).
export default function Reset({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (password.length < 6) return setError('Password needs at least 6 characters.')
    if (password !== confirm) return setError('Passwords don’t match.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) {
      return setError(
        err.message.includes('session')
          ? 'This reset link expired — request a new one from the sign-in screen.'
          : err.message
      )
    }
    toast('Password updated', '🔒')
    onDone()
  }

  return (
    <div className="login-screen">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="login-sent-icon">🔒</div>
        <div className="reveal-wrap">
          <motion.h1
            className="login-title"
            style={{ fontSize: 38 }}
            initial={{ y: '108%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            New password<span className="dot">.</span>
          </motion.h1>
        </div>
        <p className="login-sub">choose a new password for your {APP_NAME} account</p>

        <input
          type="password"
          className="login-input"
          autoFocus
          value={password}
          placeholder="New password (6+ chars)"
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          className="login-input"
          value={confirm}
          placeholder="Repeat it"
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
        />
        {error && <p className="login-error">{error}</p>}
        <motion.button
          className="btn primary login-btn"
          onClick={submit}
          disabled={busy}
          whileTap={{ scale: 0.97 }}
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'One moment…' : 'Set password →'}
        </motion.button>
      </motion.div>
    </div>
  )
}
