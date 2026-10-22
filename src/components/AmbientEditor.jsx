import { motion } from 'framer-motion'
import { AMBIENT_WIDGETS } from '../utils'
import { XIcon } from './Icons'

function Section({ title, children }) {
  return (
    <section className="ame-section">
      <h3 className="ame-title">{title}</h3>
      {children}
    </section>
  )
}

function Seg({ label, value, options, onChange }) {
  return (
    <div className="ame-row">
      <span className="ame-label">{label}</span>
      <div className="ame-seg">
        {options.map((o) => (
          <button key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="ame-row">
      <span className="ame-label">{label}</span>
      <button className={`switch ${value ? 'on' : ''}`} role="switch" aria-checked={value} onClick={() => onChange(!value)}>
        <span className="switch-knob" />
      </button>
    </div>
  )
}

// slider + exact number entry, so a value can be set to the pixel
function Slider({ label, value, min, max, step = 1, unit = 'px', onChange }) {
  const set = (v) => {
    const n = Number(v)
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
  }
  return (
    <div className="ame-row ame-slider-row">
      <span className="ame-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(e.target.value)}
        style={{ '--fill': `${((value - min) / (max - min)) * 100}%` }}
      />
      <label className="ame-num">
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => set(e.target.value)} />
        <span>{unit}</span>
      </label>
    </div>
  )
}

const hourOpts = Array.from({ length: 24 }, (_, h) => h)

export default function AmbientEditor({ cfg, onChange, onReset, onClose }) {
  const set = (k) => (v) => onChange({ [k]: v })

  return (
    <motion.aside
      className="ame"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="ame-head">
        <div>
          <div className="ame-kicker">Ambient mode</div>
          <div className="ame-h">Customize</div>
        </div>
        <button className="ame-close" onClick={onClose} aria-label="Close customization">
          <XIcon size={15} />
        </button>
      </header>

      <div className="ame-body">
        <Section title="Look">
          <Seg
            label="Theme"
            value={cfg.theme}
            options={[
              { id: 'app', label: 'Match app' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ]}
            onChange={set('theme')}
          />
          <Slider label="Background glow" value={cfg.glow} min={0} max={200} unit="%" onChange={set('glow')} />
          <Slider label="Card corners" value={cfg.radius} min={0} max={40} onChange={set('radius')} />
        </Section>

        <Section title="Clock">
          <Slider label="Size" value={cfg.clockSize} min={160} max={900} onChange={set('clockSize')} />
          <Seg
            label="Dial"
            value={cfg.clockFace}
            options={[
              { id: 'minimal', label: 'Minimal' },
              { id: 'classic', label: 'Classic' },
              { id: 'numerals', label: 'Numerals' },
            ]}
            onChange={set('clockFace')}
          />
          <Seg
            label="Second hand"
            value={cfg.seconds}
            options={[
              { id: 'sweep', label: 'Sweep' },
              { id: 'tick', label: 'Tick' },
              { id: 'off', label: 'Off' },
            ]}
            onChange={set('seconds')}
          />
          <Toggle label="Date" value={cfg.showDate} onChange={set('showDate')} />
          <Toggle label="Digital time" value={cfg.showDigital} onChange={set('showDigital')} />
        </Section>

        <Section title="Layout">
          <Seg
            label="Clock side"
            value={cfg.side}
            options={[
              { id: 'left', label: 'Left' },
              { id: 'right', label: 'Right' },
            ]}
            onChange={set('side')}
          />
          <Seg
            label="Columns"
            value={cfg.columns}
            options={[
              { id: 'both', label: 'Todo + Done' },
              { id: 'todo', label: 'Todo only' },
            ]}
            onChange={set('columns')}
          />
          <Slider label="Edge padding" value={cfg.padding} min={0} max={200} onChange={set('padding')} />
          <Slider label="Clock ↔ tasks gap" value={cfg.gap} min={0} max={300} onChange={set('gap')} />
          <Slider label="Task text" value={cfg.rowSize} min={12} max={48} onChange={set('rowSize')} />
          <Slider label="Max rows" value={cfg.maxRows} min={3} max={25} unit="" onChange={set('maxRows')} />
          <Toggle label="Quick add (N / +)" value={cfg.quickAdd} onChange={set('quickAdd')} />
          <Toggle label="Greeting" value={cfg.showGreeting} onChange={set('showGreeting')} />
          <Toggle label="Progress bar" value={cfg.showProgress} onChange={set('showProgress')} />
        </Section>

        <Section title="Widgets">
          <Seg label="Slot 1" value={cfg.widget1} options={AMBIENT_WIDGETS} onChange={set('widget1')} />
          <Seg label="Slot 2" value={cfg.widget2} options={AMBIENT_WIDGETS} onChange={set('widget2')} />
          <p className="ame-hint">A widget with nothing to show (no focus running, no streak yet) stays hidden.</p>
        </Section>

        <Section title="Ember">
          <Toggle label="Show Ember" value={cfg.showEmber} onChange={set('showEmber')} />
          <Slider label="Size" value={cfg.emberSize} min={48} max={320} onChange={set('emberSize')} />
          <Seg
            label="Corner"
            value={cfg.emberCorner}
            options={[
              { id: 'left', label: 'Bottom left' },
              { id: 'right', label: 'Bottom right' },
            ]}
            onChange={set('emberCorner')}
          />
          <Toggle label="Eyes follow cursor" value={cfg.emberEyes} onChange={set('emberEyes')} />
        </Section>

        <Section title="Night">
          <Seg
            label="Night mode"
            value={cfg.night}
            options={[
              { id: 'off', label: 'Off' },
              { id: 'dim', label: 'Dim' },
              { id: 'dark', label: 'Dim + dark' },
            ]}
            onChange={set('night')}
          />
          <div className="ame-row">
            <span className="ame-label">From → to</span>
            <div className="ame-hours">
              <select value={cfg.nightStart} onChange={(e) => onChange({ nightStart: Number(e.target.value) })}>
                {hourOpts.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <span>→</span>
              <select value={cfg.nightEnd} onChange={(e) => onChange({ nightEnd: Number(e.target.value) })}>
                {hourOpts.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Slider label="Dim brightness" value={cfg.nightLevel} min={15} max={100} unit="%" onChange={set('nightLevel')} />
        </Section>

        <Section title="Screen care">
          <Slider label="Burn-in drift" value={cfg.drift} min={0} max={40} onChange={set('drift')} />
          <p className="ame-hint">Nudges everything by up to this many pixels every 3 minutes. 0 turns it off.</p>
        </Section>
      </div>

      <footer className="ame-foot">
        <button className="ame-reset" onClick={onReset}>
          Reset to defaults
        </button>
        <span className="ame-saved">Saved automatically</span>
      </footer>
    </motion.aside>
  )
}
