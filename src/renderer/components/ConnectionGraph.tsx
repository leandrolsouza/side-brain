import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { RefreshCw, Info, X, Sparkles } from 'lucide-react'
import { Entry, EntryConnection, ConnectionType, CONNECTION_TYPE_LABELS } from '../../shared/types'

interface GraphNode {
  id: string
  label: string
  type: string
  projectId: string
  createdAt: string
  fullText: string
  color?: string
}

interface GraphLink {
  source: string
  target: string
  connectionType: ConnectionType
  id: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  related: '#569cd6',
  follows_up: '#4ec9b0',
  contradicts: '#f44747',
  depends_on: '#dcdcaa',
  evolves: '#c586c0',
}

const TYPE_COLORS: Record<string, string> = {
  information: '#569cd6',
  decision: '#dcdcaa',
  request: '#ce9178',
  idea: '#c586c0',
  blocker: '#f44747',
  update: '#4ec9b0',
}

export function ConnectionGraph() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryResult, setDiscoveryResult] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)

  useEffect(() => {
    loadGraphData()
  }, [])

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height - 48 }) // subtract header
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const loadGraphData = async () => {
    setIsLoading(true)
    try {
      const data = await window.electronAPI.getConnectionGraphData()

      const nodes: GraphNode[] = data.entries.map((entry: Entry) => ({
        id: entry.id,
        label: entry.improvedText.length > 40
          ? entry.improvedText.slice(0, 40) + '...'
          : entry.improvedText,
        type: entry.type,
        projectId: entry.projectId,
        createdAt: entry.createdAt,
        fullText: entry.improvedText,
        color: TYPE_COLORS[entry.type] || '#cccccc',
      }))

      const links: GraphLink[] = data.connections.map((conn: EntryConnection) => ({
        source: conn.sourceEntryId,
        target: conn.targetEntryId,
        connectionType: conn.connectionType,
        id: conn.id,
      }))

      setGraphData({ nodes, links })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDiscover = async () => {
    setIsDiscovering(true)
    setDiscoveryResult(null)
    try {
      const result = await window.electronAPI.discoverConnections()
      if (result.created > 0) {
        setDiscoveryResult(`${result.created} conexão(ões) descoberta(s) pela IA!`)
        await loadGraphData()
      } else {
        setDiscoveryResult('Nenhuma nova conexão encontrada.')
      }
      // Auto-hide message after 5s
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
    // Center view on clicked node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 400)
      graphRef.current.zoom(2.5, 400)
    }
  }, [])

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label as string
    const fontSize = Math.max(10 / globalScale, 3)
    const nodeRadius = 6

    // Draw node circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI)
    ctx.fillStyle = node.color || '#cccccc'
    ctx.fill()

    // Draw border for selected node
    if (selectedNode && selectedNode.id === node.id) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2 / globalScale
      ctx.stroke()
    }

    // Draw label if zoomed enough
    if (globalScale > 0.8) {
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#cccccc'
      ctx.fillText(label, node.x, node.y + nodeRadius + 2)
    }
  }, [selectedNode])

  const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const nodeRadius = 6
    ctx.beginPath()
    ctx.arc(node.x, node.y, nodeRadius + 4, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [])

  const linkColor = useCallback((link: any) => {
    return CONNECTION_COLORS[link.connectionType as ConnectionType] || '#569cd6'
  }, [])

  const linkLabel = useCallback((link: any) => {
    return CONNECTION_TYPE_LABELS[link.connectionType as ConnectionType] || link.connectionType
  }, [])

  // Legend data
  const legend = useMemo(() => ({
    nodeTypes: Object.entries(TYPE_COLORS).map(([key, color]) => ({ key, color })),
    linkTypes: Object.entries(CONNECTION_COLORS).map(([key, color]) => ({
      key: key as ConnectionType,
      color,
      label: CONNECTION_TYPE_LABELS[key as ConnectionType],
    })),
  }), [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">Mapa de Conexões</span>
        <div className="flex-row">
          <button
            className="vscode-button"
            onClick={handleDiscover}
            disabled={isDiscovering || isLoading}
            title="Usar IA para descobrir conexões entre entradas existentes"
          >
            <Sparkles size={14} className={isDiscovering ? 'spin' : ''} />
            {isDiscovering ? 'Analisando...' : 'Descobrir Conexões'}
          </button>
          <button
            className="vscode-button secondary"
            onClick={loadGraphData}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

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
                Nenhuma conexão criada ainda.
              </span>
              <p style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginTop: 4 }}>
                Conecte entradas na lista de entradas de um projeto para visualizar o grafo.
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
            onNodeClick={handleNodeClick}
            linkColor={linkColor}
            linkLabel={linkLabel}
            linkWidth={1.5}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.005}
            backgroundColor="var(--vscode-editor-background)"
            cooldownTicks={100}
            nodeRelSize={6}
          />
        )}

        {/* Legend */}
        {graphData.nodes.length > 0 && (
          <div className="graph-legend">
            <div className="graph-legend-section">
              <span className="graph-legend-title">Tipos de entrada</span>
              {legend.nodeTypes.map(({ key, color }) => (
                <div key={key} className="graph-legend-item">
                  <span className="graph-legend-dot" style={{ backgroundColor: color }} />
                  <span>{key}</span>
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
              <div style={{ marginBottom: 8 }}>
                <span className={`vscode-badge ${selectedNode.type}`} style={{ fontSize: 10 }}>
                  {selectedNode.type}
                </span>
                <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', marginLeft: 8 }}>
                  {new Date(selectedNode.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.4 }}>
                {selectedNode.fullText}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
