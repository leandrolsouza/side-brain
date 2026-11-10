import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import { getConfigService } from '../services/config-service'
import fs from 'node:fs'

export function registerWorkspaceHandlers(): void {
  const configService = getConfigService()
  const { backupService } = getContainer()
  let previousOperation: Promise<unknown> = Promise.resolve()
  const withBackupPaused = async <T>(operation: () => Promise<T>): Promise<T> => {
    backupService.pausePeriodicBackup()
    const previous = previousOperation
    let release: () => void = () => {}
    previousOperation = new Promise<void>((resolve) => {
      release = resolve
    })
    try {
      await previous
      await backupService.waitForBackup()
      return await operation()
    } finally {
      release()
      backupService.resumePeriodicBackup()
    }
  }

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
    return withBackupPaused(() => configService.switchWorkspace(workspaceId))
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

  safeHandle('database:checkExists', async (_event, dbPath: string) => {
    return fs.existsSync(dbPath)
  })

  safeHandle('database:setPath', async (_event, newPath: string, mode: 'move' | 'new' | 'existing') => {
    return withBackupPaused(() => configService.setDatabasePath(newPath, mode))
  })

  safeHandle('database:resetPath', async (_event, mode: 'move' | 'new' | 'existing') => {
    return withBackupPaused(() => configService.resetToDefaultPath(mode))
  })

  // Backup handlers
  safeHandle('backup:list', async () => {
    return backupService.listBackups()
  })

  safeHandle('backup:create', async () => {
    return withBackupPaused(() => backupService.createManualBackup())
  })

  safeHandle('backup:restore', async (_event, filePath: string) => {
    return withBackupPaused(() => backupService.restoreFromAutoBackup(filePath))
  })

  safeHandle('backup:import', async () => {
    return withBackupPaused(() => backupService.importBackup())
  })

  safeHandle('backup:importForOnboarding', async () => {
    return withBackupPaused(() => backupService.importBackup({ markOnboardingComplete: true }))
  })

  safeHandle('backup:delete', async (_event, filePath: string) => {
    return backupService.deleteBackup(filePath)
  })

  safeHandle('database:reset', async () => {
    return withBackupPaused(() => backupService.resetDatabase())
  })
}
