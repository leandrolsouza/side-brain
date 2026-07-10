import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { RefreshCw, Info, X, Sparkles, Search, Filter, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Entry, EntryConnection, ConnectionType, CONNECTION_TYPE_LABELS, Project, CustomEntryType } from '../../shared/types'

interface GraphNode {
  id: string
  label: string
  type: string
  projectId: string
  projectName?: string
  createdAt: string
  fullText: string
  color?: string
  degree: number
}

interface GraphLink {
  source: string
  target: string
  connectionType: ConnectionType
  id: string
  description?: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface GraphFilters {
  projectId?: string
  dateFrom?: string
  minConnections?: number
  connectionType?: string
}

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  related: '#569cd6',
  follows_up: '#4ec9b0',
  contradicts: '#f44747',
  depends_on: '#dcdcaa',
  evolves: '#c586c0',
}

// Maps custom field badge color classes to hex for canvas rendering
const BADGE_COLOR_TO_HEX: Record<string, string> = {
  info: '#007acc',
  warning: '#cca700',
  success: '#73c991',
  error: '#f44747',
  neutral: '#888888',
}

function getNodeColor(colorClass: string): string {
  return BADGE_COLOR_TO_HEX[colorClass] || '#888888'
}

type ColorMode = 'type' | 'project'

// Distinct color palette for projects (up to 12, then cycles)
const PROJECT_PALETTE = [
  '#4ec9b0', '#569cd6', '#ce9178', '#c586c0', '#dcdcaa',
  '#d7ba7d', '#9cdcfe', '#b5cea8', '#f44747', '#608b4e',
  '#d16969', '#6a9955',
]

function getProjectColor(index: number): string {
  return PROJECT_PALETTE[index % PROJECT_PALETTE.length]
}

