import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Zap, DollarSign, Clock, RefreshCw } from 'lucide-react'
import type { AIUsageSummary, AIUsageDailyPoint, AIUsageRecord, AIOperationType } from '../../shared/types'

type PeriodFilter = '7d' | '30d' | '90d' | 'all'

function formatNumber(n: number, locale: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString(locale)
}

function formatCurrency(value: number): string {
  return `US$ ${value.toFixed(4)}`
}

function getDateRange(period: PeriodFilter): { dateFrom?: string; dateTo?: string } {
  if (period === 'all') return {}
  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const from = new Date(now)
  from.setDate(from.getDate() - days)
  return { dateFrom: from.toISOString(), dateTo: now.toISOString() }
}

export function AIUsageDashboard() {
  const { t, i18n } = useTranslation('reports')
  const [period, setPeriod] = useState<PeriodFilter>('30d')
  const [summary, setSummary] = useState<AIUsageSummary | null>(null)
  const [dailyUsage, setDailyUsage] = useState<AIUsageDailyPoint[]>([])
  const [history, setHistory] = useState<AIUsageRecord[]>([])
  const [loading, setLoading] = useState(true)

  const getOperationLabel = (op: AIOperationType): string => {
    const map: Record<string, string> = {
      categorization: t('aiUsage.operationCategorization'),
      summary: t('aiUsage.operationSummary'),
      global_summary: t('aiUsage.operationGlobalSummary'),
      digest: t('aiUsage.operationDigest'),
      meeting_processing: t('aiUsage.operationMeetingProcessing'),
      smart_chat: t('aiUsage.operationSmartChat'),
      insights: t('aiUsage.operationInsights'),
      meeting_prep: t('aiUsage.operationMeetingPrep'),
      connection_discovery: t('aiUsage.operationConnectionDiscovery'),
    }
    return map[op] || op
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const { dateFrom, dateTo } = getDateRange(period)
      const [summaryData, dailyData, historyData] = await Promise.all([
        window.electronAPI.getAIUsageSummary(dateFrom, dateTo),
        window.electronAPI.getAIUsageDailyUsage(dateFrom, dateTo),
        window.electronAPI.getAIUsageHistory(50, 0),
      ])
      setSummary(summaryData)
      setDailyUsage(dailyData)
      setHistory(historyData)
    } catch (err) {
      console.error('Erro ao carregar dados de uso da IA:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [period])

  const maxDailyTokens = Math.max(...dailyUsage.map((d) => d.inputTokens + d.outputTokens), 1)

  return (
    <div className="ai-usage-dashboard">
      {/* Header */}
      <div className="ai-usage-header">
        <h2>
          <BarChart3 size={20} /> {t('aiUsage.title')}
        </h2>
        <div className="ai-usage-controls">
          <div className="ai-usage-period-filter">
            {(['7d', '30d', '90d', 'all'] as PeriodFilter[]).map((p) => (
              <button
                type="button"
                key={p}
                className={`period-btn ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p === '7d'
                  ? t('period7d')
                  : p === '30d'
                    ? t('period30d')
                    : p === '90d'
                      ? t('period90d')
                      : t('periodAll')}
              </button>
            ))}
          </div>
          <button type="button" className="btn-icon" onClick={loadData} title={t('refresh')}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ai-usage-loading">{t('common:loading')}</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="ai-usage-cards">
            <div className="ai-usage-card">
              <div className="ai-usage-card-icon">
                <Zap size={20} />
              </div>
              <div className="ai-usage-card-content">
                <span className="ai-usage-card-value">{summary?.totalCalls ?? 0}</span>
                <span className="ai-usage-card-label">{t('aiUsage.calls')}</span>
              </div>
            </div>
            <div className="ai-usage-card">
              <div className="ai-usage-card-icon">
                <BarChart3 size={20} />
              </div>
              <div className="ai-usage-card-content">
                <span className="ai-usage-card-value">
                  {formatNumber((summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0), i18n.language)}
                </span>
                <span className="ai-usage-card-label">{t('aiUsage.totalTokens')}</span>
              </div>
            </div>
            <div className="ai-usage-card">
              <div className="ai-usage-card-icon">
                <DollarSign size={20} />
              </div>
              <div className="ai-usage-card-content">
                <span className="ai-usage-card-value">{formatCurrency(summary?.totalEstimatedCost ?? 0)}</span>
                <span className="ai-usage-card-label">{t('aiUsage.estimatedCost')}</span>
              </div>
            </div>
            <div className="ai-usage-card">
              <div className="ai-usage-card-icon">
                <Clock size={20} />
              </div>
              <div className="ai-usage-card-content">
                <span className="ai-usage-card-value">
                  {formatNumber(summary?.totalInputTokens ?? 0, i18n.language)} /{' '}
                  {formatNumber(summary?.totalOutputTokens ?? 0, i18n.language)}
                </span>
                <span className="ai-usage-card-label">{t('aiUsage.inputOutput')}</span>
              </div>
            </div>
          </div>

          {/* Daily Usage Chart (simple bar chart) */}
          {dailyUsage.length > 0 && (
            <div className="ai-usage-section">
              <h3>{t('aiUsage.dailyUsage')}</h3>
              <div className="ai-usage-chart">
                {dailyUsage
                  .slice(0, 30)
                  .reverse()
                  .map((day) => {
                    const totalTokens = day.inputTokens + day.outputTokens
                    const heightPercent = (totalTokens / maxDailyTokens) * 100
                    const inputPercent = totalTokens > 0 ? (day.inputTokens / totalTokens) * 100 : 0
                    return (
                      <div
                        key={day.date}
                        className="ai-usage-chart-bar-wrapper"
                        title={t('aiUsage.chartTooltip', {
                          date: day.date,
                          calls: day.calls,
                          tokens: formatNumber(totalTokens, i18n.language),
                          cost: formatCurrency(day.estimatedCost),
                        })}
                      >
                        <div className="ai-usage-chart-bar" style={{ height: `${Math.max(heightPercent, 2)}%` }}>
                          <div className="ai-usage-chart-bar-input" style={{ height: `${inputPercent}%` }} />
                        </div>
                        <span className="ai-usage-chart-label">{day.date.slice(8, 10)}</span>
                      </div>
                    )
                  })}
              </div>
              <div className="ai-usage-chart-legend">
                <span>
                  <span className="legend-dot legend-input" /> Input
                </span>
                <span>
                  <span className="legend-dot legend-output" /> Output
                </span>
              </div>
            </div>
          )}

          {/* Breakdown by Operation */}
          {summary && summary.byOperation.length > 0 && (
            <div className="ai-usage-section">
              <h3>{t('aiUsage.byOperation')}</h3>
              <div className="ai-usage-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t('aiUsage.columnOperation')}</th>
                      <th>{t('aiUsage.columnCalls')}</th>
                      <th>{t('aiUsage.columnInput')}</th>
                      <th>{t('aiUsage.columnOutput')}</th>
                      <th>{t('aiUsage.columnCost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byOperation.map((op) => (
                      <tr key={op.operationType}>
                        <td>{getOperationLabel(op.operationType)}</td>
                        <td>{op.calls}</td>
                        <td>{formatNumber(op.inputTokens, i18n.language)}</td>
                        <td>{formatNumber(op.outputTokens, i18n.language)}</td>
                        <td>{formatCurrency(op.estimatedCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent History */}
          {history.length > 0 && (
            <div className="ai-usage-section">
              <h3>{t('aiUsage.recentHistory')}</h3>
              <div className="ai-usage-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t('aiUsage.columnDate')}</th>
                      <th>{t('aiUsage.columnOperation')}</th>
                      <th>{t('aiUsage.columnTokens')}</th>
                      <th>{t('aiUsage.columnCost')}</th>
                      <th>{t('aiUsage.columnLatency')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 20).map((record) => (
                      <tr key={record.id}>
                        <td>
                          {new Date(record.createdAt).toLocaleString(i18n.language, {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>{getOperationLabel(record.operationType)}</td>
                        <td>{formatNumber(record.inputTokens + record.outputTokens, i18n.language)}</td>
                        <td>{formatCurrency(record.estimatedCost)}</td>
                        <td>{record.latencyMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!summary || summary.totalCalls === 0) && (
            <div className="ai-usage-empty">
              <BarChart3 size={48} />
              <p>{t('aiUsage.emptyTitle')}</p>
              <p className="ai-usage-empty-hint">{t('aiUsage.emptyHint')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
