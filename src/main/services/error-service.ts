import { BrowserWindow } from 'electron'
import { ErrorLogRepository } from '../database/repositories/error-log-repository'
import type { ErrorCategory, ErrorSeverity, ErrorLog } from '../../shared/types'
import { redactLogText } from './log-privacy'

let errorServiceInstance: ErrorService | null = null

export function getErrorService(): ErrorService {
  if (!errorServiceInstance) {
    errorServiceInstance = new ErrorService()
  }
  return errorServiceInstance
}

export class ErrorService {
  private repo: ErrorLogRepository

  constructor() {
    this.repo = new ErrorLogRepository()
  }

  /**
   * Registra um erro no sistema. Chamado por outros services quando algo dá errado.
   */
  logError(data: {
    category: ErrorCategory
    severity?: ErrorSeverity
    message: string
    stack?: string
    context?: Record<string, any>
  }): ErrorLog {
    const errorLog = this.repo.create({
      category: data.category,
      severity: data.severity || 'error',
      message: redactLogText(data.message),
      context: data.context ? JSON.stringify(sanitizeContext(data.context)) : undefined,
    })

    // Notifica o renderer sobre novo erro (para atualizar badge)
    this.notifyRenderer()

    return errorLog
  }

  /**
   * Captura erros não tratados do processo principal.
   * Deve ser chamado uma vez na inicialização do app.
   */
  setupGlobalHandlers(): void {
    process.on('uncaughtException', (error) => {
      this.logError({
        category: 'system',
        severity: 'critical',
        message: 'Unhandled exception',
        context: { type: 'uncaughtException' },
      })
    })

    process.on('unhandledRejection', (reason) => {
      this.logError({
        category: 'system',
        severity: 'error',
        message: 'Unhandled promise rejection',
        context: { type: 'unhandledRejection' },
      })
    })
  }

  /**
   * Limpa logs antigos (resolvidos com mais de 30 dias). Chamar periodicamente.
   */
  cleanOldLogs(): number {
    return this.repo.cleanOld(30)
  }

  getAll(filters?: { category?: ErrorCategory; severity?: ErrorSeverity; resolved?: boolean }): ErrorLog[] {
    return this.repo.getAll(filters)
  }

  getUnresolvedCount(): number {
    return this.repo.getUnresolvedCount()
  }

  resolve(id: string): void {
    this.repo.resolve(id)
    this.notifyRenderer()
  }

  resolveAll(): void {
    this.repo.resolveAll()
    this.notifyRenderer()
  }

  delete(id: string): void {
    this.repo.delete(id)
    this.notifyRenderer()
  }

  clearAll(): void {
    this.repo.clearAll()
    this.notifyRenderer()
  }

  /**
   * Notifica todas as janelas sobre mudança na contagem de erros.
   */
  private notifyRenderer(): void {
    const count = this.repo.getUnresolvedCount()
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('error-log:countChanged', count)
      }
    }
  }
}

const SAFE_CONTEXT_KEYS = new Set([
  'channel',
  'operation',
  'operationType',
  'provider',
  'statusCode',
  'type',
  'textLength',
])

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue
    if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value
    else if (typeof value === 'string' && /^[a-zA-Z0-9_:.-]{1,80}$/.test(value)) safe[key] = value
  }
  return safe
}
