import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerTaskHandlers(): void {
  const { taskRepo } = getContainer()

  safeHandle('task:getByProject', async (_event, projectId: string) => {
    return taskRepo.getByProject(projectId)
  })

  safeHandle('task:getAll', async () => {
    return taskRepo.getAll()
  })

  safeHandle('task:create', async (_event, data: { projectId: string; title: string; description?: string }) => {
    return taskRepo.create(data)
  })

  safeHandle('task:update', async (_event, id: string, updates: Record<string, any>) => {
    return taskRepo.update(id, updates)
  })

  safeHandle('task:delete', async (_event, id: string) => {
    return taskRepo.delete(id)
  })

  safeHandle('task:getDueThisWeek', async () => {
    return taskRepo.getDueThisWeek()
  })

  safeHandle('task:getOverdue', async () => {
    return taskRepo.getOverdue()
  })
}
