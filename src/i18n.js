import en from './locales/en'

// The languages an Indian kiln user is most likely to read. `native` is what
// the picker shows; `name` is the English label beside it.
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
]

const known = (c) => LANGUAGES.some((l) => l.code === c)

// Nothing picked yet → follow the phone's language if we speak it
// (a kn-IN phone lands on Kannada), else English.
export function resolveLang(settings) {
  if (known(settings?.language)) return settings.language
  for (const tag of navigator.languages ?? [navigator.language]) {
    const c = (tag || '').slice(0, 2).toLowerCase()
    if (known(c)) return c
  }
  return 'en'
}

// English ships in the bundle; every other language is its own chunk, fetched
// the first time it's picked (main.jsx awaits the saved one before first paint).
const loaders = import.meta.glob(['./locales/*.js', '!./locales/en.js'])
const dicts = { en }
let lang = 'en'

export function loadLang(code) {
  if (dicts[code] || !loaders[`./locales/${code}.js`]) return Promise.resolve()
  return loaders[`./locales/${code}.js`]().then((m) => {
    dicts[code] = m.default
  })
}

export const isLoaded = (code) => !!dicts[code]

// Called by the store on every render, before any child renders, so a
// language switch repaints the whole tree in one pass.
export function setLang(code) {
  lang = dicts[code] ? code : 'en'
}

export const currentLang = () => lang

// t('key', { name }) — anywhere, not just in components. Falls back to
// English for anything not translated yet.
export function t(key, vars) {
  let s = dicts[lang]?.[key] ?? en[key] ?? key
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k])
  return s
}

// Counted strings: tn('tasks', 3) reads `tasks_one` / `tasks_other`, with {n}.
export function tn(key, n, vars) {
  return t(n === 1 ? `${key}_one` : `${key}_other`, { n: fmtNum(n), ...vars })
}

// Kept so components can read `const t = useT()` like any other hook.
export const useT = () => t

/* ------------------------------ dates & numbers ------------------------------ */

// en stays en-US so English dates read as before ("Oct 26"); the rest use the
// Indian locale of that language for native month/day names.
const intlLocale = () => (lang === 'en' ? 'en-US' : `${lang}-IN`)

export const fmtNum = (n) => (lang === 'en' ? String(n) : new Intl.NumberFormat(intlLocale()).format(n))

export const fmtDate = (d, opts) => d.toLocaleDateString(intlLocale(), opts)

export const fmtClock = (d, opts) => d.toLocaleTimeString(intlLocale(), opts)
