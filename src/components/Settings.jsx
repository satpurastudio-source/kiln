import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { supabase } from '../supabase'
import { BASE_KEY } from '../sync'
import { PRIORITIES, TEXT_SCALE, exportData as downloadBackup, parseBackup } from '../utils'
import AccentPicker from './AccentPicker'
import Account from './Account'
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
  FlameIcon,
  MailIcon,
  KeyboardIcon,
  GiftIcon,
} from './Icons'

const DUE_OPTS = [
  { id: 'none', label: 'No date' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
]

const LOCAL_KEYS = ['zenith-v1', BASE_KEY, 'kiln-focus', 'kiln-tips', 'kiln-reminders', 'kiln-reminded-on']

const SYNC_LABEL = {
  synced: 'All changes synced',
  syncing: 'Syncing…',
  offline: 'Offline — changes are saved on this device and will sync when you’re back',
  error: 'Can’t reach the server right now — changes are saved on this device, retrying',
}

export default function Settings({ onClose, onOpenSheet }) {
  const { state, dispatch, syncStatus, signOut: storeSignOut } = useStore()
  const { settings, profile } = state
  const [name, setName] = useState(profile?.name ?? '')
  const [reminders, setReminders] = useState(remindersOptedIn())
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [signOutStuck, setSignOutStuck] = useState(false)
  const [restore, setRestore] = useState(null) // parsed backup awaiting confirmation
  const fileRef = useRef(null)

  const set = (patch) => dispatch({ type: 'SET_SETTINGS', patch })

  // Escape closes, like every other overlay
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      toast(ok ? 'Reminders on' : 'Notifications are blocked — allow them for kiln in settings', ok ? '🔔' : '⚠')
    }
  }

  const replayTour = () => {
    dispatch({ type: 'START_TOUR_REPLAY' })
    onClose()
  }

  const exportData = () => {
    downloadBackup(state)
    toast('Backup downloaded', '⬇')
  }

  const pickBackup = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again should still fire
    if (!file) return
    try {
      setRestore(parseBackup(await file.text()))
    } catch (err) {
      toast(err.message, '⚠')
    }
  }

  const applyRestore = () => {
    // current tasks are swapped out, not destroyed — they go to the trash
    const incoming = new Set(restore.tasks.map((t) => t.id))
    dispatch({ type: 'DELETE_TASKS', ids: state.tasks.filter((t) => !incoming.has(t.id)).map((t) => t.id) })
    dispatch({ type: 'HYDRATE', data: { ...restore, seedV: 3 } })
    toast(`Restored ${restore.tasks.length} task${restore.tasks.length === 1 ? '' : 's'}`, '↩')
    setRestore(null)
    onClose()
  }

  // Waits for unsynced changes to reach the cloud first. If they can't
  // (offline), say so instead of quietly throwing them away.
  const signOut = async (force = false) => {
    setBusy(true)
    const ok = await storeSignOut({ force })
    setBusy(false)
    if (!ok) setSignOutStuck(true)
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
            {profile?.cloud && (
              <p className={`set-hint sync-line ${syncStatus}`}>
                <span className="sync-dot" />
                {profile.email ? `${profile.email} · ` : ''}
                {SYNC_LABEL[syncStatus] ?? 'Connecting…'}
              </p>
            )}
            {profile?.cloud && <Account email={profile.email} />}
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
            <div className="set-text-size">
              <div className="set-row">
                <span>
                  Text size
                  <span className="set-sub">Drag to make every label easier to read</span>
                </span>
                <button
                  className="set-text-val"
                  title="Back to default"
                  onClick={() => set({ textScale: 1 })}
                  disabled={(settings.textScale ?? 1) === 1}
                >
                  {Math.round((settings.textScale ?? 1) * 100)}%
                </button>
              </div>
              <div className="set-slider">
                <span className="set-slider-a small" aria-hidden>
                  A
                </span>
                <input
                  type="range"
                  aria-label="Text size"
                  min={TEXT_SCALE.min}
                  max={TEXT_SCALE.max}
                  step={TEXT_SCALE.step}
                  value={settings.textScale ?? 1}
                  style={{
                    '--fill': `${(((settings.textScale ?? 1) - TEXT_SCALE.min) / (TEXT_SCALE.max - TEXT_SCALE.min)) * 100}%`,
                  }}
                  onChange={(e) => set({ textScale: Number(e.target.value) })}
                />
                <span className="set-slider-a big" aria-hidden>
                  A
                </span>
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

          {/* Ambient */}
          <section className="set-section">
            <div className="set-head">
              <FlameIcon size={12} /> Ambient
            </div>
            <p className="set-hint" style={{ marginTop: 0 }}>
              A calm full-screen clock + today view for a second monitor or a docked phone. Every
              part of it — clock size, dial, layout, widgets, Ember, night mode — is tweakable with a
              live preview.
            </p>
            <button
              className="set-action"
              onClick={() => window.location.assign(`${window.location.pathname}?ambient=1&customize=1`)}
            >
              <SparkleIcon size={14} /> Customize ambient mode
            </button>
            <button
              className="set-action"
              onClick={() => window.open(`${window.location.pathname}?ambient=1`, 'kiln-ambient', 'popup')}
            >
              <FlameIcon size={14} /> Open in a new window
            </button>
            {Object.keys(settings.ambient ?? {}).length > 0 && (
              <button className="set-action" onClick={() => set({ ambient: {} })}>
                Reset ambient customizations
              </button>
            )}
          </section>

          {/* Help */}
          <section className="set-section">
            <div className="set-head">
              <InfoIcon size={12} /> Help & feedback
            </div>
            <button className="set-action" onClick={() => onOpenSheet('help')}>
              <KeyboardIcon size={14} /> Help, shortcuts & gestures
            </button>
            <button className="set-action" onClick={() => onOpenSheet('feedback')}>
              <MailIcon size={14} /> Send feedback or report a bug
            </button>
            <button className="set-action" onClick={() => onOpenSheet('whatsnew')}>
              <GiftIcon size={14} /> What’s new
            </button>
          </section>

          {/* Actions */}
          <section className="set-section">
            <button className="set-action" onClick={replayTour}>
              <InfoIcon size={14} /> Replay welcome tour
            </button>
            <button className="set-action" onClick={exportData}>
              <DownloadIcon size={14} /> Download a backup (JSON)
            </button>
            <button className="set-action" onClick={() => fileRef.current?.click()}>
              <DownloadIcon size={14} style={{ transform: 'rotate(180deg)' }} /> Restore from a backup…
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pickBackup} />
            {restore && (
              <div className="danger-confirm">
                <p>
                  Replace your current tasks with this backup ({restore.projects.length} folder
                  {restore.projects.length === 1 ? '' : 's'}, {restore.tasks.length} task
                  {restore.tasks.length === 1 ? '' : 's'})? What you have now moves to the Trash.
                </p>
                <div className="danger-confirm-row">
                  <button className="mini-btn" onClick={() => setRestore(null)}>
                    Cancel
                  </button>
                  <button className="mini-btn danger" onClick={applyRestore}>
                    Restore backup
                  </button>
                </div>
              </div>
            )}
            {profile?.cloud && !signOutStuck && (
              <button className="set-action danger" onClick={() => signOut()} disabled={busy}>
                {busy ? 'Saving your changes…' : 'Sign out'}
              </button>
            )}
            {signOutStuck && (
              <div className="danger-confirm">
                <p>
                  Some changes haven’t reached the cloud yet (you may be offline). Signing out now
                  removes them from this device.
                </p>
                <div className="danger-confirm-row">
                  <button className="mini-btn" onClick={() => setSignOutStuck(false)}>
                    Stay signed in
                  </button>
                  <button className="mini-btn" onClick={exportData}>
                    Download backup
                  </button>
                  <button className="mini-btn danger" onClick={() => signOut(true)}>
                    Sign out anyway
                  </button>
                </div>
              </div>
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
