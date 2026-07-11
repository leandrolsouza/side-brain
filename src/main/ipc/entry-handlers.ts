import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import type { EntryConfirmRequest, PaginationParams } from '../../shared/types'

export function registerEntryHandlers(): void {
  const { entryService, entryRepo } = getContainer()

  safeHandle('entry:create', async (_event, rawText: string) => {
    return entryService.createEntry(rawText)
  })

  safeHandle('entry:preview', async (_event, rawText: string, projectIdHint?: string) => {
    return entryService.previewEntry(rawText, projectIdHint)
  })

  safeHandle('entry:previewBatch', async (_event, rawText: string) => {
    return entryService.previewBatch(rawText)
  })

  safeHandle('entry:confirm', async (_event, data: EntryConfirmRequest) => {
    return entryService.confirmEntry(data)
  })

  safeHandle('entry:getAll', async (_event, projectId?: string) => {
    return entryService.getEntries(projectId)
  })

  safeHandle('entry:getPaginated', async (_event, params: PaginationParams & { projectId?: string }) => {
    return entryService.getEntriesPaginated(params)
  })

  safeHandle('entry:update', async (_event, id: string, updates: Record<string, any>) => {
    return entryService.updateEntry(id, updates)
  })

  safeHandle('entry:delete', async (_event, id: string) => {
    return entryService.deleteEntry(id)
  })

  safeHandle('entry:getActivityHeatmap', async (_event, weeks?: number) => {
    return entryRepo.getActivityHeatmap(weeks)
  })
}
