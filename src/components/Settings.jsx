import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { supabase } from '../supabase'
import { BASE_KEY } from '../sync'
import { PRIORITIES, TEXT_SCALE, exportData as downloadBackup, parseBackup } from '../utils'
import AccentPicker from './AccentPicker'
import LanguagePicker from './LanguagePicker'
import { t, tn } from '../i18n'
import Account from './Account'
import { remindersOptedIn, enableReminders, disableReminders, sendTestReminder, turnOnReminders } from '../reminders'
import { isNative } from '../native'
import { COARSE } from '../fx'
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
  GlobeIcon,
} from './Icons'

const DUE_OPTS = [
  { id: 'none', key: 'noDate' },
  { id: 'today', key: 'today' },
  { id: 'tomorrow', key: 'tomorrow' },
]

const LOCAL_KEYS = ['zenith-v1', BASE_KEY, 'kiln-focus', 'kiln-tips', 'kiln-reminders', 'kiln-reminded-on']

const SYNC_LABEL = {
  synced: 'syncSynced',
  syncing: 'syncSyncing',
  offline: 'syncOffline',
  error: 'syncError',
}

export default function Settings({ onClose, onOpenSheet, onOpenAmbient }) {
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
      toast(t('nameUpdated'), '✓')
    } else {
      setName(profile?.name ?? '')
    }
  }

  const toggleReminders = async () => {
    if (reminders) {
      disableReminders()
      setReminders(false)
      toast(t('remindersOff'), '🔕')
    } else if (isNative) {
      setReminders(await turnOnReminders())
    } else {
      const ok = await enableReminders()
      setReminders(ok)
      toast(ok ? t('remindersOn') : t('notifBlocked'), ok ? '🔔' : '⚠')
    }
  }

  const testReminder = async () => {
    const ok = await sendTestReminder()
    if (!ok && isNative) return void (await turnOnReminders())
    toast(ok ? t('testOnWay') : t('notifBlockedIos'), ok ? '🔔' : '⚠')
  }

  const replayTour = () => {
    dispatch({ type: 'START_TOUR_REPLAY' })
    onClose()
  }

  const exportData = () => {
    downloadBackup(state)
    toast(t('backupDownloaded'), '⬇')
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
    toast(tn('restoredTasks', restore.tasks.length), '↩')
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
        toast(t('deleteFailed'), '⚠')
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
        <h2>{t('settings')}</h2>
        <div className="settings-body">
          {/* You */}
          <section className="set-section">
            <div className="set-head">
              <UserIcon size={13} /> {t('you')}
            </div>
            <label className="set-label">{t('displayName')}</label>
            <input
              className="set-input"
              value={name}
              maxLength={40}
              placeholder={t('yourName')}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            />
            <p className="set-hint">{t('displayNameHint')}</p>
            {profile?.cloud && (
              <p className={`set-hint sync-line ${syncStatus}`}>
                <span className="sync-dot" />
                {profile.email ? `${profile.email} · ` : ''}
                {SYNC_LABEL[syncStatus] ? t(SYNC_LABEL[syncStatus]) : t('connecting')}
              </p>
            )}
            {profile?.cloud && <Account email={profile.email} />}
          </section>

          {/* Language */}
          <section className="set-section">
            <div className="set-head">
              <GlobeIcon size={12} /> Language{t('language') !== 'Language' && ` · ${t('language')}`}
            </div>
            <LanguagePicker settings={settings} dispatch={dispatch} />
          </section>

          {/* Accent */}
          <section className="set-section">
            <div className="set-head">
              <SparkleIcon size={12} /> {t('accentColor')}
            </div>
            <AccentPicker settings={settings} dispatch={dispatch} />
          </section>

          {/* Appearance */}
          <section className="set-section">
            <div className="set-head">
              <SunIcon size={13} /> {t('appearance')}
            </div>
            <div className="set-row">
              <span>{t('theme')}</span>
              <div className="seg">
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
            </div>
            <div className="set-text-size">
              <div className="set-row">
                <span>
                  {t('textSize')}
                  <span className="set-sub">{t('textSizeSub')}</span>
                </span>
                <button
                  className="set-text-val"
                  title={t('backToDefault')}
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
                  aria-label={t('textSize')}
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
              <span>{t('soundEffects')}</span>
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
                {t('reducedVisuals')}
                <span className="set-sub">{t('reducedVisualsSub')}</span>
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
              <FlagIcon size={12} /> {t('newTaskDefaults')}
            </div>
            <div className="set-row">
              <span>{t('dueDate')}</span>
              <div className="seg">
                {DUE_OPTS.map((o) => (
                  <button
                    key={o.id}
                    className={`seg-btn ${settings.defaultDue === o.id ? 'on' : ''}`}
                    onClick={() => set({ defaultDue: o.id })}
                  >
                    {t(o.key)}
                  </button>
                ))}
              </div>
            </div>
            <div className="set-row">
              <span>{t('priority')}</span>
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
              <span>{t('defaultTime')}</span>
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
                    title={t('clear')}
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
              <BellIcon size={12} /> {t('notifications')}
            </div>
            <div className="set-row">
              <span>{isNative ? t('taskReminders') : t('dailyNudge')}</span>
              <button
                className={`switch ${reminders ? 'on' : ''}`}
                role="switch"
                aria-checked={reminders}
                onClick={toggleReminders}
              >
                <span className="switch-knob" />
              </button>
            </div>
            {isNative && reminders && (
              <>
                <p className="set-hint">{t('remindersHint')}</p>
                <div className="set-row">
                  <span>{t('checkItWorks')}</span>
                  <button className="mini-btn" onClick={testReminder}>
                    {t('sendTest')}
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Ambient */}
          <section className="set-section">
            <div className="set-head">
              <FlameIcon size={12} /> {t('ambient')}
            </div>
            <p className="set-hint" style={{ marginTop: 0 }}>
              {t('ambientHint')}
            </p>
            <button className="set-action" onClick={() => onOpenAmbient()}>
              <FlameIcon size={14} /> {t('openAmbient')}
            </button>
            <button className="set-action" onClick={() => onOpenAmbient(true)}>
              <SparkleIcon size={14} /> {t('customizeAmbient')}
            </button>
            {/* a second window only means something on a desktop browser —
                phones and the app shell block pop-ups */}
            {!isNative && !COARSE && (
              <button
                className="set-action"
                onClick={() => window.open(`${window.location.pathname}?ambient=1`, 'kiln-ambient', 'popup')}
              >
                <FlameIcon size={14} /> {t('openNewWindow')}
              </button>
            )}
            {Object.keys(settings.ambient ?? {}).length > 0 && (
              <button className="set-action" onClick={() => set({ ambient: {} })}>
                {t('resetAmbient')}
              </button>
            )}
          </section>

          {/* Help */}
          <section className="set-section">
            <div className="set-head">
              <InfoIcon size={12} /> {t('helpFeedback')}
            </div>
            <button className="set-action" onClick={() => onOpenSheet('help')}>
              <KeyboardIcon size={14} /> {t('helpShortcuts')}
            </button>
            <button className="set-action" onClick={() => onOpenSheet('feedback')}>
              <MailIcon size={14} /> {t('sendFeedback')}
            </button>
            <button className="set-action" onClick={() => onOpenSheet('whatsnew')}>
              <GiftIcon size={14} /> {t('whatsNew')}
            </button>
          </section>

          {/* Actions */}
          <section className="set-section">
            <button className="set-action" onClick={replayTour}>
              <InfoIcon size={14} /> {t('replayTour')}
            </button>
            <button className="set-action" onClick={exportData}>
              <DownloadIcon size={14} /> {t('downloadBackup')}
            </button>
            <button className="set-action" onClick={() => fileRef.current?.click()}>
              <DownloadIcon size={14} style={{ transform: 'rotate(180deg)' }} /> {t('restoreBackup')}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pickBackup} />
            {restore && (
              <div className="danger-confirm">
                <p>
                  {t('restoreConfirm', {
                    folders: tn('folders', restore.projects.length),
                    tasks: tn('tasks', restore.tasks.length),
                  })}
                </p>
                <div className="danger-confirm-row">
                  <button className="mini-btn" onClick={() => setRestore(null)}>
                    {t('cancel')}
                  </button>
                  <button className="mini-btn danger" onClick={applyRestore}>
                    {t('restoreBackupBtn')}
                  </button>
                </div>
              </div>
            )}
            {profile?.cloud && !signOutStuck && (
              <button className="set-action danger" onClick={() => signOut()} disabled={busy}>
                {busy ? t('savingChanges') : t('signOut')}
              </button>
            )}
            {signOutStuck && (
              <div className="danger-confirm">
                <p>{t('signOutStuck')}</p>
                <div className="danger-confirm-row">
                  <button className="mini-btn" onClick={() => setSignOutStuck(false)}>
                    {t('staySignedIn')}
                  </button>
                  <button className="mini-btn" onClick={exportData}>
                    {t('downloadBackupShort')}
                  </button>
                  <button className="mini-btn danger" onClick={() => signOut(true)}>
                    {t('signOutAnyway')}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Danger zone */}
          <section className="set-section danger-zone">
            <div className="set-head">{t('dangerZone')}</div>
            {!confirmDel ? (
              <button className="set-action danger" onClick={() => setConfirmDel(true)}>
                {t('deleteAccount')}
              </button>
            ) : (
              <div className="danger-confirm">
                <p>{profile?.cloud ? t('deleteConfirmCloud') : t('deleteConfirmLocal')}</p>
                <div className="danger-confirm-row">
                  <button className="mini-btn" onClick={() => setConfirmDel(false)} disabled={busy}>
                    {t('cancel')}
                  </button>
                  <button className="mini-btn danger" onClick={deleteAccount} disabled={busy}>
                    {busy ? t('deleting') : t('yesDeleteAll')}
                  </button>
                </div>
              </div>
            )}
            <p className="set-hint">
              {t('exportFirst')}{' '}
              <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">{t('privacy')}</a>
              {' · '}
              <a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noreferrer">{t('terms')}</a>
            </p>
          </section>
        </div>

        <div className="modal-actions">
          <motion.button className="btn primary" onClick={onClose} whileTap={{ scale: 0.96 }}>
            {t('done')}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
