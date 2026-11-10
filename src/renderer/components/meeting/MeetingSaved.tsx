import { Plus, Copy, Download, Check, Trash2 } from 'lucide-react'
import { ConfirmModal } from '../ConfirmModal'

import type { MeetingController } from './useMeetingController'

export function MeetingSaved({ state }: { state: MeetingController }) {
  const {
    onFinished,
    t,
    meeting,
    savedEntryIds,
    savedTaskIds,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleCopyMinutes,
    handleDownloadMinutes,
    handleNewMeeting,
    handleDeleteMeeting,
  } = state
  if (!meeting) return null

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
