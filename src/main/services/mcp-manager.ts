import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type {
  ToolDefinition,
  ToolCallResult,
  ToolParameterSchema,
  MCPServerConfig,
  MCPServerStatus,
  MCPToolInfo,
} from '../../shared/types'
import type { SettingsRepository } from '../database/repositories/settings-repository'
import { getErrorService } from './error-service'
import { BrowserWindow } from 'electron'
import path from 'node:path'
import { v4 as uuid } from 'uuid'
import fs from 'node:fs'
import { app } from 'electron'
import { createScopedLogger } from './logger'

const logger = createScopedLogger('mcp')

// Re-export shared MCP types for backwards compatibility with existing imports
export type { MCPServerConfig, MCPServerStatus, MCPToolInfo }

/**
 * Minimal structural view of an MCP tool input schema (JSON Schema subset).
 */
interface MCPInputSchema {
  properties?: Record<string, { type?: string; description?: string; enum?: string[] }>
  required?: string[]
}

/**
 * Minimal structural view of MCP tool result content blocks.
 */
interface MCPContentBlock {
  type?: string
  text?: string
}

// === MCP Manager ===

/**
 * Manages MCP server connections and exposes their tools to the agent system.
 * Each server runs as a subprocess connected via stdio transport.
 */
export class MCPManager {
  private clients: Map<string, { client: Client; transport: StdioClientTransport; config: MCPServerConfig }> = new Map()
  private toolCache: Map<string, MCPToolInfo[]> = new Map() // serverId → tools
  private configPath: string

  constructor(private settingsRepo: SettingsRepository) {
    this.configPath = path.join(app.getPath('userData'), 'mcp-servers.json')
  }

  // ─── Configuration ────────────────────────────────────────────

