import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, CheckCircle2, Mic, MicOff } from 'lucide-react'

interface CaptureInputProps {
  onProjectsChanged?: () => void
}

export function CaptureInput({ onProjectsChanged }: CaptureInputProps) {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baseTextRef = useRef('')

  const speechSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.interimResults = true
    recognition.continuous = true

    // Save the current text as the base before voice input starts
    baseTextRef.current = text ? (text.endsWith(' ') ? text : text + ' ') : ''

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setText(baseTextRef.current + transcript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  useEffect(() => {
    window.electronAPI.onFocusCaptureInput(() => {
      inputRef.current?.focus()
    })
  }, [])

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
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

          {speechSupported && (
            <button
              className={`vscode-button ${isListening ? 'vscode-button-active' : 'vscode-button-secondary'}`}
              onClick={toggleVoiceInput}
              disabled={isSubmitting}
              title={isListening ? 'Parar gravação' : 'Entrada por voz'}
              style={isListening ? {
                background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
                borderColor: 'var(--vscode-inputValidation-errorBorder, #be1100)',
                animation: 'pulse 1.5s infinite'
              } : undefined}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              {isListening ? 'Parar' : 'Voz'}
            </button>
          )}

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
