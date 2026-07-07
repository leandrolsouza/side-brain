import { ipcMain } from 'electron'
import { EntryService } from '../services/entry-service'
import { DigestService } from '../services/digest-service'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'

export function registerIpcHandlers(): void {
  const entryService = new EntryService()
  const digestService = new DigestService()
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
}
