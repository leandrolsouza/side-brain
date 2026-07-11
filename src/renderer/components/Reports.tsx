import React, { useState, useEffect } from 'react'
import {
  BarChart3, TrendingUp, CheckCircle2, FolderOpen, Clock, Calendar,
  Users, Zap, DollarSign, RefreshCw, PieChart, Activity, Target,
  AlertTriangle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AIUsageDashboard } from './AIUsageDashboard'
import { ReportNarrative } from './ReportNarrative'
import type {
  ReportsData, ReportPeriod, EntryType, ActivityTimelinePoint,
  EntryTypeDistribution, ProjectRanking, WeekdayActivity,
} from '../../shared/types'

type ReportsTab = 'productivity' | 'ai-usage'

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
  const { t } = useTranslation('reports')
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
      console.error(t('loadError'), err)
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
        <h2><BarChart3 size={20} /> {t('title')}</h2>
        <div className="reports-tabs">
          <button
            className={`reports-tab ${activeTab === 'productivity' ? 'active' : ''}`}
            onClick={() => setActiveTab('productivity')}
          >
            <TrendingUp size={14} />
            {t('tabProductivity')}
          </button>
          <button
            className={`reports-tab ${activeTab === 'ai-usage' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai-usage')}
          >
            <Zap size={14} />
            {t('tabAiUsage')}
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
                  {p === '7d' ? t('period7d') : p === '30d' ? t('period30d') : p === '90d' ? t('period90d') : t('periodAll')}
                </button>
              ))}
            </div>
            <button className="btn-icon" onClick={loadData} title={t('refresh')}>
              <RefreshCw size={16} />
            </button>
          </div>

          {loading ? (
            <div className="reports-loading">{t('loadingMetrics')}</div>
          ) : data ? (
            <div className="reports-content">
              {/* AI Narrative */}
              <ReportNarrative period={period} />

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
              <p>{t('emptyTitle')}</p>
              <p className="reports-empty-hint">{t('emptyHint')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ===== Overview Cards ===== */
function OverviewCards({ overview }: { overview: ReportsData['overview'] }) {
  const { t } = useTranslation('reports')
  return (
    <div className="reports-overview-cards">
      <div className="reports-card">
        <div className="reports-card-icon"><Activity size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{formatNumber(overview.totalEntries)}</span>
          <span className="reports-card-label">{t('entries')}</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><CheckCircle2 size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{overview.tasksCompleted}/{overview.totalTasks}</span>
          <span className="reports-card-label">{t('tasksCompleted')}</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><Target size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{overview.completionRate}%</span>
          <span className="reports-card-label">{t('completionRate')}</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><FolderOpen size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{overview.activeProjects}/{overview.totalProjects}</span>
          <span className="reports-card-label">{t('activeProjects')}</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><Clock size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{overview.avgTaskResolutionDays ?? '—'}</span>
          <span className="reports-card-label">{t('avgResolutionDays')}</span>
        </div>
      </div>
      <div className="reports-card">
        <div className="reports-card-icon"><Users size={20} /></div>
        <div className="reports-card-content">
          <span className="reports-card-value">{formatNumber(overview.totalMeetings)}</span>
          <span className="reports-card-label">{t('meetings')}</span>
        </div>
      </div>
    </div>
  )
}

/* ===== Activity Timeline ===== */
function ActivityTimeline({ timeline }: { timeline: ActivityTimelinePoint[] }) {
  const { t } = useTranslation('reports')
  const maxEntries = Math.max(...timeline.map((d) => d.entries), 1)
  const maxTasks = Math.max(...timeline.map((d) => d.tasksCompleted), 1)
  const maxVal = Math.max(maxEntries, maxTasks)

  // Show last 30 days max
  const displayData = timeline.slice(-30)

  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <Calendar size={14} />
        {t('activityOverTime')}
      </h3>
      <div className="reports-timeline-chart">
        {displayData.map((day) => {
          const entryHeight = (day.entries / maxVal) * 100
          const taskHeight = (day.tasksCompleted / maxVal) * 100
          return (
            <div
              key={day.date}
              className="reports-timeline-bar-group"
              title={t('timelineTooltip', { date: day.date, entries: day.entries, tasksCreated: day.tasksCreated, tasksCompleted: day.tasksCompleted })}
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
        <span><span className="legend-dot legend-entries" /> {t('legendEntries')}</span>
        <span><span className="legend-dot legend-tasks-completed" /> {t('legendTasksCompleted')}</span>
      </div>
    </div>
  )
}

/* ===== Entry Type Distribution ===== */
function EntryTypeChart({ distribution }: { distribution: EntryTypeDistribution[] }) {
  const { t } = useTranslation('reports')
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)

  const ENTRY_TYPE_LABELS_I18N: Record<EntryType, string> = {
    information: t('typeInformation'),
    decision: t('typeDecision'),
    demand: t('typeDemand'),
    idea: t('typeIdea'),
    blocker: t('typeBlocker'),
    update: t('typeUpdate'),
  }

  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <PieChart size={14} />
        {t('entryTypes')}
      </h3>
      <div className="reports-type-chart">
        {distribution.map((item) => (
          <div key={item.type} className="reports-type-row">
            <div className="reports-type-label">
              <span
                className="reports-type-dot"
                style={{ backgroundColor: ENTRY_TYPE_COLORS[item.type] }}
              />
              <span>{ENTRY_TYPE_LABELS_I18N[item.type]}</span>
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
  const { t } = useTranslation('reports')
  const total = taskFlow.todo + taskFlow.inProgress + taskFlow.waiting + taskFlow.done
  const segments = [
    { label: t('taskFlowTodo'), count: taskFlow.todo, color: 'var(--chart-blue)' },
    { label: t('taskFlowInProgress'), count: taskFlow.inProgress, color: 'var(--chart-orange)' },
    { label: t('taskFlowWaiting'), count: taskFlow.waiting, color: 'var(--chart-yellow)' },
    { label: t('taskFlowDone'), count: taskFlow.done, color: 'var(--chart-green)' },
  ]

  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <Target size={14} />
        {t('taskFlow')}
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
            <span>{t('avgLeadTime', { days: taskFlow.avgLeadTimeDays })}</span>
          </div>
        )}
        {taskFlow.longestWaitingTask && (
          <div className="reports-flow-stat warning">
            <AlertTriangle size={12} />
            <span>
              {t('longestWaiting', { title: taskFlow.longestWaitingTask.title, project: taskFlow.longestWaitingTask.projectName, days: taskFlow.longestWaitingTask.daysSinceUpdate })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ===== Weekday Activity ===== */
function WeekdayChart({ weekday }: { weekday: WeekdayActivity[] }) {
  const { t } = useTranslation('reports')
  const maxActivity = Math.max(...weekday.map((d) => d.entries + d.tasksCompleted), 1)

  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <Calendar size={14} />
        {t('weekdayActivity')}
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
        <span><span className="legend-dot legend-entries" /> {t('legendEntries')}</span>
        <span><span className="legend-dot legend-tasks-completed" /> {t('legendTasks')}</span>
      </div>
    </div>
  )
}

/* ===== Project Ranking Table ===== */
function ProjectRankingTable({ ranking }: { ranking: ProjectRanking[] }) {
  const { t } = useTranslation('reports')
  return (
    <div className="reports-section">
      <h3 className="reports-section-title">
        <FolderOpen size={14} />
        {t('projectRanking')}
      </h3>
      <div className="reports-table">
        <table>
          <thead>
            <tr>
              <th>{t('columnProject')}</th>
              <th>{t('columnEntries')}</th>
              <th>{t('columnTasks')}</th>
              <th>{t('columnCompleted')}</th>
              <th>{t('columnBlockers')}</th>
              <th>{t('columnLastActivity')}</th>
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
