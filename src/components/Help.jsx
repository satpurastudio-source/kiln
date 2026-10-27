import Sheet from './Sheet'
import { KeyboardIcon, SparkleIcon, MenuIcon } from './Icons'
import { t } from '../i18n'

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

// [keys, description key]
const KEYS = [
  [['N'], 'keyNewTask'],
  [['/'], 'keySearch'],
  [[MOD, 'K'], 'keyPalette'],
  [['?'], 'keyHelp'],
  [['Enter'], 'keyEnter'],
  [['Esc'], 'keyEsc'],
]

const GESTURES = [
  ['gSwipeRight', 'gSwipeRightDo'],
  ['gSwipeLeft', 'gSwipeLeftDo'],
  ['gPull', 'gPullDo'],
  ['gBack', 'gBackDo'],
]

// the examples stay English: that's what the quick-add parser reads
const SAY = [
  ['tomorrow · friday · next week', 'sayDue'],
  ['26 oct · 12/11', 'sayDate'],
  ['5pm · 6:30pm · noon', 'sayTime'],
  ['!high · !med · !low', 'priority'],
  ['#home', 'sayFolder'],
]

export default function Help({ onClose }) {
  const touch = window.matchMedia('(pointer: coarse)').matches
  return (
    <Sheet title={t('help')} onClose={onClose}>
      <section className="set-section">
        <div className="set-head">
          <SparkleIcon size={12} /> {t('quickAddUnderstands')}
        </div>
        <p className="set-hint" style={{ marginTop: 0 }}>
          {t('typeLikeSay')} <b>pay rent friday 5pm !high #home</b>
        </p>
        <dl className="help-list">
          {SAY.map(([k, v]) => (
            <div key={k}>
              <dt>
                <code>{k}</code>
              </dt>
              <dd>{t(v)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {touch && (
        <section className="set-section">
          <div className="set-head">
            <MenuIcon size={12} /> {t('gestures')}
          </div>
          <dl className="help-list">
            {GESTURES.map(([k, v]) => (
              <div key={k}>
                <dt>{t(k)}</dt>
                <dd>{t(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="set-section">
        <div className="set-head">
          <KeyboardIcon size={13} /> {t('keyboard')}
        </div>
        <dl className="help-list">
          {KEYS.map(([keys, v]) => (
            <div key={v}>
              <dt>
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </dt>
              <dd>{t(v)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Sheet>
  )
}
