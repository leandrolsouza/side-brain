import React, { useEffect, useState } from 'react'
import { Download, RefreshCw, CheckCircle, XCircle, X } from 'lucide-react'

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  info?: { version?: string }
  progress?: { percent?: number }
  error?: string
}

export function UpdateNotification() {
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
              Nova versão disponível: <strong>{updateStatus.info?.version}</strong>
            </span>
          </div>
          <div className="update-notification-actions">
            <button className="update-btn update-btn-primary" onClick={handleDownload}>
              Baixar
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
            <span>Baixando atualização...</span>
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
            <span>Atualização pronta para instalar</span>
          </div>
          <div className="update-notification-actions">
            <button className="update-btn update-btn-primary" onClick={handleInstall}>
              Reiniciar e Atualizar
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
            <span>Erro ao atualizar: {updateStatus.error}</span>
          </div>
          <button className="update-btn update-btn-dismiss" onClick={handleDismiss}>
            <X size={14} />
          </button>
        </>
      )}
    </div>
  )
}
