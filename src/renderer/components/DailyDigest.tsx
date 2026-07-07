import React, { useState, useEffect } from 'react'
import { DailyDigestData } from '../../shared/types'

interface DailyDigestProps {
  onClose: () => void
  onNavigateToProject?: (projectId: string, projectName: string) => void
}

export function DailyDigest({ onClose, onNavigateToProject }: DailyDigestProps) {
  const [digest, setDigest] = useState<DailyDigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDigest()
  }, [])

  const loadDigest = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.electronAPI.generateDailyDigest()
      setDigest(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar o digest')
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
            <p>Preparando seu resumo do dia...</p>
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
            <h2>Daily Digest</h2>
            <button className="digest-close" onClick={onClose}>✕</button>
          </div>
          <div className="digest-error">
            <p>Não foi possível gerar o digest: {error}</p>
            <button className="digest-retry-btn" onClick={loadDigest}>Tentar novamente</button>
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
          {digest.aiSuggestion && (
            <div className="digest-section digest-suggestion">
              <div className="digest-section-icon">💡</div>
              <div className="digest-section-content">
                <h3>Sugestão de foco</h3>
                <p>{digest.aiSuggestion}</p>
              </div>
            </div>
          )}

          {/* Tasks Needing Attention */}
          <div className="digest-section">
            <h3>📋 Tasks pendentes ({totalPending})</h3>

            {digest.tasksNeedingAttention.inProgress.length > 0 && (
              <div className="digest-task-group">
                <span className="digest-task-label in-progress">Em andamento</span>
                <ul>
                  {digest.tasksNeedingAttention.inProgress.slice(0, 5).map((task) => (
                    <li key={task.id}>{task.title}</li>
                  ))}
                </ul>
              </div>
            )}

            {digest.tasksNeedingAttention.overdue.length > 0 && (
              <div className="digest-task-group">
                <span className="digest-task-label todo">A fazer</span>
                <ul>
                  {digest.tasksNeedingAttention.overdue.slice(0, 5).map((task) => (
                    <li key={task.id}>{task.title}</li>
                  ))}
                  {digest.tasksNeedingAttention.overdue.length > 5 && (
                    <li className="digest-more">+{digest.tasksNeedingAttention.overdue.length - 5} mais...</li>
                  )}
                </ul>
              </div>
            )}

            {digest.tasksNeedingAttention.waiting.length > 0 && (
              <div className="digest-task-group">
                <span className="digest-task-label waiting">Aguardando</span>
                <ul>
                  {digest.tasksNeedingAttention.waiting.slice(0, 3).map((task) => (
                    <li key={task.id}>{task.title}</li>
                  ))}
                </ul>
              </div>
            )}

            {totalPending === 0 && (
              <p className="digest-empty">Nenhuma task pendente. Tudo em dia! 🎉</p>
            )}
          </div>

          {/* Yesterday Activity */}
          <div className="digest-section">
            <h3>📅 Ontem</h3>
            <div className="digest-stats">
              <div className="digest-stat">
                <span className="digest-stat-number">{digest.yesterdayActivity.entriesCreated.length}</span>
                <span className="digest-stat-label">entradas criadas</span>
              </div>
              <div className="digest-stat">
                <span className="digest-stat-number">{digest.yesterdayActivity.tasksCompleted.length}</span>
                <span className="digest-stat-label">tasks concluídas</span>
              </div>
              <div className="digest-stat">
                <span className="digest-stat-number">{digest.yesterdayActivity.tasksCreated.length}</span>
                <span className="digest-stat-label">tasks criadas</span>
              </div>
            </div>

            {digest.yesterdayActivity.entriesCreated.length > 0 && (
              <div className="digest-yesterday-entries">
                <ul>
                  {digest.yesterdayActivity.entriesCreated.slice(0, 3).map((entry) => (
                    <li key={entry.id}>
                      <span className={`entry-type-badge ${entry.type}`}>{entry.type}</span>
                      {entry.improvedText.slice(0, 80)}{entry.improvedText.length > 80 ? '...' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="digest-footer">
          <button className="digest-dismiss-btn" onClick={onClose}>
            Vamos lá! 🚀
          </button>
        </div>
      </div>
    </div>
  )
}
