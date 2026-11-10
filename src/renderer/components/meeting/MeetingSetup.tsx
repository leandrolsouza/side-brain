import { Play, ClipboardPaste, Sparkles, Copy, Loader2, ListChecks } from 'lucide-react'
import { MarkdownViewer } from '../MarkdownViewer'
import type { MeetingController } from './useMeetingController'

export function MeetingSetup({ state }: { state: MeetingController }) {
  const {
    t,
    setStep,
    projects,
    title,
    setTitle,
    selectedProjectId,
    setSelectedProjectId,
    participantsInput,
    setParticipantsInput,
    meetingDate,
    setMeetingDate,
    suggestedAgenda,
    isPreparingAgenda,
    handlePrepareAgenda,
    handleCopyAgenda,
    handleStart,
  } = state

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
