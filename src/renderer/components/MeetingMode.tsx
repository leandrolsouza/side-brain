import React, { useState, useEffect, useRef } from 'react'
import { Play, Square, Plus, Clock, Users, ClipboardPaste, Sparkles, FileText, Copy, Download, Check, RefreshCw } from 'lucide-react'

interface Meeting {
  id: string
  projectId: string
  title: string
  participants: string[]
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
  selected: boolean
}

type MeetingStep = 'setup' | 'active' | 'review' | 'select' | 'saved'

interface MeetingModeProps {
  projectId?: string
  onFinished?: () => void
}

export function MeetingMode({ projectId, onFinished }: MeetingModeProps) {
  const [step, setStep] = useState<MeetingStep>('setup')
  const [projects, setProjects] = useState<Project[]>([])
  const [meeting, setMeeting] = useState<Meeting | null>(null)

  // Setup form
  const [title, setTitle] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '')
  const [participantsInput, setParticipantsInput] = useState('')

  // Active meeting
  const [noteInput, setNoteInput] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const noteInputRef = useRef<HTMLInputElement>(null)

  // Review/paste
  const [transcription, setTranscription] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Selection step
  const [generatedMinutes, setGeneratedMinutes] = useState('')
  const [previewEntries, setPreviewEntries] = useState<ProcessedEntry[]>([])
  const [previewTasks, setPreviewTasks] = useState<ProcessedTask[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadProjects()
    checkActiveMeeting()
  }, [])

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

  const checkActiveMeeting = async () => {
    const active = await window.electronAPI.getActiveMeeting()
    if (active) {
      setMeeting(active)
      setStep('active')
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
    try {
      if (transcription.trim()) {
        await window.electronAPI.setMeetingTranscription(meeting.id, transcription.trim())
      }

      // Step 1: AI analyzes — returns result without saving entries/tasks
      const result = await window.electronAPI.processMeeting(meeting.id)

      if (result) {
        setGeneratedMinutes(result.minutes || '')
        setPreviewEntries(
          (result.entries || []).map((e: any) => ({ ...e, selected: true }))
        )
        setPreviewTasks(
          (result.tasks || []).map((t: any) => ({ ...t, selected: true }))
        )
        // Update meeting with minutes
        setMeeting((prev) => prev ? { ...prev, generatedMinutes: result.minutes, status: 'processed' } : null)
      }

      setStep('select')
    } catch (error) {
      console.error('Failed to process meeting:', error)
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
        .map(({ title, description }) => ({ title, description }))

      await window.electronAPI.saveSelectedMeetingItems(meeting.id, selectedE, selectedT)
      setStep('saved')
    } catch (error) {
      console.error('Failed to save selected items:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEntry = (index: number) => {
    setPreviewEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e))
    )
  }

  const toggleTask = (index: number) => {
    setPreviewTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    )
  }

  const selectAllEntries = (value: boolean) => {
    setPreviewEntries((prev) => prev.map((e) => ({ ...e, selected: value })))
  }

  const selectAllTasks = (value: boolean) => {
    setPreviewTasks((prev) => prev.map((t) => ({ ...t, selected: value })))
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
        setPreviewEntries(
          (result.entries || []).map((e: any) => ({ ...e, selected: true }))
        )
        setPreviewTasks(
          (result.tasks || []).map((t: any) => ({ ...t, selected: true }))
        )
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
    setTranscription('')
    setGeneratedMinutes('')
    setPreviewEntries([])
    setPreviewTasks([])
    setElapsed(0)
  }

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const typeLabels: Record<string, string> = {
    information: 'Info',
    decision: 'Decisão',
    demand: 'Demanda',
    idea: 'Ideia',
    blocker: 'Bloqueio',
    update: 'Atualização',
  }

  // === SETUP ===
  if (step === 'setup') {
    return (
      <div className="meeting-container">
        <div className="panel-header">
          <span className="panel-title">Nova Reunião</span>
        </div>

        <div className="meeting-setup">
          <div className="meeting-form-group">
            <label>Título da reunião</label>
            <input
              type="text"
              className="vscode-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Sprint Planning, Daily, Alinhamento com cliente..."
              autoFocus
            />
          </div>

          <div className="meeting-form-group">
            <label>Projeto</label>
            <select
              className="vscode-select"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="meeting-form-group">
            <label>Participantes (opcional)</label>
            <input
              type="text"
              className="vscode-input"
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.target.value)}
              placeholder="João, Maria, Pedro (separados por vírgula)"
            />
          </div>

          <div className="meeting-capture-options">
            <p className="meeting-hint">Como deseja capturar?</p>
            <div className="meeting-option-cards">
              <div className="meeting-option-card" onClick={handleStart}>
                <Play size={20} />
                <span className="meeting-option-title">Ao vivo</span>
                <span className="meeting-option-desc">Digito notas durante a reunião</span>
              </div>
              <div className="meeting-option-card" onClick={() => {
                if (!title.trim() || !selectedProjectId) return
                handleStart().then(() => setStep('review'))
              }}>
                <ClipboardPaste size={20} />
                <span className="meeting-option-title">Colar transcrição</span>
                <span className="meeting-option-desc">Copio do Teams/Meet depois</span>
              </div>
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
            Reunião em andamento
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
          {meeting.rawNotes.length === 0 && (
            <div className="meeting-empty-notes">
              Comece a anotar os pontos da reunião...
            </div>
          )}
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
            placeholder="Digite uma nota e pressione Enter..."
            autoFocus
          />
          <button className="vscode-button secondary" onClick={handleAddNote}>
            <Plus size={14} />
          </button>
        </div>

        <div className="meeting-actions">
          <button className="vscode-button danger" onClick={handleEnd}>
            <Square size={14} />
            Encerrar Reunião
          </button>
        </div>
      </div>
    )
  }

  // === REVIEW (after ending or paste mode) ===
  if (step === 'review' && meeting) {
    return (
      <div className="meeting-container">
        <div className="panel-header">
          <span className="panel-title">Reunião Encerrada — {meeting.title}</span>
        </div>

        {meeting.rawNotes.length > 0 && (
          <div className="meeting-review-section">
            <h4>Notas capturadas ({meeting.rawNotes.length})</h4>
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

        <div className="meeting-review-section">
          <h4>
            <ClipboardPaste size={14} />
            Colar transcrição (opcional)
          </h4>
          <p className="meeting-hint">
            Cole aqui a transcrição do Teams, Meet ou Zoom. A IA vai processar junto com as notas.
          </p>
          <textarea
            className="vscode-textarea"
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Cole a transcrição aqui... (suporta texto puro ou formato VTT)"
            rows={10}
          />
        </div>

        <div className="meeting-actions">
          <button
            className="vscode-button"
            onClick={handleProcess}
            disabled={isProcessing || (meeting.rawNotes.length === 0 && !transcription.trim())}
          >
            <Sparkles size={14} />
            {isProcessing ? 'Processando com IA...' : 'Processar Reunião'}
          </button>
          {meeting.rawNotes.length === 0 && !transcription.trim() && (
            <span className="meeting-hint">Adicione notas ou cole uma transcrição para processar.</span>
          )}
        </div>
      </div>
    )
  }

  // === SELECT (user picks which entries/tasks to save) ===
  if (step === 'select' && meeting) {
    const meetingDate = new Date(meeting.startedAt).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const selectedEntriesCount = previewEntries.filter((e) => e.selected).length
    const selectedTasksCount = previewTasks.filter((t) => t.selected).length

    return (
      <div className="meeting-container meeting-container-wide">
        <div className="panel-header">
          <span className="panel-title">Revisar Resultado — {meeting.title}</span>
        </div>

        <div className="meeting-meta-bar">
          <span><Clock size={12} /> {meetingDate}</span>
          {meeting.participants.length > 0 && (
            <span><Users size={12} /> {meeting.participants.join(', ')}</span>
          )}
        </div>

        {/* Generated minutes - collapsible */}
        {generatedMinutes && (
          <details className="meeting-minutes-collapsible">
            <summary className="meeting-minutes-summary">
              <FileText size={14} />
              <span>Ata da Reunião</span>
              <div className="meeting-minutes-actions">
                <button className="icon-button" onClick={(e) => { e.preventDefault(); handleCopyMinutes() }} title="Copiar ata" style={{ opacity: 1 }}>
                  <Copy size={14} />
                </button>
                <button className="icon-button" onClick={(e) => { e.preventDefault(); handleDownloadMinutes() }} title="Salvar como .md" style={{ opacity: 1 }}>
                  <Download size={14} />
                </button>
              </div>
            </summary>
            <div className="meeting-minutes-content">
              {generatedMinutes}
            </div>
          </details>
        )}

        {/* Entries selection */}
        {previewEntries.length > 0 && (
          <div className="meeting-select-section">
            <div className="meeting-select-header">
              <h4>Entradas a criar ({selectedEntriesCount}/{previewEntries.length})</h4>
              <div className="meeting-select-actions">
                <button className="vscode-button secondary" onClick={() => selectAllEntries(true)}>
                  Todas
                </button>
                <button className="vscode-button secondary" onClick={() => selectAllEntries(false)}>
                  Nenhuma
                </button>
              </div>
            </div>
            <div className="meeting-select-list">
              {previewEntries.map((entry, i) => (
                <label key={i} className={`meeting-select-item ${entry.selected ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={entry.selected}
                    onChange={() => toggleEntry(i)}
                  />
                  <span className={`meeting-select-badge badge-${entry.type}`}>
                    {typeLabels[entry.type] || entry.type}
                  </span>
                  <span className="meeting-select-text">{entry.text}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Tasks selection */}
        {previewTasks.length > 0 && (
          <div className="meeting-select-section">
            <div className="meeting-select-header">
              <h4>Tasks a criar no Kanban ({selectedTasksCount}/{previewTasks.length})</h4>
              <div className="meeting-select-actions">
                <button className="vscode-button secondary" onClick={() => selectAllTasks(true)}>
                  Todas
                </button>
                <button className="vscode-button secondary" onClick={() => selectAllTasks(false)}>
                  Nenhuma
                </button>
              </div>
            </div>
            <div className="meeting-select-list">
              {previewTasks.map((task, i) => (
                <label key={i} className={`meeting-select-item ${task.selected ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={task.selected}
                    onChange={() => toggleTask(i)}
                  />
                  <span className="meeting-select-text">
                    <strong>{task.title}</strong>
                    {task.description && (
                      <span className="meeting-select-desc"> — {task.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Save actions */}
        <div className="meeting-actions">
          <button
            className="vscode-button"
            onClick={handleSaveSelected}
            disabled={isSaving || isProcessing}
          >
            <Check size={14} />
            {isSaving ? 'Salvando...' : `Salvar Selecionados (${selectedEntriesCount} entradas, ${selectedTasksCount} tasks)`}
          </button>
          <button
            className="vscode-button secondary"
            onClick={handleReprocess}
            disabled={isProcessing || isSaving}
          >
            <RefreshCw size={14} />
            {isProcessing ? 'Reprocessando...' : 'Reprocessar'}
          </button>
          <button className="vscode-button secondary" onClick={handleCopyMinutes}>
            <Copy size={14} />
            Copiar Ata
          </button>
        </div>
      </div>
    )
  }

  // === SAVED (confirmation) ===
  if (step === 'saved' && meeting) {
    return (
      <div className="meeting-container">
        <div className="panel-header">
          <span className="panel-title">Reunião Salva — {meeting.title}</span>
        </div>

        <div className="meeting-processed-info">
          <Check size={16} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
          <p>
            Entradas e tasks selecionadas foram criadas no projeto.
            A ata está salva no histórico de reuniões.
          </p>
        </div>

        <div className="meeting-actions">
          <button className="vscode-button secondary" onClick={handleCopyMinutes}>
            <Copy size={14} />
            Copiar Ata
          </button>
          <button className="vscode-button secondary" onClick={handleDownloadMinutes}>
            <Download size={14} />
            Salvar .md
          </button>
          <button className="vscode-button secondary" onClick={handleNewMeeting}>
            <Plus size={14} />
            Nova Reunião
          </button>
          {onFinished && (
            <button className="vscode-button" onClick={onFinished}>
              Ver Kanban
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
