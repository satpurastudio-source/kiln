import { motion } from 'framer-motion'
import { AMBIENT_WIDGETS } from '../utils'
import { XIcon } from './Icons'
import { t } from '../i18n'

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
          <div className="ame-kicker">{t('ame_ambient_mode')}</div>
          <div className="ame-h">{t('ame_customize')}</div>
        </div>
        <button className="ame-close" onClick={onClose} aria-label={t('ame_close_customization')}>
          <XIcon size={15} />
        </button>
      </header>

      <div className="ame-body">
        <Section title={t('ame_look')}>
          <Seg
            label={t('ame_theme')}
            value={cfg.theme}
            options={[
              { id: 'app', label: t('ame_match_app') },
              { id: 'light', label: t('ame_light') },
              { id: 'dark', label: t('ame_dark') },
            ]}
            onChange={set('theme')}
          />
          <Slider label={t('ame_background_glow')} value={cfg.glow} min={0} max={200} unit="%" onChange={set('glow')} />
          <Slider label={t('ame_card_corners')} value={cfg.radius} min={0} max={40} onChange={set('radius')} />
        </Section>

        <Section title={t('ame_clock')}>
          <Slider label={t('ame_size')} value={cfg.clockSize} min={160} max={900} onChange={set('clockSize')} />
          <Seg
            label={t('ame_dial')}
            value={cfg.clockFace}
            options={[
              { id: 'minimal', label: t('ame_minimal') },
              { id: 'classic', label: t('ame_classic') },
              { id: 'numerals', label: t('ame_numerals') },
            ]}
            onChange={set('clockFace')}
          />
          <Seg
            label={t('ame_second_hand')}
            value={cfg.seconds}
            options={[
              { id: 'sweep', label: t('ame_sweep') },
              { id: 'tick', label: t('ame_tick') },
              { id: 'off', label: t('ame_off') },
            ]}
            onChange={set('seconds')}
          />
          <Toggle label={t('ame_date')} value={cfg.showDate} onChange={set('showDate')} />
          <Toggle label={t('ame_digital_time')} value={cfg.showDigital} onChange={set('showDigital')} />
        </Section>

        <Section title={t('ame_layout')}>
          <Seg
            label={t('ame_clock_side')}
            value={cfg.side}
            options={[
              { id: 'left', label: t('ame_left') },
              { id: 'right', label: t('ame_right') },
            ]}
            onChange={set('side')}
          />
          <Seg
            label={t('ame_columns')}
            value={cfg.columns}
            options={[
              { id: 'both', label: t('ame_todo_done') },
              { id: 'todo', label: t('ame_todo_only') },
            ]}
            onChange={set('columns')}
          />
          <Slider label={t('ame_edge_padding')} value={cfg.padding} min={0} max={200} onChange={set('padding')} />
          <Slider label={t('ame_clock_tasks_gap')} value={cfg.gap} min={0} max={300} onChange={set('gap')} />
          <Slider label={t('ame_task_text')} value={cfg.rowSize} min={12} max={48} onChange={set('rowSize')} />
          <Slider label={t('ame_max_rows')} value={cfg.maxRows} min={3} max={25} unit="" onChange={set('maxRows')} />
          <Toggle label={t('ame_quick_add_n')} value={cfg.quickAdd} onChange={set('quickAdd')} />
          <Toggle label={t('ame_greeting')} value={cfg.showGreeting} onChange={set('showGreeting')} />
          <Toggle label={t('ame_progress_bar')} value={cfg.showProgress} onChange={set('showProgress')} />
        </Section>

        <Section title={t('ame_widgets')}>
          <Seg label={t('ame_slot_1')} value={cfg.widget1} options={AMBIENT_WIDGETS} onChange={set('widget1')} />
          <Seg label={t('ame_slot_2')} value={cfg.widget2} options={AMBIENT_WIDGETS} onChange={set('widget2')} />
          <p className="ame-hint">{t('ame_a_widget_with_nothing_to_show_no_focus_running_no_streak_yet_stays_hidden')}</p>
        </Section>

        <Section title={t('ame_ember')}>
          <Toggle label={t('ame_show_ember')} value={cfg.showEmber} onChange={set('showEmber')} />
          <Slider label={t('ame_size')} value={cfg.emberSize} min={48} max={320} onChange={set('emberSize')} />
          <Seg
            label={t('ame_corner')}
            value={cfg.emberCorner}
            options={[
              { id: 'left', label: t('ame_bottom_left') },
              { id: 'right', label: t('ame_bottom_right') },
            ]}
            onChange={set('emberCorner')}
          />
          <Toggle label={t('ame_eyes_follow_cursor')} value={cfg.emberEyes} onChange={set('emberEyes')} />
        </Section>

        <Section title={t('ame_night')}>
          <Seg
            label={t('ame_night_mode')}
            value={cfg.night}
            options={[
              { id: 'off', label: t('ame_off') },
              { id: 'dim', label: t('ame_dim') },
              { id: 'dark', label: t('ame_dim_dark') },
            ]}
            onChange={set('night')}
          />
          <div className="ame-row">
            <span className="ame-label">{t('ame_from_to')}</span>
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
          <Slider label={t('ame_dim_brightness')} value={cfg.nightLevel} min={15} max={100} unit="%" onChange={set('nightLevel')} />
        </Section>

        <Section title={t('ame_screen_care')}>
          <Slider label={t('ame_burn_in_drift')} value={cfg.drift} min={0} max={40} onChange={set('drift')} />
          <p className="ame-hint">{t('ame_nudges_everything_by_up_to_this_many_pixels_every_3_minutes_0_turns_it_off')}</p>
        </Section>
      </div>

      <footer className="ame-foot">
        <button className="ame-reset" onClick={onReset}>
          {t('ame_reset_to_defaults')}
        </button>
        <span className="ame-saved">{t('ame_saved_automatically')}</span>
      </footer>
    </motion.aside>
  )
}
