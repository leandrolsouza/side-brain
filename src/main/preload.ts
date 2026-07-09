import { contextBridge, ipcRenderer } from 'electron'
import type {
  Entry,
  Project,
  Task,
  Meeting,
  MeetingProcessResult,
  DailyDigestData,
  BackupInfo,
  AppSettings,
  EntryConfirmRequest,
  EntryPreviewResult,
  AIUsageSummary,
  AIUsageDailyPoint,
  AIUsageRecord,
  Workspace,
  SmartChatMessage,
  ProactiveInsight,
  AppNotification,
  ErrorLog,
  ErrorCategory,
  ErrorSeverity,
  ReportPeriod,
  ReportsData,
  CustomEntryType,
  CustomActionStatus,
  CustomCaptureTemplate,
} from '../shared/types'

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
  createEntry: (rawText: string) => Promise<Entry & { autoSuggestedProject?: { id: string; name: string } }>
  previewEntry: (rawText: string, projectIdHint?: string) => Promise<EntryPreviewResult>
  confirmEntry: (data: EntryConfirmRequest) => Promise<Entry & { autoSuggestedProject?: { id: string; name: string } }>
  getEntries: (projectId?: string) => Promise<Entry[]>
  updateEntry: (id: string, updates: Record<string, any>) => Promise<Entry | null>
  deleteEntry: (id: string) => Promise<void>

  // Projects
  getProjects: (includeInactive?: boolean) => Promise<Project[]>
  createProject: (name: string, description?: string) => Promise<Project>
  updateProject: (id: string, updates: Record<string, any>) => Promise<Project | null>
  setProjectActive: (id: string, active: boolean) => Promise<Project | null>
  deleteProject: (id: string) => Promise<void>

  // Tasks
  getTasksByProject: (projectId: string) => Promise<Task[]>
  getAllTasks: () => Promise<Task[]>
  getTasksDueThisWeek: () => Promise<Task[]>
  getOverdueTasks: () => Promise<Task[]>
  createTask: (data: { projectId: string; title: string; description?: string; dueDate?: string | null }) => Promise<Task>
  updateTask: (id: string, updates: Record<string, any>) => Promise<Task | null>
  deleteTask: (id: string) => Promise<void>

  // AI
  generateSummary: (projectId: string) => Promise<string>
  generateGlobalSummary: () => Promise<string>

  // Daily Digest
  generateDailyDigest: () => Promise<DailyDigestData>

  // Settings
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>

  // Global Search
  globalSearch: (query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }) => Promise<{ entries: Entry[]; tasks: Task[]; projects: Project[] }>

  // Export
  exportProject: (projectId: string, format: 'markdown' | 'pdf') => Promise<{ success: boolean; filePath?: string }>

  // Meetings
  createMeeting: (data: { projectId: string; title: string; participants?: string[]; meetingDate?: string }) => Promise<Meeting>
  getMeetings: (projectId?: string) => Promise<Meeting[]>
  getMeetingById: (id: string) => Promise<Meeting | null>
  getActiveMeeting: () => Promise<Meeting | null>
  addMeetingNote: (id: string, note: string) => Promise<Meeting | null>
  setMeetingTranscription: (id: string, transcription: string) => Promise<Meeting | null>
  endMeeting: (id: string) => Promise<Meeting | null>
  processMeeting: (id: string) => Promise<MeetingProcessResult | null>
  saveSelectedMeetingItems: (meetingId: string, selectedEntries: any[], selectedTasks: any[]) => Promise<{ entryIds: string[]; taskIds: string[] }>
  deleteMeeting: (id: string) => Promise<void>
  deleteMeetingWithData: (meetingId: string, entryIds: string[], taskIds: string[]) => Promise<void>
  prepareMeeting: (projectId: string, title: string, participants: string[]) => Promise<string>

  // Backup
  listBackups: () => Promise<BackupInfo[]>
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

  // Smart Chat
  smartChatSend: (message: string) => Promise<SmartChatMessage>

  // Proactive Insights
  generateInsights: (forceRefresh?: boolean) => Promise<ProactiveInsight[]>
  getInsightsLastGeneratedAt: () => Promise<number | null>

  // Reports
  getReportsData: (period: ReportPeriod) => Promise<ReportsData>

  // Notifications
  getNotifications: () => Promise<AppNotification[]>
  getUnreadNotificationCount: () => Promise<number>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  dismissNotification: (id: string) => Promise<void>
  dismissAllNotifications: () => Promise<void>
  onNewNotification: (callback: (notification: AppNotification) => void) => void

  // Error Logs
  getErrorLogs: (filters?: { category?: ErrorCategory; severity?: ErrorSeverity; resolved?: boolean }) => Promise<ErrorLog[]>
  getUnresolvedErrorCount: () => Promise<number>
  resolveError: (id: string) => Promise<void>
  resolveAllErrors: () => Promise<void>
  deleteError: (id: string) => Promise<void>
  clearAllErrors: () => Promise<void>
  onErrorCountChanged: (callback: (count: number) => void) => void

  // Custom Fields (entry types, action statuses, capture templates)
  getEntryTypes: () => Promise<CustomEntryType[]>
  createEntryType: (data: Omit<CustomEntryType, 'id'>) => Promise<CustomEntryType>
  updateEntryType: (id: string, updates: Partial<Omit<CustomEntryType, 'id' | 'isDefault'>>) => Promise<CustomEntryType | null>
  deleteEntryType: (id: string) => Promise<boolean>
  reorderEntryTypes: (orderedIds: string[]) => Promise<void>
  getActionStatuses: () => Promise<CustomActionStatus[]>
  createActionStatus: (data: Omit<CustomActionStatus, 'id'>) => Promise<CustomActionStatus>
  updateActionStatus: (id: string, updates: Partial<Omit<CustomActionStatus, 'id' | 'isDefault'>>) => Promise<CustomActionStatus | null>
  deleteActionStatus: (id: string) => Promise<boolean>
  reorderActionStatuses: (orderedIds: string[]) => Promise<void>
  getCaptureTemplates: () => Promise<CustomCaptureTemplate[]>
  createCaptureTemplate: (data: Omit<CustomCaptureTemplate, 'id'>) => Promise<CustomCaptureTemplate>
  updateCaptureTemplate: (id: string, updates: Partial<Omit<CustomCaptureTemplate, 'id' | 'isDefault'>>) => Promise<CustomCaptureTemplate | null>
  deleteCaptureTemplate: (id: string) => Promise<boolean>
  reorderCaptureTemplates: (orderedIds: string[]) => Promise<void>

  // Events
  onFocusCaptureInput: (callback: () => void) => void

  // Theme
  setNativeTheme: (theme: 'dark' | 'light') => Promise<void>
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
  createMeeting: (data: { projectId: string; title: string; participants?: string[]; meetingDate?: string }) =>
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
  deleteMeetingWithData: (meetingId: string, entryIds: string[], taskIds: string[]) =>
    ipcRenderer.invoke('meeting:deleteWithData', meetingId, entryIds, taskIds),
  prepareMeeting: (projectId: string, title: string, participants: string[]) =>
    ipcRenderer.invoke('meeting:prepare', projectId, title, participants),

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

  // Smart Chat
  smartChatSend: (message: string) =>
    ipcRenderer.invoke('smart-chat:send', message),

  // Proactive Insights
  generateInsights: (forceRefresh?: boolean) =>
    ipcRenderer.invoke('insights:generate', forceRefresh),
  getInsightsLastGeneratedAt: () =>
    ipcRenderer.invoke('insights:getLastGeneratedAt'),

  // Reports
  getReportsData: (period: ReportPeriod) =>
    ipcRenderer.invoke('reports:getData', period),

  // Notifications
  getNotifications: () =>
    ipcRenderer.invoke('notification:getAll'),
  getUnreadNotificationCount: () =>
    ipcRenderer.invoke('notification:getUnreadCount'),
  markNotificationRead: (id: string) =>
    ipcRenderer.invoke('notification:markRead', id),
  markAllNotificationsRead: () =>
    ipcRenderer.invoke('notification:markAllRead'),
  dismissNotification: (id: string) =>
    ipcRenderer.invoke('notification:dismiss', id),
  dismissAllNotifications: () =>
    ipcRenderer.invoke('notification:dismissAll'),
  onNewNotification: (callback: (notification: AppNotification) => void) => {
    ipcRenderer.on('notification:new', (_event, notification) => callback(notification))
  },

  // Error Logs
  getErrorLogs: (filters?: { category?: ErrorCategory; severity?: ErrorSeverity; resolved?: boolean }) =>
    ipcRenderer.invoke('error-log:getAll', filters),
  getUnresolvedErrorCount: () =>
    ipcRenderer.invoke('error-log:getUnresolvedCount'),
  resolveError: (id: string) =>
    ipcRenderer.invoke('error-log:resolve', id),
  resolveAllErrors: () =>
    ipcRenderer.invoke('error-log:resolveAll'),
  deleteError: (id: string) =>
    ipcRenderer.invoke('error-log:delete', id),
  clearAllErrors: () =>
    ipcRenderer.invoke('error-log:clearAll'),
  onErrorCountChanged: (callback: (count: number) => void) => {
    ipcRenderer.on('error-log:countChanged', (_event, count) => callback(count))
  },

  // Custom Fields
  getEntryTypes: () =>
    ipcRenderer.invoke('custom-fields:getEntryTypes'),
  createEntryType: (data: Omit<CustomEntryType, 'id'>) =>
    ipcRenderer.invoke('custom-fields:createEntryType', data),
  updateEntryType: (id: string, updates: Partial<Omit<CustomEntryType, 'id' | 'isDefault'>>) =>
    ipcRenderer.invoke('custom-fields:updateEntryType', id, updates),
  deleteEntryType: (id: string) =>
    ipcRenderer.invoke('custom-fields:deleteEntryType', id),
  reorderEntryTypes: (orderedIds: string[]) =>
    ipcRenderer.invoke('custom-fields:reorderEntryTypes', orderedIds),
  getActionStatuses: () =>
    ipcRenderer.invoke('custom-fields:getActionStatuses'),
  createActionStatus: (data: Omit<CustomActionStatus, 'id'>) =>
    ipcRenderer.invoke('custom-fields:createActionStatus', data),
  updateActionStatus: (id: string, updates: Partial<Omit<CustomActionStatus, 'id' | 'isDefault'>>) =>
    ipcRenderer.invoke('custom-fields:updateActionStatus', id, updates),
  deleteActionStatus: (id: string) =>
    ipcRenderer.invoke('custom-fields:deleteActionStatus', id),
  reorderActionStatuses: (orderedIds: string[]) =>
    ipcRenderer.invoke('custom-fields:reorderActionStatuses', orderedIds),
  getCaptureTemplates: () =>
    ipcRenderer.invoke('custom-fields:getCaptureTemplates'),
  createCaptureTemplate: (data: Omit<CustomCaptureTemplate, 'id'>) =>
    ipcRenderer.invoke('custom-fields:createCaptureTemplate', data),
  updateCaptureTemplate: (id: string, updates: Partial<Omit<CustomCaptureTemplate, 'id' | 'isDefault'>>) =>
    ipcRenderer.invoke('custom-fields:updateCaptureTemplate', id, updates),
  deleteCaptureTemplate: (id: string) =>
    ipcRenderer.invoke('custom-fields:deleteCaptureTemplate', id),
  reorderCaptureTemplates: (orderedIds: string[]) =>
    ipcRenderer.invoke('custom-fields:reorderCaptureTemplates', orderedIds),

  // Events
  onFocusCaptureInput: (callback: () => void) => {
    ipcRenderer.on('focus-capture-input', () => callback())
  },

  // Theme
  setNativeTheme: (theme: 'dark' | 'light') =>
    ipcRenderer.invoke('theme:set', theme),
} satisfies ElectronAPI)
