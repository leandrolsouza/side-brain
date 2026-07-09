import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import type { ExportFormat } from '../services/export-service'

export function registerExportHandlers(): void {
  const { exportService } = getContainer()

  safeHandle('export:project', async (_event, projectId: string, format: ExportFormat) => {
    return exportService.exportProject(projectId, format)
  })
}
