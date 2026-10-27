import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, todayProgress } from './store'
import Loader from './components/Loader'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import QuickAdd from './components/QuickAdd'
import TaskList from './components/TaskList'
import Focus from './components/Focus'
import CompleteZone from './components/CompleteZone'
import MiniCalendar from './components/MiniCalendar'
import { maybeNotifyDueToday, scheduleNative, askOnFirstLaunch } from './reminders'
import Toasts from './components/Toasts'
import WhatsNew, { shouldShowWhatsNew } from './components/WhatsNew'
import { MenuIcon, XIcon } from './components/Icons'
import useEdgeSwipe from './useEdgeSwipe'
import GestureTips from './components/GestureTips'
import usePullToSearch from './usePullToSearch'
import useBackGesture from './useBackGesture'
import { todayStr } from './utils'
import { t } from './i18n'

// Screens and sheets that aren't on the main task list load on demand, so a
// phone parses and holds only what it shows. They're all fetched in the
// background once the app is idle, so opening one later never waits.
const screens = {
  Calendar: () => import('./components/Calendar'),
  Insights: () => import('./components/Insights'),
  Archive: () => import('./components/Archive'),
  Trash: () => import('./components/Trash'),
  ProjectModal: () => import('./components/ProjectModal'),
  CommandPalette: () => import('./components/CommandPalette'),
  Settings: () => import('./components/Settings'),
  Help: () => import('./components/Help'),
  Feedback: () => import('./components/Feedback'),
  Reset: () => import('./components/Reset'),
  Verified: () => import('./components/Verified'),
  Onboarding: () => import('./components/Onboarding'),
  Login: () => import('./components/Login'),
  Ambient: () => import('./components/Ambient'),
}
const { Calendar, Insights, Archive, Trash, ProjectModal, CommandPalette, Settings, Help, Feedback, Reset, Verified, Onboarding, Login, Ambient } = Object.fromEntries(
  Object.entries(screens).map(([name, load]) => [name, lazy(load)])
)
const prefetchScreens = () => Object.values(screens).forEach((load) => load().catch(() => {}))

