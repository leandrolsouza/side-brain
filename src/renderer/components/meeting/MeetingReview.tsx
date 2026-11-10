import { Clock, Users, ClipboardPaste, Sparkles, FileText, ListChecks, AlertTriangle } from 'lucide-react'
import type { MeetingController } from './useMeetingController'

export function MeetingReview({ state }: { state: MeetingController }) {
  const { t, meeting, transcription, setTranscription, isProcessing, processError, handleProcess } = state
  if (!meeting) return null

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
