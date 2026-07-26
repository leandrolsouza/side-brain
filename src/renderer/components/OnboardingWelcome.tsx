import { Brain, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  onNewUser: () => void
  onImport: () => void
}

export function OnboardingWelcome({ onNewUser, onImport }: Props) {
  const { t } = useTranslation('common')

  return (
    <div className="onboarding-step">
      <div className="onboarding-icon">
        <Brain size={64} strokeWidth={1.5} />
      </div>
      <h1 className="onboarding-title">{t('onboarding.welcomeTitle')}</h1>
      <p className="onboarding-description">{t('onboarding.welcomeDescription')}</p>

      <div className="onboarding-paths">
        <button type="button" className="onboarding-path-card" onClick={onNewUser}>
          <span className="onboarding-path-emoji">🚀</span>
          <h3>{t('onboarding.startFromScratch')}</h3>
          <p>{t('onboarding.startFromScratchDesc')}</p>
        </button>

        <button type="button" className="onboarding-path-card" onClick={onImport}>
          <span className="onboarding-path-icon">
            <Download size={24} strokeWidth={1.5} />
          </span>
          <h3>{t('onboarding.alreadyUse')}</h3>
          <p>{t('onboarding.alreadyUseDesc')}</p>
        </button>
      </div>
    </div>
  )
}
