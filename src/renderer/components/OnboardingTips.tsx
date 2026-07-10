import React from 'react'
import { Keyboard, Sparkles, Inbox } from 'lucide-react'

interface Props {
  onFinish: () => void
}

export function OnboardingTips({ onFinish }: Props) {
  return (
    <div className="onboarding-step">
      <h1 className="onboarding-title">Dicas rápidas</h1>
      <p className="onboarding-description">
        Pronto! Aqui estão algumas dicas para aproveitar ao máximo o SideBrain.
      </p>

      <div className="onboarding-tips-grid">
        <div className="onboarding-tip-card">
          <div className="onboarding-tip-icon">
            <Keyboard size={28} strokeWidth={1.5} />
          </div>
          <h3>Captura global</h3>
          <p>Use <kbd>Ctrl+Shift+Space</kbd> para capturar de qualquer lugar, mesmo com o app minimizado.</p>
        </div>

        <div className="onboarding-tip-card">
          <div className="onboarding-tip-icon">
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <h3>IA automática</h3>
          <p>Suas entradas são categorizadas automaticamente em projetos, tipos e ações.</p>
        </div>

        <div className="onboarding-tip-card">
          <div className="onboarding-tip-icon">
            <Inbox size={28} strokeWidth={1.5} />
          </div>
          <h3>Busca rápida</h3>
          <p>Pressione <kbd>Ctrl+K</kbd> para buscar entradas, tarefas e projetos instantaneamente.</p>
        </div>
      </div>

      <button className="onboarding-btn-primary" onClick={onFinish}>
        Começar a usar
      </button>
    </div>
  )
}
