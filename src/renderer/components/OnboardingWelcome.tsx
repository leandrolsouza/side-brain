import React from 'react'
import { Brain } from 'lucide-react'

interface Props {
  onNext: () => void
}

export function OnboardingWelcome({ onNext }: Props) {
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
      <div className="onboarding-features">
        <div className="onboarding-feature-item">
          <span className="onboarding-feature-emoji">⚡</span>
          <span>Captura rápida de texto livre</span>
        </div>
        <div className="onboarding-feature-item">
          <span className="onboarding-feature-emoji">🤖</span>
          <span>Categorização automática por IA</span>
        </div>
        <div className="onboarding-feature-item">
          <span className="onboarding-feature-emoji">📋</span>
          <span>Tarefas e projetos organizados</span>
        </div>
      </div>
      <button className="onboarding-btn-primary" onClick={onNext}>
        Começar
      </button>
    </div>
  )
}
