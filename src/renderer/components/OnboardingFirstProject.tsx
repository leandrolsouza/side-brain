import type React from 'react'
import { useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  onNext: (projectName: string) => void
  onSkip: () => void
}

export function OnboardingFirstProject({ onNext, onSkip }: Props) {
  const { t } = useTranslation('common')
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
      <h1 className="onboarding-title">{t('onboarding.firstProjectTitle')}</h1>
      <p className="onboarding-description">{t('onboarding.firstProjectDescription')}</p>

      <div className="onboarding-form">
        <label className="onboarding-label">{t('onboarding.projectNameLabel')}</label>
        <input
          type="text"
          className="onboarding-input"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('onboarding.projectNamePlaceholder')}
          autoFocus
        />
        <p className="onboarding-hint">{t('onboarding.projectNameHint')}</p>
      </div>

      <div className="onboarding-actions">
        <button type="button" className="onboarding-btn-secondary" onClick={onSkip}>
          {t('onboarding.skip')}
        </button>
        <button type="button" className="onboarding-btn-primary" onClick={handleCreate} disabled={!projectName.trim()}>
          {t('onboarding.createProject')}
        </button>
      </div>
    </div>
  )
}
