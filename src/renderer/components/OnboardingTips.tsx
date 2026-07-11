import React from 'react'
import { Keyboard, Sparkles, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  onFinish: () => void
}

export function OnboardingTips({ onFinish }: Props) {
  const { t } = useTranslation('common')

  return (
    <div className="onboarding-step">
      <h1 className="onboarding-title">{t('onboarding.tipsTitle')}</h1>
      <p className="onboarding-description">
        {t('onboarding.tipsDescription')}
      </p>

      <div className="onboarding-tips-grid">
        <div className="onboarding-tip-card">
          <div className="onboarding-tip-icon">
            <Keyboard size={28} strokeWidth={1.5} />
          </div>
          <h3>{t('onboarding.tipGlobalCapture')}</h3>
          <p dangerouslySetInnerHTML={{ __html: t('onboarding.tipGlobalCaptureDesc') }} />
        </div>

        <div className="onboarding-tip-card">
          <div className="onboarding-tip-icon">
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <h3>{t('onboarding.tipAutoAi')}</h3>
          <p>{t('onboarding.tipAutoAiDesc')}</p>
        </div>

        <div className="onboarding-tip-card">
          <div className="onboarding-tip-icon">
            <Inbox size={28} strokeWidth={1.5} />
          </div>
          <h3>{t('onboarding.tipQuickSearch')}</h3>
          <p dangerouslySetInnerHTML={{ __html: t('onboarding.tipQuickSearchDesc') }} />
        </div>
      </div>

      <button className="onboarding-btn-primary" onClick={onFinish}>
        {t('onboarding.startUsing')}
      </button>
    </div>
  )
}
