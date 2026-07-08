import React from 'react'
import { X, Brain, Github, Coffee } from 'lucide-react'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
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
            <Brain size={64} strokeWidth={1.5} />
          </div>

          <h1 className="about-title">SideBrain</h1>
          <p className="about-version">Versão 0.1.0</p>

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
