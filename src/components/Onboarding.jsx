import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { PURPOSES, iconGlyph, uid, todayStr, resolveAccent } from '../utils'
import AccentPicker from './AccentPicker'
import { NLDemo, TapDemo } from './OnboardingDemos'
import { APP_NAME } from '../brand'
import { FlameIcon, SunIcon, MoonIcon } from './Icons'

// First-run flow (Duolingo-style): personalize first, ask to sign in last.
// Also reopened as a quick tour from Settings / palette by flipping `onboarded`.
export default function Onboarding() {
  const { state, dispatch } = useStore()
  // an explicit replay (Settings / palette) is never treated as first-run,
  // even if `profile` happens to be unset (e.g. right after signing out) —
  // first-run is the only path that's allowed to touch projects/tasks
  const firstRun = !state.replayTour && !state.profile
  const accent = resolveAccent(state.settings).accent
  const [step, setStep] = useState(0)
  const [name, setName] = useState(state.profile?.name ?? '')
  const [picked, setPicked] = useState(new Set())
  const [firstTask, setFirstTask] = useState('')

  const togglePurpose = (id) =>
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // build the tailored starter folders (keeps "Getting Started" + its tutorial)
  // and drop in the user's first real task so Today isn't empty on arrival
  const applyPersonalization = () => {
    const clean = name.trim()
    if (!firstRun && clean) dispatch({ type: 'UPDATE_PROFILE', patch: { name: clean } })
    const keep = state.projects[0] // Getting Started holds the tutorial tasks
    if (firstRun && picked.size > 0) {
      const folders = PURPOSES.filter((p) => picked.has(p.id) && p.name !== keep.name).map((p) => ({
        id: uid(),
        name: p.name,
        color: p.color,
        icon: p.icon,
      }))
      dispatch({ type: 'SET_PROJECTS', projects: [keep, ...folders] })
    }
    if (firstRun && firstTask.trim()) {
      dispatch({
        type: 'ADD_TASK',
        title: firstTask.trim(),
        projectId: keep.id,
        due: todayStr(),
        priority: 'none',
      })
    }
  }

  const finishGuest = () => {
    applyPersonalization()
    const clean = name.trim() || 'friend'
    dispatch({ type: 'SET_PROFILE', profile: { name: clean, createdAt: Date.now() } })
    dispatch({ type: 'SET_ONBOARDED', value: true })
    toast(`Welcome, ${clean.split(/\s+/)[0]}`, '🔥')
  }

  // hand off to the Login screen, prefilled + in the right mode
  const finishToAuth = (intent) => {
    applyPersonalization()
    try {
      if (name.trim()) localStorage.setItem('kiln-pending-name', name.trim())
      localStorage.setItem('kiln-auth-intent', intent)
    } catch {
      /* private mode: prefill just won't happen */
    }
    dispatch({ type: 'SET_ONBOARDED', value: true })
  }

  const finishReplay = () => {
    applyPersonalization()
    dispatch({ type: 'SET_ONBOARDED', value: true })
  }

  /* ------------------------------- steps ------------------------------- */

  const stepWelcome = {
    key: 'welcome',
    body: (
      <>
        <motion.div
          className="brand-mark onb-mark"
          initial={{ rotate: -90, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        >
          <FlameIcon size={24} />
        </motion.div>
        <h2 className="onb-title">
          Welcome to {APP_NAME}
          <span className="dot">.</span>
        </h2>
        <p className="onb-sub">A calm home for your tasks. First — what should we call you?</p>
        <input
          className="onb-input"
          autoFocus
          value={name}
          maxLength={40}
          placeholder="Your name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && next()}
        />
      </>
    ),
  }

  const stepLook = {
    key: 'look',
    body: (
      <>
        <h2 className="onb-title">Make it yours</h2>
        <p className="onb-sub">Pick a color and a mode. You can change these anytime in Settings.</p>
        <label className="onb-field-label">Accent</label>
        <AccentPicker settings={state.settings} dispatch={dispatch} className="onb-accents" />
        <label className="onb-field-label">Theme</label>
        <div className="seg onb-theme-seg">
          <button
            className={`seg-btn ${state.theme === 'light' ? 'on' : ''}`}
            onClick={() => dispatch({ type: 'SET_THEME', theme: 'light' })}
          >
            <SunIcon size={13} /> Light
          </button>
          <button
            className={`seg-btn ${state.theme === 'dark' ? 'on' : ''}`}
            onClick={() => dispatch({ type: 'SET_THEME', theme: 'dark' })}
          >
            <MoonIcon size={13} /> Dark
          </button>
        </div>
      </>
    ),
  }

  const stepPurpose = {
    key: 'purpose',
    body: (
      <>
        <h2 className="onb-title">What’s on your plate?</h2>
        <p className="onb-sub">Pick a few and we’ll set up matching folders. Skip if you’d rather start blank.</p>
        <div className="onb-purpose">
          {PURPOSES.map((p) => (
            <button
              key={p.id}
              className={`onb-chip ${picked.has(p.id) ? 'on' : ''}`}
              onClick={() => togglePurpose(p.id)}
            >
              <span className="onb-chip-dot" style={{ background: p.color }}>
                {iconGlyph(p.icon)}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </>
    ),
  }

  const stepCapture = {
    key: 'capture',
    body: (
      <>
        <h2 className="onb-title">Capture it in a flash</h2>
        <p className="onb-sub">
          Just type — kiln reads dates, times, priority and folders right out of your words.
        </p>
        <NLDemo />
        {firstRun && (
          <>
            <label className="onb-field-label">Your turn — add your first task</label>
            <input
              className="onb-input"
              value={firstTask}
              maxLength={140}
              placeholder="e.g. Plan my week tomorrow 9am"
              onChange={(e) => setFirstTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <p className="onb-mini-hint">We’ll drop it on your Today list so you land somewhere alive.</p>
          </>
        )}
      </>
    ),
  }

  const stepComplete = {
    key: 'complete',
    body: (
      <>
        <h2 className="onb-title">One tap to done</h2>
        <p className="onb-sub">
          Tap the circle to complete a task — or drag it to the bottom of the screen to finish with a
          flourish.
        </p>
        <TapDemo accent={accent} />
      </>
    ),
  }

  const stepAccount = {
    key: 'account',
    body: (
      <>
        <motion.div
          className="brand-mark onb-mark"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          <FlameIcon size={24} />
        </motion.div>
        <h2 className="onb-title">
          You’re all set{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''}
          <span className="dot">.</span>
        </h2>
        <p className="onb-sub">
          Create a free account to save your tasks and sync them across every device — or just start
          now on this one.
        </p>
        <div className="onb-account">
          <motion.button className="btn primary onb-cta" whileTap={{ scale: 0.97 }} onClick={() => finishToAuth('signup')}>
            Create a free account →
          </motion.button>
          <button className="btn ghost onb-cta" onClick={finishGuest}>
            Continue on this device
          </button>
          <button className="onb-link" onClick={() => finishToAuth('signin')}>
            Already have an account? <b>Sign in</b>
          </button>
        </div>
      </>
    ),
  }

  const stepDone = {
    key: 'done',
    body: (
      <>
        <div className="onb-mark brand-mark">
          <FlameIcon size={24} />
        </div>
        <h2 className="onb-title">You’re all set<span className="dot">.</span></h2>
        <p className="onb-sub">That’s the tour. Back to your tasks.</p>
      </>
    ),
  }

  const steps = firstRun
    ? [stepWelcome, stepLook, stepPurpose, stepCapture, stepComplete, stepAccount]
    : [stepWelcome, stepLook, stepCapture, stepComplete, stepDone]

  const last = step === steps.length - 1
  const onAccount = firstRun && last // account step carries its own buttons
  const canNext = step !== 0 || name.trim().length > 0

  function next() {
    if (!canNext) return
    if (last) return firstRun ? null : finishReplay()
    setStep((s) => s + 1)
  }
  const back = () => setStep((s) => Math.max(0, s - 1))

  return (
    <div className="login-screen onboarding-screen">
      <motion.div
        className="onb-card"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        {firstRun && (
          <button className="onb-skip" onClick={() => dispatch({ type: 'SET_ONBOARDED', value: true })}>
            Skip
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={steps[step].key}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="onb-step"
          >
            {steps[step].body}
          </motion.div>
        </AnimatePresence>

        <div className="onb-foot">
          <div className="onb-dots">
            {steps.map((s, i) => (
              <span key={s.key} className={`onb-dot ${i === step ? 'on' : ''}`} />
            ))}
          </div>
          {!onAccount && (
            <div className="onb-btns">
              {step > 0 && (
                <button className="btn ghost" onClick={back}>
                  Back
                </button>
              )}
              <motion.button
                className="btn primary"
                onClick={next}
                whileTap={{ scale: 0.96 }}
                disabled={!canNext}
                style={{ opacity: canNext ? 1 : 0.5 }}
              >
                {last ? 'Done' : 'Next →'}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
