import React, { useEffect, useState } from 'react'
import { X, RefreshCw, CheckCircle, Download } from 'lucide-react'
import logo from '../assets/logo.png'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

type UpdateCheckState = 'idle' | 'checking' | 'available' | 'not-available' | 'error'

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
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
          <h2>Sobre o SideBrain</h2>
          <button className="modal-close" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="about-body">
          <div className="about-logo">
            <img src={logo} alt="SideBrain" width={64} height={64} />
          </div>

          <h1 className="about-title">SideBrain</h1>
          <p className="about-version">Versão {version || '...'}</p>

          <div className="about-update-section">
            {updateState === 'idle' && (
              <button className="about-check-update-btn" onClick={handleCheckUpdates}>
                <RefreshCw size={14} />
                Verificar atualizações
              </button>
            )}
            {updateState === 'checking' && (
              <span className="about-update-status">
                <RefreshCw size={14} className="update-spinner" />
                Verificando...
              </span>
            )}
            {updateState === 'not-available' && (
              <span className="about-update-status about-update-ok">
                <CheckCircle size={14} />
                Você está na versão mais recente
              </span>
            )}
            {updateState === 'available' && (
              <span className="about-update-status about-update-available">
                <Download size={14} />
                Nova versão disponível: {updateVersion}
              </span>
            )}
            {updateState === 'error' && (
              <span className="about-update-status about-update-error">
                Não foi possível verificar atualizações
              </span>
            )}
          </div>

          <p className="about-description">
            Seu segundo cérebro para organizar o trabalho. Capture notas rápidas durante o dia
            e deixe a IA categorizar, organizar e resumir tudo para você.
          </p>

          <div className="about-features">
            <div className="about-feature-item">
              <strong>Captura Inteligente</strong>
              <span>Texto livre categorizado automaticamente por IA</span>
            </div>
            <div className="about-feature-item">
              <strong>Projetos & Tarefas</strong>
              <span>Organização automática com Kanban e status</span>
            </div>
            <div className="about-feature-item">
              <strong>Resumo Diário</strong>
              <span>Digest com pendências, atividades e sugestões</span>
            </div>
            <div className="about-feature-item">
              <strong>Modo Reunião</strong>
              <span>Capture atas e ações durante reuniões</span>
            </div>
          </div>

          <div className="about-tech">
            <p className="about-tech-label">Desenvolvido com</p>
            <p className="about-tech-stack">
              Electron 35 &middot; React 19 &middot; TypeScript &middot; SQLite &middot; AWS Bedrock (Claude)
            </p>
          </div>

          <div className="about-footer">
            <p>&copy; 2025 SideBrain. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
