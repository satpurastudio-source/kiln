import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { isStandalone, isIOS, canPromptInstall, onInstallChange, promptInstall } from '../pwa'
import { DownloadIcon, ShareIcon } from './Icons'

// "Put kiln on your home screen" — phones only, hidden once installed.
// Android/Chrome gets a real Install button; iOS has no install API, so it
// gets the Share → Add to Home Screen steps; other phone browsers get a
// generic pointer to their menu.

const isPhone = () => window.matchMedia('(max-width: 860px) and (pointer: coarse)').matches

export default function InstallHint() {
  const [, rerender] = useState(0)
  const [installed, setInstalled] = useState(false)
  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), [])

  if (installed || isStandalone() || !isPhone()) return null

  const ios = isIOS()
  const canPrompt = canPromptInstall()

  return (
    <motion.div
      className="onb-install"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="onb-install-head">
        <span className="onb-install-icon">
          <DownloadIcon size={14} />
        </span>
        <span>
          <b>Put kiln on your home screen</b>
          <span className="onb-install-sub">Opens full-screen like an app and updates itself.</span>
        </span>
      </div>
      {canPrompt ? (
        <button
          className="btn ghost onb-install-btn"
          onClick={async () => {
            if (await promptInstall()) setInstalled(true)
          }}
        >
          Install kiln
        </button>
      ) : ios ? (
        <p className="onb-install-steps">
          Tap <ShareIcon size={13} className="onb-install-glyph" /> <b>Share</b> in Safari, then{' '}
          <b>Add to Home Screen</b>.
        </p>
      ) : (
        <p className="onb-install-steps">
          Open your browser menu <b>⋮</b> and choose <b>Add to Home screen</b> or <b>Install app</b>.
        </p>
      )}
    </motion.div>
  )
}
