import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import { getConfigService } from '../services/config-service'

export function registerWorkspaceHandlers(): void {
  const configService = getConfigService()
  const { backupService } = getContainer()

  // Workspace handlers
  safeHandle('workspace:list', async () => {
    return configService.getWorkspaces()
  })

  safeHandle('workspace:getActive', async () => {
    return configService.getActiveWorkspace()
  })

  safeHandle('workspace:create', async (_event, data: { name: string; emoji: string; databasePath: string }) => {
    return configService.createWorkspace(data)
  })

  safeHandle('workspace:update', async (_event, id: string, updates: { name?: string; emoji?: string }) => {
    return configService.updateWorkspace(id, updates)
  })

  safeHandle('workspace:delete', async (_event, id: string) => {
    return configService.deleteWorkspace(id)
  })

  safeHandle('workspace:switch', async (_event, workspaceId: string) => {
    return configService.switchWorkspace(workspaceId)
  })

  safeHandle('workspace:selectFolder', async () => {
    return configService.selectWorkspaceFolder()
  })

  // Database path handlers (compatibilidade)
  safeHandle('database:getPath', async () => {
    return {
      currentPath: configService.getDatabasePath(),
      defaultPath: configService.getDefaultDatabasePath(),
      isCustom: configService.isCustomPath(),
    }
  })

  safeHandle('database:selectFolder', async () => {
    return configService.selectDatabaseFolder()
  })

  safeHandle('database:setPath', async (_event, newPath: string, mode: 'move' | 'new') => {
    return configService.setDatabasePath(newPath, mode)
  })

  safeHandle('database:resetPath', async (_event, mode: 'move' | 'new') => {
    return configService.resetToDefaultPath(mode)
  })

  // Backup handlers
  safeHandle('backup:list', async () => {
    return backupService.listBackups()
  })

  safeHandle('backup:create', async () => {
    return backupService.createManualBackup()
  })

  safeHandle('backup:restore', async (_event, filePath: string) => {
    return backupService.restoreFromAutoBackup(filePath)
  })

  safeHandle('backup:import', async () => {
    return backupService.importBackup()
  })

  safeHandle('backup:delete', async (_event, filePath: string) => {
    return backupService.deleteBackup(filePath)
  })

  safeHandle('database:reset', async () => {
    return backupService.resetDatabase()
  })
}
