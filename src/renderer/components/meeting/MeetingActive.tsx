import { Square, Plus, Clock, Users } from 'lucide-react'
import type { MeetingController } from './useMeetingController'

export function MeetingActive({ state }: { state: MeetingController }) {
  const { t, meeting, noteInput, setNoteInput, elapsed, noteInputRef, handleAddNote, handleEnd, formatTime } = state
  if (!meeting) return null

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
