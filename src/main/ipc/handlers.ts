import { ipcMain, nativeTheme } from 'electron'
import { EntryService } from '../services/entry-service'
import { DigestService } from '../services/digest-service'
import { ExportService } from '../services/export-service'
import { MeetingService } from '../services/meeting-service'
import { BackupService } from '../services/backup-service'
import { SmartChatService } from '../services/smart-chat-service'
import { InsightsService } from '../services/insights-service'
import { getConfigService } from '../services/config-service'
import { getErrorService } from '../services/error-service'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIUsageRepository } from '../database/repositories/ai-usage-repository'
import { NotificationRepository } from '../database/repositories/notification-repository'
import type { ExportFormat } from '../services/export-service'
import type { EntryConfirmRequest, ErrorCategory, ErrorSeverity } from '../../shared/types'

/**
 * Wrapper que captura erros de qualquer IPC handler e loga na Central de Erros.
 * Determina a categoria com base no channel name.
 */
function safeHandle(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (error: any) {
      const category = inferCategory(channel)
      // Avoid double-logging AI errors that were already logged at the service level
      // (e.g. HTTP 429/500 errors from Bedrock that are logged inside invokeConverse)
      const isAlreadyLogged = category === 'ai'
        && error?.message?.includes('API error')
        && !channel.startsWith('meeting:')
      if (!isAlreadyLogged) {
        getErrorService().logError({
          category,
          severity: 'error',
          message: error?.message || `Erro no handler ${channel}`,
          stack: error?.stack,
          context: { channel, args: sanitizeArgs(args) },
        })
      }
      throw error
    }
  })
}

function inferCategory(channel: string): ErrorCategory {
  if (channel.startsWith('ai:') || channel.startsWith('digest:') || channel.startsWith('smart-chat:') || channel.startsWith('insights:')) return 'ai'
  if (channel === 'meeting:process' || channel === 'meeting:prepare') return 'ai'
  if (channel.startsWith('entry:') || channel.startsWith('project:') || channel.startsWith('task:') || channel.startsWith('search:')) return 'database'
  if (channel.startsWith('meeting:')) return 'database'
  if (channel.startsWith('backup:') || channel.startsWith('database:') || channel.startsWith('workspace:')) return 'database'
  if (channel.startsWith('notification:') || channel.startsWith('ai-usage:')) return 'database'
  return 'ipc'
}

function sanitizeArgs(args: any[]): string {
  try {
    const sanitized = args.map((arg) => {
      if (typeof arg === 'string' && arg.length > 200) return arg.slice(0, 200) + '...'
      if (typeof arg === 'object' && arg !== null) {
        const str = JSON.stringify(arg)
        return str.length > 300 ? str.slice(0, 300) + '...' : str
      }
      return arg
    })
    return JSON.stringify(sanitized).slice(0, 500)
  } catch {
    return '[não serializável]'
  }
}

