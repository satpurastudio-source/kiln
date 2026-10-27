import { Component } from 'react'
import { t } from '../i18n'

// Last line of defense: a crash anywhere renders a friendly recovery screen
// instead of unmounting to a blank page.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[kiln] crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        style={{
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          textAlign: 'center',
          fontFamily: "'Figtree', system-ui, sans-serif",
        }}
      >
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔥</div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, marginBottom: 8 }}>
            {t('crashTitle')}
          </h1>
          <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 20 }}>
            {String(this.state.error?.message ?? this.state.error)}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 22px',
              borderRadius: 10,
              border: 'none',
              background: '#d85a30',
              color: '#f4efe6',
              fontSize: 13,
              cursor: 'pointer',
              marginRight: 10,
            }}
          >
            {t('reload')}
          </button>
          <button
            onClick={() => {
              // last resort — and it erases tasks that may not have synced,
              // so save a copy to the device before wiping anything
              if (!window.confirm(t('resetConfirm'))) return
              try {
                const raw = localStorage.getItem('zenith-v1')
                if (raw) {
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
                  a.download = `kiln-local-backup-${Date.now()}.json`
                  document.body.appendChild(a)
                  a.click()
                }
                localStorage.removeItem('zenith-v1')
                if (raw) localStorage.setItem(`zenith-v1-unreadable-${Date.now()}`, raw)
              } catch {
                /* ignore */
              }
              setTimeout(() => window.location.reload(), 600)
            }}
            style={{
              padding: '10px 22px',
              borderRadius: 10,
              border: '1px solid rgba(128,128,128,0.4)',
              background: 'transparent',
              color: 'inherit',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t('resetLocal')}
          </button>
        </div>
      </div>
    )
  }
}
