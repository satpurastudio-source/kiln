import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { supabase } from '../supabase'
import { FlameIcon } from './Icons'
import { APP_NAME, APP_LABEL } from '../brand'
import { linkBase } from '../native'

// Where email links land. Inside the app shell the page lives at kiln://,
// which a mail app can't open — so links go to the web app instead.
const RESEND_WAIT = 30 // seconds

// onboarding hands off the chosen name + whether they wanted to sign up
const readIntent = () => {
  try {
    return {
      name: localStorage.getItem('kiln-pending-name') || '',
      mode: localStorage.getItem('kiln-auth-intent') === 'signup' ? 'signup' : 'signin',
    }
  } catch {
    return { name: '', mode: 'signin' }
  }
}

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
}

export default function Login() {
  const { dispatch } = useStore()
  const intent = readIntent()
  const [mode, setMode] = useState(intent.mode) // signin | signup | sent | guest
  const [name, setName] = useState(intent.name)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)

  // consume the one-time handoff so it doesn't stick around next visit
  useEffect(() => {
    try {
      localStorage.removeItem('kiln-pending-name')
      localStorage.removeItem('kiln-auth-intent')
    } catch {
      /* ignore */
    }
  }, [])

  // countdown before "resend code" unlocks
  useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  const switchMode = (m) => {
    setMode(m)
    setError('')
  }

  const forgot = async () => {
    if (!email.includes('@')) return setError('Enter your account email first.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${linkBase()}?reset=1`,
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
    if (err?.message === 'Email not confirmed') {
      // straight to the code screen, with a fresh code on its way
      setMode('sent')
      setCode('')
      return resend()
    }
    if (err) setError(err.message)
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
        emailRedirectTo: `${linkBase()}?verified=1`,
      },
    })
    setBusy(false)
    if (err) return setError(err.message)
    if (data.session) return // email confirmation disabled: signed in immediately
    setCode('')
    setResendIn(RESEND_WAIT)
    setMode('sent')
  }

  // The email carries a 6-digit code as well as the link. Typing the code
  // signs you in right here — on any device, in the app or the browser —
  // without the link having to find its way back to this exact screen.
  const verifyCode = async () => {
    const token = code.replace(/\D/g, '')
    if (token.length < 6) return setError('Enter the code from the email.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
    setBusy(false)
    if (err) return setError(/expired|invalid/i.test(err.message) ? 'That code didn’t work — check it, or send a new one.' : err.message)
    toast('Email verified', '✓')
    // signed in: the store's auth listener takes over and opens the app
  }

  async function resend() {
    setError('')
    setResendIn(RESEND_WAIT)
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${linkBase()}?verified=1` },
    })
    if (err) {
      setResendIn(0)
      setError(err.message)
    } else toast('New code sent', '✉')
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
          {mode === 'sent' ? (
            <motion.div key="sent" {...fade}>
              <div className="login-sent-icon">✉</div>
              <p className="login-sent-title">Check your inbox</p>
              <p className="login-note">
                We sent a code to <b>{email}</b>.<br />
                Type it here — or just tap the link in the email.
              </p>
              <input
                type="text"
                className="login-input login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={10}
                value={code}
                placeholder="••••••"
                aria-label="Verification code"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && !busy && verifyCode()}
              />
              {error && <p className="login-error">{error}</p>}
              <motion.button
                className="btn primary login-btn"
                onClick={verifyCode}
                disabled={busy}
                whileTap={{ scale: 0.97 }}
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'One moment…' : 'Verify & enter →'}
              </motion.button>
              <div className="login-alt">
                <button className="login-link" onClick={resend} disabled={resendIn > 0}>
                  {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Didn’t get it? Send a new code'}
                </button>
                <button className="login-link" onClick={() => switchMode('signin')}>
                  ← back to sign in
                </button>
              </div>
            </motion.div>
          ) : mode === 'sent-reset' ? (
            <motion.div key="sent-reset" {...fade}>
              <div className="login-sent-icon">✉</div>
              <p className="login-sent-title">Check your inbox</p>
              <p className="login-note">
                We sent a password reset link to <b>{email}</b>.<br />
                Click it to choose a new password.
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

        <div className="login-legal">
          <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy</a>
          <span>·</span>
          <a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noreferrer">Terms</a>
        </div>
      </motion.div>
    </div>
  )
}
