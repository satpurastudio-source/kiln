import Sheet from './Sheet'
import { KeyboardIcon, SparkleIcon, MenuIcon } from './Icons'

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

const KEYS = [
  [['N'], 'New task'],
  [['/'], 'Search'],
  [[MOD, 'K'], 'Command palette: jump anywhere'],
  [['?'], 'This help'],
  [['Enter'], 'Add task / confirm'],
  [['Esc'], 'Close / clear'],
]

const GESTURES = [
  ['Swipe right', 'Open your folders'],
  ['Swipe left', 'Close them again'],
  ['Pull down on the title', 'Search or jump anywhere'],
  ['Android back', 'Closes what’s open, then opens your folders'],
]

const SAY = [
  ['tomorrow · friday · next week', 'Due date'],
  ['26 oct · 12/11', 'A calendar date (day first)'],
  ['5pm · 6:30pm · noon', 'Time'],
  ['!high · !med · !low', 'Priority'],
  ['#home', 'Folder (made for you if it’s new)'],
]

export default function Help({ onClose }) {
  const touch = window.matchMedia('(pointer: coarse)').matches
  return (
    <Sheet title="Help" onClose={onClose}>
      <section className="set-section">
        <div className="set-head">
          <SparkleIcon size={12} /> Quick add understands
        </div>
        <p className="set-hint" style={{ marginTop: 0 }}>
          Type it like you’d say it, e.g. <b>pay rent friday 5pm !high #home</b>
        </p>
        <dl className="help-list">
          {SAY.map(([k, v]) => (
            <div key={k}>
              <dt>
                <code>{k}</code>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {touch && (
        <section className="set-section">
          <div className="set-head">
            <MenuIcon size={12} /> Gestures
          </div>
          <dl className="help-list">
            {GESTURES.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="set-section">
        <div className="set-head">
          <KeyboardIcon size={13} /> Keyboard
        </div>
        <dl className="help-list">
          {KEYS.map(([keys, v]) => (
            <div key={v}>
              <dt>
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Sheet>
  )
}
