import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Square,
  Plus,
  Clock,
  Users,
  ClipboardPaste,
  Sparkles,
  FileText,
  Copy,
  Download,
  Check,
  RefreshCw,
  Loader2,
  ListChecks,
  Trash2,
  AlertTriangle,
  Pencil,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MarkdownViewer } from './MarkdownViewer'
import { ConfirmModal } from './ConfirmModal'

interface Meeting {
  id: string
  projectId: string
  title: string
  participants: string[]
  meetingDate: string
  startedAt: string
  endedAt: string | null
  status: string
  rawNotes: string[]
  pastedTranscription: string | null
  generatedMinutes: string | null
}

interface Project {
  id: string
  name: string
}

interface ProcessedEntry {
  text: string
  type: string
  action: string
  selected: boolean
}

interface ProcessedTask {
  title: string
  description?: string
  assignee?: string
  similarTo?: {
    taskId: string
    taskTitle: string
    reason: string
  }
  selected: boolean
}

interface ResolvedTask {
  taskId: string
  taskTitle: string
  reason: string
  selected: boolean
}

type MeetingStep = 'setup' | 'active' | 'review' | 'select' | 'saved'

interface MeetingModeProps {
  projectId?: string
  onFinished?: (projectId: string) => void
}

export function MeetingMode({ projectId, onFinished }: MeetingModeProps) {
  const { t } = useTranslation('meetings')
  const [step, setStep] = useState<MeetingStep>('setup')
  const [projects, setProjects] = useState<Project[]>([])
  const [meeting, setMeeting] = useState<Meeting | null>(null)

  // Setup form
  const [title, setTitle] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '')
  const [participantsInput, setParticipantsInput] = useState('')
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Meeting prep (suggested agenda)
  const [suggestedAgenda, setSuggestedAgenda] = useState<string | null>(null)
  const [isPreparingAgenda, setIsPreparingAgenda] = useState(false)

  // Active meeting
  const [noteInput, setNoteInput] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const noteInputRef = useRef<HTMLInputElement>(null)

  // Review/paste
  const [transcription, setTranscription] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)

  // Selection step
  const [generatedMinutes, setGeneratedMinutes] = useState('')
  const [previewEntries, setPreviewEntries] = useState<ProcessedEntry[]>([])
  const [previewTasks, setPreviewTasks] = useState<ProcessedTask[]>([])
  const [previewResolvedTasks, setPreviewResolvedTasks] = useState<ResolvedTask[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [savedEntryIds, setSavedEntryIds] = useState<string[]>([])
  const [savedTaskIds, setSavedTaskIds] = useState<string[]>([])
  const [savedResolvedTaskIds, setSavedResolvedTaskIds] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [userName, setUserName] = useState('')
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null)
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null)
  const [editingEntryTypeIndex, setEditingEntryTypeIndex] = useState<number | null>(null)

  useEffect(() => {
    loadProjects()
    checkActiveMeeting()
    loadUserName()
  }, [])

  // Sync selectedProjectId when prop changes (e.g. navigating from a project)
  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId)
    }
  }, [projectId])

  useEffect(() => {
    if (step === 'active' && meeting) {
      timerRef.current = setInterval(() => {
        const start = new Date(meeting.startedAt).getTime()
        const now = Date.now()
        setElapsed(Math.floor((now - start) / 1000))
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [step, meeting?.startedAt])

  const loadProjects = async () => {
    const data = await window.electronAPI.getProjects()
    setProjects(data)
    if (!selectedProjectId && data.length > 0) {
      setSelectedProjectId(data[0].id)
    }
  }

  const loadUserName = async () => {
    try {
      const settings = await window.electronAPI.getSettings()
      if (settings?.userName) {
        setUserName(settings.userName)
      }
    } catch {
      /* ignore */
    }
  }

  const checkActiveMeeting = async () => {
    const active = await window.electronAPI.getActiveMeeting()
    if (active) {
      setMeeting(active)
      setStep('active')
    }
  }

  const handlePrepareAgenda = async () => {
    if (!selectedProjectId || !title.trim()) return
    setIsPreparingAgenda(true)
    try {
      const participants = participantsInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      const agenda = await window.electronAPI.prepareMeeting(selectedProjectId, title.trim(), participants)
      setSuggestedAgenda(agenda)
    } catch (error) {
      console.error('Failed to prepare agenda:', error)
    } finally {
      setIsPreparingAgenda(false)
    }
  }

  const handleCopyAgenda = async () => {
    if (suggestedAgenda) {
      await navigator.clipboard.writeText(suggestedAgenda)
    }
  }

  const handleStart = async () => {
    if (!title.trim() || !selectedProjectId) return

    const participants = participantsInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    const created = await window.electronAPI.createMeeting({
      projectId: selectedProjectId,
      title: title.trim(),
      participants,
      meetingDate,
    })

    setMeeting(created)
    setStep('active')
  }

  const handleAddNote = async () => {
    const trimmed = noteInput.trim()
    if (!trimmed || !meeting) return

    const updated = await window.electronAPI.addMeetingNote(meeting.id, trimmed)
    if (updated) setMeeting(updated)
    setNoteInput('')
    noteInputRef.current?.focus()
  }

  const handleEnd = async () => {
    if (!meeting) return
    const updated = await window.electronAPI.endMeeting(meeting.id)
    if (updated) setMeeting(updated)
    setStep('review')
  }

  const handleProcess = async () => {
    if (!meeting) return
    setIsProcessing(true)
    setProcessError(null)
    try {
      if (transcription.trim()) {
        await window.electronAPI.setMeetingTranscription(meeting.id, transcription.trim())
      }

      // End the meeting if still active (e.g. paste mode)
      if (meeting.status === 'active') {
        const ended = await window.electronAPI.endMeeting(meeting.id)
        if (ended) setMeeting(ended)
      }

      // Step 1: AI analyzes — returns result without saving entries/tasks
      const result = await window.electronAPI.processMeeting(meeting.id)

      if (result) {
        setGeneratedMinutes(result.minutes || '')
        setPreviewEntries((result.entries || []).map((e: any) => ({ ...e, selected: true })))
        setPreviewTasks((result.tasks || []).map((t: any) => ({ ...t, selected: !t.similarTo })))
        setPreviewResolvedTasks((result.resolvedTasks || []).map((rt: any) => ({ ...rt, selected: true })))
        // Update meeting with minutes
        setMeeting((prev) => (prev ? { ...prev, generatedMinutes: result.minutes, status: 'processed' } : null))
      }

      setStep('select')
    } catch (error: any) {
      console.error('Failed to process meeting:', error)
      const message = error?.message || 'Erro desconhecido ao processar reunião'
      setProcessError(message.includes('invalid JSON') ? t('errorInvalidJson') : t('errorProcessing', { message }))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveSelected = async () => {
    if (!meeting) return
    setIsSaving(true)
    try {
      const selectedE = previewEntries
        .filter((e) => e.selected)
        .map(({ text, type, action }) => ({ text, type, action }))

      const selectedT = previewTasks
        .filter((t) => t.selected)
        .map(({ title, description, assignee }) => ({ title, description, assignee }))

      const resolvedIds = previewResolvedTasks.filter((rt) => rt.selected).map((rt) => rt.taskId)

      const result = await window.electronAPI.saveSelectedMeetingItems(meeting.id, selectedE, selectedT, resolvedIds)
      setSavedEntryIds(result.entryIds || [])
      setSavedTaskIds(result.taskIds || [])
      setSavedResolvedTaskIds(result.resolvedTaskIds || [])
      setStep('saved')
    } catch (error) {
      console.error('Failed to save selected items:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEntry = (index: number) => {
    setPreviewEntries((prev) => prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e)))
  }

  const toggleTask = (index: number) => {
    setPreviewTasks((prev) => prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t)))
  }

  const selectAllEntries = (value: boolean) => {
    setPreviewEntries((prev) => prev.map((e) => ({ ...e, selected: value })))
  }

  const selectAllTasks = (value: boolean) => {
    setPreviewTasks((prev) => prev.map((t) => ({ ...t, selected: value })))
  }

  const toggleResolvedTask = (index: number) => {
    setPreviewResolvedTasks((prev) => prev.map((rt, i) => (i === index ? { ...rt, selected: !rt.selected } : rt)))
  }

  const selectAllResolvedTasks = (value: boolean) => {
    setPreviewResolvedTasks((prev) => prev.map((rt) => ({ ...rt, selected: value })))
  }

  const updateEntryText = (index: number, text: string) => {
    setPreviewEntries((prev) => prev.map((e, i) => (i === index ? { ...e, text } : e)))
  }

  const updateEntryType = (index: number, type: string) => {
    setPreviewEntries((prev) => prev.map((e, i) => (i === index ? { ...e, type } : e)))
    setEditingEntryTypeIndex(null)
  }

  const updateTaskTitle = (index: number, title: string) => {
    setPreviewTasks((prev) => prev.map((t, i) => (i === index ? { ...t, title } : t)))
  }

  const updateTaskDescription = (index: number, description: string) => {
    setPreviewTasks((prev) => prev.map((t, i) => (i === index ? { ...t, description } : t)))
  }

  const handleCopyMinutes = async () => {
    if (generatedMinutes) {
      await navigator.clipboard.writeText(generatedMinutes)
    }
  }

  const handleDownloadMinutes = () => {
    if (!generatedMinutes || !meeting) return
    const blob = new Blob([generatedMinutes], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ata-${meeting.title.replace(/\s+/g, '-').toLowerCase()}-${new Date(meeting.startedAt).toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReprocess = async () => {
    if (!meeting) return
    setIsProcessing(true)
    try {
      const result = await window.electronAPI.processMeeting(meeting.id)
      if (result) {
        setGeneratedMinutes(result.minutes || '')
        setPreviewEntries((result.entries || []).map((e: any) => ({ ...e, selected: true })))
        setPreviewTasks((result.tasks || []).map((t: any) => ({ ...t, selected: !t.similarTo })))
      }
    } catch (error) {
      console.error('Failed to reprocess meeting:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleNewMeeting = () => {
    setMeeting(null)
    setStep('setup')
    setTitle('')
    setParticipantsInput('')
    setMeetingDate(new Date().toISOString().slice(0, 10))
    setTranscription('')
    setGeneratedMinutes('')
    setPreviewEntries([])
    setPreviewTasks([])
    setSavedEntryIds([])
    setSavedTaskIds([])
    setElapsed(0)
  }

  const handleDeleteMeeting = async () => {
    if (!meeting) return
    try {
      if (savedEntryIds.length > 0 || savedTaskIds.length > 0) {
        // Delete meeting + associated data that was created
        await window.electronAPI.deleteMeetingWithData(meeting.id, savedEntryIds, savedTaskIds)
      } else {
        // Just delete the meeting (nothing was saved yet)
        await window.electronAPI.deleteMeeting(meeting.id)
      }
      setShowDeleteConfirm(false)
      handleNewMeeting()
    } catch (error) {
      console.error('Failed to delete meeting:', error)
    }
  }

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const typeLabels: Record<string, string> = {
    information: t('typeInfo'),
    decision: t('typeDecision'),
    demand: t('typeDemand'),
    idea: t('typeIdea'),
    blocker: t('typeBlocker'),
    update: t('typeUpdate'),
  }

  // === SETUP ===
  if (step === 'setup') {
    return (
      <div className="meeting-review-page">
        {/* Hero */}
        <div className="capture-hero">
          <div className="capture-hero-icon">
            <Play size={24} />
          </div>
          <h2 className="capture-hero-title">{t('newMeeting')}</h2>
          <p className="capture-hero-subtitle">{t('heroSubtitle')}</p>
        </div>

        {/* Form card */}
        <div className="meeting-review-card">
          <div className="meeting-form-group">
            <label>{t('meetingTitle')}</label>
            <input
              type="text"
              className="vscode-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('meetingTitlePlaceholder')}
              autoFocus
            />
          </div>

          <div className="meeting-form-group">
            <label>{t('project')}</label>
            <select
              className="vscode-select"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="meeting-form-group">
            <label>{t('meetingDate')}</label>
            <input
              type="date"
              className="vscode-input"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>

          <div className="meeting-form-group">
            <label>{t('participants')}</label>
            <input
              type="text"
              className="vscode-input"
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.target.value)}
              placeholder={t('participantsPlaceholder')}
            />
          </div>
        </div>

        {/* AI Agenda Preparation */}
        <div className="meeting-prep-section">
          <button
            type="button"
            className="vscode-button secondary meeting-prep-button"
            onClick={handlePrepareAgenda}
            disabled={isPreparingAgenda || !title.trim() || !selectedProjectId}
          >
            {isPreparingAgenda ? (
              <>
                <Loader2 size={14} className="spinning" />
                {t('preparingAgenda')}
              </>
            ) : (
              <>
                <ListChecks size={14} />
                {t('generateAgenda')}
              </>
            )}
          </button>

          {suggestedAgenda && (
            <div className="meeting-agenda-card">
              <div className="meeting-agenda-header">
                <Sparkles size={14} />
                <span>{t('suggestedAgenda')}</span>
                <button type="button" className="icon-button" onClick={handleCopyAgenda} title={t('copyAgenda')}>
                  <Copy size={14} />
                </button>
              </div>
              <div className="meeting-agenda-body">
                <MarkdownViewer content={suggestedAgenda} />
              </div>
            </div>
          )}
        </div>

        {/* Capture options */}
        <div className="meeting-review-card" style={{ gap: '16px' }}>
          <div className="meeting-review-card-header">{t('captureHow')}</div>
          <div className="meeting-option-cards">
            <div className="meeting-option-card" onClick={handleStart}>
              <Play size={20} />
              <span className="meeting-option-title">{t('captureLive')}</span>
              <span className="meeting-option-desc">{t('captureLiveDesc')}</span>
            </div>
            <div
              className="meeting-option-card"
              onClick={() => {
                if (!title.trim() || !selectedProjectId) return
                handleStart().then(() => setStep('review'))
              }}
            >
              <ClipboardPaste size={20} />
              <span className="meeting-option-title">{t('captureTranscription')}</span>
              <span className="meeting-option-desc">{t('captureTranscriptionDesc')}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // === ACTIVE (live capture) ===
  if (step === 'active' && meeting) {
    return (
      <div className="meeting-container">
        <div className="meeting-active-header">
          <div className="meeting-recording-badge">
            <span className="recording-dot" />
            {t('meetingInProgress')}
          </div>
          <div className="meeting-timer">
            <Clock size={14} />
            {formatTime(elapsed)}
          </div>
        </div>

        <div className="meeting-active-title">
          <span>{meeting.title}</span>
          {meeting.participants.length > 0 && (
            <span className="meeting-participants">
              <Users size={12} />
              {meeting.participants.join(', ')}
            </span>
          )}
        </div>

        <div className="meeting-notes-list">
          {meeting.rawNotes.map((note, i) => (
            <div key={i} className="meeting-note-item">
              <span className="meeting-note-bullet">•</span>
              <span>{note}</span>
            </div>
          ))}
          {meeting.rawNotes.length === 0 && <div className="meeting-empty-notes">{t('emptyNotes')}</div>}
        </div>

        <div className="meeting-note-input">
          <input
            ref={noteInputRef}
            type="text"
            className="vscode-input"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddNote()
            }}
            placeholder={t('noteInputPlaceholder')}
            autoFocus
          />
          <button type="button" className="vscode-button secondary" onClick={handleAddNote}>
            <Plus size={14} />
          </button>
        </div>

        <div className="meeting-actions">
          <button type="button" className="vscode-button danger" onClick={handleEnd}>
            <Square size={14} />
            {t('endMeeting')}
          </button>
        </div>
      </div>
    )
  }

  // === REVIEW (after ending or paste mode) ===
  if (step === 'review' && meeting) {
    const reviewDate = meeting.meetingDate
      ? new Date(`${meeting.meetingDate}T12:00:00`).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : null

    return (
      <div className="meeting-review-page">
        {/* Hero */}
        <div className="capture-hero">
          <div className="capture-hero-icon">
            <FileText size={24} />
          </div>
          <h2 className="capture-hero-title">{t('meetingEnded')}</h2>
          <p className="capture-hero-subtitle">{meeting.title}</p>
          {(reviewDate || meeting.participants.length > 0) && (
            <div className="meeting-review-meta">
              {reviewDate && (
                <span className="meeting-review-meta-item">
                  <Clock size={12} />
                  {reviewDate}
                </span>
              )}
              {meeting.participants.length > 0 && (
                <span className="meeting-review-meta-item">
                  <Users size={12} />
                  {meeting.participants.join(', ')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Notes captured card */}
        {meeting.rawNotes.length > 0 && (
          <div className="meeting-review-card">
            <div className="meeting-review-card-header">
              <ListChecks size={14} />
              <span>{t('notesCaptured', { count: meeting.rawNotes.length })}</span>
            </div>
            <div className="meeting-notes-list compact">
              {meeting.rawNotes.map((note, i) => (
                <div key={i} className="meeting-note-item">
                  <span className="meeting-note-bullet">•</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcription paste card */}
        <div className="meeting-review-card">
          <div className="meeting-review-card-header">
            <ClipboardPaste size={14} />
            <span>{t('pasteTranscription')}</span>
          </div>
          <p className="meeting-review-card-hint">{t('pasteTranscriptionHint')}</p>
          <textarea
            className="vscode-textarea meeting-review-textarea"
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder={t('pasteTranscriptionPlaceholder')}
            rows={8}
          />
        </div>

        {/* Action bar */}
        <div className="meeting-review-action-bar">
          <button
            type="button"
            className="capture-send-btn"
            onClick={handleProcess}
            disabled={isProcessing || (meeting.rawNotes.length === 0 && !transcription.trim())}
          >
            <Sparkles size={14} />
            <span>{isProcessing ? t('processing') : t('processMeeting')}</span>
          </button>
          {meeting.rawNotes.length === 0 && !transcription.trim() && (
            <span className="meeting-review-warning">{t('addNotesOrTranscription')}</span>
          )}
        </div>

        {/* Error display */}
        {processError && (
          <div className="meeting-process-error">
            <AlertTriangle size={14} />
            <span>{processError}</span>
          </div>
        )}
      </div>
    )
  }

  // === SELECT (user picks which entries/tasks to save) ===
  if (step === 'select' && meeting) {
    const meetingDate = new Date(`${meeting.meetingDate}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    const selectedEntriesCount = previewEntries.filter((e) => e.selected).length
    const selectedTasksCount = previewTasks.filter((t) => t.selected).length
    const selectedResolvedCount = previewResolvedTasks.filter((rt) => rt.selected).length

    return (
      <div className="meeting-container meeting-container-wide">
        <div className="panel-header">
          <span className="panel-title">
            {t('reviewResult')} — {meeting.title}
          </span>
        </div>

        <div className="meeting-meta-bar">
          <span>
            <Clock size={12} /> {meetingDate}
          </span>
          {meeting.participants.length > 0 && (
            <span>
              <Users size={12} /> {meeting.participants.join(', ')}
            </span>
          )}
        </div>

        {/* Generated minutes - collapsible */}
        {generatedMinutes && (
          <details className="meeting-minutes-collapsible">
            <summary className="meeting-minutes-summary">
              <FileText size={14} />
              <span>{t('meetingMinutes')}</span>
              <div className="meeting-minutes-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={(e) => {
                    e.preventDefault()
                    handleCopyMinutes()
                  }}
                  title={t('copyMinutes')}
                  style={{ opacity: 1 }}
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={(e) => {
                    e.preventDefault()
                    handleDownloadMinutes()
                  }}
                  title={t('downloadMinutes')}
                  style={{ opacity: 1 }}
                >
                  <Download size={14} />
                </button>
              </div>
            </summary>
            <div className="meeting-minutes-content">
              <MarkdownViewer content={generatedMinutes} />
            </div>
          </details>
        )}

        {/* Entries selection */}
        {previewEntries.length > 0 && (
          <div className="meeting-select-section">
            <div className="meeting-select-header">
              <h4>{t('entriesToCreate', { selected: selectedEntriesCount, total: previewEntries.length })}</h4>
              <div className="meeting-select-actions">
                <button type="button" className="vscode-button secondary" onClick={() => selectAllEntries(true)}>
                  {t('all')}
                </button>
                <button type="button" className="vscode-button secondary" onClick={() => selectAllEntries(false)}>
                  {t('none')}
                </button>
              </div>
            </div>
            <div className="meeting-select-list">
              {previewEntries.map((entry, i) => (
                <label key={i} className={`meeting-select-item ${entry.selected ? 'selected' : ''}`}>
                  <input type="checkbox" checked={entry.selected} onChange={() => toggleEntry(i)} />
                  <span
                    className={`meeting-select-badge badge-${entry.type} meeting-badge-clickable`}
                    onClick={(e) => {
                      e.preventDefault()
                      setEditingEntryTypeIndex(editingEntryTypeIndex === i ? null : i)
                    }}
                    title={t('clickToChangeType')}
                  >
                    {typeLabels[entry.type] || entry.type}
                  </span>
                  {editingEntryTypeIndex === i && (
                    <div className="meeting-type-dropdown" onClick={(e) => e.preventDefault()}>
                      {Object.entries(typeLabels).map(([type, label]) => (
                        <button
                          type="button"
                          key={type}
                          className={`meeting-type-option ${type === entry.type ? 'active' : ''}`}
                          onClick={(e) => {
                            e.preventDefault()
                            updateEntryType(i, type)
                          }}
                        >
                          <span className={`meeting-select-badge badge-${type}`}>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {editingEntryIndex === i ? (
                    <input
                      type="text"
                      className="vscode-input meeting-inline-edit"
                      value={entry.text}
                      onChange={(e) => updateEntryText(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingEntryIndex(null)
                      }}
                      onBlur={() => setEditingEntryIndex(null)}
                      autoFocus
                      onClick={(e) => e.preventDefault()}
                    />
                  ) : (
                    <span
                      className="meeting-select-text meeting-editable"
                      onDoubleClick={(e) => {
                        e.preventDefault()
                        setEditingEntryIndex(i)
                      }}
                    >
                      {entry.text}
                    </span>
                  )}
                  {editingEntryIndex !== i && (
                    <button
                      type="button"
                      className="meeting-edit-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        setEditingEntryIndex(i)
                      }}
                      title={t('editText')}
                    >
                      <Pencil size={11} />
                    </button>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Tasks selection */}
        {previewTasks.length > 0 &&
          (() => {
            const isMyTask = (task: ProcessedTask) => {
              if (!userName || !task.assignee) return false
              return (
                task.assignee.toLowerCase().includes(userName.toLowerCase()) ||
                userName.toLowerCase().includes(task.assignee.toLowerCase())
              )
            }

            const myTasks = previewTasks.map((t, i) => ({ ...t, originalIndex: i })).filter((t) => isMyTask(t))
            const otherTasks = previewTasks.map((t, i) => ({ ...t, originalIndex: i })).filter((t) => !isMyTask(t))
            const mySelectedCount = myTasks.filter((t) => t.selected).length
            const otherSelectedCount = otherTasks.filter((t) => t.selected).length

            const renderTask = (task: ProcessedTask & { originalIndex: number }) => (
              <label
                key={task.originalIndex}
                className={`meeting-select-item ${task.selected ? 'selected' : ''} ${task.similarTo ? 'has-warning' : ''}`}
              >
                <input type="checkbox" checked={task.selected} onChange={() => toggleTask(task.originalIndex)} />
                <span className="meeting-select-text">
                  {editingTaskIndex === task.originalIndex ? (
                    <div className="meeting-inline-edit-group" onClick={(e) => e.preventDefault()}>
                      <input
                        type="text"
                        className="vscode-input meeting-inline-edit"
                        value={task.title}
                        onChange={(e) => updateTaskTitle(task.originalIndex, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') setEditingTaskIndex(null)
                        }}
                        onBlur={() => setEditingTaskIndex(null)}
                        autoFocus
                        placeholder={t('taskTitlePlaceholder')}
                      />
                      <input
                        type="text"
                        className="vscode-input meeting-inline-edit meeting-inline-edit-desc"
                        value={task.description || ''}
                        onChange={(e) => updateTaskDescription(task.originalIndex, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingTaskIndex(null)
                        }}
                        placeholder={t('taskDescriptionPlaceholder')}
                      />
                    </div>
                  ) : (
                    <>
                      <strong
                        className="meeting-editable"
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          setEditingTaskIndex(task.originalIndex)
                        }}
                      >
                        {task.title}
                      </strong>
                      {task.assignee && <span className="meeting-task-assignee-badge">{task.assignee}</span>}
                      {task.description && <span className="meeting-select-desc"> — {task.description}</span>}
                    </>
                  )}
                  {task.similarTo && (
                    <span className="meeting-task-similar-warning">
                      <AlertTriangle size={12} />
                      <span>{t('similarTo', { title: task.similarTo.taskTitle, reason: task.similarTo.reason })}</span>
                    </span>
                  )}
                </span>
                {editingTaskIndex !== task.originalIndex && (
                  <button
                    type="button"
                    className="meeting-edit-btn"
                    onClick={(e) => {
                      e.preventDefault()
                      setEditingTaskIndex(task.originalIndex)
                    }}
                    title={t('editTask')}
                  >
                    <Pencil size={11} />
                  </button>
                )}
              </label>
            )

            // If no userName configured or no assignee data, show flat list
            if (!userName || (myTasks.length === 0 && otherTasks.length === 0)) {
              return (
                <div className="meeting-select-section">
                  <div className="meeting-select-header">
                    <h4>{t('tasksToCreate', { selected: selectedTasksCount, total: previewTasks.length })}</h4>
                    <div className="meeting-select-actions">
                      <button type="button" className="vscode-button secondary" onClick={() => selectAllTasks(true)}>
                        {t('all')}
                      </button>
                      <button type="button" className="vscode-button secondary" onClick={() => selectAllTasks(false)}>
                        {t('none')}
                      </button>
                    </div>
                  </div>
                  <div className="meeting-select-list">
                    {previewTasks.map((task, i) => renderTask({ ...task, originalIndex: i }))}
                  </div>
                </div>
              )
            }

            return (
              <>
                {/* My tasks */}
                {myTasks.length > 0 && (
                  <div className="meeting-select-section meeting-select-mine">
                    <div className="meeting-select-header">
                      <h4>🎯 {t('myTasks', { selected: mySelectedCount, total: myTasks.length })}</h4>
                      <div className="meeting-select-actions">
                        <button
                          type="button"
                          className="vscode-button secondary"
                          onClick={() => {
                            setPreviewTasks((prev) =>
                              prev.map((t, i) =>
                                myTasks.some((mt) => mt.originalIndex === i) ? { ...t, selected: true } : t
                              )
                            )
                          }}
                        >
                          {t('all')}
                        </button>
                        <button
                          type="button"
                          className="vscode-button secondary"
                          onClick={() => {
                            setPreviewTasks((prev) =>
                              prev.map((t, i) =>
                                myTasks.some((mt) => mt.originalIndex === i) ? { ...t, selected: false } : t
                              )
                            )
                          }}
                        >
                          {t('none')}
                        </button>
                      </div>
                    </div>
                    <div className="meeting-select-list">{myTasks.map(renderTask)}</div>
                  </div>
                )}

                {/* Others' tasks */}
                {otherTasks.length > 0 && (
                  <div className="meeting-select-section meeting-select-others">
                    <div className="meeting-select-header">
                      <h4>👥 {t('othersTasks', { selected: otherSelectedCount, total: otherTasks.length })}</h4>
                      <div className="meeting-select-actions">
                        <button
                          type="button"
                          className="vscode-button secondary"
                          onClick={() => {
                            setPreviewTasks((prev) =>
                              prev.map((t, i) =>
                                otherTasks.some((ot) => ot.originalIndex === i) ? { ...t, selected: true } : t
                              )
                            )
                          }}
                        >
                          {t('all')}
                        </button>
                        <button
                          type="button"
                          className="vscode-button secondary"
                          onClick={() => {
                            setPreviewTasks((prev) =>
                              prev.map((t, i) =>
                                otherTasks.some((ot) => ot.originalIndex === i) ? { ...t, selected: false } : t
                              )
                            )
                          }}
                        >
                          {t('none')}
                        </button>
                      </div>
                    </div>
                    <div className="meeting-select-list">{otherTasks.map(renderTask)}</div>
                  </div>
                )}
              </>
            )
          })()}

        {/* Resolved tasks selection */}
        {previewResolvedTasks.length > 0 && (
          <div className="meeting-select-section meeting-select-resolved">
            <div className="meeting-select-header">
              <h4>
                ✅{' '}
                {t('resolvedTasks', {
                  selected: previewResolvedTasks.filter((rt) => rt.selected).length,
                  total: previewResolvedTasks.length,
                })}
              </h4>
              <div className="meeting-select-actions">
                <button type="button" className="vscode-button secondary" onClick={() => selectAllResolvedTasks(true)}>
                  {t('all')}
                </button>
                <button type="button" className="vscode-button secondary" onClick={() => selectAllResolvedTasks(false)}>
                  {t('none')}
                </button>
              </div>
            </div>
            <p className="meeting-select-hint">{t('resolvedTasksHint')}</p>
            <div className="meeting-select-list">
              {previewResolvedTasks.map((rt, i) => (
                <label key={i} className={`meeting-select-item ${rt.selected ? 'selected' : ''}`}>
                  <input type="checkbox" checked={rt.selected} onChange={() => toggleResolvedTask(i)} />
                  <span className="meeting-select-text">
                    <strong>{rt.taskTitle}</strong>
                    <span className="meeting-resolved-reason"> — {rt.reason}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Save actions */}
        <div className="meeting-actions">
          <button
            type="button"
            className="vscode-button"
            onClick={handleSaveSelected}
            disabled={isSaving || isProcessing}
          >
            <Check size={14} />
            {isSaving
              ? t('saving')
              : selectedResolvedCount > 0
                ? t('saveSelectedWithResolved', {
                    entries: selectedEntriesCount,
                    tasks: selectedTasksCount,
                    resolved: selectedResolvedCount,
                  })
                : t('saveSelected', { entries: selectedEntriesCount, tasks: selectedTasksCount })}
          </button>
          <button
            type="button"
            className="vscode-button secondary"
            onClick={handleReprocess}
            disabled={isProcessing || isSaving}
          >
            <RefreshCw size={14} />
            {isProcessing ? t('reprocessing') : t('reprocess')}
          </button>
          <button type="button" className="vscode-button secondary" onClick={handleCopyMinutes}>
            <Copy size={14} />
            {t('copyMinutes')}
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="vscode-button danger"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSaving || isProcessing}
            title={t('deleteMeeting')}
          >
            <Trash2 size={14} />
            {t('deleteMeeting')}
          </button>
        </div>

        <ConfirmModal
          isOpen={showDeleteConfirm}
          title={t('deleteMeetingTitle')}
          message={t('deleteMeetingMessage')}
          confirmLabel={t('deleteMeeting')}
          cancelLabel={t('common:cancel')}
          variant="danger"
          onConfirm={handleDeleteMeeting}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>
    )
  }

  // === SAVED (confirmation) ===
  if (step === 'saved' && meeting) {
    return (
      <div className="meeting-container">
        <div className="panel-header">
          <span className="panel-title">
            {t('meetingSaved')} — {meeting.title}
          </span>
        </div>

        <div className="meeting-processed-info">
          <Check size={16} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
          <p>{t('meetingSavedInfo')}</p>
        </div>

        <div className="meeting-actions">
          <button type="button" className="vscode-button secondary" onClick={handleCopyMinutes}>
            <Copy size={14} />
            {t('copyMinutes')}
          </button>
          <button type="button" className="vscode-button secondary" onClick={handleDownloadMinutes}>
            <Download size={14} />
            {t('saveAsMd')}
          </button>
          <button type="button" className="vscode-button secondary" onClick={handleNewMeeting}>
            <Plus size={14} />
            {t('newMeeting')}
          </button>
          {onFinished && meeting && (
            <button type="button" className="vscode-button" onClick={() => onFinished(meeting.projectId)}>
              {t('viewKanban')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="vscode-button danger"
            onClick={() => setShowDeleteConfirm(true)}
            title={t('deleteMeetingAndData')}
          >
            <Trash2 size={14} />
            {t('deleteAll')}
          </button>
        </div>

        <ConfirmModal
          isOpen={showDeleteConfirm}
          title={t('deleteMeetingAndDataTitle')}
          message={t('deleteMeetingAndDataMessage', { entries: savedEntryIds.length, tasks: savedTaskIds.length })}
          confirmLabel={t('deleteAll')}
          cancelLabel={t('common:cancel')}
          variant="danger"
          onConfirm={handleDeleteMeeting}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>
    )
  }

  return null
}