export function registerIpcHandlers(): void {
  const entryService = new EntryService()
  const digestService = new DigestService()
  const exportService = new ExportService()
  const meetingService = new MeetingService()
  const backupService = new BackupService()
  const smartChatService = new SmartChatService()
  const insightsService = new InsightsService()
  const projectRepo = new ProjectRepository()
  const taskRepo = new TaskRepository()
  const settingsRepo = new SettingsRepository()
  const aiUsageRepo = new AIUsageRepository()
  const notificationRepo = new NotificationRepository()

  // Entry handlers
  safeHandle('entry:create', async (_event, rawText: string) => {
    return entryService.createEntry(rawText)
  })

  safeHandle('entry:preview', async (_event, rawText: string, projectIdHint?: string) => {
    return entryService.previewEntry(rawText, projectIdHint)
  })

  safeHandle('entry:confirm', async (_event, data: EntryConfirmRequest) => {
    return entryService.confirmEntry(data)
  })

  safeHandle('entry:getAll', async (_event, projectId?: string) => {
    return entryService.getEntries(projectId)
  })

  safeHandle('entry:update', async (_event, id: string, updates: Record<string, any>) => {
    return entryService.updateEntry(id, updates)
  })

  safeHandle('entry:delete', async (_event, id: string) => {
    return entryService.deleteEntry(id)
  })

  // Project handlers
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

  // AI handlers
  safeHandle('ai:generateSummary', async (_event, projectId: string) => {
    return entryService.generateSummary(projectId)
  })

  safeHandle('ai:generateGlobalSummary', async () => {
    return entryService.generateGlobalSummary()
  })

  // Settings handlers
  safeHandle('settings:get', async () => {
    return settingsRepo.get()
  })

  safeHandle('settings:update', async (_event, settings: Record<string, any>) => {
    return settingsRepo.update(settings)
  })

  // Global Search handler
  safeHandle('search:global', async (_event, query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }) => {
    const entries = query ? entryService.searchEntries(query, filters) : []
    const tasks = query ? taskRepo.search(query, filters) : []
    const projects = query ? projectRepo.search(query) : []
    return { entries, tasks, projects }
  })

  // Task handlers
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

  // Task deadline handlers
  safeHandle('task:getDueThisWeek', async () => {
    return taskRepo.getDueThisWeek()
  })

  safeHandle('task:getOverdue', async () => {
    return taskRepo.getOverdue()
  })

  // Daily Digest handler
  safeHandle('digest:generate', async () => {
    return digestService.generateDailyDigest()
  })

  // Export handler
  safeHandle('export:project', async (_event, projectId: string, format: ExportFormat) => {
    return exportService.exportProject(projectId, format)
  })

  // Meeting handlers
  safeHandle('meeting:create', async (_event, data: { projectId: string; title: string; participants?: string[]; meetingDate?: string }) => {
    return meetingService.create(data)
  })

  safeHandle('meeting:getAll', async (_event, projectId?: string) => {
    return meetingService.getAll(projectId)
  })

  safeHandle('meeting:getById', async (_event, id: string) => {
    return meetingService.getById(id)
  })

  safeHandle('meeting:getActive', async () => {
    return meetingService.getActive()
  })

  safeHandle('meeting:addNote', async (_event, id: string, note: string) => {
    return meetingService.addNote(id, note)
  })

  safeHandle('meeting:setTranscription', async (_event, id: string, transcription: string) => {
    return meetingService.setTranscription(id, transcription)
  })

  safeHandle('meeting:end', async (_event, id: string) => {
    return meetingService.end(id)
  })

  safeHandle('meeting:process', async (_event, id: string) => {
    return meetingService.analyze(id)
  })

  safeHandle('meeting:saveSelected', async (_event, meetingId: string, selectedEntries: any[], selectedTasks: any[]) => {
    return meetingService.saveSelected(meetingId, selectedEntries, selectedTasks)
  })

  safeHandle('meeting:delete', async (_event, id: string) => {
    return meetingService.delete(id)
  })

  safeHandle('meeting:deleteWithData', async (_event, meetingId: string, entryIds: string[], taskIds: string[]) => {
    return meetingService.deleteWithData(meetingId, entryIds, taskIds)
  })

  safeHandle('meeting:prepare', async (_event, projectId: string, title: string, participants: string[]) => {
    return meetingService.prepareMeeting(projectId, title, participants)
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

  // Workspace handlers
  const configService = getConfigService()

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

  // AI Usage handlers
  safeHandle('ai-usage:getSummary', async (_event, dateFrom?: string, dateTo?: string) => {
    return aiUsageRepo.getSummary(dateFrom, dateTo)
  })

  safeHandle('ai-usage:getDailyUsage', async (_event, dateFrom?: string, dateTo?: string) => {
    return aiUsageRepo.getDailyUsage(dateFrom, dateTo)
  })

  safeHandle('ai-usage:getHistory', async (_event, limit?: number, offset?: number) => {
    return aiUsageRepo.getHistory(limit, offset)
  })

  // Smart Chat handlers
  safeHandle('smart-chat:send', async (_event, message: string) => {
    return smartChatService.chat(message)
  })

  // Proactive Insights handlers
  safeHandle('insights:generate', async () => {
    return insightsService.generateInsights()
  })

  // Notification handlers
  safeHandle('notification:getAll', async () => {
    return notificationRepo.getAll()
  })

  safeHandle('notification:getUnreadCount', async () => {
    return notificationRepo.getUnreadCount()
  })

  safeHandle('notification:markRead', async (_event, id: string) => {
    return notificationRepo.markRead(id)
  })

  safeHandle('notification:markAllRead', async () => {
    return notificationRepo.markAllRead()
  })

  safeHandle('notification:dismiss', async (_event, id: string) => {
    return notificationRepo.dismiss(id)
  })

  safeHandle('notification:dismissAll', async () => {
    return notificationRepo.dismissAll()
  })

  // Theme handler — sincroniza controles nativos (select dropdown) com o tema do app
  ipcMain.handle('theme:set', async (_event, theme: 'dark' | 'light') => {
    nativeTheme.themeSource = theme
  })

  // Error Log handlers — NOT wrapped with safeHandle to avoid infinite recursion
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
