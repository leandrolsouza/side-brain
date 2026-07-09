import React, { useState, useEffect } from 'react'
import {
  Circle, Clock, CheckCircle2, AlertCircle, Timer, Sparkles, X,
  Calendar, Target, Inbox, History, Lightbulb, Loader2, RefreshCw,
  ListTodo, FolderKanban, TrendingUp, Zap
} from 'lucide-react'
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

const TASKS_PER_GROUP = 5

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
  const [insightsLastUpdated, setInsightsLastUpdated] = useState<number | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    loadData()
    loadInsights()
    loadUserName()
  }, [])

  const loadUserName = async () => {
    try {
      const settings = await window.electronAPI.getSettings()
      if (settings?.userName) {
        setUserName(settings.userName)
      }
    } catch (e) {
      // ignore
    }
  }

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

  const loadInsights = async (forceRefresh = false) => {
    setIsLoadingInsights(true)
    if (forceRefresh) {
      window.dispatchEvent(new Event('ai:start'))
    }
    try {
      const data = await window.electronAPI.generateInsights(forceRefresh)
      setInsights(data)
      const lastGenerated = await window.electronAPI.getInsightsLastGeneratedAt()
      setInsightsLastUpdated(lastGenerated)
      if (forceRefresh) {
        window.dispatchEvent(new Event('ai:end'))
      }
    } catch (error) {
      console.error('Failed to generate insights:', error)
      if (forceRefresh) {
        window.dispatchEvent(new Event('ai:error'))
      }
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const getProjectName = (projectId: string): string => {
    return projects.find((p) => p.id === projectId)?.name || 'Sem projeto'
  }

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  // Pending tasks grouped by status
  const actionNeeded = tasks.filter((t) => t.status === 'todo')
  const waiting = tasks.filter((t) => t.status === 'waiting')
  const inProgress = tasks.filter((t) => t.status === 'in_progress')
  const doneTasks = tasks.filter((t) => t.status === 'done')

  // Completed this week
  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const completedThisWeek = doneTasks.filter(
    (t) => new Date(t.updatedAt) >= startOfWeek
  )

  // Entries this week
  const entriesThisWeek = entries.filter(
    (e) => new Date(e.createdAt) >= startOfWeek
  )

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

  // Project progress data
  const activeProjects = projects.filter((p) => !p.isAutoSuggested)
  const projectProgress = activeProjects.map((project) => {
    const projectTasks = tasks.filter((t) => t.projectId === project.id)
    const totalTasks = projectTasks.length
    const completedTasks = projectTasks.filter((t) => t.status === 'done').length
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    return { ...project, totalTasks, completedTasks, percentage }
  }).filter((p) => p.totalTasks > 0).sort((a, b) => b.totalTasks - a.totalTasks).slice(0, 5)

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

  const formatRelativeTime = (timestamp: number): string => {
    const diffMs = Date.now() - timestamp
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'agora'
    if (diffMin < 60) return `há ${diffMin} min`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `há ${diffHours}h`
    return `há ${Math.floor(diffHours / 24)}d`
  }

  const getGreeting = (): string => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const getGreetingSummary = (): string => {
    const parts: string[] = []
    const totalPending = actionNeeded.length + waiting.length + inProgress.length
    if (totalPending > 0) parts.push(`${totalPending} tarefa${totalPending > 1 ? 's' : ''} pendente${totalPending > 1 ? 's' : ''}`)
    if (overdueTasks.length > 0) parts.push(`${overdueTasks.length} vencida${overdueTasks.length > 1 ? 's' : ''}`)
    if (pendingReviewCount > 0) parts.push(`${pendingReviewCount} para revisar`)
    if (parts.length === 0) return 'Tudo em dia!'
    return parts.join(' · ')
  }

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <Loader2 size={20} className="spinning" />
        <span>Carregando...</span>
      </div>
    )
  }

  const totalPending = actionNeeded.length + waiting.length + inProgress.length
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0

  return (
    <div className="dashboard">
      {/* Greeting + Header */}
      <div className="dashboard-greeting-bar">
        <div className="dashboard-greeting">
          <h2 className="dashboard-greeting-text">
            {getGreeting()}{userName ? `, ${userName}` : ''}
          </h2>
          <span className="dashboard-greeting-summary">{getGreetingSummary()}</span>
        </div>
        <div className="dashboard-header-actions">
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

      {/* KPI Cards */}
      <div className="dashboard-kpi-row">
        <div className="dashboard-kpi-card">
          <div className="kpi-icon kpi-icon-pending">
            <ListTodo size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{totalPending}</span>
            <span className="kpi-label">Pendentes</span>
          </div>
        </div>

        <div className="dashboard-kpi-card">
          <div className="kpi-icon kpi-icon-progress">
            <TrendingUp size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{inProgress.length}</span>
            <span className="kpi-label">Em andamento</span>
          </div>
        </div>

        <div className="dashboard-kpi-card">
          <div className="kpi-icon kpi-icon-done">
            <CheckCircle2 size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{completedThisWeek.length}</span>
            <span className="kpi-label">Concluídas na semana</span>
          </div>
        </div>

        <div className="dashboard-kpi-card">
          <div className="kpi-icon kpi-icon-entries">
            <Zap size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{entriesThisWeek.length}</span>
            <span className="kpi-label">Registros na semana</span>
          </div>
        </div>

        <div className="dashboard-kpi-card">
          <div className="kpi-icon kpi-icon-projects">
            <FolderKanban size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{completionRate}%</span>
            <span className="kpi-label">Taxa de conclusão</span>
          </div>
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

      {/* Main grid: 2 columns */}
      <div className="dashboard-main-grid">
        {/* LEFT COLUMN */}
        <div className="dashboard-col-left">
          {/* Due this week */}
          {(dueThisWeek.length > 0 || overdueTasks.length > 0) && (
            <div className="dashboard-card">
              <h3 className="dashboard-card-title">
                <Calendar size={14} />
                Prazos da Semana
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

          {/* Pending tasks */}
          <div className="dashboard-card">
            <h3 className="dashboard-card-title">
              <ListTodo size={14} />
              Tarefas Pendentes
            </h3>

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
                    {(expandedGroups['todo'] ? actionNeeded : actionNeeded.slice(0, TASKS_PER_GROUP)).map((task) => (
                      <div
                        key={task.id}
                        className="dashboard-task-item"
                        onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                      >
                        <span className="dashboard-task-title">{task.title}</span>
                        <span className="dashboard-task-project">{getProjectName(task.projectId)}</span>
                      </div>
                    ))}
                    {actionNeeded.length > TASKS_PER_GROUP && (
                      <button className="task-group-toggle" onClick={() => toggleGroup('todo')}>
                        {expandedGroups['todo'] ? 'Ver menos' : `+${actionNeeded.length - TASKS_PER_GROUP} mais`}
                      </button>
                    )}
                  </div>
                )}

                {inProgress.length > 0 && (
                  <div className="task-group">
                    <div className="task-group-header">
                      <Circle size={10} className="dot-progress" />
                      <span>Em Andamento ({inProgress.length})</span>
                    </div>
                    {(expandedGroups['in_progress'] ? inProgress : inProgress.slice(0, TASKS_PER_GROUP)).map((task) => (
                      <div
                        key={task.id}
                        className="dashboard-task-item"
                        onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                      >
                        <span className="dashboard-task-title">{task.title}</span>
                        <span className="dashboard-task-project">{getProjectName(task.projectId)}</span>
                      </div>
                    ))}
                    {inProgress.length > TASKS_PER_GROUP && (
                      <button className="task-group-toggle" onClick={() => toggleGroup('in_progress')}>
                        {expandedGroups['in_progress'] ? 'Ver menos' : `+${inProgress.length - TASKS_PER_GROUP} mais`}
                      </button>
                    )}
                  </div>
                )}

                {waiting.length > 0 && (
                  <div className="task-group">
                    <div className="task-group-header">
                      <Timer size={10} className="dot-waiting" />
                      <span>Aguardando ({waiting.length})</span>
                    </div>
                    {(expandedGroups['waiting'] ? waiting : waiting.slice(0, TASKS_PER_GROUP)).map((task) => (
                      <div
                        key={task.id}
                        className="dashboard-task-item"
                        onClick={() => onNavigateToProject(task.projectId, getProjectName(task.projectId))}
                      >
                        <span className="dashboard-task-title">{task.title}</span>
                        <span className="dashboard-task-project">{getProjectName(task.projectId)}</span>
                      </div>
                    ))}
                    {waiting.length > TASKS_PER_GROUP && (
                      <button className="task-group-toggle" onClick={() => toggleGroup('waiting')}>
                        {expandedGroups['waiting'] ? 'Ver menos' : `+${waiting.length - TASKS_PER_GROUP} mais`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Yesterday's recap */}
          <div className="dashboard-card">
            <h3 className="dashboard-card-title">
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

          {/* Pending review */}
          {pendingReviewCount > 0 && (
            <div className="dashboard-card">
              <h3 className="dashboard-card-title">
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
        </div>

        {/* RIGHT COLUMN */}
        <div className="dashboard-col-right">
          {/* Focus of the day */}
          <div className="dashboard-card dashboard-card-focus">
            <h3 className="dashboard-card-title">
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

          {/* Project progress */}
          {projectProgress.length > 0 && (
            <div className="dashboard-card">
              <h3 className="dashboard-card-title">
                <FolderKanban size={14} />
                Progresso dos Projetos
              </h3>
              <div className="project-progress-list">
                {projectProgress.map((project) => (
                  <div
                    key={project.id}
                    className="project-progress-item"
                    onClick={() => onNavigateToProject(project.id, project.name)}
                  >
                    <div className="project-progress-header">
                      <span className="project-progress-name">{project.name}</span>
                      <span className="project-progress-stats">
                        {project.completedTasks}/{project.totalTasks}
                      </span>
                    </div>
                    <div className="project-progress-bar-track">
                      <div
                        className="project-progress-bar-fill"
                        style={{ width: `${project.percentage}%` }}
                      />
                    </div>
                    <span className="project-progress-percent">{project.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Insights */}
          <div className="dashboard-card">
            <div className="dashboard-card-title-row">
              <h3 className="dashboard-card-title">
                <Lightbulb size={14} />
                Sugestões da IA
              </h3>
              <div className="insights-actions">
                {insightsLastUpdated && !isLoadingInsights && (
                  <span className="insights-last-updated">
                    {formatRelativeTime(insightsLastUpdated)}
                  </span>
                )}
                <button
                  className="icon-button insights-refresh-btn"
                  onClick={() => loadInsights(true)}
                  disabled={isLoadingInsights}
                  title="Atualizar sugestões agora"
                >
                  <RefreshCw size={14} className={isLoadingInsights ? 'spinning' : ''} />
                </button>
              </div>
            </div>

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
    </div>
  )
}
