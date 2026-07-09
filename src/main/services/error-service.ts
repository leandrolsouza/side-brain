import { BrowserWindow } from 'electron'
import { ErrorLogRepository } from '../database/repositories/error-log-repository'
import type { ErrorCategory, ErrorSeverity, ErrorLog } from '../../shared/types'

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
      message: data.message,
      stack: data.stack,
      context: data.context ? JSON.stringify(data.context) : undefined,
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
        message: error.message,
        stack: error.stack,
        context: { type: 'uncaughtException' },
      })
    })

    process.on('unhandledRejection', (reason) => {
      const message = reason instanceof Error ? reason.message : String(reason)
      const stack = reason instanceof Error ? reason.stack : undefined
      this.logError({
        category: 'system',
        severity: 'error',
        message,
        stack,
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
