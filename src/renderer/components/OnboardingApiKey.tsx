import { useState } from 'react'
import { Key } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  onNext: (apiKey: string, provider: string) => void
  onSkip: () => void
}

export function OnboardingApiKey({ onNext, onSkip }: Props) {
  const { t } = useTranslation('common')
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState('bedrock')

  const handleContinue = () => {
    onNext(apiKey, provider)
  }

  return (
    <div className="onboarding-step">
      <div className="onboarding-icon">
        <Key size={48} strokeWidth={1.5} />
      </div>
      <h1 className="onboarding-title">{t('onboarding.configureAiTitle')}</h1>
      <p className="onboarding-description">{t('onboarding.configureAiDescription')}</p>

      <div className="onboarding-form">
        <label className="onboarding-label">{t('onboarding.providerLabel')}</label>
        <select className="onboarding-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="bedrock">{t('onboarding.providerBedrock')}</option>
          <option value="openai">{t('onboarding.providerOpenai')}</option>
          <option value="gemini">{t('onboarding.providerGemini')}</option>
          <option value="grok">{t('onboarding.providerGrok')}</option>
          <option value="local">{t('onboarding.providerLocal')}</option>
        </select>

        {provider !== 'local' && (
          <>
            <label className="onboarding-label">{t('onboarding.apiKeyLabel')}</label>
            <input
              type="password"
              className="onboarding-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === 'bedrock'
                  ? t('onboarding.apiKeyPlaceholderBedrock')
                  : provider === 'openai'
                    ? t('onboarding.apiKeyPlaceholderOpenai')
                    : provider === 'gemini'
                      ? t('onboarding.apiKeyPlaceholderGemini')
                      : t('onboarding.apiKeyPlaceholderGrok')
              }
            />
          </>
        )}

        {provider === 'local' && (
          <>
            <label className="onboarding-label">{t('onboarding.endpointLabel')}</label>
            <input
              type="text"
              className="onboarding-input"
              value="http://localhost:1234"
              disabled
              placeholder="http://localhost:1234"
            />
            <p className="onboarding-hint">{t('onboarding.localHint')}</p>
          </>
        )}
      </div>

      <div className="onboarding-actions">
        <button type="button" className="onboarding-btn-secondary" onClick={onSkip}>
          {t('onboarding.configureLater')}
        </button>
        <button
          type="button"
          className="onboarding-btn-primary"
          onClick={handleContinue}
          disabled={provider !== 'local' && !apiKey.trim()}
        >
          {t('onboarding.continue')}
        </button>
      </div>
    </div>
  )
}
