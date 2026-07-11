import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, RefreshCw, CheckCircle, Download } from 'lucide-react'
import logo from '../assets/logo.png'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

type UpdateCheckState = 'idle' | 'checking' | 'available' | 'not-available' | 'error'

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const { t } = useTranslation('common')
  const [version, setVersion] = useState<string>('')
  const [updateState, setUpdateState] = useState<UpdateCheckState>('idle')
  const [updateVersion, setUpdateVersion] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      window.electronAPI.getAppVersion().then(setVersion)
      setUpdateState('idle')
    }
  }, [isOpen])

  const handleCheckUpdates = async () => {
    setUpdateState('checking')
    try {
      const result = await window.electronAPI.checkForUpdates()
      if (result?.updateInfo?.version && result.updateInfo.version !== version) {
        setUpdateVersion(result.updateInfo.version)
        setUpdateState('available')
      } else {
        setUpdateState('not-available')
      }
    } catch {
      setUpdateState('error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('about.title')}</h2>
          <button className="modal-close" onClick={onClose} title={t('close')}>
            <X size={18} />
          </button>
        </div>

        <div className="about-body">
          <div className="about-logo">
            <img src={logo} alt="SideBrain" width={64} height={64} />
          </div>

          <h1 className="about-title">SideBrain</h1>
          <p className="about-version">{t('about.version', { version: version || '...' })}</p>

          <div className="about-update-section">
            {updateState === 'idle' && (
              <button className="about-check-update-btn" onClick={handleCheckUpdates}>
                <RefreshCw size={14} />
                {t('about.checkUpdates')}
              </button>
            )}
            {updateState === 'checking' && (
              <span className="about-update-status">
                <RefreshCw size={14} className="update-spinner" />
                {t('about.checking')}
              </span>
            )}
            {updateState === 'not-available' && (
              <span className="about-update-status about-update-ok">
                <CheckCircle size={14} />
                {t('about.upToDate')}
              </span>
            )}
            {updateState === 'available' && (
              <span className="about-update-status about-update-available">
                <Download size={14} />
                {t('about.newVersion', { version: updateVersion })}
              </span>
            )}
            {updateState === 'error' && (
              <span className="about-update-status about-update-error">
                {t('about.checkError')}
              </span>
            )}
          </div>

          <p className="about-description">
            {t('about.description')}
          </p>

          <div className="about-features">
            <div className="about-feature-item">
              <strong>{t('about.featureCapture')}</strong>
              <span>{t('about.featureCaptureDesc')}</span>
            </div>
            <div className="about-feature-item">
              <strong>{t('about.featureProjects')}</strong>
              <span>{t('about.featureProjectsDesc')}</span>
            </div>
            <div className="about-feature-item">
              <strong>{t('about.featureDigest')}</strong>
              <span>{t('about.featureDigestDesc')}</span>
            </div>
            <div className="about-feature-item">
              <strong>{t('about.featureMeeting')}</strong>
              <span>{t('about.featureMeetingDesc')}</span>
            </div>
          </div>

          <div className="about-tech">
            <p className="about-tech-label">{t('about.builtWith')}</p>
            <p className="about-tech-stack">
              Electron 43 &middot; React 19 &middot; TypeScript &middot; SQLite &middot; AWS Bedrock (Claude)
            </p>
          </div>

          <div className="about-footer">
            <p>{t('about.copyright')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
