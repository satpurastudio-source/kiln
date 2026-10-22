import { motion } from 'framer-motion'

const STATES = {
  search: { icon: '🔍', title: 'No matches', body: 'Nothing fits that search. Try different words.' },
  today: { icon: '✨', title: 'All clear', body: 'Nothing due today. Enjoy it — or add something in the bar above.' },
  upcoming: { icon: '🌅', title: 'A blank horizon', body: 'No scheduled tasks ahead. Add a due date to a task to see it here.' },
  all: { icon: '🪐', title: 'A fresh start', body: 'No tasks yet. Write your first one in the bar above.' },
  project: { icon: '🎯', title: 'Nothing here yet', body: 'This folder is empty. Add its first task in the bar above.' },
}

export default function EmptyState({ kind }) {
  const s = STATES[kind] ?? STATES.all
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
      <h3>{s.title}</h3>
      <p>{s.body}</p>
    </motion.div>
  )
}
