import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { onDrag } from '../store'
import { DROP_ZONE_HEIGHT } from './TaskItem'
import { FlameIcon } from './Icons'

// Invisible until a task is being dragged — then rises from the bottom.
// Drop a task inside to complete it.
export default function CompleteZone() {
  const [visible, setVisible] = useState(false)
  const [hot, setHot] = useState(false)

  useEffect(
    () =>
      onDrag((evt) => {
        if (evt.phase === 'start') setVisible(true)
        else if (evt.phase === 'end') {
          setVisible(false)
          setHot(false)
        } else if (evt.phase === 'move') {
          setHot(evt.y > window.innerHeight - DROP_ZONE_HEIGHT)
        }
      }),
    []
  )

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`complete-zone ${hot ? 'hot' : ''}`}
          initial={{ y: DROP_ZONE_HEIGHT + 20 }}
          animate={{ y: 0 }}
          exit={{ y: DROP_ZONE_HEIGHT + 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <motion.div
            className="complete-zone-inner"
            animate={hot ? { scale: 1.04 } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <motion.span
              className="cz-flame"
              animate={hot ? { scale: [1, 1.25, 1], rotate: [0, -6, 6, 0] } : {}}
              transition={{ duration: 0.7, repeat: hot ? Infinity : 0 }}
            >
              <FlameIcon size={20} />
            </motion.span>
            {hot ? 'Release to complete' : 'Drop here to complete'}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
