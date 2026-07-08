import { contextBridge, ipcRenderer } from 'electron'
import type { EntryConfirmRequest, EntryPreviewResult, AIUsageSummary, AIUsageDailyPoint, AIUsageRecord, Workspace } from '../shared/types'

export interface ElectronAPI {
  // Workspaces
  getWorkspaces: () => Promise<Workspace[]>
  getActiveWorkspace: () => Promise<Workspace>
  createWorkspace: (data: { name: string; emoji: string; databasePath: string }) => Promise<Workspace>
  updateWorkspace: (id: string, updates: { name?: string; emoji?: string }) => Promise<Workspace | null>
  deleteWorkspace: (id: string) => Promise<{ success: boolean; error?: string }>
  switchWorkspace: (workspaceId: string) => Promise<{ success: boolean; error?: string }>
  selectWorkspaceFolder: () => Promise<string | null>

  // Entries
  createEntry: (rawText: string) => Promise<any>
  previewEntry: (rawText: string, projectIdHint?: string) => Promise<EntryPreviewResult>
  confirmEntry: (data: EntryConfirmRequest) => Promise<any>
  getEntries: (projectId?: string) => Promise<any[]>
  updateEntry: (id: string, updates: Record<string, any>) => Promise<any>
  deleteEntry: (id: string) => Promise<void>

  // Projects
  getProjects: (includeInactive?: boolean) => Promise<any[]>
  createProject: (name: string, description?: string) => Promise<any>
  updateProject: (id: string, updates: Record<string, any>) => Promise<any>
  setProjectActive: (id: string, active: boolean) => Promise<any>
  deleteProject: (id: string) => Promise<void>

  // Tasks
  getTasksByProject: (projectId: string) => Promise<any[]>
  getAllTasks: () => Promise<any[]>
  getTasksDueThisWeek: () => Promise<any[]>
  getOverdueTasks: () => Promise<any[]>
  createTask: (data: { projectId: string; title: string; description?: string; dueDate?: string | null }) => Promise<any>
  updateTask: (id: string, updates: Record<string, any>) => Promise<any>
  deleteTask: (id: string) => Promise<void>

  // AI
  generateSummary: (projectId: string) => Promise<string>
  generateGlobalSummary: () => Promise<string>

  // Daily Digest
  generateDailyDigest: () => Promise<any>

  // Settings
  getSettings: () => Promise<Record<string, any>>
  updateSettings: (settings: Record<string, any>) => Promise<void>

