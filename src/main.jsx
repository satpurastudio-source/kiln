import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App'
import { initPWA } from './pwa'
import { initViewport } from './viewport'
import './index.css'

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
