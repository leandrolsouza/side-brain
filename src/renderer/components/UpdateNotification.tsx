import React, { useEffect, useState } from 'react'
import { Download, RefreshCw, CheckCircle, XCircle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  info?: { version?: string }
  progress?: { percent?: number }
  error?: string
}

export function UpdateNotification() {
  const { t } = useTranslation('common')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Listen for status changes from main process
    window.electronAPI.onUpdateStatusChanged((status: UpdateStatus) => {
      setUpdateStatus(status)
      setDismissed(false)
    })

    // Check initial status
    window.electronAPI.getUpdateStatus().then((status: UpdateStatus) => {
      if (status.status !== 'not-available') {
        setUpdateStatus(status)
      }
    })
  }, [])

  if (!updateStatus || dismissed) return null
  if (updateStatus.status === 'not-available' || updateStatus.status === 'checking') return null

  const handleDownload = async () => {
    await window.electronAPI.downloadUpdate()
  }

  const handleInstall = () => {
    window.electronAPI.quitAndInstall()
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  return (
    <div className="update-notification">
      {updateStatus.status === 'available' && (
        <>
          <div className="update-notification-content">
            <Download size={16} />
            <span>
              {t('update.available', { version: updateStatus.info?.version })}
            </span>
          </div>
          <div className="update-notification-actions">
            <button className="update-btn update-btn-primary" onClick={handleDownload}>
              {t('update.download')}
            </button>
            <button className="update-btn update-btn-dismiss" onClick={handleDismiss}>
              <X size={14} />
            </button>
          </div>
        </>
      )}

      {updateStatus.status === 'downloading' && (
        <>
          <div className="update-notification-content">
            <RefreshCw size={16} className="update-spinner" />
            <span>{t('update.downloading')}</span>
          </div>
          {updateStatus.progress?.percent != null && (
            <div className="update-progress-bar">
              <div
                className="update-progress-fill"
                style={{ width: `${Math.round(updateStatus.progress.percent)}%` }}
              />
            </div>
          )}
        </>
      )}

      {updateStatus.status === 'downloaded' && (
        <>
          <div className="update-notification-content">
            <CheckCircle size={16} />
            <span>{t('update.ready')}</span>
          </div>
          <div className="update-notification-actions">
            <button className="update-btn update-btn-primary" onClick={handleInstall}>
              {t('update.install')}
            </button>
            <button className="update-btn update-btn-dismiss" onClick={handleDismiss}>
              <X size={14} />
            </button>
          </div>
        </>
      )}

      {updateStatus.status === 'error' && (
        <>
          <div className="update-notification-content">
            <XCircle size={16} />
            <span>{t('update.error', { error: updateStatus.error })}</span>
          </div>
          <button className="update-btn update-btn-dismiss" onClick={handleDismiss}>
            <X size={14} />
          </button>
        </>
      )}
    </div>
  )
}
