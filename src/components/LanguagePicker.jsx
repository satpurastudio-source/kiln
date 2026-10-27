import { LANGUAGES, resolveLang, loadLang } from '../i18n'

// Native-script chips, used on the first onboarding step and in Settings.
export default function LanguagePicker({ settings, dispatch, className = '' }) {
  const current = resolveLang(settings)
  return (
    <div className={`lang-grid ${className}`}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          lang={l.code}
          className={`lang-chip ${current === l.code ? 'on' : ''}`}
          aria-pressed={current === l.code}
          onClick={async () => {
            // fetch first so the switch lands in one repaint, not English-then-Kannada
            await loadLang(l.code).catch(() => {})
            dispatch({ type: 'SET_SETTINGS', patch: { language: l.code } })
          }}
        >
          <span className="lang-native">{l.native}</span>
          {l.native !== l.name && <span className="lang-name">{l.name}</span>}
        </button>
      ))}
    </div>
  )
}
