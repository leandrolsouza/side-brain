import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerProjectHandlers(): void {
  const { projectRepo } = getContainer()

  safeHandle('project:getAll', async (_event, includeInactive?: boolean) => {
    return projectRepo.getAll(includeInactive)
  })

  safeHandle('project:create', async (_event, name: string, description?: string) => {
    return projectRepo.create(name, description)
  })

  safeHandle('project:update', async (_event, id: string, updates: Record<string, any>) => {
    return projectRepo.update(id, updates)
  })

  safeHandle('project:setActive', async (_event, id: string, active: boolean) => {
    return projectRepo.setActive(id, active)
  })

  safeHandle('project:delete', async (_event, id: string) => {
    return projectRepo.delete(id)
  })
}
