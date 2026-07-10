import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, CheckCircle2, Mic, MicOff, Users, Gavel, AlertTriangle,
  MessageSquare, Lightbulb, RefreshCw, Sparkles, X, Eye, Edit3,
  FolderPlus, ChevronDown, PenLine, Info, Clock, Minus, AlertCircle,
  Circle, Tag, Zap, Archive, Star, Flag, Heart, Shield, Bell,
  Bookmark, Coffee, FileText, Globe, Home, Key, Link, Lock,
  Mail, Map, Phone, Search, Settings, Smile, Target, Truck, Wifi
} from 'lucide-react'
import { CaptureTemplate, EntryPreviewResult, CustomEntryType, CustomActionStatus } from '@shared/types'
import { CustomSelect } from './CustomSelect'
import { useToast } from './ToastContext'
import type { SelectOption } from './CustomSelect'

interface CaptureInputProps {
  onProjectsChanged?: () => void
}

interface ProjectOption {
  id: string
  name: string
  isAutoSuggested?: boolean
}

type CaptureState = 'idle' | 'processing' | 'previewing' | 'confirming'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Users, Gavel, AlertTriangle, MessageSquare, Lightbulb, RefreshCw,
  Info, Clock, CheckCircle2, Minus, AlertCircle, Circle, PenLine,
  Tag, Zap, Archive, Star, Flag, Heart, Shield, Bell,
  Bookmark, Coffee, FileText, Globe, Home, Key, Link, Lock,
  Mail, Map, Phone, Search, Settings, Smile, Target, Truck, Wifi,
  Send, Mic, MicOff, Sparkles, X, Eye, Edit3, FolderPlus, ChevronDown,
}