  // Global Search
  globalSearch: (query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }) => Promise<{ entries: any[]; tasks: any[]; projects: any[] }>

  // Export
  exportProject: (projectId: string, format: 'markdown' | 'pdf') => Promise<{ success: boolean; filePath?: string }>

  // Meetings
  createMeeting: (data: { projectId: string; title: string; participants?: string[] }) => Promise<any>
  getMeetings: (projectId?: string) => Promise<any[]>
  getMeetingById: (id: string) => Promise<any | null>
  getActiveMeeting: () => Promise<any | null>
  addMeetingNote: (id: string, note: string) => Promise<any>
  setMeetingTranscription: (id: string, transcription: string) => Promise<any>
  endMeeting: (id: string) => Promise<any>
  processMeeting: (id: string) => Promise<any>
  saveSelectedMeetingItems: (meetingId: string, selectedEntries: any[], selectedTasks: any[]) => Promise<void>
  deleteMeeting: (id: string) => Promise<void>

  // Backup
  listBackups: () => Promise<any[]>
  createManualBackup: () => Promise<{ success: boolean; filePath?: string }>
  restoreBackup: (filePath: string) => Promise<{ success: boolean; error?: string }>
  importBackup: () => Promise<{ success: boolean; error?: string }>
  deleteBackup: (filePath: string) => Promise<boolean>
  resetDatabase: () => Promise<{ success: boolean; archivedPath?: string; error?: string }>

  // Database Path
  getDatabasePath: () => Promise<{ currentPath: string; defaultPath: string; isCustom: boolean }>
  selectDatabaseFolder: () => Promise<string | null>
  setDatabasePath: (newPath: string, mode: 'move' | 'new') => Promise<{ success: boolean; error?: string }>
  resetDatabasePath: (mode: 'move' | 'new') => Promise<{ success: boolean; error?: string }>

  // AI Usage
  getAIUsageSummary: (dateFrom?: string, dateTo?: string) => Promise<AIUsageSummary>
  getAIUsageDailyUsage: (dateFrom?: string, dateTo?: string) => Promise<AIUsageDailyPoint[]>
  getAIUsageHistory: (limit?: number, offset?: number) => Promise<AIUsageRecord[]>

  // Events
  onFocusCaptureInput: (callback: () => void) => void
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Workspaces
  getWorkspaces: () =>
    ipcRenderer.invoke('workspace:list'),
  getActiveWorkspace: () =>
    ipcRenderer.invoke('workspace:getActive'),
  createWorkspace: (data: { name: string; emoji: string; databasePath: string }) =>
    ipcRenderer.invoke('workspace:create', data),
  updateWorkspace: (id: string, updates: { name?: string; emoji?: string }) =>
    ipcRenderer.invoke('workspace:update', id, updates),
  deleteWorkspace: (id: string) =>
    ipcRenderer.invoke('workspace:delete', id),
  switchWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('workspace:switch', workspaceId),
  selectWorkspaceFolder: () =>
    ipcRenderer.invoke('workspace:selectFolder'),

  // Entries
  createEntry: (rawText: string) =>
    ipcRenderer.invoke('entry:create', rawText),
  previewEntry: (rawText: string, projectIdHint?: string) =>
    ipcRenderer.invoke('entry:preview', rawText, projectIdHint),
  confirmEntry: (data: EntryConfirmRequest) =>
    ipcRenderer.invoke('entry:confirm', data),
  getEntries: (projectId?: string) =>
    ipcRenderer.invoke('entry:getAll', projectId),
  updateEntry: (id: string, updates: Record<string, any>) =>
    ipcRenderer.invoke('entry:update', id, updates),
  deleteEntry: (id: string) =>
    ipcRenderer.invoke('entry:delete', id),

  // Projects
  getProjects: (includeInactive?: boolean) =>
    ipcRenderer.invoke('project:getAll', includeInactive),
  createProject: (name: string, description?: string) =>
    ipcRenderer.invoke('project:create', name, description),
  updateProject: (id: string, updates: Record<string, any>) =>
    ipcRenderer.invoke('project:update', id, updates),
  setProjectActive: (id: string, active: boolean) =>
    ipcRenderer.invoke('project:setActive', id, active),
  deleteProject: (id: string) =>
    ipcRenderer.invoke('project:delete', id),

  // Tasks
  getTasksByProject: (projectId: string) =>
    ipcRenderer.invoke('task:getByProject', projectId),
  getAllTasks: () =>
    ipcRenderer.invoke('task:getAll'),
  getTasksDueThisWeek: () =>
    ipcRenderer.invoke('task:getDueThisWeek'),
  getOverdueTasks: () =>
    ipcRenderer.invoke('task:getOverdue'),
  createTask: (data: { projectId: string; title: string; description?: string; dueDate?: string | null }) =>
    ipcRenderer.invoke('task:create', data),
  updateTask: (id: string, updates: Record<string, any>) =>
    ipcRenderer.invoke('task:update', id, updates),
  deleteTask: (id: string) =>
    ipcRenderer.invoke('task:delete', id),

  // AI
  generateSummary: (projectId: string) =>
    ipcRenderer.invoke('ai:generateSummary', projectId),
  generateGlobalSummary: () =>
    ipcRenderer.invoke('ai:generateGlobalSummary'),

  // Daily Digest
  generateDailyDigest: () =>
    ipcRenderer.invoke('digest:generate'),

  // Settings
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Record<string, any>) =>
    ipcRenderer.invoke('settings:update', settings),

  // Global Search
  globalSearch: (query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }) =>
    ipcRenderer.invoke('search:global', query, filters),

  // Export
  exportProject: (projectId: string, format: 'markdown' | 'pdf') =>
    ipcRenderer.invoke('export:project', projectId, format),

  // Meetings
  createMeeting: (data: { projectId: string; title: string; participants?: string[] }) =>
    ipcRenderer.invoke('meeting:create', data),
  getMeetings: (projectId?: string) =>
    ipcRenderer.invoke('meeting:getAll', projectId),
  getMeetingById: (id: string) =>
    ipcRenderer.invoke('meeting:getById', id),
  getActiveMeeting: () =>
    ipcRenderer.invoke('meeting:getActive'),
  addMeetingNote: (id: string, note: string) =>
    ipcRenderer.invoke('meeting:addNote', id, note),
  setMeetingTranscription: (id: string, transcription: string) =>
    ipcRenderer.invoke('meeting:setTranscription', id, transcription),
  endMeeting: (id: string) =>
    ipcRenderer.invoke('meeting:end', id),
  processMeeting: (id: string) =>
    ipcRenderer.invoke('meeting:process', id),
  saveSelectedMeetingItems: (meetingId: string, selectedEntries: any[], selectedTasks: any[]) =>
    ipcRenderer.invoke('meeting:saveSelected', meetingId, selectedEntries, selectedTasks),
  deleteMeeting: (id: string) =>
    ipcRenderer.invoke('meeting:delete', id),

  // Backup
  listBackups: () =>
    ipcRenderer.invoke('backup:list'),
  createManualBackup: () =>
    ipcRenderer.invoke('backup:create'),
  restoreBackup: (filePath: string) =>
    ipcRenderer.invoke('backup:restore', filePath),
  importBackup: () =>
    ipcRenderer.invoke('backup:import'),
  deleteBackup: (filePath: string) =>
    ipcRenderer.invoke('backup:delete', filePath),
  resetDatabase: () =>
    ipcRenderer.invoke('database:reset'),

  // Database Path
  getDatabasePath: () =>
    ipcRenderer.invoke('database:getPath'),
  selectDatabaseFolder: () =>
    ipcRenderer.invoke('database:selectFolder'),
  setDatabasePath: (newPath: string, mode: 'move' | 'new') =>
    ipcRenderer.invoke('database:setPath', newPath, mode),
  resetDatabasePath: (mode: 'move' | 'new') =>
    ipcRenderer.invoke('database:resetPath', mode),

  // AI Usage
  getAIUsageSummary: (dateFrom?: string, dateTo?: string) =>
    ipcRenderer.invoke('ai-usage:getSummary', dateFrom, dateTo),
  getAIUsageDailyUsage: (dateFrom?: string, dateTo?: string) =>
    ipcRenderer.invoke('ai-usage:getDailyUsage', dateFrom, dateTo),
  getAIUsageHistory: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('ai-usage:getHistory', limit, offset),

  // Events
  onFocusCaptureInput: (callback: () => void) => {
    ipcRenderer.on('focus-capture-input', () => callback())
  },
} satisfies ElectronAPI)
