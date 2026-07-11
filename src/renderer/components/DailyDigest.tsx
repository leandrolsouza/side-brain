import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DailyDigestData, CustomEntryType } from '../../shared/types'

interface DailyDigestProps {
  onClose: () => void
  onNavigateToProject?: (projectId: string, projectName: string) => void
}

export function DailyDigest({ onClose, onNavigateToProject }: DailyDigestProps) {
  const { t } = useTranslation('common')
  const [digest, setDigest] = useState<DailyDigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entryTypes, setEntryTypes] = useState<CustomEntryType[]>([])
  const [visibleSections, setVisibleSections] = useState<string[]>(['aiSuggestion', 'pendingTasks', 'yesterdayActivity'])

  const typeLabels: Record<string, string> = useMemo(
    () => Object.fromEntries(entryTypes.map(t => [t.key, t.label])),
    [entryTypes]
  )

  useEffect(() => {
    loadDigest()
    window.electronAPI.getEntryTypes().then(setEntryTypes).catch(() => { })
    // Load section visibility from settings
    window.electronAPI.getSettings().then((data) => {
      if (data?.dailyDigestSections) {
        setVisibleSections(data.dailyDigestSections.split(',').filter(Boolean))
      }
    }).catch(() => { })
  }, [])

  const loadDigest = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.electronAPI.generateDailyDigest()
      setDigest(data)
    } catch (err: any) {
      setError(err.message || t('error'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="digest-overlay" onClick={onClose}>
        <div className="digest-modal" onClick={(e) => e.stopPropagation()}>
          <div className="digest-loading">
            <div className="digest-spinner" />
            <p>{t('dailyDigest.preparingDigest')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="digest-overlay" onClick={onClose}>
        <div className="digest-modal" onClick={(e) => e.stopPropagation()}>
          <div className="digest-header">
            <h2>{t('dailyDigest.title')}</h2>
            <button className="digest-close" onClick={onClose}>✕</button>
          </div>
          <div className="digest-error">
            <p>{t('dailyDigest.errorGenerating', { error })}</p>
            <button className="digest-retry-btn" onClick={loadDigest}>{t('dailyDigest.retry')}</button>
          </div>
        </div>
      </div>
    )
  }

  if (!digest) return null

  const totalPending =
    digest.tasksNeedingAttention.overdue.length +
    digest.tasksNeedingAttention.inProgress.length +
    digest.tasksNeedingAttention.waiting.length

  return (
    <div className="digest-overlay" onClick={onClose}>
      <div className="digest-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="digest-header">
          <h2>{digest.greeting}</h2>
          <button className="digest-close" onClick={onClose}>✕</button>
        </div>

        <div className="digest-body">
          {/* AI Suggestion */}
          {visibleSections.includes('aiSuggestion') && digest.aiSuggestion && (
            <div className="digest-section digest-suggestion">
              <div className="digest-section-icon">💡</div>
              <div className="digest-section-content">
                <h3>{t('dailyDigest.focusSuggestion')}</h3>
                <p>{digest.aiSuggestion}</p>
              </div>
            </div>
          )}

          {/* Tasks Needing Attention */}
          {visibleSections.includes('pendingTasks') && (
            <div className="digest-section">
              <h3>📋 {t('dailyDigest.pendingTasks', { count: totalPending })}</h3>

              {digest.tasksNeedingAttention.inProgress.length > 0 && (
                <div className="digest-task-group">
                  <span className="digest-task-label in-progress">{t('dailyDigest.inProgress')}</span>
                  <ul>
                    {digest.tasksNeedingAttention.inProgress.slice(0, 5).map((task) => (
                      <li key={task.id}>{task.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              {digest.tasksNeedingAttention.overdue.length > 0 && (
                <div className="digest-task-group">
                  <span className="digest-task-label todo">{t('dailyDigest.todo')}</span>
                  <ul>
                    {digest.tasksNeedingAttention.overdue.slice(0, 5).map((task) => (
                      <li key={task.id}>{task.title}</li>
                    ))}
                    {digest.tasksNeedingAttention.overdue.length > 5 && (
                      <li className="digest-more">{t('seeMore', { count: digest.tasksNeedingAttention.overdue.length - 5 })}</li>
                    )}
                  </ul>
                </div>
              )}

              {digest.tasksNeedingAttention.waiting.length > 0 && (
                <div className="digest-task-group">
                  <span className="digest-task-label waiting">{t('dailyDigest.waiting')}</span>
                  <ul>
                    {digest.tasksNeedingAttention.waiting.slice(0, 3).map((task) => (
                      <li key={task.id}>{task.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              {totalPending === 0 && (
                <p className="digest-empty">{t('dailyDigest.noPendingTasks')}</p>
              )}
            </div>
          )}

          {/* Yesterday Activity */}
          {visibleSections.includes('yesterdayActivity') && (
            <div className="digest-section">
              <h3>📅 {t('dailyDigest.yesterday')}</h3>
              <div className="digest-stats">
                <div className="digest-stat">
                  <span className="digest-stat-number">{digest.yesterdayActivity.entriesCreated.length}</span>
                  <span className="digest-stat-label">{t('dailyDigest.entriesCreated')}</span>
                </div>
                <div className="digest-stat">
                  <span className="digest-stat-number">{digest.yesterdayActivity.tasksCompleted.length}</span>
                  <span className="digest-stat-label">{t('dailyDigest.tasksCompleted')}</span>
                </div>
                <div className="digest-stat">
                  <span className="digest-stat-number">{digest.yesterdayActivity.tasksCreated.length}</span>
                  <span className="digest-stat-label">{t('dailyDigest.tasksCreated')}</span>
                </div>
              </div>

              {digest.yesterdayActivity.entriesCreated.length > 0 && (
                <div className="digest-yesterday-entries">
                  <ul>
                    {digest.yesterdayActivity.entriesCreated.slice(0, 3).map((entry) => (
                      <li key={entry.id}>
                        <span className={`entry-type-badge ${entry.type}`}>{typeLabels[entry.type] || entry.type}</span>
                        {entry.improvedText.slice(0, 80)}{entry.improvedText.length > 80 ? '...' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="digest-footer">
          <button className="digest-dismiss-btn" onClick={onClose}>
            {t('dailyDigest.letsGo')}
          </button>
        </div>
      </div>
    </div>
  )
}