  /**
   * Load MCP server configurations from disk.
   */
  getConfigs(): MCPServerConfig[] {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8')
        return JSON.parse(data) as MCPServerConfig[]
      }
    } catch (error) {
      logger.error('Failed to load MCP configs:', error)
    }
    return []
  }

  /**
   * Save MCP server configurations to disk.
   */
  private saveConfigs(configs: MCPServerConfig[]): void {
    try {
      const dir = path.dirname(this.configPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.configPath, JSON.stringify(configs, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to save MCP configs:', error)
    }
  }

  /**
   * Add a new MCP server configuration.
   */
  addServer(config: Omit<MCPServerConfig, 'id'>): MCPServerConfig {
    const configs = this.getConfigs()
    const newConfig: MCPServerConfig = { ...config, id: uuid() }
    configs.push(newConfig)
    this.saveConfigs(configs)
    return newConfig
  }

  /**
   * Update an existing server configuration.
   */
  updateServer(id: string, updates: Partial<Omit<MCPServerConfig, 'id'>>): MCPServerConfig | null {
    const configs = this.getConfigs()
    const index = configs.findIndex((c) => c.id === id)
    if (index === -1) return null

    configs[index] = { ...configs[index], ...updates }
    this.saveConfigs(configs)
    return configs[index]
  }

  /**
   * Remove a server configuration and disconnect if running.
   */
  async removeServer(id: string): Promise<boolean> {
    await this.disconnectServer(id, false) // Don't persist, we're deleting
    const configs = this.getConfigs()
    const filtered = configs.filter((c) => c.id !== id)
    if (filtered.length === configs.length) return false
    this.saveConfigs(filtered)
    return true
  }

  // ─── Connection Management ────────────────────────────────────

  /**
   * Connect to a specific MCP server.
   */
  async connectServer(id: string): Promise<void> {
    const configs = this.getConfigs()
    const config = configs.find((c) => c.id === id)
    if (!config) throw new Error(`MCP server config "${id}" not found`)

    // Mark as enabled and persist
    if (!config.enabled) {
      this.updateServer(id, { enabled: true })
      config.enabled = true
    }

    // Disconnect if already connected
    if (this.clients.has(id)) {
      await this.disconnectServer(id)
    }

    this.emitStatus(id, config.name, 'connecting')

    try {
      const client = new Client({ name: 'sidebrain', version: '1.0.0' }, { capabilities: {} })

      const env = { ...process.env, ...(config.env || {}) } as Record<string, string>

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env,
      })

      await client.connect(transport)

      this.clients.set(id, { client, transport, config })

      // Discover tools
      await this.discoverTools(id, client)

      const tools = this.toolCache.get(id) || []
      this.emitStatus(id, config.name, 'connected', tools.length)
    } catch (error) {
      const err = error as { message?: string; stack?: string }
      this.toolCache.delete(id)
      this.emitStatus(id, config.name, 'error', 0, err.message)

      getErrorService().logError({
        category: 'ai',
        severity: 'error',
        message: `MCP server "${config.name}" failed to connect: ${err.message}`,
        stack: err.stack,
        context: { serverId: id, command: config.command },
      })

      throw error
    }
  }

  /**
   * Disconnect from a specific MCP server.
   */
  async disconnectServer(id: string, persist = true): Promise<void> {
    const entry = this.clients.get(id)
    if (!entry) return

    try {
      await entry.client.close()
    } catch {
      // Ignore close errors
    }

    this.clients.delete(id)
    this.toolCache.delete(id)

    // Mark as disabled and persist (unless shutting down)
    if (persist) {
      this.updateServer(id, { enabled: false })
    }

    this.emitStatus(id, entry.config.name, 'disconnected')
  }

  /**
   * Connect to all enabled servers on startup.
   */
  async connectAll(): Promise<void> {
    const configs = this.getConfigs()
    const enabled = configs.filter((c) => c.enabled)

    for (const config of enabled) {
      try {
        await this.connectServer(config.id)
      } catch {
        // Non-fatal — log was done inside connectServer
      }
    }
  }

  /**
   * Disconnect all servers (for app shutdown).
   */
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.clients.keys())
    for (const id of ids) {
      await this.disconnectServer(id, false) // Don't persist on shutdown
    }
  }

  // ─── Tool Discovery & Execution ──────────────────────────────

  /**
   * Discover tools from a connected MCP server.
   */
  private async discoverTools(serverId: string, client: Client): Promise<void> {
    const tools: MCPToolInfo[] = []
    const entry = this.clients.get(serverId)
    const serverName = entry?.config.name || serverId

    let cursor: string | undefined
    do {
      const page = await client.listTools(cursor ? { cursor } : {})
      for (const tool of page.tools) {
        tools.push({
          serverId,
          serverName,
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {},
        })
      }
      cursor = page.nextCursor
    } while (cursor)

    this.toolCache.set(serverId, tools)
  }

  /**
   * Get all tools from all connected servers.
   */
  getAllTools(): MCPToolInfo[] {
    const allTools: MCPToolInfo[] = []
    for (const tools of this.toolCache.values()) {
      allTools.push(...tools)
    }
    return allTools
  }

  validateToolArguments(serverId: string, name: string, args: unknown): void {
    const tool = this.getAllTools().find((item) => item.serverId === serverId && item.name === name)
    if (!tool) throw new Error('Ferramenta MCP não encontrada.')
    const schema = tool.inputSchema as Parameters<AjvJsonSchemaValidator['getValidator']>[0]
    if (!schema || typeof schema !== 'object' || schema.type !== 'object') throw new Error('Schema MCP inválido.')
    const result = new AjvJsonSchemaValidator().getValidator(schema)(args)
    if (!result.valid) throw new Error(`Argumentos MCP inválidos: ${result.errorMessage}`)
  }

  /**
   * Get tools as ToolDefinition format (for the agent system).
   */
  getToolDefinitions(): ToolDefinition[] {
    return this.getAllTools().map((tool) => {
      const schema = tool.inputSchema as MCPInputSchema | undefined
      return {
        name: `mcp_${tool.serverId.slice(0, 8)}_${tool.name}`,
        description: `[${tool.serverName}] ${tool.description}`,
        parameters: this.convertInputSchema(schema),
        requiredParams: schema?.required || [],
      }
    })
  }

  /**
   * Call a tool on a connected MCP server.
   */
  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const entry = this.clients.get(serverId)
    if (!entry) {
      return { toolCallId: '', success: false, result: null, error: `Server "${serverId}" not connected` }
    }

    try {
      const result = await entry.client.callTool({ name: toolName, arguments: args })

      if (result.isError) {
        const content = result.content as MCPContentBlock[]
        const errorText = content?.map((c) => c.text || '').join('\n') || 'Unknown error'
        return { toolCallId: '', success: false, result: null, error: errorText }
      }

      // Extract content
      const content = result.content as MCPContentBlock[]
      const textContent = content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')

      return {
        toolCallId: '',
        success: true,
        result: result.structuredContent || textContent || '',
      }
    } catch (error) {
      const err = error as { message?: string }
      return { toolCallId: '', success: false, result: null, error: err.message }
    }
  }

  // ─── Status ───────────────────────────────────────────────────

  /**
   * Get the status of all configured servers.
   */
  getStatuses(): MCPServerStatus[] {
    const configs = this.getConfigs()
    return configs.map((config) => {
      const entry = this.clients.get(config.id)
      const tools = this.toolCache.get(config.id) || []

      return {
        id: config.id,
        name: config.name,
        status: entry ? 'connected' : config.enabled ? 'disconnected' : 'disconnected',
        toolCount: tools.length,
      }
    })
  }

  // ─── Helpers ──────────────────────────────────────────────────

  /**
   * Convert MCP JSON Schema to our ToolParameterSchema format.
   */
  private convertInputSchema(schema: MCPInputSchema | undefined): Record<string, ToolParameterSchema> {
    if (!schema?.properties) return {}

    const result: Record<string, ToolParameterSchema> = {}
    for (const [key, prop] of Object.entries(schema.properties)) {
      result[key] = {
        type: (prop.type || 'string') as ToolParameterSchema['type'],
        description: prop.description || '',
        required: (schema.required || []).includes(key),
        ...(prop.enum ? { enum: prop.enum } : {}),
      }
    }
    return result
  }

  private emitStatus(id: string, name: string, status: MCPServerStatus['status'], toolCount = 0, error?: string): void {
    try {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('mcp:status-changed', { id, name, status, toolCount, error })
        }
      }
    } catch {
      // Non-fatal
    }
  }
}
