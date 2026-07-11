import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initI18n } from './i18n'
import './styles/global.css'

async function bootstrap() {
  try {
    const settings = await window.electronAPI.getSettings()
    initI18n(settings?.language)
  } catch {
    initI18n() // fallback to pt-BR
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap()
