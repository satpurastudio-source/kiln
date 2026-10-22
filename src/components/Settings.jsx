import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { supabase } from '../supabase'
import { PRIORITIES } from '../utils'
import AccentPicker from './AccentPicker'
import { remindersOptedIn, enableReminders, disableReminders } from '../reminders'
import {
  UserIcon,
  SparkleIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  ClockIcon,
  InfoIcon,
  DownloadIcon,
  FlagIcon,
} from './Icons'

const DUE_OPTS = [
  { id: 'none', label: 'No date' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
]

const LOCAL_KEYS = ['zenith-v1', 'kiln-focus', 'kiln-tips', 'kiln-reminders', 'kiln-reminded-on']

export default function Settings({ onClose }) {
  const { state, dispatch } = useStore()
  const { settings, profile } = state
  const [name, setName] = useState(profile?.name ?? '')
  const [reminders, setReminders] = useState(remindersOptedIn())
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = (patch) => dispatch({ type: 'SET_SETTINGS', patch })

  const commitName = () => {
    const clean = name.trim()
    if (clean && clean !== profile?.name) {
      dispatch({ type: 'UPDATE_PROFILE', patch: { name: clean } })
      toast('Name updated', '✓')
    } else {
      setName(profile?.name ?? '')
    }
  }

  const toggleReminders = async () => {
    if (reminders) {
      disableReminders()
      setReminders(false)
      toast('Reminders off', '🔕')
    } else {
      const ok = await enableReminders()
      setReminders(ok)
      toast(ok ? 'Reminders on' : 'Notifications blocked by the browser', ok ? '🔔' : '⚠')
    }
  }

  const replayTour = () => {
    dispatch({ type: 'START_TOUR_REPLAY' })
    onClose()
  }

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ projects: state.projects, tasks: state.tasks, habits: state.habits }, null, 2)],
      { type: 'application/json' }
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kiln-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Data exported', '⬇')
  }

  const signOut = () => {
    supabase.auth.signOut()
    dispatch({ type: 'SIGN_OUT' })
  }

  const wipeLocal = () => {
    LOCAL_KEYS.forEach((k) => {
      try {
        localStorage.removeItem(k)
      } catch {
        /* ignore */
      }
    })
  }

  // Permanently delete the account + all cloud data, then reset this device.
  const deleteAccount = async () => {
    setBusy(true)
    if (profile?.cloud) {
      // the Edge Function removes the auth user + their kiln_data row (a client
      // can't delete its own auth user, so this must run server-side)
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) {
        setBusy(false)
        setConfirmDel(false)
        toast('Couldn’t delete right now — please try again', '⚠')
        return
      }
      await supabase.auth.signOut()
    }
    wipeLocal()
    window.location.reload() // back to a clean first-run state
  }

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="modal settings-modal"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      >
        <h2>Settings</h2>
        <div className="settings-body">
          {/* You */}
          <section className="set-section">
            <div className="set-head">
              <UserIcon size={13} /> You
            </div>
            <label className="set-label">Display name</label>
            <input
              className="set-input"
              value={name}
              maxLength={40}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            />
            <p className="set-hint">Used in your greeting on the Today screen.</p>
          </section>

          {/* Accent */}
          <section className="set-section">
            <div className="set-head">
              <SparkleIcon size={12} /> Accent color
            </div>
            <AccentPicker settings={settings} dispatch={dispatch} />
          </section>

          {/* Appearance */}
          <section className="set-section">
            <div className="set-head">
              <SunIcon size={13} /> Appearance
            </div>
            <div className="set-row">
              <span>Theme</span>
              <div className="seg">
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
            </div>
            <div className="set-row">
              <span>Sound effects</span>
              <button
                className={`switch ${state.sound ? 'on' : ''}`}
                role="switch"
                aria-checked={state.sound}
                onClick={() => dispatch({ type: 'SET_SOUND', sound: !state.sound })}
              >
                <span className="switch-knob" />
              </button>
            </div>
            <div className="set-row">
              <span>
                Reduced visuals
                <span className="set-sub">Turns off blur, glow & confetti — lighter on older phones</span>
              </span>
              <button
                className={`switch ${settings.reducedEffects ? 'on' : ''}`}
                role="switch"
                aria-checked={settings.reducedEffects}
                onClick={() => set({ reducedEffects: !settings.reducedEffects })}
              >
                <span className="switch-knob" />
              </button>
            </div>
          </section>

          {/* New task defaults */}
          <section className="set-section">
            <div className="set-head">
              <FlagIcon size={12} /> New task defaults
            </div>
            <div className="set-row">
              <span>Due date</span>
              <div className="seg">
                {DUE_OPTS.map((o) => (
                  <button
                    key={o.id}
                    className={`seg-btn ${settings.defaultDue === o.id ? 'on' : ''}`}
                    onClick={() => set({ defaultDue: o.id })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="set-row">
              <span>Priority</span>
              <div className="chip-wrap">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    className={`chip ${settings.defaultPriority === p.id ? 'on' : ''}`}
                    onClick={() => set({ defaultPriority: p.id })}
                  >
                    {p.id !== 'none' && <FlagIcon size={11} filled style={{ color: p.color }} />}
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="set-row">
              <span>Default time</span>
              <label className={`time-input ${settings.defaultTime ? 'set' : ''}`}>
                <ClockIcon size={12} />
                <input
                  type="time"
                  value={settings.defaultTime}
                  onChange={(e) => set({ defaultTime: e.target.value })}
                />
                {settings.defaultTime && (
                  <button
                    className="time-clear"
                    onClick={(e) => {
                      e.preventDefault()
                      set({ defaultTime: '' })
                    }}
                    title="Clear"
                  >
                    ×
                  </button>
                )}
              </label>
            </div>
          </section>

          {/* Notifications */}
          <section className="set-section">
            <div className="set-head">
              <BellIcon size={12} /> Notifications
            </div>
            <div className="set-row">
              <span>Daily “due today” nudge</span>
              <button
                className={`switch ${reminders ? 'on' : ''}`}
                role="switch"
                aria-checked={reminders}
                onClick={toggleReminders}
              >
                <span className="switch-knob" />
              </button>
            </div>
          </section>

          {/* Actions */}
          <section className="set-section">
            <button className="set-action" onClick={replayTour}>
              <InfoIcon size={14} /> Replay welcome tour
            </button>
            <button className="set-action" onClick={exportData}>
              <DownloadIcon size={14} /> Export my data (JSON)
            </button>
            {profile?.cloud && (
              <button className="set-action danger" onClick={signOut}>
                Sign out
              </button>
            )}
          </section>

          {/* Danger zone */}
          <section className="set-section danger-zone">
            <div className="set-head">Danger zone</div>
            {!confirmDel ? (
              <button className="set-action danger" onClick={() => setConfirmDel(true)}>
                Delete account
              </button>
            ) : (
              <div className="danger-confirm">
                <p>
                  This permanently erases your account{profile?.cloud ? ' and all synced data' : ' and everything on this device'}. It can’t be undone.
                </p>
                <div className="danger-confirm-row">
                  <button className="mini-btn" onClick={() => setConfirmDel(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button className="mini-btn danger" onClick={deleteAccount} disabled={busy}>
                    {busy ? 'Deleting…' : 'Yes, delete everything'}
                  </button>
                </div>
              </div>
            )}
            <p className="set-hint">
              Prefer to keep a copy? Export your data first.{' '}
              <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy</a>
              {' · '}
              <a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noreferrer">Terms</a>
            </p>
          </section>
        </div>

        <div className="modal-actions">
          <motion.button className="btn primary" onClick={onClose} whileTap={{ scale: 0.96 }}>
            Done
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
