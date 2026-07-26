import { ipcMain } from 'electron'
import { getErrorService } from '../services/error-service'
import type { ErrorCategory, ErrorSeverity } from '../../shared/types'

/**
 * Error Log handlers — intentionally NOT wrapped with safeHandle.
 *
 * All 6 handlers read/write the error_logs store itself. If one of them fails
 * (e.g. database issue), safeHandle would try to log that error into the same
 * failing store, and logError() also emits 'error-log:countChanged', which makes
 * the renderer refetch the error log — failing again and logging again, creating
 * an infinite error-logging feedback loop. Direct ipcMain.handle avoids this.
 */
export function registerErrorHandlers(): void {
  const errorService = getErrorService()

  ipcMain.handle(
    'error-log:getAll',
    async (_event, filters?: { category?: ErrorCategory; severity?: ErrorSeverity; resolved?: boolean }) => {
      return errorService.getAll(filters)
    }
  )

  ipcMain.handle('error-log:getUnresolvedCount', async () => {
    return errorService.getUnresolvedCount()
  })

  ipcMain.handle('error-log:resolve', async (_event, id: string) => {
    return errorService.resolve(id)
  })

  ipcMain.handle('error-log:resolveAll', async () => {
    return errorService.resolveAll()
  })

  ipcMain.handle('error-log:delete', async (_event, id: string) => {
    return errorService.delete(id)
  })

  ipcMain.handle('error-log:clearAll', async () => {
    return errorService.clearAll()
  })
}