const PERIOD_OPTIONS = [
  { value: '', label: 'Todo o período' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
]

export function ConnectionGraph() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryResult, setDiscoveryResult] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [showFilters, setShowFilters] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [entryTypes, setEntryTypes] = useState<CustomEntryType[]>([])
  const [colorMode, setColorMode] = useState<ColorMode>('type')

  // Maps: key -> label, key -> hex color
  const typeLabels = useMemo(() =>
    Object.fromEntries(entryTypes.map(t => [t.key, t.label])),
    [entryTypes]
  )
  const typeColors = useMemo(() =>
    Object.fromEntries(entryTypes.map(t => [t.key, getNodeColor(t.color)])),
    [entryTypes]
  )

  // Project color map: projectId -> hex color
  const projectColors = useMemo(() =>
    Object.fromEntries(projects.map((p, i) => [p.id, getProjectColor(i)])),
    [projects]
  )
  // Filters
  const [filterProjectId, setFilterProjectId] = useState<string>('')
  const [filterPeriod, setFilterPeriod] = useState<string>('')
  const [filterMinConnections, setFilterMinConnections] = useState<number>(1)
  const [filterConnectionType, setFilterConnectionType] = useState<string>('')

  // Search-to-focus
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set())
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)

  useEffect(() => {
    loadProjects()
    loadEntryTypes()
  }, [])

  // Load graph data after entryTypes are available (for coloring)
  useEffect(() => {
    if (entryTypes.length > 0) {
      loadGraphData()
    }
  }, [entryTypes, colorMode])

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height - 48 })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Search-to-focus logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setHighlightNodes(new Set())
      setHighlightLinks(new Set())
      return
    }

    const query = searchQuery.toLowerCase()
    const matchedNodeIds = new Set<string>()
    const matchedLinkIds = new Set<string>()

    for (const node of graphData.nodes) {
      if (node.fullText.toLowerCase().includes(query) || node.label.toLowerCase().includes(query)) {
        matchedNodeIds.add(node.id)
      }
    }

    // Also highlight neighbors and their links
    for (const link of graphData.links) {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target

      if (matchedNodeIds.has(sourceId) || matchedNodeIds.has(targetId)) {
        matchedLinkIds.add(link.id)
        matchedNodeIds.add(sourceId)
        matchedNodeIds.add(targetId)
      }
    }

    setHighlightNodes(matchedNodeIds)
    setHighlightLinks(matchedLinkIds)

    // Center on first match
    if (matchedNodeIds.size > 0 && graphRef.current) {
      const firstMatchId = Array.from(matchedNodeIds)[0]
      const node = graphData.nodes.find(n => n.id === firstMatchId)
      if (node && (node as any).x !== undefined) {
        graphRef.current.centerAt((node as any).x, (node as any).y, 400)
        graphRef.current.zoom(2, 400)
      }
    }
  }, [searchQuery, graphData])

  const loadProjects = async () => {
    const data = await window.electronAPI.getProjects()
    setProjects(data)
  }

  const loadEntryTypes = async () => {
    const data = await window.electronAPI.getEntryTypes()
    setEntryTypes(data)
  }

  const buildFilters = (): GraphFilters | undefined => {
    const filters: GraphFilters = {}
    let hasFilter = false

    if (filterProjectId) {
      filters.projectId = filterProjectId
      hasFilter = true
    }
    if (filterPeriod) {
      const days = parseInt(filterPeriod)
      const date = new Date()
      date.setDate(date.getDate() - days)
      filters.dateFrom = date.toISOString()
      hasFilter = true
    }
    if (filterMinConnections > 1) {
      filters.minConnections = filterMinConnections
      hasFilter = true
    }
    if (filterConnectionType) {
      filters.connectionType = filterConnectionType
      hasFilter = true
    }

    return hasFilter ? filters : undefined
  }

  const loadGraphData = async () => {
    setIsLoading(true)
    try {
      const filters = buildFilters()
      const data = await window.electronAPI.getConnectionGraphData(filters)

      // Calculate degree (number of connections per node)
      const degreeMap = new Map<string, number>()
      for (const conn of data.connections) {
        degreeMap.set(conn.sourceEntryId, (degreeMap.get(conn.sourceEntryId) || 0) + 1)
        degreeMap.set(conn.targetEntryId, (degreeMap.get(conn.targetEntryId) || 0) + 1)
      }

      // Map project names
      const projectMap = new Map(projects.map(p => [p.id, p.name]))

      const nodes: GraphNode[] = data.entries.map((entry: Entry) => ({
        id: entry.id,
        label: entry.improvedText.length > 40
          ? entry.improvedText.slice(0, 40) + '...'
          : entry.improvedText,
        type: entry.type,
        projectId: entry.projectId,
        projectName: projectMap.get(entry.projectId) || '',
        createdAt: entry.createdAt,
        fullText: entry.improvedText,
        color: colorMode === 'project'
          ? (projectColors[entry.projectId] || '#888888')
          : (typeColors[entry.type] || '#888888'),
        degree: degreeMap.get(entry.id) || 0,
      }))

      const links: GraphLink[] = data.connections.map((conn: EntryConnection) => ({
        source: conn.sourceEntryId,
        target: conn.targetEntryId,
        connectionType: conn.connectionType,
        id: conn.id,
        description: conn.description,
      }))

      setGraphData({ nodes, links })
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyFilters = () => {
    loadGraphData()
  }

  const handleClearFilters = () => {
    setFilterProjectId('')
    setFilterPeriod('')
    setFilterMinConnections(1)
    setFilterConnectionType('')
    // Reload after state update
    setTimeout(() => loadGraphData(), 0)
  }

  const handleDiscover = async () => {
    setIsDiscovering(true)
    setDiscoveryResult(null)
    try {
      const result = await window.electronAPI.discoverConnections(filterProjectId || undefined)
      if (result.created > 0) {
        setDiscoveryResult(`${result.created} conexão(ões) descoberta(s) pela IA!`)
        await loadGraphData()
      } else {
        setDiscoveryResult('Nenhuma nova conexão encontrada.')
      }
      setTimeout(() => setDiscoveryResult(null), 5000)
    } catch (err: any) {
      setDiscoveryResult('Erro ao descobrir conexões: ' + (err.message || 'erro desconhecido'))
      setTimeout(() => setDiscoveryResult(null), 5000)
    } finally {
      setIsDiscovering(false)
    }
  }

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as GraphNode)
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 400)
      graphRef.current.zoom(2.5, 400)
    }
  }, [])

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label as string
    const fontSize = Math.max(10 / globalScale, 3)
    const degree = node.degree || 1
    // Node size scales with degree (min 4, max 16)
    const nodeRadius = Math.min(4 + degree * 2, 16)

    const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id)
    const opacity = isHighlighted ? 1 : 0.15

    // Draw node circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI)
    ctx.globalAlpha = opacity
    ctx.fillStyle = node.color || '#cccccc'
    ctx.fill()

    // Draw border for selected node
    if (selectedNode && selectedNode.id === node.id) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2 / globalScale
      ctx.stroke()
    }

    // Draw label if zoomed enough and node is highlighted
    if (globalScale > 0.8 && isHighlighted) {
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#cccccc'
      ctx.globalAlpha = opacity
      ctx.fillText(label, node.x, node.y + nodeRadius + 2)
    }

    ctx.globalAlpha = 1
  }, [selectedNode, highlightNodes])

  const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const degree = node.degree || 1
    const nodeRadius = Math.min(4 + degree * 2, 16)
    ctx.beginPath()
    ctx.arc(node.x, node.y, nodeRadius + 4, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [])

  const linkColor = useCallback((link: any) => {
    const baseColor = CONNECTION_COLORS[link.connectionType as ConnectionType] || '#569cd6'
    if (highlightLinks.size === 0) return baseColor
    if (highlightLinks.has(link.id)) return baseColor
    return 'rgba(86, 156, 214, 0.08)'
  }, [highlightLinks])

  const linkWidth = useCallback((link: any) => {
    if (highlightLinks.size > 0 && highlightLinks.has(link.id)) return 2.5
    return 1
  }, [highlightLinks])

  const linkLabel = useCallback((link: any) => {
    const typeLabel = CONNECTION_TYPE_LABELS[link.connectionType as ConnectionType] || link.connectionType
    return link.description ? `${typeLabel}: ${link.description}` : typeLabel
  }, [])

  // Legend data
  const legend = useMemo(() => ({
    nodeTypes: colorMode === 'type'
      ? entryTypes.map(t => ({ key: t.key, label: t.label, color: getNodeColor(t.color) }))
      : projects.map((p, i) => ({ key: p.id, label: p.name, color: getProjectColor(i) })),
    linkTypes: Object.entries(CONNECTION_COLORS).map(([key, color]) => ({
      key: key as ConnectionType,
      color,
      label: CONNECTION_TYPE_LABELS[key as ConnectionType],
    })),
  }), [entryTypes, projects, colorMode])

  // Stats
  const stats = useMemo(() => ({
    nodes: graphData.nodes.length,
    links: graphData.links.length,
    avgDegree: graphData.nodes.length > 0
      ? (graphData.links.length * 2 / graphData.nodes.length).toFixed(1)
      : '0',
  }), [graphData])

  const hasActiveFilters = filterProjectId || filterPeriod || filterMinConnections > 1 || filterConnectionType

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="panel-header">
        <div className="flex-row">
          <span className="panel-title">Mapa de Conexões</span>
          {stats.nodes > 0 && (
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
              {stats.nodes} nós · {stats.links} conexões · grau médio {stats.avgDegree}
            </span>
          )}
        </div>
        <div className="flex-row">
          <button
            className={`vscode-button secondary ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filtros"
          >
            <Filter size={14} />
            {hasActiveFilters && <span className="filter-badge" />}
          </button>
          <button
            className="vscode-button"
            onClick={handleDiscover}
            disabled={isDiscovering || isLoading}
            title="Usar IA para descobrir conexões entre entradas existentes"
          >
            <Sparkles size={14} className={isDiscovering ? 'spin' : ''} />
            {isDiscovering ? 'Analisando...' : 'Descobrir'}
          </button>
          <button
            className="vscode-button secondary"
            onClick={loadGraphData}
            disabled={isLoading}
            title="Atualizar grafo"
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="graph-filter-bar">
          <div className="graph-filter-row">
            <div className="graph-filter-item">
              <label>Projeto</label>
              <select
                className="vscode-select"
                value={filterProjectId}
                onChange={(e) => setFilterProjectId(e.target.value)}
              >
                <option value="">Todos</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="graph-filter-item">
              <label>Período</label>
              <select
                className="vscode-select"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
              >
                {PERIOD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="graph-filter-item">
              <label>Tipo de conexão</label>
              <select
                className="vscode-select"
                value={filterConnectionType}
                onChange={(e) => setFilterConnectionType(e.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(CONNECTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="graph-filter-item">
              <label>Mín. conexões</label>
              <input
                type="number"
                className="vscode-input"
                value={filterMinConnections}
                onChange={(e) => setFilterMinConnections(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={20}
                style={{ width: 60 }}
              />
            </div>

            <div className="graph-filter-actions">
              <button className="vscode-button" onClick={handleApplyFilters}>Aplicar</button>
              {hasActiveFilters && (
                <button className="vscode-button secondary" onClick={handleClearFilters}>Limpar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discovery result toast */}
      {discoveryResult && (
        <div style={{
          padding: '8px 12px',
          fontSize: 12,
          background: 'var(--vscode-inputValidation-infoBackground, #063b49)',
          border: '1px solid var(--vscode-inputValidation-infoBorder, #007acc)',
          borderRadius: 4,
          margin: '0 8px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{discoveryResult}</span>
          <button className="icon-button" onClick={() => setDiscoveryResult(null)} style={{ marginLeft: 8 }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Graph area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {graphData.nodes.length === 0 && !isLoading ? (
          <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <Info size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <span className="empty-state-text">
                {hasActiveFilters
                  ? 'Nenhuma conexão encontrada com esses filtros.'
                  : 'Nenhuma conexão criada ainda.'}
              </span>
              <p style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginTop: 4 }}>
                {hasActiveFilters
                  ? 'Tente ajustar os filtros ou limpar para ver todas as conexões.'
                  : 'Conecte entradas na lista de entradas de um projeto ou use "Descobrir" para a IA encontrar conexões.'}
              </p>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            nodeLabel={(node: any) => {
              const typeName = typeLabels[node.type] || node.type
              const project = node.projectName || ''
              const date = new Date(node.createdAt).toLocaleDateString('pt-BR')
              return `<div style="max-width:300px;font-size:12px;line-height:1.4;padding:6px 8px;background:#252526;border:1px solid #474747;border-radius:4px;color:#cccccc;box-shadow:0 2px 8px rgba(0,0,0,0.5)">
                <div style="font-weight:500;margin-bottom:4px">${node.fullText}</div>
                <div style="font-size:10px;color:#969696">${typeName} · ${project} · ${date} · ${node.degree} conexão(ões)</div>
              </div>`
            }}
            onNodeClick={handleNodeClick}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkLabel={linkLabel}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.004}
            backgroundColor="#1e1e1e"
            cooldownTicks={80}
            warmupTicks={30}
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.3}
            nodeRelSize={6}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        )}

        {/* Search overlay */}
        <div className="graph-search-overlay">
          <Search size={13} style={{ opacity: 0.5 }} />
          <input
            type="text"
            className="graph-search-input"
            placeholder="Buscar no grafo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="icon-button" onClick={() => setSearchQuery('')} style={{ padding: 2 }}>
              <X size={12} />
            </button>
          )}
          {searchQuery && highlightNodes.size > 0 && (
            <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', whiteSpace: 'nowrap' }}>
              {highlightNodes.size} encontrado(s)
            </span>
          )}
        </div>

        {/* Color mode toggle */}
        <div className="graph-color-toggle">
          <button
            className={`graph-toggle-btn ${colorMode === 'type' ? 'active' : ''}`}
            onClick={() => setColorMode('type')}
            title="Colorir por tipo de entrada"
          >
            Tipo
          </button>
          <button
            className={`graph-toggle-btn ${colorMode === 'project' ? 'active' : ''}`}
            onClick={() => setColorMode('project')}
            title="Colorir por projeto"
          >
            Projeto
          </button>
        </div>

        {/* Zoom controls */}
        <div className="graph-zoom-controls">
          <button
            className="graph-zoom-btn"
            onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 300)}
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            className="graph-zoom-btn"
            onClick={() => graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 300)}
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            className="graph-zoom-btn"
            onClick={() => graphRef.current?.zoomToFit(400, 40)}
            title="Ajustar à tela"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Legend */}
        {graphData.nodes.length > 0 && (
          <div className="graph-legend">
            <div className="graph-legend-section">
              <span className="graph-legend-title">
                {colorMode === 'type' ? 'Tipos de entrada' : 'Projetos'}
              </span>
              {legend.nodeTypes.map(({ key, label, color }) => (
                <div key={key} className="graph-legend-item">
                  <span className="graph-legend-dot" style={{ backgroundColor: color }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="graph-legend-section">
              <span className="graph-legend-title">Tipos de conexão</span>
              {legend.linkTypes.map(({ key, color, label }) => (
                <div key={key} className="graph-legend-item">
                  <span className="graph-legend-line" style={{ backgroundColor: color }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="graph-legend-section">
              <span className="graph-legend-title">Tamanho do nó</span>
              <div className="graph-legend-item">
                <span style={{ fontSize: 10 }}>Proporcional ao nº de conexões</span>
              </div>
            </div>
          </div>
        )}

        {/* Node detail panel */}
        {selectedNode && (
          <div className="graph-detail-panel">
            <div className="graph-detail-header">
              <span style={{ fontWeight: 500 }}>Detalhes da Entrada</span>
              <button className="icon-button" onClick={() => setSelectedNode(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="graph-detail-body">
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className={`vscode-badge ${selectedNode.type}`} style={{ fontSize: 10 }}>
                  {typeLabels[selectedNode.type] || selectedNode.type}
                </span>
                {selectedNode.projectName && (
                  <span style={{ fontSize: 10, color: 'var(--vscode-activityBarBadge-background)' }}>
                    {selectedNode.projectName}
                  </span>
                )}
                <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)' }}>
                  {new Date(selectedNode.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.4 }}>
                {selectedNode.fullText}
              </p>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                {selectedNode.degree} conexão(ões)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
