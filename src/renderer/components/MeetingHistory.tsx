import React, { useState, useEffect } from 'react'
import { FileText, Clock, Users, Trash2, ChevronDown, ChevronRight, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'

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

interface MeetingHistoryProps {
  projectId: string
}

export function MeetingHistory({ projectId }: MeetingHistoryProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [reprocessError, setReprocessError] = useState<string | null>(null)

  useEffect(() => {
    loadMeetings()
  }, [projectId])

  const loadMeetings = async () => {
    const data = await window.electronAPI.getMeetings(projectId)
    setMeetings(data)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await window.electronAPI.deleteMeeting(id)
    await loadMeetings()
  }

  const handleReprocess = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setProcessingId(id)
    setReprocessError(null)
    try {
      const result = await window.electronAPI.processMeeting(id)
      if (result) {
        await loadMeetings()
      } else {
        setReprocessError('A IA não retornou resultado. Tente novamente.')
      }
    } catch (error: any) {
      console.error('Failed to reprocess meeting:', error)
      setReprocessError(
        error?.message?.includes('invalid JSON')
          ? 'A IA retornou formato inválido. Tente novamente.'
          : error?.message || 'Erro ao reprocessar reunião.'
      )
    } finally {
      setProcessingId(null)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (startedAt: string, endedAt: string | null): string => {
    if (!endedAt) return 'Em andamento'
    const start = new Date(startedAt).getTime()
    const end = new Date(endedAt).getTime()
    const diffMin = Math.round((end - start) / 60000)
    if (diffMin < 60) return `${diffMin}min`
    const h = Math.floor(diffMin / 60)
    const m = diffMin % 60
    return `${h}h${m > 0 ? `${m}min` : ''}`
  }

  const getStatusLabel = (status: string): { text: string; variant: string } => {
    switch (status) {
      case 'active': return { text: 'Em andamento', variant: 'warning' }
      case 'ended': return { text: 'Aguardando processamento', variant: 'info' }
      case 'processed': return { text: 'Processada', variant: 'success' }
      default: return { text: status, variant: 'neutral' }
    }
  }

  if (meetings.length === 0) {
    return (
      <div className="meeting-history-empty">
        <FileText size={32} />
        <span>Nenhuma reunião registrada neste projeto.</span>
        <span className="meeting-hint">Use o modo "Nova Reunião" para capturar e gerar atas automaticamente.</span>
      </div>
    )
  }

  return (
    <div className="meeting-history">
      {reprocessError && (
        <div className="meeting-process-error" style={{ marginBottom: 12 }}>
          <AlertTriangle size={14} />
          <span>{reprocessError}</span>
        </div>
      )}
      {meetings.map((meeting) => {
        const isExpanded = expandedId === meeting.id
        const status = getStatusLabel(meeting.status)

        return (
          <div key={meeting.id} className="meeting-history-item">
            <div
              className="meeting-history-header"
              onClick={() => toggleExpand(meeting.id)}
            >
              <div className="meeting-history-chevron">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              <div className="meeting-history-info">
                <div className="meeting-history-title">
                  <FileText size={14} />
                  <span>{meeting.title}</span>
                  <span className={`vscode-badge ${status.variant}`}>{status.text}</span>
                </div>
                <div className="meeting-history-meta">
                  <span>
                    <Clock size={10} />
                    {meeting.meetingDate
                      ? new Date(meeting.meetingDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : formatDate(meeting.startedAt)}
                  </span>
                  <span>
                    Duração: {formatDuration(meeting.startedAt, meeting.endedAt)}
                  </span>
                  {meeting.participants.length > 0 && (
                    <span>
                      <Users size={10} />
                      {meeting.participants.join(', ')}
                    </span>
                  )}
                  <span>
                    {meeting.rawNotes.length} notas
                  </span>
                </div>
              </div>

              <div className="meeting-history-actions">
                {(meeting.status === 'active' || meeting.status === 'ended') && (
                  <button
                    className="vscode-button secondary"
                    onClick={(e) => handleReprocess(e, meeting.id)}
                    disabled={processingId === meeting.id}
                    title="Reprocessar reunião"
                    style={{ fontSize: 11, padding: '3px 10px' }}
                  >
                    {processingId === meeting.id ? (
                      <><Sparkles size={12} className="spinning" /> Processando...</>
                    ) : (
                      <><RefreshCw size={12} /> Reprocessar</>
                    )}
                  </button>
                )}
                <button
                  className="icon-button"
                  onClick={(e) => handleDelete(e, meeting.id)}
                  title="Excluir reunião"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="meeting-history-body">
                {/* Generated minutes */}
                {meeting.generatedMinutes && (
                  <div className="meeting-minutes">
                    <div className="meeting-minutes-header">
                      <FileText size={14} />
                      <span>Ata</span>
                    </div>
                    <div className="meeting-minutes-content">
                      <MarkdownViewer content={meeting.generatedMinutes} />
                    </div>
                  </div>
                )}

                {/* Raw notes */}
                {meeting.rawNotes.length > 0 && (
                  <div className="meeting-review-section">
                    <h4>Notas capturadas</h4>
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

                {/* Pasted transcription preview */}
                {meeting.pastedTranscription && (
                  <div className="meeting-review-section">
                    <h4>Transcrição colada</h4>
                    <div className="meeting-transcription-preview">
                      {meeting.pastedTranscription.slice(0, 500)}
                      {meeting.pastedTranscription.length > 500 && '...'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
