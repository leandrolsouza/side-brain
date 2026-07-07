import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Entry, Task, Project, EntryType } from '../../shared/types'

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
  onNavigateToProject: (projectId: string, projectName: string) => void
}

type ResultType = 'all' | 'entry' | 'task' | 'project'

interface SearchFilters {
  type?: string
  projectId?: string
  dateFrom?: string
  dateTo?: string
}

interface SearchResults {
  entries: Entry[]
  tasks: Task[]
  projects: Project[]
}

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  information: 'Informação',
  decision: 'Decisão',
  request: 'Solicitação',
  idea: 'Ideia',
  blocker: 'Bloqueio',
  update: 'Atualização',
}

export function GlobalSearch({ isOpen, onClose, onNavigateToProject }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ entries: [], tasks: [], projects: [] })
  const [activeFilter, setActiveFilter] = useState<ResultType>('all')
  const [filters, setFilters] = useState<SearchFilters>({})
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load available projects for filter dropdown
  useEffect(() => {
    if (isOpen) {
      window.electronAPI.getProjects().then(setAvailableProjects)
    }
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults({ entries: [], tasks: [], projects: [] })
      setSelectedIndex(0)
      setActiveFilter('all')
      setFilters({})
      setShowFilters(false)
    }
  }, [isOpen])

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
    if (!searchQuery.trim()) {
      setResults({ entries: [], tasks: [], projects: [] })
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const result = await window.electronAPI.globalSearch(searchQuery.trim(), searchFilters)
      setResults(result)
      setSelectedIndex(0)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults({ entries: [], tasks: [], projects: [] })
      return
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query, filters)
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, filters, performSearch])

  // Get flattened results list based on active filter
  const getFlatResults = (): Array<{ type: 'entry' | 'task' | 'project'; item: Entry | Task | Project }> => {
    const flat: Array<{ type: 'entry' | 'task' | 'project'; item: Entry | Task | Project }> = []

    if (activeFilter === 'all' || activeFilter === 'project') {
      results.projects.forEach((p) => flat.push({ type: 'project', item: p }))
    }
    if (activeFilter === 'all' || activeFilter === 'entry') {
      results.entries.forEach((e) => flat.push({ type: 'entry', item: e }))
    }
    if (activeFilter === 'all' || activeFilter === 'task') {
      results.tasks.forEach((t) => flat.push({ type: 'task', item: t }))
    }

    return flat
  }

  const flatResults = getFlatResults()

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault()
      handleResultClick(flatResults[selectedIndex])
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsRef.current
    if (!container) return
    const selected = container.querySelector('.search-result-item.selected')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleResultClick = (result: { type: 'entry' | 'task' | 'project'; item: Entry | Task | Project }) => {
    onClose()
    if (result.type === 'project') {
      const project = result.item as Project
      onNavigateToProject(project.id, project.name)
    } else if (result.type === 'entry') {
      const entry = result.item as Entry
      const project = availableProjects.find((p) => p.id === entry.projectId)
      if (project) {
        onNavigateToProject(project.id, project.name)
      }
    } else if (result.type === 'task') {
      const task = result.item as Task
      const project = availableProjects.find((p) => p.id === task.projectId)
      if (project) {
        onNavigateToProject(project.id, project.name)
      }
    }
  }

  const getResultIcon = (type: 'entry' | 'task' | 'project'): string => {
    switch (type) {
      case 'entry': return '📝'
      case 'task': return '✅'
      case 'project': return '📁'
    }
  }

  const getResultLabel = (result: { type: 'entry' | 'task' | 'project'; item: Entry | Task | Project }): string => {
    switch (result.type) {
      case 'project':
        return (result.item as Project).name
      case 'entry':
        return (result.item as Entry).improvedText || (result.item as Entry).rawText
      case 'task':
        return (result.item as Task).title
    }
  }

  const getResultMeta = (result: { type: 'entry' | 'task' | 'project'; item: Entry | Task | Project }): string => {
    switch (result.type) {
      case 'project': {
        const p = result.item as Project
        return p.description || ''
      }
      case 'entry': {
        const e = result.item as Entry
        const project = availableProjects.find((p) => p.id === e.projectId)
        const typeName = ENTRY_TYPE_LABELS[e.type] || e.type
        return `${typeName} · ${project?.name || ''} · ${formatDate(e.createdAt)}`
      }
      case 'task': {
        const t = result.item as Task
        const project = availableProjects.find((p) => p.id === t.projectId)
        return `${t.status} · ${project?.name || ''} · ${formatDate(t.createdAt)}`
      }
    }
  }

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    } catch {
      return ''
    }
  }

  const totalResults = results.entries.length + results.tasks.length + results.projects.length

  if (!isOpen) return null

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Search Input */}
        <div className="global-search-input-row">
          <span className="global-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder="Buscar entradas, tasks, projetos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button
            className="global-search-filter-btn"
            onClick={() => setShowFilters(!showFilters)}
            title="Filtros"
          >
            ⚙️
          </button>
          <kbd className="global-search-kbd">Esc</kbd>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="global-search-filters">
            <div className="global-search-filter-row">
              <label>Tipo de entrada:</label>
              <select
                value={filters.type || ''}
                onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
              >
                <option value="">Todos</option>
                {Object.entries(ENTRY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="global-search-filter-row">
              <label>Projeto:</label>
              <select
                value={filters.projectId || ''}
                onChange={(e) => setFilters({ ...filters, projectId: e.target.value || undefined })}
              >
                <option value="">Todos</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="global-search-filter-row">
              <label>De:</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
              />
              <label>Até:</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
              />
            </div>
          </div>
        )}

        {/* Type Tabs */}
        <div className="global-search-tabs">
          <button
            className={`global-search-tab ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => { setActiveFilter('all'); setSelectedIndex(0) }}
          >
            Tudo ({totalResults})
          </button>
          <button
            className={`global-search-tab ${activeFilter === 'project' ? 'active' : ''}`}
            onClick={() => { setActiveFilter('project'); setSelectedIndex(0) }}
          >
            Projetos ({results.projects.length})
          </button>
          <button
            className={`global-search-tab ${activeFilter === 'entry' ? 'active' : ''}`}
            onClick={() => { setActiveFilter('entry'); setSelectedIndex(0) }}
          >
            Entradas ({results.entries.length})
          </button>
          <button
            className={`global-search-tab ${activeFilter === 'task' ? 'active' : ''}`}
            onClick={() => { setActiveFilter('task'); setSelectedIndex(0) }}
          >
            Tasks ({results.tasks.length})
          </button>
        </div>

        {/* Results */}
        <div className="global-search-results" ref={resultsRef}>
          {isLoading && (
            <div className="global-search-empty">Buscando...</div>
          )}

          {!isLoading && query && flatResults.length === 0 && (
            <div className="global-search-empty">Nenhum resultado para "{query}"</div>
          )}

          {!isLoading && !query && (
            <div className="global-search-empty">
              <span className="global-search-hint">Digite para buscar em tudo</span>
            </div>
          )}

          {!isLoading && flatResults.map((result, index) => (
            <div
              key={`${result.type}-${(result.item as any).id}`}
              className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleResultClick(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="search-result-icon">{getResultIcon(result.type)}</span>
              <div className="search-result-content">
                <span className="search-result-label">{getResultLabel(result)}</span>
                <span className="search-result-meta">{getResultMeta(result)}</span>
              </div>
              <span className="search-result-type-badge">{result.type === 'entry' ? 'entrada' : result.type === 'task' ? 'task' : 'projeto'}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="global-search-footer">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}
