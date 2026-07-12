import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerMCPHandlers(): void {
  const { mcpManager } = getContainer()

  // ─── Server Configuration ─────────────────────────────────────

  safeHandle('mcp:getServers', async () => {
    return mcpManager.getConfigs()
  })

  safeHandle('mcp:addServer', async (_event, data: { name: string; command: string; args: string[]; env?: Record<string, string>; enabled: boolean }) => {
    return mcpManager.addServer(data)
  })

  safeHandle('mcp:updateServer', async (_event, id: string, updates: any) => {
    return mcpManager.updateServer(id, updates)
  })

  safeHandle('mcp:removeServer', async (_event, id: string) => {
    return mcpManager.removeServer(id)
  })

  // ─── Connection Management ────────────────────────────────────

  safeHandle('mcp:connect', async (_event, id: string) => {
    await mcpManager.connectServer(id)
    return { success: true }
  })

  safeHandle('mcp:disconnect', async (_event, id: string) => {
    await mcpManager.disconnectServer(id)
    return { success: true }
  })

  safeHandle('mcp:connectAll', async () => {
    await mcpManager.connectAll()
    return { success: true }
  })

  // ─── Status & Tools ───────────────────────────────────────────

  safeHandle('mcp:getStatuses', async () => {
    return mcpManager.getStatuses()
  })

  safeHandle('mcp:getTools', async () => {
    return mcpManager.getAllTools()
  })
}
