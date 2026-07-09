import { ipcMain, nativeTheme } from 'electron'
import { EntryService } from '../services/entry-service'
import { DigestService } from '../services/digest-service'
import { ExportService } from '../services/export-service'
import { MeetingService } from '../services/meeting-service'
import { BackupService } from '../services/backup-service'
import { SmartChatService } from '../services/smart-chat-service'
import { InsightsService } from '../services/insights-service'
import { getConfigService } from '../services/config-service'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIUsageRepository } from '../database/repositories/ai-usage-repository'
import { NotificationRepository } from '../database/repositories/notification-repository'
import type { ExportFormat } from '../services/export-service'
import type { EntryConfirmRequest } from '../../shared/types'

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
  ipcMain.handle('entry:create', async (_event, rawText: string) => {
    return entryService.createEntry(rawText)
  })

  ipcMain.handle('entry:preview', async (_event, rawText: string, projectIdHint?: string) => {
    return entryService.previewEntry(rawText, projectIdHint)
  })

  ipcMain.handle('entry:confirm', async (_event, data: EntryConfirmRequest) => {
    return entryService.confirmEntry(data)
  })

  ipcMain.handle('entry:getAll', async (_event, projectId?: string) => {
    return entryService.getEntries(projectId)
  })

  ipcMain.handle('entry:update', async (_event, id: string, updates: Record<string, any>) => {
    return entryService.updateEntry(id, updates)
  })

  ipcMain.handle('entry:delete', async (_event, id: string) => {
    return entryService.deleteEntry(id)
  })

  // Project handlers
  ipcMain.handle('project:getAll', async (_event, includeInactive?: boolean) => {
    return projectRepo.getAll(includeInactive)
  })

  ipcMain.handle('project:create', async (_event, name: string, description?: string) => {
    return projectRepo.create(name, description)
  })

  ipcMain.handle('project:update', async (_event, id: string, updates: Record<string, any>) => {
    return projectRepo.update(id, updates)
  })

  ipcMain.handle('project:setActive', async (_event, id: string, active: boolean) => {
    return projectRepo.setActive(id, active)
  })

  ipcMain.handle('project:delete', async (_event, id: string) => {
    return projectRepo.delete(id)
  })

  // AI handlers
  ipcMain.handle('ai:generateSummary', async (_event, projectId: string) => {
    return entryService.generateSummary(projectId)
  })

  ipcMain.handle('ai:generateGlobalSummary', async () => {
    return entryService.generateGlobalSummary()
  })

  // Settings handlers
  ipcMain.handle('settings:get', async () => {
    return settingsRepo.get()
  })

  ipcMain.handle('settings:update', async (_event, settings: Record<string, any>) => {
    return settingsRepo.update(settings)
  })

  // Global Search handler
  ipcMain.handle('search:global', async (_event, query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }) => {
    const entries = query ? entryService.searchEntries(query, filters) : []
    const tasks = query ? taskRepo.search(query, filters) : []
    const projects = query ? projectRepo.search(query) : []
    return { entries, tasks, projects }
  })

  // Task handlers
  ipcMain.handle('task:getByProject', async (_event, projectId: string) => {
    return taskRepo.getByProject(projectId)
  })

  ipcMain.handle('task:getAll', async () => {
    return taskRepo.getAll()
  })

  ipcMain.handle('task:create', async (_event, data: { projectId: string; title: string; description?: string }) => {
    return taskRepo.create(data)
  })

  ipcMain.handle('task:update', async (_event, id: string, updates: Record<string, any>) => {
    return taskRepo.update(id, updates)
  })

  ipcMain.handle('task:delete', async (_event, id: string) => {
    return taskRepo.delete(id)
  })

  // Task deadline handlers
  ipcMain.handle('task:getDueThisWeek', async () => {
    return taskRepo.getDueThisWeek()
  })

  ipcMain.handle('task:getOverdue', async () => {
    return taskRepo.getOverdue()
  })

  // Daily Digest handler
  ipcMain.handle('digest:generate', async () => {
    return digestService.generateDailyDigest()
  })

  // Export handler
  ipcMain.handle('export:project', async (_event, projectId: string, format: ExportFormat) => {
    return exportService.exportProject(projectId, format)
  })

  // Meeting handlers
  ipcMain.handle('meeting:create', async (_event, data: { projectId: string; title: string; participants?: string[]; meetingDate?: string }) => {
    return meetingService.create(data)
  })

  ipcMain.handle('meeting:getAll', async (_event, projectId?: string) => {
    return meetingService.getAll(projectId)
  })

  ipcMain.handle('meeting:getById', async (_event, id: string) => {
    return meetingService.getById(id)
  })

  ipcMain.handle('meeting:getActive', async () => {
    return meetingService.getActive()
  })

  ipcMain.handle('meeting:addNote', async (_event, id: string, note: string) => {
    return meetingService.addNote(id, note)
  })

  ipcMain.handle('meeting:setTranscription', async (_event, id: string, transcription: string) => {
    return meetingService.setTranscription(id, transcription)
  })

  ipcMain.handle('meeting:end', async (_event, id: string) => {
    return meetingService.end(id)
  })

  ipcMain.handle('meeting:process', async (_event, id: string) => {
    return meetingService.analyze(id)
  })

  ipcMain.handle('meeting:saveSelected', async (_event, meetingId: string, selectedEntries: any[], selectedTasks: any[]) => {
    return meetingService.saveSelected(meetingId, selectedEntries, selectedTasks)
  })

  ipcMain.handle('meeting:delete', async (_event, id: string) => {
    return meetingService.delete(id)
  })

  ipcMain.handle('meeting:deleteWithData', async (_event, meetingId: string, entryIds: string[], taskIds: string[]) => {
    return meetingService.deleteWithData(meetingId, entryIds, taskIds)
  })

  ipcMain.handle('meeting:prepare', async (_event, projectId: string, title: string, participants: string[]) => {
    return meetingService.prepareMeeting(projectId, title, participants)
  })

  // Backup handlers
  ipcMain.handle('backup:list', async () => {
    return backupService.listBackups()
  })

  ipcMain.handle('backup:create', async () => {
    return backupService.createManualBackup()
  })

  ipcMain.handle('backup:restore', async (_event, filePath: string) => {
    return backupService.restoreFromAutoBackup(filePath)
  })

  ipcMain.handle('backup:import', async () => {
    return backupService.importBackup()
  })

  ipcMain.handle('backup:delete', async (_event, filePath: string) => {
    return backupService.deleteBackup(filePath)
  })

  ipcMain.handle('database:reset', async () => {
    return backupService.resetDatabase()
  })

  // Workspace handlers
  const configService = getConfigService()

  ipcMain.handle('workspace:list', async () => {
    return configService.getWorkspaces()
  })

  ipcMain.handle('workspace:getActive', async () => {
    return configService.getActiveWorkspace()
  })

  ipcMain.handle('workspace:create', async (_event, data: { name: string; emoji: string; databasePath: string }) => {
    return configService.createWorkspace(data)
  })

  ipcMain.handle('workspace:update', async (_event, id: string, updates: { name?: string; emoji?: string }) => {
    return configService.updateWorkspace(id, updates)
  })

  ipcMain.handle('workspace:delete', async (_event, id: string) => {
    return configService.deleteWorkspace(id)
  })

  ipcMain.handle('workspace:switch', async (_event, workspaceId: string) => {
    return configService.switchWorkspace(workspaceId)
  })

  ipcMain.handle('workspace:selectFolder', async () => {
    return configService.selectWorkspaceFolder()
  })

  // Database path handlers (compatibilidade)
  ipcMain.handle('database:getPath', async () => {
    return {
      currentPath: configService.getDatabasePath(),
      defaultPath: configService.getDefaultDatabasePath(),
      isCustom: configService.isCustomPath(),
    }
  })

  ipcMain.handle('database:selectFolder', async () => {
    return configService.selectDatabaseFolder()
  })

  ipcMain.handle('database:setPath', async (_event, newPath: string, mode: 'move' | 'new') => {
    return configService.setDatabasePath(newPath, mode)
  })

  ipcMain.handle('database:resetPath', async (_event, mode: 'move' | 'new') => {
    return configService.resetToDefaultPath(mode)
  })

  // AI Usage handlers
  ipcMain.handle('ai-usage:getSummary', async (_event, dateFrom?: string, dateTo?: string) => {
    return aiUsageRepo.getSummary(dateFrom, dateTo)
  })

  ipcMain.handle('ai-usage:getDailyUsage', async (_event, dateFrom?: string, dateTo?: string) => {
    return aiUsageRepo.getDailyUsage(dateFrom, dateTo)
  })

  ipcMain.handle('ai-usage:getHistory', async (_event, limit?: number, offset?: number) => {
    return aiUsageRepo.getHistory(limit, offset)
  })

  // Smart Chat handlers
  ipcMain.handle('smart-chat:send', async (_event, message: string) => {
    return smartChatService.chat(message)
  })

  // Proactive Insights handlers
  ipcMain.handle('insights:generate', async () => {
    return insightsService.generateInsights()
  })

  // Notification handlers
  ipcMain.handle('notification:getAll', async () => {
    return notificationRepo.getAll()
  })

  ipcMain.handle('notification:getUnreadCount', async () => {
    return notificationRepo.getUnreadCount()
  })

  ipcMain.handle('notification:markRead', async (_event, id: string) => {
    return notificationRepo.markRead(id)
  })

  ipcMain.handle('notification:markAllRead', async () => {
    return notificationRepo.markAllRead()
  })

  ipcMain.handle('notification:dismiss', async (_event, id: string) => {
    return notificationRepo.dismiss(id)
  })

  ipcMain.handle('notification:dismissAll', async () => {
    return notificationRepo.dismissAll()
  })

  // Theme handler — sincroniza controles nativos (select dropdown) com o tema do app
  ipcMain.handle('theme:set', async (_event, theme: 'dark' | 'light') => {
    nativeTheme.themeSource = theme
  })
}
