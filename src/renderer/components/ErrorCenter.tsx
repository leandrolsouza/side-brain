import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, AlertCircle, AlertOctagon, CheckCircle, Trash2, CheckCheck, Filter, RefreshCw, ChevronDown, ChevronRight, Cpu, Database, Radio, Monitor, Server } from 'lucide-react'
import type { ErrorLog, ErrorCategory, ErrorSeverity } from '../../shared/types'

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  ai: 'Inteligência Artificial',
  database: 'Banco de Dados',
  ipc: 'Comunicação IPC',
  renderer: 'Interface',
  system: 'Sistema',
}

const CATEGORY_ICONS: Record<ErrorCategory, React.ReactNode> = {
  ai: <Cpu size={14} />,
  database: <Database size={14} />,
  ipc: <Radio size={14} />,
  renderer: <Monitor size={14} />,
  system: <Server size={14} />,
}

const SEVERITY_LABELS: Record<ErrorSeverity, string> = {
  warning: 'Aviso',
  error: 'Erro',
  critical: 'Crítico',
}

const SEVERITY_ICONS: Record<ErrorSeverity, React.ReactNode> = {
  warning: <AlertTriangle size={14} />,
  error: <AlertCircle size={14} />,
  critical: <AlertOctagon size={14} />,
}

