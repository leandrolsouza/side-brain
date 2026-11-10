import { useEffect, useState } from 'react'
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
      if (result.status === 'available' && result.info?.version) {
        setUpdateVersion(result.info.version)
        setUpdateState('available')
      } else if (result.status === 'error') {
        setUpdateState('error')
      } else {
        setUpdateState('not-available')
      }
    } catch {
      setUpdateState('error')
    }
  }

  if (!isOpen) return null

  const techItems = ['Electron 43', 'React 19', 'TypeScript 7', 'Vite 8', 'SQLite', 'Multi-AI']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content about-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="about-close" onClick={onClose} title={t('close')}>
          <X size={18} />
        </button>

        <div className="about-body">
          <div className="about-hero">
            <div className="about-logo">
              <img src={logo} alt="SideBrain" width={72} height={72} />
            </div>
            <h1 className="about-title">SideBrain</h1>
            <p className="about-version">v{version || '...'}</p>
          </div>

          <div className="about-update-section">
            {updateState === 'idle' && (
              <button type="button" className="about-check-update-btn" onClick={handleCheckUpdates}>
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
              <span className="about-update-status about-update-error">{t('about.checkError')}</span>
            )}
          </div>

          <p className="about-description">{t('about.description')}</p>

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
            <div className="about-tech-badges">
              {techItems.map((item) => (
                <span key={item} className="about-tech-badge">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="about-divider" />

          <div className="about-author">
            <p className="about-author-name">Leandro Souza</p>
            <div className="about-author-links">
              <a
                href="https://www.linkedin.com/in/leandrolsouza/"
                target="_blank"
                rel="noopener noreferrer"
                className="about-social-btn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
              <a
                href="https://github.com/leandrolsouza/"
                target="_blank"
                rel="noopener noreferrer"
                className="about-social-btn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>

          <div className="about-footer">
            <p>{t('about.copyright')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