// Re-render when the date changes — a phone app resumed the next morning (or
// a tab left open overnight) would otherwise keep showing yesterday's Today.
function useDayRollover() {
  const [day, setDay] = useState(todayStr)
  useEffect(() => {
    const check = () => setDay(todayStr())
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    const id = setTimeout(check, midnight - now)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [day])
  return day
}

export default function App() {
  const { state, dispatch } = useStore()
  useDayRollover()
  // ?ambient=1 opens straight into the ambient view — skip the typewriter
  // boot screen for it (a second-monitor kiosk shouldn't wait on that)
  const [showAmbient, setShowAmbient] = useState(() =>
    new URLSearchParams(window.location.search).has('ambient')
  )
  const [booted, setBooted] = useState(() => showAmbient)
  const reveal = useCallback(() => setBooted(true), [])
  const exitAmbient = useCallback(() => {
    window.history.replaceState(null, '', window.location.pathname)
    setShowAmbient(false)
  }, [])
  const [query, setQuery] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [projectModal, setProjectModal] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // dev only: ?sheet=help|feedback|whatsnew opens one straight away, for previews
  const [sheet, setSheet] = useState(() =>
    import.meta.env.DEV ? new URLSearchParams(window.location.search).get('sheet') : null
  ) // 'help' | 'feedback' | 'whatsnew'
  const [mobileNav, setMobileNav] = useState(false)
  // landing from the email-confirmation link (?verified=1)
  const [showVerified, setShowVerified] = useState(() =>
    new URLSearchParams(window.location.search).has('verified')
  )
  // landing from the password-recovery link (?reset=1)
  const [showReset, setShowReset] = useState(() =>
    new URLSearchParams(window.location.search).has('reset')
  )

  // opt-in "due today" nudge, once per day while the app is open
  const dueTodayCount = todayProgress(state).active
  useEffect(() => {
    if (state.profile) maybeNotifyDueToday(dueTodayCount)
  }, [state.profile, dueTodayCount])
  const quickAddRef = useRef(null)
  const searchRef = useRef(null)

  const viewKey = `${state.view.type}-${state.view.projectId ?? ''}`

  // reset search when switching views (unless we switched *to* show a search)
  const pendingQuery = useRef('')
  useEffect(() => {
    setQuery(pendingQuery.current)
    pendingQuery.current = ''
  }, [viewKey])

  // picking a task in the command palette: open its folder, filtered to it
  const openTask = useCallback(
    (t) => {
      const view = { type: 'project', projectId: t.projectId }
      if (`${view.type}-${view.projectId}` === viewKey) setQuery(t.title)
      else {
        pendingQuery.current = t.title
        dispatch({ type: 'SET_VIEW', view })
      }
    },
    [dispatch, viewKey]
  )

  const signedIn = !!state.profile

  const gesturesOn = booted && signedIn && state.onboarded && !showAmbient && !showReset && !showVerified
  useEdgeSwipe({ open: mobileNav, setOpen: setMobileNav, enabled: gesturesOn })
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  usePullToSearch({ onPull: openPalette, enabled: gesturesOn })

  // Android back / edge swipe: close what's on top, else toggle into the drawer
  useBackGesture(() => {
    // overlays owned by child components mark their close control
    const closers = document.querySelectorAll('[data-back-close]')
    if (paletteOpen) setPaletteOpen(false)
    else if (projectModal) setProjectModal(null)
    else if (sheet) setSheet(null)
    else if (settingsOpen) setSettingsOpen(false)
    else if (closers.length) closers[closers.length - 1].click()
    else if (!mobileNav) setMobileNav(true)
    else return false
    return true
  }, gesturesOn)

  // app shell: ask for the notification permission on first launch
  useEffect(() => {
    askOnFirstLaunch()
  }, [])

  // keep the OS reminder schedule (app shell only) in step with the tasks
  useEffect(() => {
    if (signedIn) scheduleNative(state.tasks)
  }, [signedIn, state.tasks])

  useEffect(() => {
    if (!signedIn) return
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      const t = e.target
      const typing =
        t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
      if (typing || paletteOpen || projectModal || sheet) return
      if (e.key === '?') {
        e.preventDefault()
        setSheet('help')
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        quickAddRef.current?.focus()
      } else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, projectModal, sheet, signedIn])

  // release notes, once, for people who were here before them
  const mainReady = gesturesOn
  useEffect(() => {
    if (!mainReady) return
    const id = setTimeout(() => shouldShowWhatsNew(state.tasks) && setSheet((s) => s ?? 'whatsnew'), 1200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainReady])

  // warm the on-demand screens once the first paint is done
  useEffect(() => {
    if (!booted) return
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500))
    const cancel = window.cancelIdleCallback ?? clearTimeout
    const id = idle(prefetchScreens)
    return () => cancel(id)
  }, [booted])

  // The loader overlays everything at z-20000, calls reveal() as it starts
  // fading, then removes itself. The app mounts at that moment, so its
  // entrance animations play through the fade. The Loader sits at a stable
  // position in the fragment so it never remounts mid-sequence.
  return (
    <>
      {!showAmbient && <Loader onReveal={reveal} />}
      {booted && (
        <div className="app">
          {!showAmbient && (
            <>
              <div className="aurora">
                <div className="blob b1" />
                <div className="blob b2" />
                <div className="blob b3" />
              </div>
              <div className="noise" />
            </>
          )}

          <Suspense fallback={null}>
          {showReset ? (
            <Reset
              onDone={() => {
                window.history.replaceState(null, '', window.location.pathname)
                setShowReset(false)
              }}
            />
          ) : showVerified ? (
            <Verified
              onDone={() => {
                window.history.replaceState(null, '', window.location.pathname)
                setShowVerified(false)
              }}
            />
          ) : !state.onboarded ? (
            <Onboarding />
          ) : !signedIn ? (
            <Login />
          ) : showAmbient ? (
            <Ambient onExit={exitAmbient} />
          ) : (
            <>
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileNav(!mobileNav)}
        aria-label={mobileNav ? t('closeMenu') : t('openMenu')}
      >
        {mobileNav ? <XIcon size={16} /> : <MenuIcon size={16} />}
      </button>

      <AnimatePresence>
        {mobileNav && (
          <motion.div
            className="mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setMobileNav(false)}
          />
        )}
      </AnimatePresence>

      <Sidebar
        onNewProject={() => {
          setMobileNav(false)
          setProjectModal({ mode: 'new' })
        }}
        onEditProject={(p) => {
          setMobileNav(false)
          setProjectModal({ mode: 'edit', project: p })
        }}
        onOpenSettings={() => {
          setMobileNav(false)
          setSettingsOpen(true)
        }}
        mobileOpen={mobileNav}
        closeMobile={() => setMobileNav(false)}
      />

      <main className="main">
        <Header
          query={query}
          setQuery={setQuery}
          searchRef={searchRef}
          openPalette={() => setPaletteOpen(true)}
        />
        <div className="main-scroll">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewKey}
              className="view-content"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={null}>
              {state.view.type === 'calendar' ? (
                <Calendar />
              ) : state.view.type === 'insights' ? (
                <Insights />
              ) : state.view.type === 'archive' ? (
                <Archive />
              ) : state.view.type === 'trash' ? (
                <Trash />
              ) : (
                <>
                  <GestureTips />
                  <QuickAdd ref={quickAddRef} />
                  <TaskList query={query} />
                </>
              )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <Suspense fallback={null}>
      <AnimatePresence>
        {projectModal && (
          <ProjectModal
            mode={projectModal.mode}
            project={projectModal.project}
            onClose={() => setProjectModal(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paletteOpen && (
          <CommandPalette
            onClose={() => setPaletteOpen(false)}
            onNewProject={() => setProjectModal({ mode: 'new' })}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenSheet={setSheet}
            onOpenTask={openTask}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && (
          <Settings
            onClose={() => setSettingsOpen(false)}
            onOpenSheet={(s) => {
              setSettingsOpen(false)
              setSheet(s)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet === 'help' && <Help onClose={() => setSheet(null)} />}
        {sheet === 'feedback' && <Feedback onClose={() => setSheet(null)} />}
        {sheet === 'whatsnew' && <WhatsNew onClose={() => setSheet(null)} />}
      </AnimatePresence>
      </Suspense>

              <Focus />
              <MiniCalendar />
              <CompleteZone />
            </>
          )}
          </Suspense>
          <Toasts />
        </div>
      )}
    </>
  )
}
