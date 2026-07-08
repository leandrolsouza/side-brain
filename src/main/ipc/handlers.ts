import { ipcMain } from 'electron'
import { EntryService } from '../services/entry-service'
import { DigestService } from '../services/digest-service'
import { ExportService } from '../services/export-service'
import { MeetingService } from '../services/meeting-service'
import { BackupService } from '../services/backup-service'
import { getConfigService } from '../services/config-service'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import type { ExportFormat } from '../services/export-service'

export function registerIpcHandlers(): void {
  const entryService = new EntryService()
  const digestService = new DigestService()
  const exportService = new ExportService()
  const meetingService = new MeetingService()
  const backupService = new BackupService()
  const projectRepo = new ProjectRepository()
  const taskRepo = new TaskRepository()
  const settingsRepo = new SettingsRepository()

  // Entry handlers
  ipcMain.handle('entry:create', async (_event, rawText: string) => {
    return entryService.createEntry(rawText)
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

  ipcMain.handle('entry:approve', async (_event, id: string) => {
    return entryService.approveEntry(id)
  })

  ipcMain.handle('entry:correct', async (_event, id: string, corrections: Record<string, any>) => {
    return entryService.correctEntry(id, corrections)
  })

  // Project handlers
  ipcMain.handle('project:getAll', async () => {
    return projectRepo.getAll()
  })

  ipcMain.handle('project:create', async (_event, name: string, description?: string) => {
    return projectRepo.create(name, description)
  })

  ipcMain.handle('project:update', async (_event, id: string, updates: Record<string, any>) => {
    return projectRepo.update(id, updates)
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
  ipcMain.handle('meeting:create', async (_event, data: { projectId: string; title: string; participants?: string[] }) => {
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

  // Database path handlers
  const configService = getConfigService()

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
}
