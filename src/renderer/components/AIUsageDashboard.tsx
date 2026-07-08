import React, { useState, useEffect } from 'react'
import { BarChart3, Zap, DollarSign, Clock, RefreshCw } from 'lucide-react'
import type { AIUsageSummary, AIUsageDailyPoint, AIUsageRecord, AIOperationType } from '../../shared/types'

type PeriodFilter = '7d' | '30d' | '90d' | 'all'

const OPERATION_LABELS: Record<AIOperationType, string> = {
  categorization: 'Categorização',
  summary: 'Resumo de Projeto',
  global_summary: 'Resumo Global',
  digest: 'Digest Diário',
  meeting_processing: 'Processamento de Reunião',
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('pt-BR')
}

function formatCurrency(value: number): string {
  return 'US$ ' + value.toFixed(4)
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
  const [period, setPeriod] = useState<PeriodFilter>('30d')
  const [summary, setSummary] = useState<AIUsageSummary | null>(null)
  const [dailyUsage, setDailyUsage] = useState<AIUsageDailyPoint[]>([])
  const [history, setHistory] = useState<AIUsageRecord[]>([])
  const [loading, setLoading] = useState(true)

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

  const maxDailyTokens = Math.max(
    ...dailyUsage.map((d) => d.inputTokens + d.outputTokens),
    1
  )

  return (
    <div className="ai-usage-dashboard">
      {/* Header */}
      <div className="ai-usage-header">
        <h2><BarChart3 size={20} /> Uso da IA</h2>
        <div className="ai-usage-controls">
          <div className="ai-usage-period-filter">
            {(['7d', '30d', '90d', 'all'] as PeriodFilter[]).map((p) => (
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
      </div>

      {loading ? (
        <div className="ai-usage-loading">Carregando...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="ai-usage-cards">
            <div className="ai-usage-card">
              <div className="ai-usage-card-icon"><Zap size={20} /></div>
              <div className="ai-usage-card-content">
                <span className="ai-usage-card-value">{summary?.totalCalls ?? 0}</span>
                <span className="ai-usage-card-label">Chamadas</span>
              </div>
            </div>
            <div className="ai-usage-card">
              <div className="ai-usage-card-icon"><BarChart3 size={20} /></div>
              <div className="ai-usage-card-content">
                <span className="ai-usage-card-value">
                  {formatNumber((summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0))}
                </span>
                <span className="ai-usage-card-label">Tokens Totais</span>
              </div>
            </div>
            <div className="ai-usage-card">
              <div className="ai-usage-card-icon"><DollarSign size={20} /></div>
              <div className="ai-usage-card-content">
                <span className="ai-usage-card-value">{formatCurrency(summary?.totalEstimatedCost ?? 0)}</span>
                <span className="ai-usage-card-label">Custo Estimado</span>
              </div>
            </div>
            <div className="ai-usage-card">
              <div className="ai-usage-card-icon"><Clock size={20} /></div>
              <div className="ai-usage-card-content">
                <span className="ai-usage-card-value">
                  {formatNumber(summary?.totalInputTokens ?? 0)} / {formatNumber(summary?.totalOutputTokens ?? 0)}
                </span>
                <span className="ai-usage-card-label">Input / Output</span>
              </div>
            </div>
          </div>

          {/* Daily Usage Chart (simple bar chart) */}
          {dailyUsage.length > 0 && (
            <div className="ai-usage-section">
              <h3>Uso Diário</h3>
              <div className="ai-usage-chart">
                {dailyUsage.slice(0, 30).reverse().map((day) => {
                  const totalTokens = day.inputTokens + day.outputTokens
                  const heightPercent = (totalTokens / maxDailyTokens) * 100
                  const inputPercent = totalTokens > 0 ? (day.inputTokens / totalTokens) * 100 : 0
                  return (
                    <div key={day.date} className="ai-usage-chart-bar-wrapper" title={`${day.date}\n${day.calls} chamadas\n${formatNumber(totalTokens)} tokens\n${formatCurrency(day.estimatedCost)}`}>
                      <div className="ai-usage-chart-bar" style={{ height: `${Math.max(heightPercent, 2)}%` }}>
                        <div className="ai-usage-chart-bar-input" style={{ height: `${inputPercent}%` }} />
                      </div>
                      <span className="ai-usage-chart-label">
                        {day.date.slice(8, 10)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="ai-usage-chart-legend">
                <span><span className="legend-dot legend-input" /> Input</span>
                <span><span className="legend-dot legend-output" /> Output</span>
              </div>
            </div>
          )}

          {/* Breakdown by Operation */}
          {summary && summary.byOperation.length > 0 && (
            <div className="ai-usage-section">
              <h3>Por Tipo de Operação</h3>
              <div className="ai-usage-table">
                <table>
                  <thead>
                    <tr>
                      <th>Operação</th>
                      <th>Chamadas</th>
                      <th>Input</th>
                      <th>Output</th>
                      <th>Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byOperation.map((op) => (
                      <tr key={op.operationType}>
                        <td>{OPERATION_LABELS[op.operationType] || op.operationType}</td>
                        <td>{op.calls}</td>
                        <td>{formatNumber(op.inputTokens)}</td>
                        <td>{formatNumber(op.outputTokens)}</td>
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
              <h3>Histórico Recente</h3>
              <div className="ai-usage-table">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Operação</th>
                      <th>Tokens</th>
                      <th>Custo</th>
                      <th>Latência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 20).map((record) => (
                      <tr key={record.id}>
                        <td>{new Date(record.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{OPERATION_LABELS[record.operationType] || record.operationType}</td>
                        <td>{formatNumber(record.inputTokens + record.outputTokens)}</td>
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
              <p>Nenhum uso da IA registrado ainda.</p>
              <p className="ai-usage-empty-hint">Os dados aparecerão aqui conforme você usar as funcionalidades de IA do app.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
