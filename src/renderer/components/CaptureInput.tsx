import React, { useState, useRef, useEffect } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'

interface CaptureInputProps {
  onProjectsChanged?: () => void
}

export function CaptureInput({ onProjectsChanged }: CaptureInputProps) {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.electronAPI.onFocusCaptureInput(() => {
      inputRef.current?.focus()
    })
  }, [])

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    try {
      await window.electronAPI.createEntry(trimmed)
      setLastSubmitted(trimmed)
      setText('')
      onProjectsChanged?.()
      setTimeout(() => setLastSubmitted(null), 3000)
    } catch (error) {
      console.error('Failed to create entry:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex-col">
      <div className="panel-header">
        <span className="panel-title">Captura Rápida</span>
      </div>
      <p className="panel-description">
        Digite o que aconteceu e pressione Enter. A IA vai organizar automaticamente.
      </p>

      <div className="flex-col" style={{ maxWidth: 600 }}>
        <textarea
          ref={inputRef}
          className="vscode-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: João falou que o prazo do projeto X mudou pra semana que vem..."
          disabled={isSubmitting}
          rows={4}
          autoFocus
        />

        <div className="flex-row">
          <button
            className="vscode-button"
            onClick={handleSubmit}
            disabled={!text.trim() || isSubmitting}
          >
            <Send size={14} />
            {isSubmitting ? 'Processando...' : 'Enviar'}
          </button>

          <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>
            <kbd>Enter</kbd> para enviar, <kbd>Shift+Enter</kbd> nova linha
          </span>
        </div>

        {lastSubmitted && (
          <div className="toast">
            <CheckCircle2 size={14} />
            Registrado com sucesso
          </div>
        )}
      </div>

      <div className="mt-16" style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>
        Dica: Use <kbd>Ctrl+Shift+Space</kbd> para abrir a captura de qualquer lugar.
      </div>
    </div>
  )
}
