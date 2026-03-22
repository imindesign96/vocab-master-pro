import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './anki.css'
import AnkiApp from './AnkiApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnkiApp />
  </StrictMode>,
)
