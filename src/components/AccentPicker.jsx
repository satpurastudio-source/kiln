import { useState } from 'react'
import { ACCENTS } from '../utils'

const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v)

// Preset accent swatches + a custom color well. The native color well and the
// hex field only update a LOCAL draft (no app-wide retint each tick — that was
// the lag); the choice applies to the whole app when you press Apply.
export default function AccentPicker({ settings, dispatch, className = '' }) {
  const set = (patch) => dispatch({ type: 'SET_SETTINGS', patch })
  const isCustom = settings.accent === 'custom'
  const [draft, setDraft] = useState(settings.customAccent || '#d85a30')

  const applied = isCustom ? (settings.customAccent || '').toLowerCase() : ''
  const pending = isHex(draft) && draft.toLowerCase() !== applied
  const apply = () => pending && set({ accent: 'custom', customAccent: draft.toLowerCase() })

  return (
    <div className={`accent-row ${className}`}>
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          className={`accent-swatch ${settings.accent === a.id ? 'on' : ''}`}
          style={{ background: a.accent, color: a.accent }}
          title={a.name}
          aria-label={a.name}
          onClick={() => set({ accent: a.id })}
        />
      ))}

      <div className="accent-custom-wrap">
        {/* visible, directly clickable color well (shows the draft color) */}
        <input
          type="color"
          className={`accent-color-input ${isCustom ? 'on' : ''}`}
          value={isHex(draft) ? draft : '#d85a30'}
          onChange={(e) => setDraft(e.target.value)}
          title="Pick a custom color"
          aria-label="Pick a custom color"
        />
        <input
          type="text"
          className="accent-hex"
          value={draft}
          maxLength={7}
          spellCheck={false}
          placeholder="#hex"
          onChange={(e) => {
            let v = e.target.value.trim()
            if (v && !v.startsWith('#')) v = '#' + v
            setDraft(v)
          }}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
        />
        <button
          className="btn primary accent-apply"
          onClick={apply}
          disabled={!pending}
          style={{ opacity: pending ? 1 : 0.45 }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
