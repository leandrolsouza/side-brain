// === MCP (Model Context Protocol) Types ===

/**
 * Configuration for an MCP server managed by the app.
 */
export interface MCPServerConfig {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
  /** Command to run the server */
  command: string
  /** Arguments to pass */
  args: string[]
  /** Environment variables */
  env?: Record<string, string>
  /** Whether this server is enabled */
  enabled: boolean
}

/**
 * Connection status of an MCP server.
 */
export interface MCPServerStatus {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  toolCount: number
  error?: string
}

/**
 * A tool exposed by a connected MCP server.
 */
export interface MCPToolInfo {
  /** Server this tool belongs to */
  serverId: string
  serverName: string
  /** Tool name (as registered in MCP) */
  name: string
  description: string
  /** JSON schema for input parameters */
  inputSchema: unknown
}
