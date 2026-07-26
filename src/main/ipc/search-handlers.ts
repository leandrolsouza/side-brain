import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerSearchHandlers(): void {
  const { entryService, projectRepo, taskRepo } = getContainer()

  safeHandle(
    'search:global',
    async (
      _event,
      query: string,
      filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }
    ) => {
      const entries = query ? entryService.searchEntries(query, filters) : []
      const tasks = query ? taskRepo.search(query, filters) : []
      const projects = query ? projectRepo.search(query) : []
      return { entries, tasks, projects }
    }
  )
}
