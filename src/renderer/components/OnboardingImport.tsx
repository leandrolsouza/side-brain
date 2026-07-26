import { useState } from 'react'
import { Database, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  onComplete: () => void
  onBack: () => void
}

export function OnboardingImport({ onComplete, onBack }: Props) {
  const { t } = useTranslation('common')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleImport = async () => {
    try {
      const result = await window.electronAPI.importBackupForOnboarding()
      if (result.success) {
        setStatus('success')
      } else if (result.error && result.error !== 'Operação cancelada.') {
        setStatus('error')
        setErrorMessage(result.error)
      }
      // If cancelled, stay on same screen (idle)
    } catch (err: any) {
      setStatus('error')
      setErrorMessage(err?.message || t('onboarding.importError'))
    }
  }

  if (status === 'success') {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon onboarding-icon-success">
          <CheckCircle size={56} strokeWidth={1.5} />
        </div>
        <h1 className="onboarding-title">{t('onboarding.importSuccessTitle')}</h1>
        <p className="onboarding-description">{t('onboarding.importSuccessDescription')}</p>
        <button type="button" className="onboarding-btn-primary" onClick={onComplete}>
          {t('onboarding.restartApp')}
        </button>
      </div>
    )
  }

  return (
    <div className="onboarding-step">
      <div className="onboarding-icon">
        <Database size={48} strokeWidth={1.5} />
      </div>
      <h1 className="onboarding-title">{t('onboarding.importTitle')}</h1>
      <p className="onboarding-description">{t('onboarding.importDescription')}</p>

      {status === 'error' && (
        <div className="onboarding-error">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="onboarding-actions">
        <button type="button" className="onboarding-btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          {t('onboarding.back')}
        </button>
        <button type="button" className="onboarding-btn-primary" onClick={handleImport}>
          {t('onboarding.selectDbFile')}
        </button>
      </div>

      <p className="onboarding-hint" style={{ marginTop: '16px' }}>
        {t('onboarding.importHint')}
      </p>
    </div>
  )
}
