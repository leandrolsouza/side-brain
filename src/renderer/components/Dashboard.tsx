import React, { useState, useEffect } from 'react'
import { Circle, Clock, CheckCircle2, AlertCircle, Timer, Sparkles, X, Calendar, Target, Inbox, History, Lightbulb, Loader2 } from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'

interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: string
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

interface Entry {
  id: string
  rawText: string
  improvedText: string
  projectId: string
  type: string
  action: string
  reviewStatus: string
  createdAt: string
}

interface Project {
  id: string
  name: string
  description?: string
  isAutoSuggested: boolean
}

interface DashboardProps {
  onNavigateToProject: (projectId: string, projectName: string) => void
}

export function Dashboard({ onNavigateToProject }: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [dueThisWeek, setDueThisWeek] = useState<Task[]>([])
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [globalSummary, setGlobalSummary] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [insights, setInsights] = useState<{ id: string; type: string; title: string; description: string; priority: string; relatedProjectId?: string; relatedProjectName?: string }[]>([])
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)

  useEffect(() => {
    loadData()
    loadInsights()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [tasksData, entriesData, projectsData, dueThisWeekData, overdueData] = await Promise.all([
        window.electronAPI.getAllTasks(),
        window.electronAPI.getEntries(),
        window.electronAPI.getProjects(),
        window.electronAPI.getTasksDueThisWeek(),
        window.electronAPI.getOverdueTasks(),
      ])
      setTasks(tasksData)
      setEntries(entriesData)
      setProjects(projectsData)
      setDueThisWeek(dueThisWeekData)
      setOverdueTasks(overdueData)
    } finally {
      setIsLoading(false)
    }
  }

  const loadInsights = async () => {
    setIsLoadingInsights(true)
    window.dispatchEvent(new Event('ai:start'))
    try {
      const data = await window.electronAPI.generateInsights()
      setInsights(data)
      window.dispatchEvent(new Event('ai:end'))
    } catch (error) {
      console.error('Failed to generate insights:', error)
      window.dispatchEvent(new Event('ai:error'))
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const getProjectName = (projectId: string): string => {
    return projects.find((p) => p.id === projectId)?.name || 'Sem projeto'
  }

  // Pending tasks grouped by status
  const actionNeeded = tasks.filter((t) => t.status === 'todo')
  const waiting = tasks.filter((t) => t.status === 'waiting')
  const inProgress = tasks.filter((t) => t.status === 'in_progress')

  // Pending review entries
  const pendingReviewCount = entries.filter((e) => e.reviewStatus === 'pending').length

  // Focus of the day: overdue + due today + in progress (max 5)
  const today = new Date().toISOString().split('T')[0]
  const focusTasks: Task[] = [
    ...overdueTasks,
    ...dueThisWeek.filter((t) => t.dueDate === today),
    ...inProgress,
  ].slice(0, 5)

  // Yesterday's activity
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toDateString()

  const yesterdayEntries = entries.filter((e) => new Date(e.createdAt).toDateString() === yesterdayStr)
  const yesterdayTasksCompleted = tasks.filter(
    (t) => t.status === 'done' && new Date(t.updatedAt).toDateString() === yesterdayStr
  )

  const handleGlobalSummary = async () => {
    setIsLoadingSummary(true)
    window.dispatchEvent(new Event('ai:start'))
    try {
      const result = await window.electronAPI.generateGlobalSummary()
      setGlobalSummary(result)
      window.dispatchEvent(new Event('ai:end'))
    } catch (error) {
      console.error('Failed to generate global summary:', error)
      window.dispatchEvent(new Event('ai:error'))
    } finally {
      setIsLoadingSummary(false)
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <span>Carregando...</span>
      </div>
    )
  }

  const totalPending = actionNeeded.length + waiting.length + inProgress.length

  return (
    <div className="dashboard">
      {/* Header stats */}
      <div className="dashboard-header">
        <span className="panel-title">Visão Geral</span>
        <div className="dashboard-stats">
          <div className="stat-chip">
            <AlertCircle size={12} />
            <span>{totalPending} pendentes</span>
          </div>
          {pendingReviewCount > 0 && (
            <div className="stat-chip stat-chip-warning">
              <Inbox size={12} />
              <span>{pendingReviewCount} para revisar</span>
            </div>
          )}
          <button
            className="vscode-button"
            onClick={handleGlobalSummary}
            disabled={isLoadingSummary}
          >
            <Sparkles size={14} />
            {isLoadingSummary ? 'Gerando...' : 'Me atualiza'}
          </button>
        </div>
      </div>

      {/* Global summary modal */}
      {globalSummary && (
        <div className="summary-modal-overlay" onClick={() => setGlobalSummary(null)}>
          <div className="summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="summary-modal-header">
              <Sparkles size={16} />
              <span>Resumo Geral</span>
              <button className="icon-button" onClick={() => setGlobalSummary(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="summary-modal-body">
              <MarkdownViewer content={globalSummary} />
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Section: Due this week */}
        {(dueThisWeek.length > 0 || overdueTasks.length > 0) && (
          <div className="dashboard-section dashboard-due-week">
            <h3 className="dashboard-section-title">
              <Calendar size={14} />
              Vencendo essa semana
            </h3>
            <div className="dashboard-due-list">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="dashboard-due-item due-overdue"
                  onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                >
                  <span className="dashboard-due-date">
                    {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="dashboard-due-title">{task.title}</span>
                  <span className="dashboard-due-project">{getProjectName(task.projectId)}</span>
                  <span className="dashboard-due-badge overdue">Vencida</span>
                </div>
              ))}
              {dueThisWeek.map((task) => {
                const today = new Date().toISOString().split('T')[0]
                const isToday = task.dueDate === today
                return (
                  <div
                    key={task.id}
                    className={`dashboard-due-item ${isToday ? 'due-today' : 'due-soon'}`}
                    onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                  >
                    <span className="dashboard-due-date">
                      {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span className="dashboard-due-title">{task.title}</span>
                    <span className="dashboard-due-project">{getProjectName(task.projectId)}</span>
                    {isToday && <span className="dashboard-due-badge today">Hoje</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Section 1: Pending tasks */}
        <div className="dashboard-section dashboard-tasks">
          <h3 className="dashboard-section-title">Tarefas Pendentes</h3>

          {totalPending === 0 ? (
            <div className="dashboard-empty">
              <CheckCircle2 size={24} />
              <span>Nenhuma tarefa pendente</span>
            </div>
          ) : (
            <div className="dashboard-task-groups">
              {actionNeeded.length > 0 && (
                <div className="task-group">
                  <div className="task-group-header">
                    <Circle size={10} className="dot-action" />
                    <span>A Fazer ({actionNeeded.length})</span>
                  </div>
                  {actionNeeded.map((task) => (
                    <div
                      key={task.id}
                      className="dashboard-task-item"
                      onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                    >
                      <span className="dashboard-task-title">{task.title}</span>
                      <span className="dashboard-task-project">{getProjectName(task.projectId)}</span>
                    </div>
                  ))}
                </div>
              )}

              {inProgress.length > 0 && (
                <div className="task-group">
                  <div className="task-group-header">
                    <Circle size={10} className="dot-progress" />
                    <span>Em Andamento ({inProgress.length})</span>
                  </div>
                  {inProgress.map((task) => (
                    <div
                      key={task.id}
                      className="dashboard-task-item"
                      onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                    >
                      <span className="dashboard-task-title">{task.title}</span>
                      <span className="dashboard-task-project">{getProjectName(task.projectId)}</span>
                    </div>
                  ))}
                </div>
              )}

              {waiting.length > 0 && (
                <div className="task-group">
                  <div className="task-group-header">
                    <Timer size={10} className="dot-waiting" />
                    <span>Aguardando ({waiting.length})</span>
                  </div>
                  {waiting.map((task) => (
                    <div
                      key={task.id}
                      className="dashboard-task-item"
                      onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                    >
                      <span className="dashboard-task-title">{task.title}</span>
                      <span className="dashboard-task-project">{getProjectName(task.projectId)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Yesterday's recap */}
        <div className="dashboard-section dashboard-yesterday">
          <h3 className="dashboard-section-title">
            <History size={14} />
            Ontem
          </h3>

          {yesterdayEntries.length === 0 && yesterdayTasksCompleted.length === 0 ? (
            <div className="dashboard-empty">
              <Clock size={24} />
              <span>Nenhuma atividade ontem</span>
            </div>
          ) : (
            <div className="yesterday-content">
              {yesterdayTasksCompleted.length > 0 && (
                <div className="yesterday-group">
                  <div className="yesterday-group-header">
                    <CheckCircle2 size={12} className="yesterday-icon-done" />
                    <span>{yesterdayTasksCompleted.length} {yesterdayTasksCompleted.length === 1 ? 'tarefa concluída' : 'tarefas concluídas'}</span>
                  </div>
                  {yesterdayTasksCompleted.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="yesterday-item"
                      onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                    >
                      <span className="yesterday-item-text">{task.title}</span>
                      <span className="yesterday-item-project">{getProjectName(task.projectId)}</span>
                    </div>
                  ))}
                  {yesterdayTasksCompleted.length > 3 && (
                    <span className="yesterday-more">+{yesterdayTasksCompleted.length - 3} mais</span>
                  )}
                </div>
              )}

              {yesterdayEntries.length > 0 && (
                <div className="yesterday-group">
                  <div className="yesterday-group-header">
                    <Circle size={12} className="yesterday-icon-entries" />
                    <span>{yesterdayEntries.length} {yesterdayEntries.length === 1 ? 'registro' : 'registros'}</span>
                  </div>
                  {yesterdayEntries.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      className="yesterday-item"
                      onClick={() => onNavigateToProject(entry.projectId, getProjectName(entry.projectId))}
                    >
                      <span className="yesterday-item-text">{entry.improvedText}</span>
                      <span className="yesterday-item-project">{getProjectName(entry.projectId)}</span>
                    </div>
                  ))}
                  {yesterdayEntries.length > 4 && (
                    <span className="yesterday-more">+{yesterdayEntries.length - 4} mais</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Focus of the day */}
        <div className="dashboard-section dashboard-focus">
          <h3 className="dashboard-section-title">
            <Target size={14} />
            Foco do Dia
          </h3>

          {focusTasks.length === 0 ? (
            <div className="dashboard-empty">
              <CheckCircle2 size={24} />
              <span>Nada urgente para hoje</span>
            </div>
          ) : (
            <div className="focus-list">
              {focusTasks.map((task) => {
                const isOverdue = overdueTasks.some((t) => t.id === task.id)
                const isDueToday = task.dueDate === today
                return (
                  <div
                    key={task.id}
                    className={`focus-item ${isOverdue ? 'focus-overdue' : isDueToday ? 'focus-today' : 'focus-progress'}`}
                    onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                  >
                    <div className="focus-item-status">
                      {isOverdue && <AlertCircle size={12} className="focus-icon-overdue" />}
                      {isDueToday && !isOverdue && <Calendar size={12} className="focus-icon-today" />}
                      {!isOverdue && !isDueToday && <Circle size={12} className="focus-icon-progress" />}
                    </div>
                    <div className="focus-item-content">
                      <span className="focus-item-title">{task.title}</span>
                      <span className="focus-item-project">{getProjectName(task.projectId)}</span>
                    </div>
                    {isOverdue && <span className="focus-badge overdue">Vencida</span>}
                    {isDueToday && !isOverdue && <span className="focus-badge today">Hoje</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Section 4: Pending review */}
        {pendingReviewCount > 0 && (
          <div className="dashboard-section dashboard-review">
            <h3 className="dashboard-section-title">
              <Inbox size={14} />
              Itens para Revisar
            </h3>
            <div className="review-summary">
              <div className="review-summary-count">
                <span className="review-count-number">{pendingReviewCount}</span>
                <span className="review-count-label">
                  {pendingReviewCount === 1 ? 'entrada aguardando' : 'entradas aguardando'} revisão
                </span>
              </div>
              <p className="review-summary-hint">
                A IA categorizou novas entradas. Revise para confirmar ou corrigir.
              </p>
            </div>
          </div>
        )}

        {/* Section 5: Proactive Insights */}
        <div className="dashboard-section dashboard-insights">
          <h3 className="dashboard-section-title">
            <Lightbulb size={14} />
            Sugestões da IA
          </h3>

          {isLoadingInsights ? (
            <div className="dashboard-insights-loading">
              <Loader2 size={16} className="spinning" />
              <span>Analisando padrões...</span>
            </div>
          ) : insights.length === 0 ? (
            <div className="dashboard-empty">
              <Lightbulb size={24} />
              <span>Nenhuma sugestão no momento</span>
            </div>
          ) : (
            <div className="insights-list">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`insight-card insight-${insight.priority}`}
                  onClick={() => insight.relatedProjectId && onNavigateToProject(insight.relatedProjectId, insight.relatedProjectName || '')}
                >
                  <div className="insight-card-header">
                    <span className={`insight-priority-dot priority-${insight.priority}`} />
                    <span className="insight-title">{insight.title}</span>
                  </div>
                  <p className="insight-description">{insight.description}</p>
                  {insight.relatedProjectName && (
                    <span className="insight-project">{insight.relatedProjectName}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
