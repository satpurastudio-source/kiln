import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App'
import { initPWA } from './pwa'
import './index.css'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <StoreProvider>
      <App />
    </StoreProvider>
  </ErrorBoundary>
)

initPWA()
