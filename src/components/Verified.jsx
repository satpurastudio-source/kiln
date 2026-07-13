import { useEffect } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useStore } from '../store'
import { playFanfare } from '../sound'
import { APP_NAME } from '../brand'

export default function Verified({ onDone }) {
  const { state } = useStore()
  const signedIn = !!state.profile

  useEffect(() => {
    const t = setTimeout(() => {
      playFanfare()
      const colors = ['#d85a30', '#d9a441', '#f4efe6']
      confetti({ particleCount: 90, spread: 75, origin: { x: 0.5, y: 0.6 }, colors, scalar: 0.9 })
      setTimeout(() => {
        confetti({ particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors })
        confetti({ particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors })
      }, 200)
    }, 700)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="login-screen">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="verified-badge">
          <svg viewBox="0 0 64 64" fill="none">
            <motion.circle
              cx="32"
              cy="32"
              r="29"
              stroke="#d85a30"
              strokeWidth="3"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay: 0.2 }}
            />
            <motion.path
              d="M20 33.5 L28.5 42 L45 24"
              stroke="#d85a30"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1], delay: 0.75 }}
            />
          </svg>
        </div>

        <div className="reveal-wrap">
          <motion.h1
            className="login-title"
            style={{ fontSize: 42 }}
            initial={{ y: '108%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
          >
            Email verified<span className="dot">.</span>
          </motion.h1>
        </div>

        <motion.p
          className="login-sub"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
        >
          {signedIn
            ? `welcome to ${APP_NAME} — your account is ready`
            : 'your account is ready — sign in to continue'}
        </motion.p>

        <motion.button
          className="btn primary login-btn"
          onClick={onDone}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
        >
          {signedIn ? `Enter ${APP_NAME} →` : 'Sign in →'}
        </motion.button>
      </motion.div>
    </div>
  )
}
