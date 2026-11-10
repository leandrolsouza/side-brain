import { Clock, Users, FileText, Copy, Download, Check, RefreshCw, Trash2, AlertTriangle, Pencil } from 'lucide-react'
import { MarkdownViewer } from '../MarkdownViewer'
import { ConfirmModal } from '../ConfirmModal'

import type { ProcessedTask } from './meeting-types'
import type { MeetingController } from './useMeetingController'

export function MeetingSelection({ state }: { state: MeetingController }) {
  const {
    t,
    meeting,
    isProcessing,
    generatedMinutes,
    previewEntries,
    previewTasks,
    setPreviewTasks,
    previewResolvedTasks,
    isSaving,
    showDeleteConfirm,
    setShowDeleteConfirm,
    userName,
    editingEntryIndex,
    setEditingEntryIndex,
    editingTaskIndex,
    setEditingTaskIndex,
    editingEntryTypeIndex,
    setEditingEntryTypeIndex,
    handleSaveSelected,
    toggleEntry,
    toggleTask,
    selectAllEntries,
    selectAllTasks,
    toggleResolvedTask,
    selectAllResolvedTasks,
    updateEntryText,
    updateEntryType,
    updateTaskTitle,
    updateTaskDescription,
    handleCopyMinutes,
    handleDownloadMinutes,
    handleReprocess,
    handleDeleteMeeting,
    typeLabels,
  } = state
  if (!meeting) return null

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
