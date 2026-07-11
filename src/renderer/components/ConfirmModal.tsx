import React, { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  alternativeLabel?: string
  secondAlternativeLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
  onAlternative?: () => void
  onSecondAlternative?: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  alternativeLabel,
  secondAlternativeLabel,
  variant = 'default',
  onConfirm,
  onCancel,
  onAlternative,
  onSecondAlternative,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-modal-header ${variant}`}>
          <AlertTriangle size={16} />
          <span>{title}</span>
          <button className="inline-action-btn" onClick={onCancel} style={{ opacity: 1 }}>
            <X size={14} />
          </button>
        </div>
        <div className="confirm-modal-body">
          {message.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <div className="confirm-modal-footer">
          <button className="vscode-button secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          {alternativeLabel && onAlternative && (
            <button className="vscode-button secondary" onClick={onAlternative}>
              {alternativeLabel}
            </button>
          )}
          {secondAlternativeLabel && onSecondAlternative && (
            <button className="vscode-button secondary" onClick={onSecondAlternative}>
              {secondAlternativeLabel}
            </button>
          )}
          <button className={`vscode-button ${variant}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
