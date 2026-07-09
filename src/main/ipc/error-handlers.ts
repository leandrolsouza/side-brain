import { ipcMain } from 'electron'
import { getErrorService } from '../services/error-service'
import type { ErrorCategory, ErrorSeverity } from '../../shared/types'

/**
 * Error Log handlers — NOT wrapped with safeHandle to avoid infinite recursion.
 * If these handlers fail, the error would try to log itself, causing a loop.
 */
export function registerErrorHandlers(): void {
  const errorService = getErrorService()

  ipcMain.handle('error-log:getAll', async (_event, filters?: { category?: ErrorCategory; severity?: ErrorSeverity; resolved?: boolean }) => {
    return errorService.getAll(filters)
  })

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
