import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowLeft, Sparkles, X, Trash2, Link2, Search, Plus, ArrowUpDown, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from './ConfirmModal'
import { MarkdownViewer } from './MarkdownViewer'
import { CONNECTION_TYPE_LABELS, ConnectionType, ConnectedEntry } from '../../shared/types'

interface Entry {
  id: string
  rawText: string
  improvedText: string
  projectId: string
  type: string
  action: string
  createdAt: string
}

type SortField = 'date' | 'type' | 'action'
type SortDirection = 'asc' | 'desc'

const PAGE_SIZE = 50

interface EntryListProps {
  projectId: string
  onBack: () => void
}

export function EntryList({ projectId, onBack }: EntryListProps) {
  const { t, i18n } = useTranslation('projects')
  const [entries, setEntries] = useState<Entry[]>([])
  const [totalEntries, setTotalEntries] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Search & sort state
  const [filterQuery, setFilterQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Connections state
  const [connectionsMap, setConnectionsMap] = useState<Record<string, ConnectedEntry[]>>({})
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set())
  const [connectModalEntry, setConnectModalEntry] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Entry[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedConnectionType, setSelectedConnectionType] = useState<ConnectionType>('related')

  // Dynamic labels from custom fields
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({})
  const [typeBadgeVariant, setTypeBadgeVariant] = useState<Record<string, string>>({})
  const [actionLabels, setActionLabels] = useState<Record<string, string>>({})
  const [typesAllowsAction, setTypesAllowsAction] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadEntries()
    loadCustomFields()
  }, [projectId])

  const loadCustomFields = async () => {
    const [types, statuses] = await Promise.all([
      window.electronAPI.getEntryTypes(),
      window.electronAPI.getActionStatuses(),
    ])
    setTypeLabels(Object.fromEntries(types.map(t => [t.key, t.label])))
    setTypeBadgeVariant(Object.fromEntries(types.map(t => [t.key, t.color])))
    setActionLabels(Object.fromEntries(statuses.map(s => [s.key, s.label])))
    setTypesAllowsAction(Object.fromEntries(types.map(t => [t.key, t.allowsAction])))
  }

  const loadEntries = async () => {
    const result = await window.electronAPI.getEntriesPaginated({
      page: 1,
      pageSize: PAGE_SIZE,
      projectId,
    })
    setEntries(result.data)
    setTotalEntries(result.total)
    setCurrentPage(1)
  }

  const loadMoreEntries = async () => {
    setIsLoadingMore(true)
    try {
      const nextPage = currentPage + 1
      const result = await window.electronAPI.getEntriesPaginated({
        page: nextPage,
        pageSize: PAGE_SIZE,
        projectId,
      })
      setEntries(prev => [...prev, ...result.data])
      setCurrentPage(nextPage)
      setTotalEntries(result.total)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const hasMoreEntries = entries.length < totalEntries

  // Filtered and sorted entries
  const filteredEntries = useMemo(() => {
    let result = entries

    // Filter by search query
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase()
      result = result.filter(entry =>
        entry.improvedText.toLowerCase().includes(q) ||
        entry.rawText.toLowerCase().includes(q) ||
        (typeLabels[entry.type] || entry.type).toLowerCase().includes(q)
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'date':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'type':
          cmp = (typeLabels[a.type] || a.type).localeCompare(typeLabels[b.type] || b.type)
          break
        case 'action':
          cmp = (actionLabels[a.action] || a.action).localeCompare(actionLabels[b.action] || b.action)
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })

    return result
  }, [entries, filterQuery, sortField, sortDirection, typeLabels, actionLabels])

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'date' ? 'desc' : 'asc')
    }
  }

  const loadConnectionsForEntry = useCallback(async (entryId: string) => {
    const connections = await window.electronAPI.getConnectionsByEntry(entryId)
    setConnectionsMap(prev => ({ ...prev, [entryId]: connections }))
  }, [])

  const toggleConnections = async (entryId: string) => {
    const newExpanded = new Set(expandedConnections)
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId)
    } else {
      newExpanded.add(entryId)
      if (!connectionsMap[entryId]) {
        await loadConnectionsForEntry(entryId)
      }
    }
    setExpandedConnections(newExpanded)
  }

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true)
    try {
      const result = await window.electronAPI.generateSummary(projectId)
      setSummary(result)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  const handleActionChange = async (entryId: string, newAction: string) => {
    await window.electronAPI.updateEntry(entryId, { action: newAction })
    await loadEntries()
  }

  const handleDelete = async (entryId: string) => {
    setDeleteTarget(entryId)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await window.electronAPI.deleteEntry(deleteTarget)
    setDeleteTarget(null)
    await loadEntries()
  }

  // Connection actions
  const openConnectModal = (entryId: string) => {
    setConnectModalEntry(entryId)
    setSearchQuery('')
    setSearchResults([])
    setSelectedConnectionType('related')
  }

  const closeConnectModal = () => {
    setConnectModalEntry(null)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleSearchConnections = async (query: string) => {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const results = await window.electronAPI.searchEntriesForConnection(query, connectModalEntry!)
      setSearchResults(results)
    } finally {
      setIsSearching(false)
    }
  }

  const handleCreateConnection = async (targetEntryId: string) => {
    if (!connectModalEntry) return
    try {
      await window.electronAPI.createConnection({
        sourceEntryId: connectModalEntry,
        targetEntryId,
        connectionType: selectedConnectionType,
      })
      // Reload connections for this entry
      await loadConnectionsForEntry(connectModalEntry)
      // Ensure expanded
      setExpandedConnections(prev => new Set(prev).add(connectModalEntry))
      closeConnectModal()
    } catch (err: any) {
      // Connection already exists — silently ignore or could show toast
      console.warn('Conexão já existe:', err.message)
    }
  }

  const handleDeleteConnection = async (connectionId: string, entryId: string) => {
    await window.electronAPI.deleteConnection(connectionId)
    await loadConnectionsForEntry(entryId)
  }

  return (
    <div className="flex-col" style={{ height: '100%', minHeight: 0 }}>
      <div className="panel-header">
        <div className="flex-row">
          <button
            className="inline-action-btn"
            onClick={onBack}
            title={t('entryList.backToProjects')}
            style={{ opacity: 1 }}
          >
            <ArrowLeft size={16} />
          </button>
          <span className="panel-title">{t('entryList.title')}</span>
        </div>
        <button
          className="vscode-button"
          onClick={handleGenerateSummary}
          disabled={isLoadingSummary}
        >
          <Sparkles size={14} />
          {isLoadingSummary ? t('entryList.generatingSummary') : t('entryList.generateSummary')}
        </button>
      </div>

      {/* Search and Sort toolbar */}
      {entries.length > 0 && (
        <div className="entry-list-toolbar">
          <div className="entry-list-search">
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <input
              type="text"
              className="vscode-input"
              placeholder={t('entryList.searchPlaceholder')}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{ paddingLeft: 28, width: '100%' }}
            />
            {filterQuery && (
              <button
                className="inline-action-btn"
                onClick={() => setFilterQuery('')}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="entry-list-sort">
            <ArrowUpDown size={12} style={{ opacity: 0.6 }} />
            <button
              className={`entry-sort-btn ${sortField === 'date' ? 'active' : ''}`}
              onClick={() => handleSortChange('date')}
              title={t('entryList.sortByDate')}
            >
              {t('entryList.sortDate')} {sortField === 'date' && (sortDirection === 'desc' ? '↓' : '↑')}
            </button>
            <button
              className={`entry-sort-btn ${sortField === 'type' ? 'active' : ''}`}
              onClick={() => handleSortChange('type')}
              title={t('entryList.sortByType')}
            >
              {t('entryList.sortType')} {sortField === 'type' && (sortDirection === 'desc' ? '↓' : '↑')}
            </button>
            <button
              className={`entry-sort-btn ${sortField === 'action' ? 'active' : ''}`}
              onClick={() => handleSortChange('action')}
              title={t('entryList.sortByStatus')}
            >
              {t('entryList.sortStatus')} {sortField === 'action' && (sortDirection === 'desc' ? '↓' : '↑')}
            </button>
          </div>
          {filterQuery && (
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
              {t('entryList.resultsCount', { filtered: filteredEntries.length, total: totalEntries })}
            </span>
          )}
          {!filterQuery && totalEntries > 0 && (
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
              {t('entryList.loadedCount', { loaded: entries.length, total: totalEntries })}
            </span>
          )}
        </div>
      )}

      {summary && (
        <div className="summary-modal-overlay" onClick={() => setSummary(null)}>
          <div className="summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="summary-modal-header">
              <Sparkles size={16} />
              <span>{t('entryList.summaryTitle')}</span>
              <button className="icon-button" onClick={() => setSummary(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="summary-modal-body">
              <MarkdownViewer content={summary} />
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {t('entryList.emptyState')}
          </span>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {t('entryList.noResults', { query: filterQuery })}
          </span>
        </div>
      ) : (
        <div className="entry-list-scroll">
          <div className="flex-col gap-4">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="vscode-card">
                <div className="vscode-card-header">
                  <div className="flex-row">
                    <span className={`vscode-badge ${typeBadgeVariant[entry.type] || 'neutral'}`}>
                      {typeLabels[entry.type] || entry.type}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                      {new Date(entry.createdAt).toLocaleString(i18n.language)}
                    </span>
                  </div>
                  <div className="flex-row">
                    {typesAllowsAction[entry.type] !== false && (
                      <select
                        className="vscode-select"
                        value={entry.action}
                        onChange={(e) => handleActionChange(entry.id, e.target.value)}
                        style={{ fontSize: 11, padding: '2px 6px' }}
                      >
                        {Object.entries(actionLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    )}
                    <button
                      className="inline-action-btn"
                      onClick={() => openConnectModal(entry.id)}
                      title={t('entryList.connectTooltip')}
                      style={{ opacity: 0.6 }}
                    >
                      <Link2 size={14} />
                    </button>
                    <button
                      className="inline-action-btn"
                      onClick={() => handleDelete(entry.id)}
                      title={t('entryList.deleteTooltip')}
                      style={{ opacity: 0.6, color: 'var(--vscode-errorForeground)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="vscode-card-body">
                  {entry.improvedText}
                </div>
                {entry.rawText !== entry.improvedText && (
                  <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginTop: 6, fontStyle: 'italic' }}>
                    {t('entryList.original')} {entry.rawText}
                  </div>
                )}

                {/* Connections toggle & display */}
                <div style={{ marginTop: 8, borderTop: '1px solid var(--vscode-widget-border)', paddingTop: 6 }}>
                  <button
                    className="inline-action-btn"
                    onClick={() => toggleConnections(entry.id)}
                    style={{ fontSize: 11, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Link2 size={12} />
                    {expandedConnections.has(entry.id) ? t('entryList.hideConnections') : t('entryList.showConnections')}
                  </button>

                  {expandedConnections.has(entry.id) && connectionsMap[entry.id] && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {connectionsMap[entry.id].length === 0 ? (
                        <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                          {t('entryList.noConnections')}
                        </span>
                      ) : (
                        connectionsMap[entry.id].map((conn) => (
                          <div
                            key={conn.connection.id}
                            className="connection-chip"
                            title={conn.entry.improvedText}
                          >
                            <span className="connection-chip-type">
                              {CONNECTION_TYPE_LABELS[conn.connection.connectionType] || conn.connection.connectionType}
                            </span>
                            <span className="connection-chip-text">
                              {conn.entry.improvedText.length > 50
                                ? conn.entry.improvedText.slice(0, 50) + '...'
                                : conn.entry.improvedText}
                            </span>
                            <button
                              className="connection-chip-remove"
                              onClick={() => handleDeleteConnection(conn.connection.id, entry.id)}
                              title={t('entryList.removeConnection')}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Load More button */}
            {hasMoreEntries && !filterQuery && (
              <button
                className="vscode-button"
                onClick={loadMoreEntries}
                disabled={isLoadingMore}
                style={{ alignSelf: 'center', marginTop: 8, marginBottom: 8 }}
              >
                <ChevronDown size={14} />
                {isLoadingMore
                  ? t('entryList.loadingMore')
                  : t('entryList.loadMore', { remaining: totalEntries - entries.length })
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* Connect Modal */}
      {connectModalEntry && (
        <div className="summary-modal-overlay" onClick={closeConnectModal}>
          <div className="summary-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="summary-modal-header">
              <Link2 size={16} />
              <span>{t('entryList.connectEntry')}</span>
              <button className="icon-button" onClick={closeConnectModal}>
                <X size={16} />
              </button>
            </div>
            <div className="summary-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Connection type selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>{t('entryList.connectionType')}</label>
                <select
                  className="vscode-select"
                  value={selectedConnectionType}
                  onChange={(e) => setSelectedConnectionType(e.target.value as ConnectionType)}
                  style={{ fontSize: 12 }}
                >
                  {Object.entries(CONNECTION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 8, top: 8, opacity: 0.5 }} />
                <input
                  type="text"
                  className="vscode-input"
                  placeholder={t('entryList.searchConnections')}
                  value={searchQuery}
                  onChange={(e) => handleSearchConnections(e.target.value)}
                  autoFocus
                  style={{ paddingLeft: 28, width: '100%' }}
                />
              </div>

              {/* Search results */}
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {isSearching && (
                  <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>{t('entryList.searching')}</span>
                )}
                {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>{t('entryList.noEntriesFound')}</span>
                )}
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="connection-search-result"
                    onClick={() => handleCreateConnection(result.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={12} style={{ opacity: 0.6 }} />
                      <span style={{ fontSize: 12 }}>
                        {result.improvedText.length > 80
                          ? result.improvedText.slice(0, 80) + '...'
                          : result.improvedText}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)' }}>
                      {new Date(result.createdAt).toLocaleDateString(i18n.language)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={t('entryList.deleteTitle')}
        message={t('entryList.deleteMessage')}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
