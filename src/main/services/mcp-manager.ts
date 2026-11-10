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
import { decryptValue, encryptValue, isSafeStorageAvailable } from './safe-storage-service'

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
  private secretsDir: string

  constructor(private settingsRepo: SettingsRepository) {
    this.configPath = path.join(app.getPath('userData'), 'mcp-servers.json')
    this.secretsDir = path.join(app.getPath('userData'), 'mcp-secrets')
  }

  // ─── Configuration ────────────────────────────────────────────

  /**
   * Load MCP server configurations from disk.
   */
  getConfigs(): MCPServerConfig[] {
    const configs = this.readConfigs()
    if (
      isSafeStorageAvailable() &&
      configs.some((config) => config.args?.length || (config.env && Object.keys(config.env).length))
    ) {
      try {
        for (const config of configs) {
          if (config.args?.length || (config.env && Object.keys(config.env).length)) {
            this.saveServerSecrets(config.id, { args: config.args || [], env: config.env || {} })
          }
        }
        this.saveConfigs(configs)
      } catch {
        // Leave the original configuration untouched so the user can retry.
        logger.warn('Unable to migrate legacy MCP credentials to secure storage.')
      }
    }
    return configs.map(({ env: _env, ...config }) => ({ ...config, args: [] }))
  }

  private readConfigs(): MCPServerConfig[] {
    if (!fs.existsSync(this.configPath)) return []
    let value: unknown
    try {
      value = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
    } catch {
      throw new Error('Invalid MCP configuration.')
    }
    if (!Array.isArray(value)) throw new Error('Invalid MCP configuration.')
    return value as MCPServerConfig[]
  }

  private secretPath(id: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid MCP server ID.')
    return path.join(this.secretsDir, `${id}.secret`)
  }

  private writeAtomic(filePath: string, data: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    const temporary = `${filePath}.${uuid()}.tmp`
    try {
      fs.writeFileSync(temporary, data, { encoding: 'utf-8', mode: 0o600, flag: 'wx' })
      fs.renameSync(temporary, filePath)
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    }
  }

  private saveServerSecrets(id: string, secrets: { args: string[]; env: Record<string, string> }): void {
    if (
      !Array.isArray(secrets.args) ||
      secrets.args.some((value) => typeof value !== 'string') ||
      !secrets.env ||
      typeof secrets.env !== 'object' ||
      Array.isArray(secrets.env) ||
      Object.values(secrets.env).some((value) => typeof value !== 'string')
    )
      throw new Error('Invalid MCP configuration.')
    const encrypted = encryptValue(JSON.stringify(secrets))
    this.writeAtomic(this.secretPath(id), encrypted)
  }

  private getServerSecrets(id: string): { args: string[]; env: Record<string, string> } {
    const legacy = this.readConfigs().find((config) => config.id === id)
    if (legacy && (legacy.args?.length || (legacy.env && Object.keys(legacy.env).length))) {
      throw new Error('Legacy MCP credentials could not be moved to secure storage.')
    }
    const secretPath = this.secretPath(id)
    if (fs.existsSync(secretPath)) {
      if (!isSafeStorageAvailable()) throw new Error('Secure storage is unavailable.')
      try {
        const encrypted = fs.readFileSync(secretPath, 'utf-8')
        if (!encrypted.startsWith('enc::')) throw new Error()
        const result = JSON.parse(decryptValue(encrypted)) as {
          args: string[]
          env: Record<string, string>
        }
        if (!Array.isArray(result.args) || !result.env || typeof result.env !== 'object') throw new Error()
        return result
      } catch {
        throw new Error('Unable to access MCP credentials.')
      }
    }
    return { args: [], env: {} }
  }

  private ensureMigrated(): void {
    if (this.readConfigs().some((config) => config.args?.length || (config.env && Object.keys(config.env).length))) {
      throw new Error('Secure storage is unavailable; existing MCP credentials were not changed.')
    }
  }

  /**
   * Save MCP server configurations to disk.
   */
  private saveConfigs(configs: MCPServerConfig[]): void {
    this.writeAtomic(
      this.configPath,
      JSON.stringify(
        configs.map(({ env: _env, ...config }) => ({ ...config, args: [] })),
        null,
        2
      )
    )
  }

  /**
   * Add a new MCP server configuration.
   */
  addServer(config: Omit<MCPServerConfig, 'id'>): MCPServerConfig {
    const configs = this.getConfigs()
    this.ensureMigrated()
    const newConfig: MCPServerConfig = { ...config, id: uuid() }
    if (config.args?.length || (config.env && Object.keys(config.env).length)) {
      this.saveServerSecrets(newConfig.id, { args: config.args || [], env: config.env || {} })
    }
    configs.push(newConfig)
    this.saveConfigs(configs)
    const { env: _env, ...safeConfig } = newConfig
    return { ...safeConfig, args: [] }
  }

  /**
   * Update an existing server configuration.
   */
  updateServer(id: string, updates: Partial<Omit<MCPServerConfig, 'id'>>): MCPServerConfig | null {
    const configs = this.getConfigs()
    this.ensureMigrated()
    const index = configs.findIndex((c) => c.id === id)
    if (index === -1) return null

    if (updates.env !== undefined || updates.args !== undefined) {
      const current = this.getServerSecrets(id)
      this.saveServerSecrets(id, { env: updates.env ?? current.env, args: updates.args ?? current.args })
    }
    configs[index] = { ...configs[index], ...updates, args: [], env: undefined }
    this.saveConfigs(configs)
    return configs[index]
  }

  /**
   * Remove a server configuration and disconnect if running.
   */
  async removeServer(id: string): Promise<boolean> {
    const configs = this.getConfigs()
    this.ensureMigrated()
    await this.disconnectServer(id, false) // Don't persist, we're deleting
    const filtered = configs.filter((c) => c.id !== id)
    if (filtered.length === configs.length) return false
    this.saveConfigs(filtered)
    const secretPath = this.secretPath(id)
    if (fs.existsSync(secretPath)) fs.unlinkSync(secretPath)
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
      await this.disconnectServer(id, false)
    }

    this.emitStatus(id, config.name, 'connecting')

    try {
      const client = new Client({ name: 'sidebrain', version: '1.0.0' }, { capabilities: {} })

      const secrets = this.getServerSecrets(id)
      const env = { ...process.env, ...secrets.env } as Record<string, string>

      const transport = new StdioClientTransport({
        command: config.command,
        args: secrets.args,
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
        message: 'MCP server failed to connect',
        context: { serverId: id },
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
