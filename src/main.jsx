import { createRoot } from 'react-dom/client'
import { StoreProvider, STORAGE_KEY } from './store'
import { isNative } from './native'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App'
import { initPWA } from './pwa'
import { initViewport } from './viewport'
import './index.css'

// First-time visitors to the bare address see the landing page first.
// Anyone with kiln data, an installed app, an email-link query (?verified,
// ?reset…) or who already came through the landing page goes straight in.
function firstVisit() {
  if (import.meta.env.DEV || isNative) return false
  if (window.location.search || window.location.hash) return false
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return false
  try {
    return !localStorage.getItem(STORAGE_KEY) && !localStorage.getItem('kiln-visited')
  } catch {
    return false
  }
}

if (firstVisit()) {
  window.location.replace('welcome/')
} else {
  // before first render so nothing lays out against the wrong height
  initViewport()

  createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  )

  initPWA()
}