export function ErrorCenter() {
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState<ErrorCategory | ''>('')
  const [filterSeverity, setFilterSeverity] = useState<ErrorSeverity | ''>('')
  const [filterResolved, setFilterResolved] = useState<'all' | 'unresolved' | 'resolved'>('unresolved')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const loadErrors = useCallback(async () => {
    setLoading(true)
    try {
      const filters: { category?: ErrorCategory; severity?: ErrorSeverity; resolved?: boolean } = {}
      if (filterCategory) filters.category = filterCategory
      if (filterSeverity) filters.severity = filterSeverity
      if (filterResolved === 'unresolved') filters.resolved = false
      else if (filterResolved === 'resolved') filters.resolved = true

      const data = await window.electronAPI.getErrorLogs(filters)
      setErrors(data)
    } catch (err) {
      console.error('Falha ao carregar logs de erro:', err)
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterSeverity, filterResolved])

  useEffect(() => {
    loadErrors()
  }, [loadErrors])

  // Escuta mudanças na contagem de erros para recarregar
  useEffect(() => {
    window.electronAPI.onErrorCountChanged(() => {
      loadErrors()
    })
  }, [loadErrors])

  const handleResolve = async (id: string) => {
    await window.electronAPI.resolveError(id)
    loadErrors()
  }

  const handleResolveAll = async () => {
    await window.electronAPI.resolveAllErrors()
    loadErrors()
  }

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteError(id)
    loadErrors()
  }

  const handleClearAll = async () => {
    await window.electronAPI.clearAllErrors()
    loadErrors()
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp + 'Z')
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const parseContext = (ctx?: string): Record<string, any> | null => {
    if (!ctx) return null
    try {
      return JSON.parse(ctx)
    } catch {
      return null
    }
  }

  const unresolvedCount = errors.filter((e) => !e.resolved).length

  return (
    <div className="error-center">
      {/* Header */}
      <div className="error-center-header">
        <div className="error-center-title">
          <AlertCircle size={20} />
          <h2>Central de Erros</h2>
          {unresolvedCount > 0 && (
            <span className="error-center-badge">{unresolvedCount}</span>
          )}
        </div>
        <div className="error-center-actions">
          <button
            className="btn-icon"
            onClick={() => setShowFilters(!showFilters)}
            title="Filtros"
          >
            <Filter size={16} />
          </button>
          <button className="btn-icon" onClick={loadErrors} title="Atualizar">
            <RefreshCw size={16} />
          </button>
          <button
            className="btn-secondary"
            onClick={handleResolveAll}
            disabled={unresolvedCount === 0}
            title="Resolver todos"
          >
            <CheckCheck size={14} />
            <span>Resolver Todos</span>
          </button>
          <button
            className="btn-danger"
            onClick={handleClearAll}
            disabled={errors.length === 0}
            title="Limpar histórico"
          >
            <Trash2 size={14} />
            <span>Limpar</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="error-center-filters">
          <div className="filter-group">
            <label>Categoria</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as ErrorCategory | '')}
            >
              <option value="">Todas</option>
              <option value="ai">IA</option>
              <option value="database">Banco de Dados</option>
              <option value="ipc">IPC</option>
              <option value="renderer">Interface</option>
              <option value="system">Sistema</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Severidade</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as ErrorSeverity | '')}
            >
              <option value="">Todas</option>
              <option value="critical">Crítico</option>
              <option value="error">Erro</option>
              <option value="warning">Aviso</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filterResolved}
              onChange={(e) => setFilterResolved(e.target.value as 'all' | 'unresolved' | 'resolved')}
            >
              <option value="all">Todos</option>
              <option value="unresolved">Não resolvidos</option>
              <option value="resolved">Resolvidos</option>
            </select>
          </div>
        </div>
      )}

      {/* Error List */}
      <div className="error-center-list">
        {loading ? (
          <div className="error-center-empty">Carregando...</div>
        ) : errors.length === 0 ? (
          <div className="error-center-empty">
            <CheckCircle size={48} />
            <p>Nenhum erro registrado</p>
            <span>O sistema está funcionando normalmente.</span>
          </div>
        ) : (
          errors.map((error) => {
            const isExpanded = expandedId === error.id
            const context = parseContext(error.context)

            return (
              <div
                key={error.id}
                className={`error-item severity-${error.severity} ${error.resolved ? 'resolved' : ''}`}
              >
                <div
                  className="error-item-header"
                  onClick={() => setExpandedId(isExpanded ? null : error.id)}
                >
                  <div className="error-item-expand">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                  <div className={`error-item-severity severity-${error.severity}`}>
                    {SEVERITY_ICONS[error.severity]}
                  </div>
                  <div className="error-item-content">
                    <div className="error-item-message">{error.message}</div>
                    <div className="error-item-meta">
                      <span className="error-item-category">
                        {CATEGORY_ICONS[error.category]}
                        {CATEGORY_LABELS[error.category]}
                      </span>
                      <span className="error-item-time">
                        {formatTimestamp(error.lastOccurrence)}
                      </span>
                      {error.occurrences > 1 && (
                        <span className="error-item-occurrences">
                          ×{error.occurrences}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="error-item-actions">
                    {!error.resolved && (
                      <button
                        className="btn-icon-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleResolve(error.id)
                        }}
                        title="Marcar como resolvido"
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button
                      className="btn-icon-sm danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(error.id)
                      }}
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="error-item-details">
                    <div className="error-detail-row">
                      <span className="error-detail-label">Severidade:</span>
                      <span className={`error-detail-value severity-text-${error.severity}`}>
                        {SEVERITY_LABELS[error.severity]}
                      </span>
                    </div>
                    <div className="error-detail-row">
                      <span className="error-detail-label">Primeira ocorrência:</span>
                      <span className="error-detail-value">{formatTimestamp(error.timestamp)}</span>
                    </div>
                    {error.occurrences > 1 && (
                      <div className="error-detail-row">
                        <span className="error-detail-label">Última ocorrência:</span>
                        <span className="error-detail-value">{formatTimestamp(error.lastOccurrence)}</span>
                      </div>
                    )}
                    {error.stack && (
                      <div className="error-detail-stack">
                        <span className="error-detail-label">Stack Trace:</span>
                        <pre>{error.stack}</pre>
                      </div>
                    )}
                    {context && (
                      <div className="error-detail-context">
                        <span className="error-detail-label">Contexto:</span>
                        <pre>{JSON.stringify(context, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
