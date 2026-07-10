import React, { useState } from 'react'
import { FolderPlus } from 'lucide-react'

interface Props {
  onNext: (projectName: string) => void
  onSkip: () => void
}

export function OnboardingFirstProject({ onNext, onSkip }: Props) {
  const [projectName, setProjectName] = useState('')

  const handleCreate = () => {
    if (projectName.trim()) {
      onNext(projectName.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && projectName.trim()) {
      handleCreate()
    }
  }

  return (
    <div className="onboarding-step">
      <div className="onboarding-icon">
        <FolderPlus size={48} strokeWidth={1.5} />
      </div>
      <h1 className="onboarding-title">Seu primeiro projeto</h1>
      <p className="onboarding-description">
        Projetos agrupam suas entradas e tarefas por contexto.
        Pode ser o nome de um cliente, equipe, produto ou qualquer tema do seu trabalho.
      </p>

      <div className="onboarding-form">
        <label className="onboarding-label">Nome do projeto</label>
        <input
          type="text"
          className="onboarding-input"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: Projeto Alpha, Marketing Q3, App Mobile..."
          autoFocus
        />
        <p className="onboarding-hint">
          Não se preocupe, a IA também pode criar projetos automaticamente a partir das suas entradas.
        </p>
      </div>

      <div className="onboarding-actions">
        <button className="onboarding-btn-secondary" onClick={onSkip}>
          Pular
        </button>
        <button
          className="onboarding-btn-primary"
          onClick={handleCreate}
          disabled={!projectName.trim()}
        >
          Criar projeto
        </button>
      </div>
    </div>
  )
}
