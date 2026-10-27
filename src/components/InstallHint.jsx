import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { isStandalone, isIOS, canPromptInstall, onInstallChange, promptInstall } from '../pwa'
import { DownloadIcon, ShareIcon } from './Icons'
import { useT } from '../i18n'

// "Put kiln on your home screen" — phones only, hidden once installed.
// Android/Chrome gets a real Install button; iOS has no install API, so it
// gets the Share → Add to Home Screen steps; other phone browsers get a
// generic pointer to their menu.

const isPhone = () => window.matchMedia('(max-width: 860px) and (pointer: coarse)').matches

export default function InstallHint() {
  const [, rerender] = useState(0)
  const [installed, setInstalled] = useState(false)
  const t = useT()
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
          <b>{t('installTitle')}</b>
          <span className="onb-install-sub">{t('installSub')}</span>
        </span>
      </div>
      {canPrompt ? (
        <button
          className="btn ghost onb-install-btn"
          onClick={async () => {
            if (await promptInstall()) setInstalled(true)
          }}
        >
          {t('installBtn')}
        </button>
      ) : ios ? (
        <p className="onb-install-steps">
          {t('iosSteps').split('{icon}').flatMap((part, i) =>
            i ? [<ShareIcon key={i} size={13} className="onb-install-glyph" />, part] : [part],
          )}
        </p>
      ) : (
        <p className="onb-install-steps">
          {t('otherSteps')}
        </p>
      )}
    </motion.div>
  )
}
