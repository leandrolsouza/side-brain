import { useEffect, useState } from 'react'
import { ChevronRight, Loader2, Plug, Plus, Power, PowerOff, Trash2 } from 'lucide-react'
import type { MCPServerConfig, MCPServerStatus, MCPToolInfo } from '@shared/types'
import { useTranslation } from 'react-i18next'

/**
 * Shape of a server entry in an imported MCP JSON config
 * (Claude Desktop / Kiro style).
 */
interface MCPImportedServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  disabled?: boolean
}

export function MCPSettings() {
  const { t } = useTranslation('settings')
  const [servers, setServers] = useState<MCPServerConfig[]>([])
  const [statuses, setStatuses] = useState<MCPServerStatus[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showJsonEditor, setShowJsonEditor] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [serverTools, setServerTools] = useState<MCPToolInfo[]>([])
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newArgs, setNewArgs] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [secureStorageAvailable, setSecureStorageAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    loadServers()
    loadStatuses()
    window.electronAPI
      .secureStorageAvailable()
      .then(setSecureStorageAvailable)
      .catch(() => setSecureStorageAvailable(false))
  }, [])

  const loadServers = async () => {
    try {
      const data: MCPServerConfig[] = await window.electronAPI.mcpGetServers()
      setServers(data)
    } catch (error) {
      console.error('Failed to load MCP servers:', error)
    }
  }

  const loadStatuses = async () => {
    try {
      const data: MCPServerStatus[] = await window.electronAPI.mcpGetStatuses()
      setStatuses(data)
    } catch (error) {
      console.error('Failed to load MCP statuses:', error)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim() || !newCommand.trim()) return
    setIsLoading(true)
    setOperationError(null)
    try {
      await window.electronAPI.mcpAddServer({
        name: newName.trim(),
        command: newCommand.trim(),
        args: newArgs.trim() ? newArgs.trim().split(' ') : [],
        enabled: true,
      })
      setNewName('')
      setNewCommand('')
      setNewArgs('')
      setShowAddForm(false)
      await loadServers()
      await loadStatuses()
    } catch (error) {
      setOperationError(t('mcp_storage_error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportJson = async () => {
    setJsonError(null)
    try {
      const parsed = JSON.parse(jsonInput.trim()) as {
        mcpServers?: Record<string, MCPImportedServerConfig>
      } | null

      // Support both formats:
      // 1. { "mcpServers": { "name": { command, args, env } } }  (Claude Desktop / Kiro style)
      // 2. { "name": { command, args, env } }  (direct object)
      const serversObj = parsed?.mcpServers || parsed

      if (!serversObj || typeof serversObj !== 'object' || Array.isArray(serversObj)) {
        setJsonError('JSON inválido. Esperado um objeto com servers configurados.')
        return
      }

      setIsLoading(true)
      let count = 0

      for (const [name, config] of Object.entries(serversObj) as [string, MCPImportedServerConfig][]) {
        if (!config.command) continue

        await window.electronAPI.mcpAddServer({
          name,
          command: config.command,
          args: config.args || [],
          env: config.env,
          enabled: config.disabled !== true,
        })
        count++
      }

      if (count === 0) {
        setJsonError('Nenhum server válido encontrado no JSON.')
        setIsLoading(false)
        return
      }

      setJsonInput('')
      setShowJsonEditor(false)
      await loadServers()
      await loadStatuses()
    } catch {
      setJsonError(t('mcp_storage_error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await window.electronAPI.mcpRemoveServer(id)
      await loadServers()
      await loadStatuses()
    } catch (error) {
      console.error('Failed to remove MCP server:', error)
    }
  }

  const handleConnect = async (id: string) => {
    setOperationError(null)
    try {
      await window.electronAPI.mcpConnect(id)
      await loadStatuses()
    } catch {
      setOperationError(t('mcp_storage_error'))
      await loadStatuses()
    }
  }

  const handleDisconnect = async (id: string) => {
    try {
      await window.electronAPI.mcpDisconnect(id)
      await loadStatuses()
    } catch (error) {
      console.error('Failed to disconnect MCP server:', error)
    }
  }

  const toggleExpand = async (id: string) => {
    if (expandedServer === id) {
      setExpandedServer(null)
      setServerTools([])
      return
    }
    setExpandedServer(id)
    try {
      const tools: MCPToolInfo[] = await window.electronAPI.mcpGetTools()
      setServerTools(tools.filter((t) => t.serverId === id))
    } catch {
      setServerTools([])
    }
  }

  const getStatus = (id: string): MCPServerStatus | undefined => {
    return statuses.find((s) => s.id === id)
  }

  return (
    <div className="agent-studio-panel">
      {operationError && <p role="alert">{operationError}</p>}
      {secureStorageAvailable === false && <p role="alert">{t('secure_storage_unavailable')}</p>}
      <div className="agent-studio-header">
        <div className="agent-studio-title">
          <Plug size={20} />
          <span>MCP Servers</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="agent-btn-secondary"
            onClick={() => {
              setShowJsonEditor(true)
              setShowAddForm(false)
            }}
          >
            <span>{} JSON</span>
          </button>
          <button
            type="button"
            className="agent-btn-primary"
            onClick={() => {
              setShowAddForm(true)
              setShowJsonEditor(false)
            }}
          >
            <Plus size={16} />
            <span>Adicionar</span>
          </button>
        </div>
      </div>

      <p className="agent-subtitle">
        Conecte servidores MCP para dar acesso externo aos seus agentes (GitHub, Jira, banco de dados, APIs, etc).
        Agentes com a skill "Ferramentas MCP" podem usar as tools desses servidores.
      </p>

      {/* Add form */}
      {showAddForm && (
        <div className="mcp-add-form">
          <div className="agent-form-section">
            <label className="agent-form-label">Nome</label>
            <input
              className="agent-form-input"
              placeholder="Ex: GitHub, Postgres, File System..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="agent-form-section">
            <label className="agent-form-label">Comando</label>
            <input
              className="agent-form-input"
              placeholder="Ex: npx, uvx, node, python..."
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
            />
          </div>
          <div className="agent-form-section">
            <label className="agent-form-label">Argumentos (separados por espaço)</label>
            <input
              className="agent-form-input"
              placeholder="Ex: @modelcontextprotocol/server-github ou path/to/server.js"
              value={newArgs}
              onChange={(e) => setNewArgs(e.target.value)}
            />
          </div>
          <div className="mcp-add-actions">
            <button
              type="button"
              className="agent-btn-primary"
              onClick={handleAdd}
              disabled={!newName.trim() || !newCommand.trim() || isLoading}
            >
              {isLoading ? <Loader2 size={14} className="spinning" /> : <Plus size={14} />}
              <span>Adicionar</span>
            </button>
            <button type="button" className="agent-btn-secondary" onClick={() => setShowAddForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* JSON Editor */}
      {showJsonEditor && (
        <div className="mcp-add-form">
          <div className="agent-form-section">
            <label className="agent-form-label">Importar JSON</label>
            <p className="agent-form-hint">
              Cole o JSON de configuração MCP. Suporta o formato do Claude Desktop, Kiro, e similares.
            </p>
            <textarea
              className="agent-form-textarea mcp-json-editor"
              placeholder={`{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["@modelcontextprotocol/server-github"],\n      "env": { "GITHUB_TOKEN": "seu-token" }\n    }\n  }\n}`}
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value)
                setJsonError(null)
              }}
              rows={10}
            />
            {jsonError && <p className="mcp-json-error">{jsonError}</p>}
          </div>
          <div className="mcp-add-actions">
            <button
              type="button"
              className="agent-btn-primary"
              onClick={handleImportJson}
              disabled={!jsonInput.trim() || isLoading}
            >
              {isLoading ? <Loader2 size={14} className="spinning" /> : <Plus size={14} />}
              <span>Importar</span>
            </button>
            <button
              type="button"
              className="agent-btn-secondary"
              onClick={() => {
                setShowJsonEditor(false)
                setJsonError(null)
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Server list */}
      {servers.length === 0 && !showAddForm && !showJsonEditor ? (
        <div className="agent-empty-state">
          <Plug size={48} strokeWidth={1} />
          <h3>Nenhum server MCP configurado</h3>
          <p>Adicione servidores MCP para expandir as capacidades dos seus agentes com ferramentas externas.</p>
          <button type="button" className="agent-btn-primary" onClick={() => setShowAddForm(true)}>
            <Plus size={16} />
            <span>Adicionar Server</span>
          </button>
        </div>
      ) : (
        <div className="mcp-server-list">
          {servers.map((server) => {
            const status = getStatus(server.id)
            return (
              <div key={server.id} className={`mcp-server-card ${expandedServer === server.id ? 'expanded' : ''}`}>
                <div
                  className="mcp-server-main"
                  onClick={() => (status?.status === 'connected' ? toggleExpand(server.id) : null)}
                >
                  <div className="mcp-server-info">
                    <div className="mcp-server-header">
                      <Plug size={16} className={`mcp-status-icon ${status?.status || 'disconnected'}`} />
                      <span className="mcp-server-name">{server.name}</span>
                      <span className={`mcp-status-badge ${status?.status || 'disconnected'}`}>
                        {status?.status === 'connected'
                          ? `Conectado · ${status.toolCount} tools`
                          : status?.status === 'connecting'
                            ? 'Conectando...'
                            : status?.status === 'error'
                              ? 'Erro'
                              : 'Desconectado'}
                      </span>
                      {status?.status === 'connected' && (
                        <ChevronRight
                          size={14}
                          className={`mcp-expand-icon ${expandedServer === server.id ? 'rotated' : ''}`}
                        />
                      )}
                    </div>
                    <div className="mcp-server-command">
                      <code>
                        {server.command} <span>({t('mcp_arguments_protected')})</span>
                      </code>
                    </div>
                  </div>
                  <div className="mcp-server-actions" onClick={(e) => e.stopPropagation()}>
                    {status?.status === 'connected' ? (
                      <button
                        type="button"
                        className="agent-btn-icon"
                        onClick={() => handleDisconnect(server.id)}
                        title="Desconectar"
                      >
                        <PowerOff size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="agent-btn-icon"
                        onClick={() => handleConnect(server.id)}
                        title="Conectar"
                      >
                        <Power size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="agent-btn-icon danger"
                      onClick={() => handleRemove(server.id)}
                      title="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {expandedServer === server.id && serverTools.length > 0 && (
                  <div className="mcp-tools-list">
                    {serverTools.map((tool, idx) => (
                      <div key={idx} className="mcp-tool-item">
                        <span className="mcp-tool-name">{tool.name}</span>
                        <span className="mcp-tool-desc">{tool.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
