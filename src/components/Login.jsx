import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { supabase } from '../supabase'
import { FlameIcon } from './Icons'
import { APP_NAME, APP_LABEL } from '../brand'

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
}

export default function Login() {
  const { dispatch } = useStore()
  const [mode, setMode] = useState('signin') // signin | signup | sent | guest
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const switchMode = (m) => {
    setMode(m)
    setError('')
  }

  const forgot = async () => {
    if (!email.includes('@')) return setError('Enter your account email first.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}?reset=1`,
    })
    setBusy(false)
    if (err) return setError(err.message)
    setMode('sent-reset')
  }

  const signIn = async () => {
    if (!email.includes('@') || !password) return setError('Enter your email and password.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (err) {
      setError(
        err.message === 'Email not confirmed'
          ? 'Please verify your email first — check your inbox.'
          : err.message
      )
    }
    // success: the store's auth listener takes over and opens the app
  }

  const signUp = async () => {
    if (!name.trim()) return setError('Tell us your name.')
    if (!email.includes('@')) return setError('That email doesn’t look right.')
    if (password.length < 6) return setError('Password needs at least 6 characters.')
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim() },
        // origin + pathname so it works on subpath hosting (GitHub Pages)
        emailRedirectTo: `${window.location.origin}${window.location.pathname}?verified=1`,
      },
    })
    setBusy(false)
    if (err) return setError(err.message)
    if (data.session) return // email confirmation disabled: signed in immediately
    setMode('sent')
  }

  const guestStart = () => {
    const clean = name.trim()
    if (!clean) return setError('Tell us your name.')
    dispatch({ type: 'SET_PROFILE', profile: { name: clean, createdAt: Date.now() } })
    toast(`Welcome, ${clean.split(/\s+/)[0]}`, '🔥')
  }

  const submit = mode === 'signin' ? signIn : mode === 'signup' ? signUp : guestStart
  const onKey = (e) => e.key === 'Enter' && !busy && submit()

  return (
    <div className="login-screen">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.15 }}
      >
        <motion.div
          className="brand-mark login-mark"
          initial={{ rotate: -90, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.35 }}
        >
          <FlameIcon size={22} />
        </motion.div>

        <div className="reveal-wrap">
          <motion.h1
            className="login-title"
            initial={{ y: '108%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          >
            {APP_NAME}
            <span className="dot">.</span>
          </motion.h1>
        </div>

        <motion.p
          className="login-sub"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          your {APP_LABEL} — synced everywhere
        </motion.p>

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'sent' || mode === 'sent-reset' ? (
            <motion.div key="sent" {...fade}>
              <div className="login-sent-icon">✉</div>
              <p className="login-sent-title">Check your inbox</p>
              <p className="login-note">
                {mode === 'sent' ? (
                  <>
                    We sent a verification link to <b>{email}</b>.<br />
                    Click it, and you’ll land right back here — signed in.
                  </>
                ) : (
                  <>
                    We sent a password reset link to <b>{email}</b>.<br />
                    Click it to choose a new password.
                  </>
                )}
              </p>
              <button className="login-link" onClick={() => switchMode('signin')}>
                ← back to sign in
              </button>
            </motion.div>
          ) : mode === 'guest' ? (
            <motion.div key="guest" {...fade}>
              <label className="login-label">What should we call you?</label>
              <input
                type="text"
                className="login-input"
                autoFocus
                value={name}
                maxLength={40}
                placeholder="Your name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onKey}
              />
              {error && <p className="login-error">{error}</p>}
              <motion.button
                className="btn primary login-btn"
                onClick={guestStart}
                whileTap={{ scale: 0.97 }}
              >
                Continue on this device →
              </motion.button>
              <p className="login-note">Guest data stays on this device only.</p>
              <button className="login-link" onClick={() => switchMode('signin')}>
                ← back to sign in
              </button>
            </motion.div>
          ) : (
            <motion.div key={mode} {...fade}>
              {mode === 'signup' && (
                <input
                  type="text"
                  className="login-input"
                  value={name}
                  maxLength={40}
                  placeholder="Your name"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={onKey}
                />
              )}
              <input
                type="email"
                className="login-input"
                autoFocus={mode === 'signin'}
                value={email}
                placeholder="you@email.com"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={onKey}
              />
              <input
                type="password"
                className="login-input"
                value={password}
                placeholder={mode === 'signup' ? 'Choose a password (6+ chars)' : 'Password'}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKey}
              />
              {error && <p className="login-error">{error}</p>}
              <motion.button
                className="btn primary login-btn"
                onClick={submit}
                disabled={busy}
                whileTap={{ scale: 0.97 }}
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'One moment…' : mode === 'signin' ? 'Sign in →' : 'Create account →'}
              </motion.button>

              <div className="login-alt">
                {mode === 'signin' ? (
                  <>
                    <button className="login-link" onClick={() => switchMode('signup')}>
                      New here? <b>Create an account</b>
                    </button>
                    <button className="login-link" onClick={forgot}>
                      Forgot password?
                    </button>
                    <button className="login-link" onClick={() => switchMode('guest')}>
                      or continue without an account
                    </button>
                  </>
                ) : (
                  <button className="login-link" onClick={() => switchMode('signin')}>
                    Already have an account? <b>Sign in</b>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
