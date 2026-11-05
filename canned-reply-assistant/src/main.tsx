import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@vibe/core/tokens'
import './styles.scss'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
