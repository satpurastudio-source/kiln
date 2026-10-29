import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, toast, SEED_TEXT } from '../store'
import { PURPOSES, iconGlyph, uid, todayStr, resolveAccent, parseQuickAdd } from '../utils'
import AccentPicker from './AccentPicker'
import { NLDemo, TapDemo } from './OnboardingDemos'
import { APP_NAME } from '../brand'
import { FlameIcon, SunIcon, MoonIcon } from './Icons'
import InstallHint from './InstallHint'
import LanguagePicker from './LanguagePicker'
import { useT } from '../i18n'

// First-run flow (Duolingo-style): personalize first, ask to sign in last.
// Also reopened as a quick tour from Settings / palette by flipping `onboarded`.
export default function Onboarding() {
  const { state, dispatch } = useStore()
  const t = useT()
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
  // first run only: the starter folders + tutorial tasks were seeded in
  // English before a language was picked — rewrite them in the chosen one
  const localizeSeed = (projects) => {
    const tr = (s) => (SEED_TEXT[s] ? t(SEED_TEXT[s]) : s)
    dispatch({ type: 'SET_PROJECTS', projects: projects.map((p) => ({ ...p, name: tr(p.name) })) })
    for (const task of state.tasks) {
      if (SEED_TEXT[task.title])
        dispatch({ type: 'UPDATE_TASK', id: task.id, patch: { title: tr(task.title), notes: tr(task.notes ?? '') } })
    }
  }

  const applyPersonalization = () => {
    const clean = name.trim()
    if (!firstRun && clean) dispatch({ type: 'UPDATE_PROFILE', patch: { name: clean } })
    const keep = state.projects[0] // Getting Started holds the tutorial tasks
    if (firstRun) {
      const folders = PURPOSES.filter((p) => picked.has(p.id) && p.name !== keep.name).map((p) => ({
        id: uid(),
        name: p.name,
        color: p.color,
        icon: p.icon,
      }))
      localizeSeed(picked.size > 0 ? [keep, ...folders] : state.projects)
    }
    if (firstRun && firstTask.trim()) {
      // read it the way the quick-add bar does ("plan my week tomorrow 9am"),
      // since this step promises exactly that; a #new-folder tag just files
      // it under Getting Started
      const p = parseQuickAdd(firstTask, state.projects)
      dispatch({
        type: 'ADD_TASK',
        title: p.title.trim() || firstTask.trim(),
        projectId: p.projectId ?? keep.id,
        due: p.due ?? todayStr(),
        time: p.time || null,
        priority: p.priority ?? 'none',
      })
    }
  }

  const finishGuest = () => {
    applyPersonalization()
    const clean = name.trim() || t('friend')
    dispatch({ type: 'SET_PROFILE', profile: { name: clean, createdAt: Date.now() } })
    dispatch({ type: 'SET_ONBOARDED', value: true })
    toast(t('welcomeToast', { name: clean.split(/\s+/)[0] }), '🔥')
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

  const stepLang = {
    key: 'lang',
    body: (
      <>
        <h2 className="onb-title">{t('langTitle')}</h2>
        <p className="onb-sub">{t('langSub')}</p>
        <LanguagePicker settings={state.settings} dispatch={dispatch} className="onb-langs" />
      </>
    ),
  }

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
          {t('welcomeTitle', { app: APP_NAME })}
          <span className="dot">.</span>
        </h2>
        <p className="onb-sub">{t('welcomeSub')}</p>
        <input
          className="onb-input"
          autoFocus
          value={name}
          maxLength={40}
          placeholder={t('yourName')}
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
        <h2 className="onb-title">{t('lookTitle')}</h2>
        <p className="onb-sub">{t('lookSub')}</p>
        <label className="onb-field-label">{t('accent')}</label>
        <AccentPicker settings={state.settings} dispatch={dispatch} className="onb-accents" />
        <label className="onb-field-label">{t('theme')}</label>
        <div className="seg onb-theme-seg">
          <button
            className={`seg-btn ${state.theme === 'light' ? 'on' : ''}`}
            onClick={() => dispatch({ type: 'SET_THEME', theme: 'light' })}
          >
            <SunIcon size={13} /> {t('light')}
          </button>
          <button
            className={`seg-btn ${state.theme === 'dark' ? 'on' : ''}`}
            onClick={() => dispatch({ type: 'SET_THEME', theme: 'dark' })}
          >
            <MoonIcon size={13} /> {t('dark')}
          </button>
        </div>
      </>
    ),
  }

  const stepPurpose = {
    key: 'purpose',
    body: (
      <>
        <h2 className="onb-title">{t('purposeTitle')}</h2>
        <p className="onb-sub">{t('purposeSub')}</p>
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
              {t(`p_${p.id}`)}
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
        <h2 className="onb-title">{t('captureTitle')}</h2>
        <p className="onb-sub">{t('captureSub')}</p>
        <NLDemo />
        {firstRun && (
          <>
            <label className="onb-field-label">{t('yourTurn')}</label>
            <input
              className="onb-input"
              value={firstTask}
              maxLength={140}
              placeholder={t('firstTaskPh')}
              onChange={(e) => setFirstTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <p className="onb-mini-hint">{t('firstTaskHint')}</p>
          </>
        )}
      </>
    ),
  }

  const stepComplete = {
    key: 'complete',
    body: (
      <>
        <h2 className="onb-title">{t('completeTitle')}</h2>
        <p className="onb-sub">{t('completeSub')}</p>
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
          {name.trim() ? t('allSetName', { name: name.trim().split(/\s+/)[0] }) : t('allSet')}
          <span className="dot">.</span>
        </h2>
        <p className="onb-sub">{t('accountSub')}</p>
        <div className="onb-account">
          <motion.button className="btn primary onb-cta" whileTap={{ scale: 0.97 }} onClick={() => finishToAuth('signup')}>
            {t('createAccount')}
          </motion.button>
          <button className="btn ghost onb-cta" onClick={finishGuest}>
            {t('continueDevice')}
          </button>
          <button className="onb-link" onClick={() => finishToAuth('signin')}>
            {t('haveAccount')} <b>{t('signIn')}</b>
          </button>
        </div>
        <InstallHint />
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
        <h2 className="onb-title">{t('allSet')}<span className="dot">.</span></h2>
        <p className="onb-sub">{t('tourDone')}</p>
        <InstallHint />
      </>
    ),
  }

  const steps = firstRun
    ? [stepLang, stepWelcome, stepLook, stepPurpose, stepCapture, stepComplete, stepAccount]
    : [stepWelcome, stepLook, stepCapture, stepComplete, stepDone]

  const last = step === steps.length - 1
  const onAccount = firstRun && last // account step carries its own buttons
  const canNext = steps[step].key !== 'welcome' || name.trim().length > 0

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
          <button
            className="onb-skip"
            onClick={() => {
              localizeSeed(state.projects)
              dispatch({ type: 'SET_ONBOARDED', value: true })
            }}
          >
            {t('skip')}
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
                  {t('back')}
                </button>
              )}
              <motion.button
                className="btn primary"
                onClick={next}
                whileTap={{ scale: 0.96 }}
                disabled={!canNext}
                style={{ opacity: canNext ? 1 : 0.5 }}
              >
                {last ? t('done') : t('next')}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
