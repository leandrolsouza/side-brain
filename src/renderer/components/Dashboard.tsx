import React, { useState, useEffect } from 'react'
import { Circle, Clock, FolderOpen, CheckCircle2, AlertCircle, Timer, ArrowRight, Sparkles, X } from 'lucide-react'

interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: string
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
  createdAt: string
}

interface Project {
  id: string
  name: string
  description?: string
  isAutoSuggested: boolean
}

interface ProjectSummary {
  project: Project
  taskCounts: { todo: number; in_progress: number; waiting: number; done: number }
  lastActivity: string | null
}

interface DashboardProps {
  onNavigateToProject: (projectId: string, projectName: string) => void
}

export function Dashboard({ onNavigateToProject }: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [globalSummary, setGlobalSummary] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [tasksData, entriesData, projectsData] = await Promise.all([
        window.electronAPI.getAllTasks(),
        window.electronAPI.getEntries(),
        window.electronAPI.getProjects(),
      ])
      setTasks(tasksData)
      setEntries(entriesData)
      setProjects(projectsData)
    } finally {
      setIsLoading(false)
    }
  }

  const getProjectName = (projectId: string): string => {
    return projects.find((p) => p.id === projectId)?.name || 'Sem projeto'
  }

  // Pending tasks grouped by status
  const actionNeeded = tasks.filter((t) => t.status === 'todo')
  const waiting = tasks.filter((t) => t.status === 'waiting')
  const inProgress = tasks.filter((t) => t.status === 'in_progress')

  // Recent entries (last 10)
  const recentEntries = entries.slice(0, 10)

  // Project summaries
  const projectSummaries: ProjectSummary[] = projects.map((project) => {
    const projectTasks = tasks.filter((t) => t.projectId === project.id)
    const projectEntries = entries.filter((e) => e.projectId === project.id)

    const taskCounts = {
      todo: projectTasks.filter((t) => t.status === 'todo').length,
      in_progress: projectTasks.filter((t) => t.status === 'in_progress').length,
      waiting: projectTasks.filter((t) => t.status === 'waiting').length,
      done: projectTasks.filter((t) => t.status === 'done').length,
    }

    const lastEntry = projectEntries[0]
    const lastActivity = lastEntry?.createdAt || null

    return { project, taskCounts, lastActivity }
  }).sort((a, b) => {
    // Sort by most recent activity
    if (!a.lastActivity) return 1
    if (!b.lastActivity) return -1
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  })

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMin < 1) return 'agora'
    if (diffMin < 60) return `há ${diffMin}min`
    if (diffHours < 24) return `há ${diffHours}h`
    if (diffDays === 1) return 'ontem'
    if (diffDays < 7) return `há ${diffDays} dias`
    return date.toLocaleDateString('pt-BR')
  }

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const isToday = date.toDateString() === today.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()

    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    if (isToday) return `Hoje, ${time}`
    if (isYesterday) return `Ontem, ${time}`
    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time}`
  }

  const handleGlobalSummary = async () => {
    setIsLoadingSummary(true)
    try {
      const result = await window.electronAPI.generateGlobalSummary()
      setGlobalSummary(result)
    } catch (error) {
      console.error('Failed to generate global summary:', error)
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
          <div className="stat-chip">
            <FolderOpen size={12} />
            <span>{projects.length} projetos</span>
          </div>
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

      {/* Global summary */}
      {globalSummary && (
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-header">
            <Sparkles size={14} />
            <span>Resumo Geral</span>
            <button className="icon-button" onClick={() => setGlobalSummary(null)} style={{ opacity: 1 }}>
              <X size={14} />
            </button>
          </div>
          <div className="dashboard-summary-text">{globalSummary}</div>
        </div>
      )}

      <div className="dashboard-grid">
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

        {/* Section 2: Recent activity */}
        <div className="dashboard-section dashboard-activity">
          <h3 className="dashboard-section-title">Atividade Recente</h3>

          {recentEntries.length === 0 ? (
            <div className="dashboard-empty">
              <Clock size={24} />
              <span>Nenhuma atividade ainda</span>
            </div>
          ) : (
            <div className="activity-list">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="activity-item"
                  onClick={() => onNavigateToProject(entry.projectId, getProjectName(entry.projectId))}
                >
                  <span className="activity-time">{formatDateTime(entry.createdAt)}</span>
                  <span className="activity-project">[{getProjectName(entry.projectId)}]</span>
                  <span className="activity-text">{entry.improvedText}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Project summary cards */}
        <div className="dashboard-section dashboard-projects-summary">
          <h3 className="dashboard-section-title">Projetos</h3>

          {projectSummaries.length === 0 ? (
            <div className="dashboard-empty">
              <FolderOpen size={24} />
              <span>Nenhum projeto criado</span>
            </div>
          ) : (
            <div className="project-summary-grid">
              {projectSummaries.map(({ project, taskCounts, lastActivity }) => (
                <div
                  key={project.id}
                  className="project-summary-card"
                  onClick={() => onNavigateToProject(project.id, project.name)}
                >
                  <div className="project-summary-name">
                    <FolderOpen size={14} />
                    <span>{project.name}</span>
                    <ArrowRight size={12} className="project-summary-arrow" />
                  </div>
                  <div className="project-summary-counts">
                    {taskCounts.todo > 0 && (
                      <span className="count-chip todo">{taskCounts.todo}</span>
                    )}
                    {taskCounts.in_progress > 0 && (
                      <span className="count-chip progress">{taskCounts.in_progress}</span>
                    )}
                    {taskCounts.waiting > 0 && (
                      <span className="count-chip waiting">{taskCounts.waiting}</span>
                    )}
                    {taskCounts.done > 0 && (
                      <span className="count-chip done">{taskCounts.done}</span>
                    )}
                    {taskCounts.todo + taskCounts.in_progress + taskCounts.waiting + taskCounts.done === 0 && (
                      <span className="count-chip empty">sem tasks</span>
                    )}
                  </div>
                  {lastActivity && (
                    <span className="project-summary-time">
                      <Clock size={10} />
                      {formatRelativeTime(lastActivity)}
                    </span>
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
