import { motion } from 'framer-motion'
import { t } from '../i18n'

const STATES = {
  search: { icon: '🔍' },
  today: { icon: '✨' },
  upcoming: { icon: '🌅' },
  all: { icon: '🪐' },
  project: { icon: '🎯' },
}

export default function EmptyState({ kind }) {
  const k = STATES[kind] ? kind : 'all'
  const s = STATES[k]
  return (
    <motion.div
      className="empty"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="orb"
        animate={{ y: [0, -9, 0], rotate: [0, 4, -4, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {s.icon}
      </motion.div>
      <h3>{t(`empty_${k}_title`)}</h3>
      <p>{t(`empty_${k}_body`)}</p>
    </motion.div>
  )
}
