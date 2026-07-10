import React from 'react'
import { Brain, Download } from 'lucide-react'

interface Props {
  onNewUser: () => void
  onImport: () => void
}

export function OnboardingWelcome({ onNewUser, onImport }: Props) {
  return (
    <div className="onboarding-step">
      <div className="onboarding-icon">
        <Brain size={64} strokeWidth={1.5} />
      </div>
      <h1 className="onboarding-title">Bem-vindo ao SideBrain</h1>
      <p className="onboarding-description">
        Organize suas anotações de trabalho com inteligência artificial.
        Capture pensamentos rápidos durante o dia e deixe a IA categorizar,
        reescrever e transformar em ações.
      </p>

      <div className="onboarding-paths">
        <button className="onboarding-path-card" onClick={onNewUser}>
          <span className="onboarding-path-emoji">🚀</span>
          <h3>Começar do zero</h3>
          <p>Configurar o app pela primeira vez</p>
        </button>

        <button className="onboarding-path-card" onClick={onImport}>
          <span className="onboarding-path-icon">
            <Download size={24} strokeWidth={1.5} />
          </span>
          <h3>Já uso o SideBrain</h3>
          <p>Importar minha base de outra máquina</p>
        </button>
      </div>
    </div>
  )
}
