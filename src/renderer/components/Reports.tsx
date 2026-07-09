import React, { useState, useEffect } from 'react'
import {
  BarChart3, TrendingUp, CheckCircle2, FolderOpen, Clock, Calendar,
  Users, Zap, DollarSign, RefreshCw, PieChart, Activity, Target,
  AlertTriangle,
} from 'lucide-react'
import { AIUsageDashboard } from './AIUsageDashboard'
import type {
  ReportsData, ReportPeriod, EntryType, ActivityTimelinePoint,
  EntryTypeDistribution, ProjectRanking, WeekdayActivity,
} from '../../shared/types'

type ReportsTab = 'productivity' | 'ai-usage'

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  information: 'Informação',
  decision: 'Decisão',
  demand: 'Demanda',
  idea: 'Ideia',
  blocker: 'Bloqueio',
  update: 'Atualização',
}

const ENTRY_TYPE_COLORS: Record<EntryType, string> = {
  information: 'var(--chart-blue)',
  decision: 'var(--chart-purple)',
  demand: 'var(--chart-orange)',
  idea: 'var(--chart-yellow)',
  blocker: 'var(--chart-red)',
  update: 'var(--chart-green)',
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('pt-BR')
}

export function Reports() {
  const [activeTab, setActiveTab] = useState<ReportsTab>('productivity')
  const [period, setPeriod] = useState<ReportPeriod>('30d')
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.getReportsData(period)
      setData(result)
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'productivity') {
      loadData()
    }
  }, [period, activeTab])

  return (
    <div className="reports-page">
      {/* Header */}
      <div className="reports-header">
        <h2><BarChart3 size={20} /> Métricas & Relatórios</h2>
        <div className="reports-tabs">
          <button
            className={`reports-tab ${activeTab === 'productivity' ? 'active' : ''}`}
            onClick={() => setActiveTab('productivity')}
          >
            <TrendingUp size={14} />
            Produtividade
          </button>
          <button
            className={`reports-tab ${activeTab === 'ai-usage' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai-usage')}
          >
            <Zap size={14} />
            Uso da IA
          </button>
        </div>
      </div>

      {activeTab === 'ai-usage' ? (
        <AIUsageDashboard />
      ) : (
        <>
          {/* Period filter */}
          <div className="reports-controls">
            <div className="reports-period-filter">
              {(['7d', '30d', '90d', 'all'] as ReportPeriod[]).map((p) => (
                <button
                  key={p}
                  className={`period-btn ${period === p ? 'active' : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : 'Tudo'}
                </button>
              ))}
            </div>
            <button className="btn-icon" onClick={loadData} title="Atualizar">
              <RefreshCw size={16} />
            </button>
          </div>

          {loading ? (
            <div className="reports-loading">Carregando métricas...</div>
          ) : data ? (
            <div className="reports-content">
              {/* Overview Cards */}
              <OverviewCards overview={data.overview} />

              {/* Activity Timeline */}
              {data.activityTimeline.length > 0 && (
                <ActivityTimeline timeline={data.activityTimeline} />
              )}

              <div className="reports-grid-2col">
                {/* Entry Type Distribution */}
                {data.entryTypeDistribution.length > 0 && (
                  <EntryTypeChart distribution={data.entryTypeDistribution} />
                )}

                {/* Task Flow */}
                <TaskFlowChart taskFlow={data.taskFlow} />
              </div>

              {/* Weekday Activity */}
              {data.weekdayActivity.some((d) => d.entries > 0 || d.tasksCompleted > 0) && (
                <WeekdayChart weekday={data.weekdayActivity} />
              )}

              {/* Project Ranking */}
              {data.projectRanking.length > 0 && (
                <ProjectRankingTable ranking={data.projectRanking} />
              )}
            </div>
          ) : (
            <div className="reports-empty">
              <BarChart3 size={48} />
              <p>Nenhum dado disponível ainda.</p>
              <p className="reports-empty-hint">As métricas aparecerão conforme você usar o app.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ===== Overview Cards ===== */
function OverviewCards({ overview }: { overview: ReportsData['overview'] }) {
  return (
    <div className="reports-overview-cards">
      <div className="reports-card">
        <div className="reports-card-icon"><Activity size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{formatNumber(overview.totalEntries)}</span>
          <span className="reports-card-label">Entradas</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><CheckCircle2 size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{overview.tasksCompleted}/{overview.totalTasks}</span>
          <span className="reports-card-label">Tarefas Concluídas</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><Target size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{overview.completionRate}%</span>
          <span className="reports-card-label">Taxa de Conclusão</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><FolderOpen size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{overview.activeProjects}/{overview.totalProjects}</span>
          <span className="reports-card-label">Projetos Ativos</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><Clock size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{overview.avgTaskResolutionDays ?? '—'}</span>
          <span className="reports-card-label">Dias p/ Concluir (média)</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><Users size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{formatNumber(overview.totalMeetings)}</span>
          <span className="reports-card-label">Reuniões</span>
        </div>
      </div>
    </div>
  )
}

/* ===== Activity Timeline ===== */
function ActivityTimeline({ timeline }: { timeline: ActivityTimelinePoint[] }) {
  const maxEntries = Math.max(...timeline.map((d) => d.entries), 1)
  const maxTasks = Math.max(...timeline.map((d) => d.tasksCompleted), 1)
  const maxVal = Math.max(maxEntries, maxTasks)

  // Show last 30 days max
  const displayData = timeline.slice(-30)

  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <Calendar size={14} />
        Atividade ao Longo do Tempo
      </h3>
      <div className="reports-timeline-chart">
        {displayData.map((day) => {
          const entryHeight = (day.entries / maxVal) * 100
          const taskHeight = (day.tasksCompleted / maxVal) * 100
          return (
            <div
              key={day.date}
              className="reports-timeline-bar-group"
              title={`${day.date}\n${day.entries} entradas\n${day.tasksCreated} tarefas criadas\n${day.tasksCompleted} tarefas concluídas`}
            >
              <div className="reports-timeline-bars">
                <div
                  className="reports-timeline-bar bar-entries"
                  style={{ height: `${Math.max(entryHeight, 2)}%` }}
                />
                <div
                  className="reports-timeline-bar bar-tasks"
                  style={{ height: `${Math.max(taskHeight, 2)}%` }}
                />
              </div>
              <span className="reports-timeline-label">{day.date.slice(8, 10)}</span>
            </div>
          )
        })}
      </div>
      <div className="reports-chart-legend">
        <span><span className="legend-dot legend-entries" /> Entradas</span>
        <span><span className="legend-dot legend-tasks-completed" /> Tarefas Concluídas</span>
      </div>
    </div>
  )
}

/* ===== Entry Type Distribution ===== */
function EntryTypeChart({ distribution }: { distribution: EntryTypeDistribution[] }) {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)

  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <PieChart size={14} />
        Tipos de Entrada
      </h3>
      <div className="reports-type-chart">
        {distribution.map((item) => (
          <div key={item.type} className="reports-type-row">
            <div className="reports-type-label">
              <span
                className="reports-type-dot"
                style={{ backgroundColor: ENTRY_TYPE_COLORS[item.type] }}
              />
              <span>{ENTRY_TYPE_LABELS[item.type]}</span>
            </div>
            <div className="reports-type-bar-container">
              <div
                className="reports-type-bar"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: ENTRY_TYPE_COLORS[item.type],
                }}
              />
            </div>
            <span className="reports-type-count">{item.count} ({item.percentage}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ===== Task Flow ===== */
function TaskFlowChart({ taskFlow }: { taskFlow: ReportsData['taskFlow'] }) {
  const total = taskFlow.todo + taskFlow.inProgress + taskFlow.waiting + taskFlow.done
  const segments = [
    { label: 'A Fazer', count: taskFlow.todo, color: 'var(--chart-blue)' },
    { label: 'Em Andamento', count: taskFlow.inProgress, color: 'var(--chart-orange)' },
    { label: 'Aguardando', count: taskFlow.waiting, color: 'var(--chart-yellow)' },
    { label: 'Concluído', count: taskFlow.done, color: 'var(--chart-green)' },
  ]

  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <Target size={14} />
        Fluxo de Tarefas
      </h3>

      {/* Stacked bar */}
      {total > 0 && (
        <div className="reports-flow-bar">
          {segments.map((seg) => (
            seg.count > 0 ? (
              <div
                key={seg.label}
                className="reports-flow-segment"
                style={{ width: `${(seg.count / total) * 100}%`, backgroundColor: seg.color }}
                title={`${seg.label}: ${seg.count}`}
              />
            ) : null
          ))}
        </div>
      )}

      <div className="reports-flow-legend">
        {segments.map((seg) => (
          <div key={seg.label} className="reports-flow-legend-item">
            <span className="legend-dot" style={{ backgroundColor: seg.color }} />
            <span>{seg.label}: {seg.count}</span>
          </div>
        ))}
      </div>

      {/* Extra stats */}
      <div className="reports-flow-stats">
        {taskFlow.avgLeadTimeDays !== null && (
          <div className="reports-flow-stat">
            <Clock size={12} />
            <span>Lead time médio: <strong>{taskFlow.avgLeadTimeDays} dias</strong></span>
          </div>
        )}
        {taskFlow.longestWaitingTask && (
          <div className="reports-flow-stat warning">
            <AlertTriangle size={12} />
            <span>
              Mais tempo aguardando: <strong>"{taskFlow.longestWaitingTask.title}"</strong>
              {' '}({taskFlow.longestWaitingTask.projectName}) — {taskFlow.longestWaitingTask.daysSinceUpdate} dias
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ===== Weekday Activity ===== */
function WeekdayChart({ weekday }: { weekday: WeekdayActivity[] }) {
  const maxActivity = Math.max(...weekday.map((d) => d.entries + d.tasksCompleted), 1)

  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <Calendar size={14} />
        Atividade por Dia da Semana
      </h3>
      <div className="reports-weekday-chart">
        {weekday.map((day) => {
          const total = day.entries + day.tasksCompleted
          const height = (total / maxActivity) * 100
          return (
            <div key={day.dayOfWeek} className="reports-weekday-bar-group">
              <div
                className="reports-weekday-bar"
                style={{ height: `${Math.max(height, 3)}%` }}
                title={`${day.label}\n${day.entries} entradas\n${day.tasksCompleted} tarefas concluídas`}
              >
                <div
                  className="reports-weekday-bar-entries"
                  style={{ height: `${total > 0 ? (day.entries / total) * 100 : 0}%` }}
                />
              </div>
              <span className="reports-weekday-label">{day.label.slice(0, 3)}</span>
            </div>
          )
        })}
      </div>
      <div className="reports-chart-legend">
        <span><span className="legend-dot legend-entries" /> Entradas</span>
        <span><span className="legend-dot legend-tasks-completed" /> Tarefas</span>
      </div>
    </div>
  )
}

/* ===== Project Ranking Table ===== */
function ProjectRankingTable({ ranking }: { ranking: ProjectRanking[] }) {
  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <FolderOpen size={14} />
        Ranking de Projetos
      </h3>
      <div className="reports-table">
        <table>
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Entradas</th>
              <th>Tarefas</th>
              <th>Concluídas</th>
              <th>Bloqueios</th>
              <th>Última Atividade</th>
            </tr>
          </thead>
          <tbody>
            {ranking.slice(0, 10).map((project) => (
              <tr key={project.projectId}>
                <td className="reports-project-name">{project.projectName}</td>
                <td>{project.entryCount}</td>
                <td>{project.taskCount}</td>
                <td>{project.completedTasks}</td>
                <td>
                  {project.blockerCount > 0 ? (
                    <span className="reports-blocker-badge">{project.blockerCount}</span>
                  ) : '—'}
                </td>
                <td>
                  {project.lastActivityDate
                    ? new Date(project.lastActivityDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
