import { ipcMain } from 'electron'
import { getErrorService } from '../services/error-service'
import type { ErrorCategory } from '../../shared/types'

/**
 * Wrapper que captura erros de qualquer IPC handler e loga na Central de Erros.
 * Determina a categoria com base no channel name.
 */
export function safeHandle<TArgs extends unknown[]>(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: TArgs) => Promise<unknown>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...(args as TArgs))
    } catch (error) {
      const err = error as { message?: string; stack?: string } | null | undefined
      const category = inferCategory(channel)
      // Avoid double-logging AI errors that were already logged at the service level
      // (e.g. HTTP 429/500 errors from Bedrock that are logged inside invokeConverse)
      const isAlreadyLogged =
        category === 'ai' && err?.message?.includes('API error') && !channel.startsWith('meeting:')
      if (!isAlreadyLogged) {
        getErrorService().logError({
          category,
          severity: 'error',
          message: err?.message || `Erro no handler ${channel}`,
          stack: err?.stack,
          context: { channel, args: sanitizeArgs(args) },
        })
      }
      throw error
    }
  })
}

export function inferCategory(channel: string): ErrorCategory {
  if (
    channel.startsWith('ai:') ||
    channel.startsWith('digest:') ||
    channel.startsWith('smart-chat:') ||
    channel.startsWith('insights:')
  )
    return 'ai'
  if (channel === 'meeting:process' || channel === 'meeting:prepare') return 'ai'
  if (channel.startsWith('agent:run') || channel.startsWith('agent:')) return 'ai'
  if (
    channel.startsWith('entry:') ||
    channel.startsWith('project:') ||
    channel.startsWith('task:') ||
    channel.startsWith('search:') ||
    channel.startsWith('connection:')
  )
    return 'database'
  if (channel.startsWith('meeting:')) return 'database'
  if (channel.startsWith('backup:') || channel.startsWith('database:') || channel.startsWith('workspace:'))
    return 'database'
  if (channel.startsWith('notification:') || channel.startsWith('ai-usage:')) return 'database'
  return 'ipc'
}

function sanitizeArgs(args: unknown[]): string {
  try {
    const sanitized = args.map((arg) => {
      if (typeof arg === 'string' && arg.length > 200) return `${arg.slice(0, 200)}...`
      if (typeof arg === 'object' && arg !== null) {
        const str = JSON.stringify(arg)
        return str.length > 300 ? `${str.slice(0, 300)}...` : str
      }
      return arg
    })
    return JSON.stringify(sanitized).slice(0, 500)
  } catch {
    return '[não serializável]'
  }
}
