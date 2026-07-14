import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, CheckCircle2, Mic, MicOff, Users, Gavel, AlertTriangle,
  MessageSquare, Lightbulb, RefreshCw, Sparkles, X, Eye, Edit3,
  FolderPlus, ChevronDown, PenLine, Info, Clock, Minus, AlertCircle,
  Circle, Tag, Zap, Archive, Star, Flag, Heart, Shield, Bell,
  Bookmark, Coffee, FileText, Globe, Home, Key, Link, Lock,
  Mail, Map, Phone, Search, Settings, Smile, Target, Truck, Wifi,
  Bug, LayoutTemplate
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CaptureTemplate, EntryPreviewResult, CustomEntryType, CustomActionStatus, StructuredTemplate, CaptureSnippet } from '@shared/types'
import { CustomSelect } from './CustomSelect'
import { useToast } from './ToastContext'
import { TemplateFormModal } from './TemplateFormModal'
import { SnippetAutocomplete, useSnippetTrigger } from './SnippetAutocomplete'
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
  Bug, LayoutTemplate,
}

export function CaptureInput({ onProjectsChanged }: CaptureInputProps) {
  const { t } = useTranslation('capture')
  const { addToast } = useToast()

  // Input state
  const [text, setText] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [isListening, setIsListening] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<CaptureTemplate | null>(null)

  // Flow state
  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const [preview, setPreview] = useState<EntryPreviewResult | null>(null)
  const [batchPreviews, setBatchPreviews] = useState<EntryPreviewResult[]>([])
  const [isBatchMode, setIsBatchMode] = useState(false)

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

  // Structured templates & snippets
  const [structuredTemplates, setStructuredTemplates] = useState<StructuredTemplate[]>([])
  const [snippets, setSnippets] = useState<CaptureSnippet[]>([])
  const [activeStructuredTemplate, setActiveStructuredTemplate] = useState<StructuredTemplate | null>(null)
  const [cursorPosition, setCursorPosition] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baseTextRef = useRef('')

  // Snippet trigger detection
  const isSnippetTriggered = useSnippetTrigger(text, cursorPosition)

  const speechSupported = false // Speech Recognition não funciona em Electron (requer chave Google embutida no Chrome)

  // Load projects and custom fields on mount
  useEffect(() => {
    loadProjects()
    loadCustomFields()
    loadStructuredData()
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

  const loadStructuredData = async () => {
    const [stTemplates, snps] = await Promise.all([
      window.electronAPI.getStructuredTemplates(),
      window.electronAPI.getCaptureSnippets(),
    ])
    setStructuredTemplates(stTemplates)
    setSnippets(snps)
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
      if (isBatchMode) {
        // Batch mode: categorize multiple paragraphs
        const results = await window.electronAPI.previewBatchEntries(trimmed)
        setBatchPreviews(results)
        setPreview(null)
        setCaptureState('previewing')
        window.dispatchEvent(new Event('ai:end'))
        return
      }

      const result = await window.electronAPI.previewEntry(
        trimmed,
        selectedProjectId || undefined
      )
      setPreview(result)
      setBatchPreviews([])

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
        // Original AI predictions for feedback learning
        aiOriginalType: preview.type,
        aiOriginalAction: preview.action,
        aiOriginalProjectId: preview.project.id,
      })

      resetForm()
      onProjectsChanged?.()
      await loadProjects()

      addToast(t('confirm_success'), 'success')
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
    setBatchPreviews([])
  }

  /**
   * Confirm all batch entries at once.
   */
  const handleBatchConfirm = async () => {
    if (batchPreviews.length === 0) return

    setCaptureState('confirming')
    try {
      let confirmed = 0
      for (const batchItem of batchPreviews) {
        await window.electronAPI.confirmEntry({
          rawText: batchItem.rawText,
          improvedText: batchItem.improvedText,
          projectId: batchItem.project.id,
          newProjectName: batchItem.project.id ? null : batchItem.project.suggestedName,
          type: batchItem.type,
          action: batchItem.action,
          suggestedTask: batchItem.suggestedTask,
        })
        confirmed++
      }

      resetForm()
      onProjectsChanged?.()
      await loadProjects()

      addToast(t('batch_confirm_success', { count: confirmed }), 'success')
    } catch (error) {
      console.error('Failed to confirm batch entries:', error)
    } finally {
      setCaptureState('idle')
    }
  }

  const resetForm = () => {
    setText('')
    setSelectedProjectId('')
    setActiveTemplate(null)
    setPreview(null)
    setBatchPreviews([])
    setIsBatchMode(false)
    setCaptureState('idle')
    setIsCreatingProject(false)
    setNewProjectName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't handle Enter when snippet autocomplete is open
    if (isSnippetTriggered && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      return // Let SnippetAutocomplete handle it
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePreview()
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handlePreview()
    }
  }

  // Track cursor position for snippet autocomplete
  const handleTextareaSelect = useCallback(() => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart)
    }
  }, [])

  // Handle snippet selection (replace /trigger with snippet content)
  const handleSnippetSelect = useCallback((snippet: CaptureSnippet, replacementRange: { start: number; end: number }) => {
    const before = text.slice(0, replacementRange.start)
    const after = text.slice(replacementRange.end)
    let content = snippet.content

    // Handle {{cursor}} placeholder — position cursor there
    const cursorPlaceholder = '{{cursor}}'
    const cursorIndex = content.indexOf(cursorPlaceholder)
    if (cursorIndex !== -1) {
      content = content.replace(cursorPlaceholder, '')
    }

    const newText = before + content + after
    setText(newText)

    // Position cursor
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = cursorIndex !== -1
          ? before.length + cursorIndex
          : before.length + content.length
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
        inputRef.current.focus()
        setCursorPosition(newCursorPos)
      }
    }, 0)
  }, [text])

  // Handle structured template form submission
  const handleTemplateFormSubmit = useCallback((outputText: string, hintType: string, hintAction: string) => {
    // Set the text from the template output and trigger preview
    setText(outputText)
    setActiveStructuredTemplate(null)

    // Auto-submit for preview after a brief delay (let state settle)
    setTimeout(async () => {
      if (!outputText.trim()) return
      setCaptureState('processing')
      window.dispatchEvent(new Event('ai:start'))
      try {
        const result = await window.electronAPI.previewEntry(outputText, selectedProjectId || undefined)
        setPreview(result)
        setBatchPreviews([])
        setEditedImprovedText(result.improvedText)
        // Use template hints as defaults but respect AI's categorization
        setEditedType(result.type || hintType)
        setEditedAction(result.action || hintAction)
        setIncludeSuggestedTask(!!result.suggestedTask)

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
    }, 100)
  }, [selectedProjectId])

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
        <h2 className="capture-hero-title">{t('hero_title')}</h2>
        <p className="capture-hero-subtitle">
          {t('hero_subtitle')}
        </p>
      </div>

      {/* Main capture card */}
      <div className="capture-main-card">
        {/* Quick Templates (prefix-based) */}
        <div className="capture-templates">
          <span className="capture-templates-label">{t('templates_label')}</span>
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

        {/* Structured Templates (form-based) */}
        {structuredTemplates.length > 0 && (
          <div className="capture-templates">
            <span className="capture-templates-label">
              <LayoutTemplate size={12} />
              {t('structured_templates_label', { defaultValue: 'Formulários' })}
            </span>
            <div className="capture-templates-list">
              {structuredTemplates.map((stpl) => {
                const Icon = ICON_MAP[stpl.icon] || FileText
                return (
                  <button
                    key={stpl.id}
                    className={`capture-template-chip structured`}
                    onClick={() => setActiveStructuredTemplate(stpl)}
                    disabled={!isIdle}
                    title={stpl.description || stpl.name}
                  >
                    <Icon size={12} />
                    <span>{stpl.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Textarea input */}
        <div className="capture-input-wrapper">
          <textarea
            ref={inputRef}
            className="vscode-textarea capture-textarea"
            value={text}
            onChange={(e) => {
              const val = e.target.value
              setText(val)
              setCursorPosition(e.target.selectionStart)
              // Detect batch mode: multiple paragraphs separated by blank lines
              const paragraphs = val.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
              setIsBatchMode(paragraphs.length > 1)
            }}
            onKeyDown={handleKeyDown}
            onSelect={handleTextareaSelect}
            onClick={handleTextareaSelect}
            placeholder={activeTemplate
              ? `${activeTemplate.prefix}${activeTemplate.placeholder}`
              : t('placeholder_default')}
            disabled={!isIdle}
            rows={5}
            autoFocus
          />
          {isListening && (
            <div className="capture-listening-indicator">
              <span className="capture-listening-dot" />
              <span>{t('listening')}</span>
            </div>
          )}

          {/* Snippet Autocomplete */}
          <SnippetAutocomplete
            text={text}
            cursorPosition={cursorPosition}
            snippets={snippets}
            isVisible={isSnippetTriggered && isIdle}
            onSelect={handleSnippetSelect}
            onClose={() => setCursorPosition(0)}
            anchorRef={inputRef}
          />
        </div>

        {/* Bottom bar: project + actions */}
        <div className="capture-bottom-bar">
          <div className="capture-project-select">
            <CustomSelect
              options={[
                { value: '', label: t('project_auto') },
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
                title={isListening ? t('voice_stop') : t('voice_start')}
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
                  <span>{t('send_analyzing')}</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>{isBatchMode ? t('send_button_batch', { count: text.split(/\n\s*\n/).filter((p) => p.trim()).length }) : t('send_button')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="capture-hints">
        <span><kbd>Enter</kbd> {t('hint_enter')}</span>
        <span><kbd>Shift+Enter</kbd> {t('hint_shift_enter')}</span>
        <span><kbd>Ctrl+N</kbd> {t('hint_ctrl_n')}</span>
        <span><kbd>/</kbd> {t('hint_snippets', { defaultValue: 'snippets' })}</span>
      </div>

      {/* Preview Card */}
      {isPreviewing && preview && (
        <div className="capture-preview-card">
          <div className="capture-preview-header">
            <Sparkles size={14} />
            <span>{t('preview_header')}</span>
            <button className="capture-preview-close" onClick={handleCancel} title={t('preview_cancel_title')}>
              <X size={14} />
            </button>
          </div>

          {/* Improved text comparison */}
          <div className="capture-preview-section">
            <label className="capture-preview-label">
              <Edit3 size={12} />
              {t('preview_improved_label')}
            </label>
            <textarea
              className="vscode-textarea capture-preview-textarea"
              value={editedImprovedText}
              onChange={(e) => setEditedImprovedText(e.target.value)}
              rows={3}
            />
            {editedImprovedText !== preview.rawText && (
              <div className="capture-preview-original">
                <span className="capture-preview-original-label">{t('preview_original_label')}</span>
                <span className="capture-preview-original-text">{preview.rawText}</span>
              </div>
            )}
          </div>

          {/* Project selection in preview */}
          <div className="capture-preview-section">
            <label className="capture-preview-label">{t('preview_project_label')}</label>
            <div className="capture-preview-project">
              {!isCreatingProject ? (
                <CustomSelect
                  options={[
                    { value: '', label: t('preview_project_select') },
                    ...projects.map((p) => ({ value: p.id, label: p.name })),
                    { value: '__new__', label: t('preview_project_new') }
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
                    placeholder={t('preview_project_name_placeholder')}
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
                    title={t('preview_project_cancel_title')}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {preview.project.suggestedName && !isCreatingProject && !editedProjectId && (
                <div className="capture-preview-suggestion">
                  <Sparkles size={12} />
                  <span>{t('preview_project_suggestion')}</span>
                  <button
                    className="capture-preview-suggestion-btn"
                    onClick={() => {
                      setIsCreatingProject(true)
                      setNewProjectName(preview.project.suggestedName || '')
                    }}
                  >
                    {t('preview_project_create', { name: preview.project.suggestedName })}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Type and Action badges */}
          <div className="capture-preview-section capture-preview-row">
            <div className="capture-preview-field">
              <label className="capture-preview-label">{t('preview_type_label')}</label>
              <CustomSelect
                options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                value={editedType}
                onChange={(val) => setEditedType(val)}
                className="capture-preview-select-sm"
              />
            </div>
            <div className="capture-preview-field">
              <label className="capture-preview-label">{t('preview_action_label')}</label>
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
                {t('preview_task_label')}
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
              {captureState === 'confirming' ? t('preview_confirming') : t('preview_confirm')}
            </button>
            <button
              className="vscode-button secondary"
              onClick={handleCancel}
              disabled={captureState === 'confirming'}
            >
              {t('preview_back')}
            </button>
            {!editedProjectId && !isCreatingProject && (
              <span className="capture-preview-warning">
                {t('preview_warning_project')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Batch Preview */}
      {isPreviewing && batchPreviews.length > 0 && (
        <div className="capture-preview-card">
          <div className="capture-preview-header">
            <Sparkles size={14} />
            <span>{t('batch_preview_header', { count: batchPreviews.length })}</span>
            <button className="capture-preview-close" onClick={handleCancel} title={t('preview_cancel_title')}>
              <X size={14} />
            </button>
          </div>

          <div className="capture-batch-list">
            {batchPreviews.map((item, index) => (
              <div key={index} className="capture-batch-item">
                <div className="capture-batch-item-header">
                  <span className="capture-batch-item-number">{index + 1}</span>
                  <span className="capture-batch-item-type">{TYPE_LABELS[item.type] || item.type}</span>
                  <span className="capture-batch-item-action">{ACTION_LABELS[item.action] || item.action}</span>
                  {(item.project.id || item.project.suggestedName) && (
                    <span className="capture-batch-item-project">
                      {item.project.suggestedName || projects.find((p) => p.id === item.project.id)?.name || ''}
                    </span>
                  )}
                </div>
                <p className="capture-batch-item-text">{item.improvedText}</p>
              </div>
            ))}
          </div>

          <div className="capture-preview-actions">
            <button
              className="vscode-button"
              onClick={handleBatchConfirm}
              disabled={captureState === 'confirming'}
            >
              <CheckCircle2 size={14} />
              {captureState === 'confirming' ? t('preview_confirming') : t('batch_confirm_button', { count: batchPreviews.length })}
            </button>
            <button
              className="vscode-button secondary"
              onClick={handleCancel}
              disabled={captureState === 'confirming'}
            >
              {t('preview_back')}
            </button>
          </div>
        </div>
      )}

      {/* Structured Template Form Modal */}
      {activeStructuredTemplate && (
        <TemplateFormModal
          isOpen={!!activeStructuredTemplate}
          template={activeStructuredTemplate}
          onSubmit={handleTemplateFormSubmit}
          onClose={() => setActiveStructuredTemplate(null)}
        />
      )}

    </div>
  )
}