export function CaptureInput({ onProjectsChanged }: CaptureInputProps) {
  const { addToast } = useToast()

  // Input state
  const [text, setText] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [isListening, setIsListening] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<CaptureTemplate | null>(null)

  // Flow state
  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const [preview, setPreview] = useState<EntryPreviewResult | null>(null)

  // Dynamic custom fields
  const [captureTemplates, setCaptureTemplates] = useState<CaptureTemplate[]>([])
  const [entryTypes, setEntryTypes] = useState<CustomEntryType[]>([])
  const [actionStatuses, setActionStatuses] = useState<CustomActionStatus[]>([])

  // Derived label maps
  const TYPE_LABELS: Record<string, string> = Object.fromEntries(entryTypes.map(t => [t.key, t.label]))
  const ACTION_LABELS: Record<string, string> = Object.fromEntries(actionStatuses.map(s => [s.key, s.label]))

  // Preview editable fields
  const [editedImprovedText, setEditedImprovedText] = useState('')
  const [editedProjectId, setEditedProjectId] = useState<string>('')
  const [editedType, setEditedType] = useState<string>('information')
  const [editedAction, setEditedAction] = useState<string>('none')
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [includeSuggestedTask, setIncludeSuggestedTask] = useState(true)

  // UI state
  const [projects, setProjects] = useState<ProjectOption[]>([])

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baseTextRef = useRef('')

  const speechSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window

  // Load projects and custom fields on mount
  useEffect(() => {
    loadProjects()
    loadCustomFields()
  }, [])

  const loadProjects = async () => {
    const result = await window.electronAPI.getProjects()
    setProjects(result)
  }

  const loadCustomFields = async () => {
    const [templates, types, statuses] = await Promise.all([
      window.electronAPI.getCaptureTemplates(),
      window.electronAPI.getEntryTypes(),
      window.electronAPI.getActionStatuses(),
    ])
    setCaptureTemplates(templates)
    setEntryTypes(types)
    setActionStatuses(statuses)
  }

  const handleTemplateSelect = useCallback((template: CaptureTemplate) => {
    if (activeTemplate?.id === template.id) {
      if (text === template.prefix || text.startsWith(template.prefix)) {
        setText('')
      }
      setActiveTemplate(null)
    } else {
      setText(template.prefix)
      setActiveTemplate(template)
    }
    inputRef.current?.focus()
  }, [activeTemplate, text])

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

    baseTextRef.current = text ? (text.endsWith(' ') ? text : text + ' ') : ''

    // Flag to track intentional stop vs premature end
    let intentionallyStopped = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }
      setText(baseTextRef.current + finalTranscript + interimTranscript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[SpeechRecognition] Error:', event.error, event.message)
      // 'no-speech' is not fatal — don't stop listening
      if (event.error === 'no-speech') return
      // 'aborted' means we stopped it intentionally
      if (event.error === 'aborted') return
      setIsListening(false)
    }

    recognition.onend = () => {
      // If we didn't intentionally stop and we're still supposed to be listening,
      // restart the recognition (Chromium sometimes stops after silence)
      if (!intentionallyStopped && recognitionRef.current === recognition) {
        try {
          recognition.start()
          return
        } catch {
          // If restart fails, just stop
        }
      }
      setIsListening(false)
    }

    recognitionRef.current = recognition

    // Override stop to set our flag
    const originalStop = recognition.stop.bind(recognition)
    recognition.stop = () => {
      intentionallyStopped = true
      originalStop()
    }

    try {
      recognition.start()
      setIsListening(true)
    } catch (err) {
      console.error('[SpeechRecognition] Failed to start:', err)
      setIsListening(false)
    }
  }, [isListening, text])

  useEffect(() => {
    window.electronAPI.onFocusCaptureInput(() => {
      inputRef.current?.focus()
    })
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [])

  // Submit for preview (calls AI without persisting)
  const handlePreview = async () => {
    const trimmed = text.trim()
    if (!trimmed || captureState === 'processing') return

    setCaptureState('processing')
    window.dispatchEvent(new Event('ai:start'))
    try {
      const result = await window.electronAPI.previewEntry(
        trimmed,
        selectedProjectId || undefined
      )
      setPreview(result)

      // Populate editable fields from preview
      setEditedImprovedText(result.improvedText)
      setEditedType(result.type)
      setEditedAction(result.action)
      setIncludeSuggestedTask(!!result.suggestedTask)

      // Resolve project selection in preview
      if (result.project.id) {
        setEditedProjectId(result.project.id)
        setIsCreatingProject(false)
        setNewProjectName('')
      } else if (result.project.suggestedName) {
        setEditedProjectId('')
        setIsCreatingProject(true)
        setNewProjectName(result.project.suggestedName)
      } else {
        setEditedProjectId('')
        setIsCreatingProject(false)
        setNewProjectName('')
      }

      setCaptureState('previewing')
      window.dispatchEvent(new Event('ai:end'))
    } catch (error) {
      console.error('Failed to preview entry:', error)
      setCaptureState('idle')
      window.dispatchEvent(new Event('ai:error'))
    }
  }

  // Confirm and persist the entry
  const handleConfirm = async () => {
    if (!preview) return

    // Validate: must have a project
    const hasProject = editedProjectId || (isCreatingProject && newProjectName.trim())
    if (!hasProject) return

    setCaptureState('confirming')
    try {
      await window.electronAPI.confirmEntry({
        rawText: preview.rawText,
        improvedText: editedImprovedText,
        projectId: isCreatingProject ? null : editedProjectId,
        newProjectName: isCreatingProject ? newProjectName.trim() : null,
        type: editedType,
        action: editedAction,
        suggestedTask: includeSuggestedTask ? preview.suggestedTask : null,
      })

      resetForm()
      onProjectsChanged?.()
      await loadProjects()

      addToast('Registrado com sucesso!', 'success')
    } catch (error) {
      console.error('Failed to confirm entry:', error)
    } finally {
      setCaptureState('idle')
    }
  }

  const handleCancel = () => {
    // Go back to idle with text preserved
    setCaptureState('idle')
    setPreview(null)
  }

  const resetForm = () => {
    setText('')
    setSelectedProjectId('')
    setActiveTemplate(null)
    setPreview(null)
    setCaptureState('idle')
    setIsCreatingProject(false)
    setNewProjectName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePreview()
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handlePreview()
    }
  }

  const isIdle = captureState === 'idle'
  const isProcessing = captureState === 'processing'
  const isPreviewing = captureState === 'previewing'

  return (
    <div className="capture-page">
      {/* Hero section */}
      <div className="capture-hero">
        <div className="capture-hero-icon">
          <PenLine size={24} />
        </div>
        <h2 className="capture-hero-title">Captura Rápida</h2>
        <p className="capture-hero-subtitle">
          Digite o que aconteceu. A IA organiza, categoriza e sugere ações.
        </p>
      </div>

      {/* Main capture card */}
      <div className="capture-main-card">
        {/* Templates */}
        <div className="capture-templates">
          <span className="capture-templates-label">Templates:</span>
          <div className="capture-templates-list">
            {captureTemplates.map((template) => {
              const Icon = ICON_MAP[template.icon]
              return (
                <button
                  key={template.id}
                  className={`capture-template-chip ${activeTemplate?.id === template.id ? 'active' : ''}`}
                  onClick={() => handleTemplateSelect(template)}
                  disabled={!isIdle}
                  title={`${template.prefix}${template.placeholder}`}
                >
                  {Icon && <Icon size={12} />}
                  <span>{template.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Textarea input */}
        <div className="capture-input-wrapper">
          <textarea
            ref={inputRef}
            className="vscode-textarea capture-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeTemplate
              ? `${activeTemplate.prefix}${activeTemplate.placeholder}`
              : 'Ex: João falou que o prazo do projeto X mudou pra semana que vem...'}
            disabled={!isIdle}
            rows={5}
            autoFocus
          />
          {isListening && (
            <div className="capture-listening-indicator">
              <span className="capture-listening-dot" />
              <span>Ouvindo...</span>
            </div>
          )}
        </div>

        {/* Bottom bar: project + actions */}
        <div className="capture-bottom-bar">
          <div className="capture-project-select">
            <CustomSelect
              options={[
                { value: '', label: '🤖 IA identifica o projeto' },
                ...projects.map((p) => ({ value: p.id, label: p.name }))
              ]}
              value={selectedProjectId}
              onChange={(val) => setSelectedProjectId(val)}
              disabled={!isIdle}
            />
          </div>

          <div className="capture-actions">
            {speechSupported && (
              <button
                className={`capture-action-btn ${isListening ? 'recording' : ''}`}
                onClick={toggleVoiceInput}
                disabled={!isIdle}
                title={isListening ? 'Parar gravação' : 'Entrada por voz'}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}

            <button
              className="capture-send-btn"
              onClick={handlePreview}
              disabled={!text.trim() || !isIdle}
            >
              {isProcessing ? (
                <>
                  <Sparkles size={14} className="spin" />
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Enviar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="capture-hints">
        <span><kbd>Enter</kbd> enviar</span>
        <span><kbd>Shift+Enter</kbd> nova linha</span>
        <span><kbd>Ctrl+N</kbd> foco aqui</span>
      </div>

      {/* Preview Card */}
      {isPreviewing && preview && (
        <div className="capture-preview-card">
          <div className="capture-preview-header">
            <Sparkles size={14} />
            <span>Prévia da IA</span>
            <button className="capture-preview-close" onClick={handleCancel} title="Cancelar">
              <X size={14} />
            </button>
          </div>

          {/* Improved text comparison */}
          <div className="capture-preview-section">
            <label className="capture-preview-label">
              <Edit3 size={12} />
              Texto melhorado:
            </label>
            <textarea
              className="vscode-textarea capture-preview-textarea"
              value={editedImprovedText}
              onChange={(e) => setEditedImprovedText(e.target.value)}
              rows={3}
            />
            {editedImprovedText !== preview.rawText && (
              <div className="capture-preview-original">
                <span className="capture-preview-original-label">Original:</span>
                <span className="capture-preview-original-text">{preview.rawText}</span>
              </div>
            )}
          </div>

          {/* Project selection in preview */}
          <div className="capture-preview-section">
            <label className="capture-preview-label">Projeto:</label>
            <div className="capture-preview-project">
              {!isCreatingProject ? (
                <CustomSelect
                  options={[
                    { value: '', label: 'Selecionar projeto...' },
                    ...projects.map((p) => ({ value: p.id, label: p.name })),
                    { value: '__new__', label: '+ Criar novo projeto' }
                  ]}
                  value={editedProjectId}
                  onChange={(val) => {
                    if (val === '__new__') {
                      setIsCreatingProject(true)
                      setEditedProjectId('')
                      setNewProjectName(preview.project.suggestedName || '')
                    } else {
                      setEditedProjectId(val)
                    }
                  }}
                />
              ) : (
                <div className="capture-preview-new-project">
                  <FolderPlus size={14} />
                  <input
                    type="text"
                    className="vscode-input"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Nome do novo projeto"
                    autoFocus
                  />
                  <button
                    className="vscode-button secondary"
                    onClick={() => {
                      setIsCreatingProject(false)
                      setNewProjectName('')
                      if (preview.project.id) {
                        setEditedProjectId(preview.project.id)
                      }
                    }}
                    title="Cancelar criação"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {preview.project.suggestedName && !isCreatingProject && !editedProjectId && (
                <div className="capture-preview-suggestion">
                  <Sparkles size={12} />
                  <span>Sugestão da IA: </span>
                  <button
                    className="capture-preview-suggestion-btn"
                    onClick={() => {
                      setIsCreatingProject(true)
                      setNewProjectName(preview.project.suggestedName || '')
                    }}
                  >
                    Criar "{preview.project.suggestedName}"
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Type and Action badges */}
          <div className="capture-preview-section capture-preview-row">
            <div className="capture-preview-field">
              <label className="capture-preview-label">Tipo:</label>
              <CustomSelect
                options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                value={editedType}
                onChange={(val) => setEditedType(val)}
                className="capture-preview-select-sm"
              />
            </div>
            <div className="capture-preview-field">
              <label className="capture-preview-label">Ação:</label>
              <CustomSelect
                options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
                value={editedAction}
                onChange={(val) => setEditedAction(val)}
                className="capture-preview-select-sm"
              />
            </div>
          </div>

          {/* Suggested task */}
          {preview.suggestedTask && (
            <div className="capture-preview-section">
              <label className="capture-preview-label capture-preview-task-label">
                <input
                  type="checkbox"
                  checked={includeSuggestedTask}
                  onChange={(e) => setIncludeSuggestedTask(e.target.checked)}
                />
                Criar tarefa sugerida:
              </label>
              <div className={`capture-preview-task ${!includeSuggestedTask ? 'disabled' : ''}`}>
                <strong>{preview.suggestedTask.title}</strong>
                {preview.suggestedTask.description && (
                  <span className="capture-preview-task-desc">{preview.suggestedTask.description}</span>
                )}
              </div>
            </div>
          )}

          {/* AI reasoning */}
          {preview.reasoning && (
            <div className="capture-preview-reasoning">
              <span className="capture-preview-reasoning-text">{preview.reasoning}</span>
            </div>
          )}

          {/* Confirm / Cancel */}
          <div className="capture-preview-actions">
            <button
              className="vscode-button"
              onClick={handleConfirm}
              disabled={captureState === 'confirming' || (!editedProjectId && !isCreatingProject) || (isCreatingProject && !newProjectName.trim())}
            >
              <CheckCircle2 size={14} />
              {captureState === 'confirming' ? 'Salvando...' : 'Confirmar'}
            </button>
            <button
              className="vscode-button secondary"
              onClick={handleCancel}
              disabled={captureState === 'confirming'}
            >
              Voltar e editar
            </button>
            {!editedProjectId && !isCreatingProject && (
              <span className="capture-preview-warning">
                Selecione um projeto para confirmar
              </span>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
