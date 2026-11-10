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
  ChatConversation,
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
  StructuredTemplate,
  CaptureSnippet,
  EntryConnection,
  ConnectedEntry,
  ConnectionType,
  PaginatedResult,
  PaginationParams,
  TaskStatus,
  EntryType,
  ActionStatus,
  AgentDefinition,
  AgentExecution,
  AgentExecutionSummary,
  AgentTemplate,
  AgentSkill,
  AgentExecutionEvent,
  AgentCreateData,
  AgentUpdateData,
  AgentTemplateOverrides,
  AgentRunResult,
  ToolDefinition,
  AgentTeam,
  TeamExecution,
  TeamExecutionSummary,
  TeamCreateData,
  TeamUpdateData,
  TeamExecutionEvent,
  MCPServerConfig,
  MCPServerStatus,
  MCPToolInfo,
} from '../shared/types'

/**
 * Structural mirror of UpdaterService's UpdateStatus (main process),
 * kept dependency-free so the renderer can consume this type.
 */
export interface UpdateStatusPayload {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  info?: { version?: string; releaseName?: string | null; releaseNotes?: unknown }
  progress?: { percent?: number; transferred?: number; total?: number; bytesPerSecond?: number }
  error?: string
}

/** Entry fields that can be updated over IPC (matches EntryRepository.update). */
export type EntryUpdateData = Partial<Pick<Entry, 'improvedText' | 'projectId' | 'type' | 'action' | 'reviewStatus'>>

/** Project fields that can be updated over IPC (matches ProjectRepository.update). */
export type ProjectUpdateData = Partial<Pick<Project, 'name' | 'description' | 'isAutoSuggested' | 'active'>>

/** Task fields that can be updated over IPC (matches TaskRepository.update). */
export type TaskUpdateData = Partial<Pick<Task, 'title' | 'description' | 'status' | 'assignee' | 'dueDate'>>

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
  previewBatchEntries: (rawText: string) => Promise<EntryPreviewResult[]>
  confirmEntry: (data: EntryConfirmRequest) => Promise<Entry & { autoSuggestedProject?: { id: string; name: string } }>
  getEntries: (projectId?: string) => Promise<Entry[]>
  getEntriesPaginated: (params: PaginationParams & { projectId?: string }) => Promise<PaginatedResult<Entry>>
  updateEntry: (id: string, updates: EntryUpdateData) => Promise<Entry | null>
  deleteEntry: (id: string) => Promise<void>
  getEntryActivityHeatmap: (weeks?: number) => Promise<{ date: string; count: number }[]>

  // Projects
  getProjects: (includeInactive?: boolean) => Promise<Project[]>
  createProject: (name: string, description?: string) => Promise<Project>
  updateProject: (id: string, updates: ProjectUpdateData) => Promise<Project | null>
  setProjectActive: (id: string, active: boolean) => Promise<Project | null>
  deleteProject: (id: string) => Promise<void>

  // Tasks
  getTasksByProject: (projectId: string) => Promise<Task[]>
  getAllTasks: () => Promise<Task[]>
  getTasksPaginated: (
    params: PaginationParams & { projectId?: string; status?: TaskStatus }
  ) => Promise<PaginatedResult<Task>>
  getTasksDueThisWeek: () => Promise<Task[]>
  getOverdueTasks: () => Promise<Task[]>
  createTask: (data: {
    projectId: string
    title: string
    description?: string
    dueDate?: string | null
  }) => Promise<Task>
  updateTask: (id: string, updates: TaskUpdateData) => Promise<Task | null>
  deleteTask: (id: string) => Promise<void>

  // AI
  generateSummary: (projectId: string) => Promise<string>
  generateGlobalSummary: () => Promise<string>

  // Daily Digest
  generateDailyDigest: () => Promise<DailyDigestData>

  // Settings
  getSettings: () => Promise<AppSettings>
  secureStorageAvailable: () => Promise<boolean>
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>
  toggleTray: (enabled: boolean) => Promise<void>

  // Global Search
  globalSearch: (
    query: string,
    filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }
  ) => Promise<{ entries: Entry[]; tasks: Task[]; projects: Project[] }>

  // Export
  exportProject: (projectId: string, format: 'markdown' | 'pdf') => Promise<{ success: boolean; filePath?: string }>

  // Meetings
  createMeeting: (data: {
    projectId: string
    title: string
    participants?: string[]
    meetingDate?: string
  }) => Promise<Meeting>
  getMeetings: (projectId?: string) => Promise<Meeting[]>
  getMeetingById: (id: string) => Promise<Meeting | null>
  getActiveMeeting: () => Promise<Meeting | null>
  addMeetingNote: (id: string, note: string) => Promise<Meeting | null>
  setMeetingTranscription: (id: string, transcription: string) => Promise<Meeting | null>
  endMeeting: (id: string) => Promise<Meeting | null>
  processMeeting: (id: string) => Promise<MeetingProcessResult | null>
  saveSelectedMeetingItems: (
    meetingId: string,
    selectedEntries: { text: string; type: EntryType; action: ActionStatus }[],
    selectedTasks: { title: string; description?: string; assignee?: string }[],
    resolvedTaskIds?: string[]
  ) => Promise<{ entryIds: string[]; taskIds: string[]; resolvedTaskIds: string[] }>
  deleteMeeting: (id: string) => Promise<void>
  deleteMeetingWithData: (meetingId: string, entryIds: string[], taskIds: string[]) => Promise<void>
  prepareMeeting: (projectId: string, title: string, participants: string[]) => Promise<string>

  // Backup
  listBackups: () => Promise<BackupInfo[]>
  createManualBackup: () => Promise<{ success: boolean; filePath?: string }>
  restoreBackup: (filePath: string) => Promise<{ success: boolean; error?: string }>
  importBackup: () => Promise<{ success: boolean; error?: string }>
  importBackupForOnboarding: () => Promise<{ success: boolean; error?: string }>
  deleteBackup: (filePath: string) => Promise<boolean>
  resetDatabase: () => Promise<{ success: boolean; archivedPath?: string; error?: string }>

  // Database Path
  getDatabasePath: () => Promise<{ currentPath: string; defaultPath: string; isCustom: boolean }>
  selectDatabaseFolder: () => Promise<string | null>
  checkDatabaseExists: (dbPath: string) => Promise<boolean>
  setDatabasePath: (newPath: string, mode: 'move' | 'new' | 'existing') => Promise<{ success: boolean; error?: string }>
  resetDatabasePath: (mode: 'move' | 'new' | 'existing') => Promise<{ success: boolean; error?: string }>

  // AI Usage
  getAIUsageSummary: (dateFrom?: string, dateTo?: string) => Promise<AIUsageSummary>
  getAIUsageDailyUsage: (dateFrom?: string, dateTo?: string) => Promise<AIUsageDailyPoint[]>
  getAIUsageHistory: (limit?: number, offset?: number) => Promise<AIUsageRecord[]>

  // Smart Chat
  smartChatSend: (message: string, conversationId?: string) => Promise<SmartChatMessage & { conversationId: string }>
  smartChatGetConversations: () => Promise<ChatConversation[]>
  smartChatGetMessages: (conversationId: string) => Promise<SmartChatMessage[]>
  smartChatCreateConversation: (title?: string) => Promise<ChatConversation>
  smartChatRenameConversation: (id: string, title: string) => Promise<void>
  smartChatDeleteConversation: (id: string) => Promise<void>
  smartChatClearAll: () => Promise<void>

  // Proactive Insights
  generateInsights: (forceRefresh?: boolean) => Promise<ProactiveInsight[]>
  getInsightsLastGeneratedAt: () => Promise<number | null>

  // Embeddings
  embeddingsGetStatus: () => Promise<{
    totalEntries: number
    indexedEntries: number
    totalTasks: number
    indexedTasks: number
    isIndexing: boolean
  }>
  embeddingsIndexAll: () => Promise<{ indexed: number; failed: number }>
  embeddingsReindexAll: () => Promise<{ indexed: number; failed: number }>
  embeddingsSupportsEmbeddings: () => Promise<boolean>

  // Reports
  getReportsData: (period: ReportPeriod) => Promise<ReportsData>
  generateReportNarrative: (period: ReportPeriod) => Promise<string>

  // Notifications
  getNotifications: () => Promise<AppNotification[]>
  getUnreadNotificationCount: () => Promise<number>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  dismissNotification: (id: string) => Promise<void>
  dismissAllNotifications: () => Promise<void>
  onNewNotification: (callback: (notification: AppNotification) => void) => void

  // Error Logs
  getErrorLogs: (filters?: {
    category?: ErrorCategory
    severity?: ErrorSeverity
    resolved?: boolean
  }) => Promise<ErrorLog[]>
  getUnresolvedErrorCount: () => Promise<number>
  resolveError: (id: string) => Promise<void>
  resolveAllErrors: () => Promise<void>
  deleteError: (id: string) => Promise<void>
  clearAllErrors: () => Promise<void>
  onErrorCountChanged: (callback: (count: number) => void) => void

  // Custom Fields (entry types, action statuses, capture templates)
  getEntryTypes: () => Promise<CustomEntryType[]>
  createEntryType: (data: Omit<CustomEntryType, 'id'>) => Promise<CustomEntryType>
  updateEntryType: (
    id: string,
    updates: Partial<Omit<CustomEntryType, 'id' | 'isDefault'>>
  ) => Promise<CustomEntryType | null>
  deleteEntryType: (id: string) => Promise<boolean>
  reorderEntryTypes: (orderedIds: string[]) => Promise<void>
  getActionStatuses: () => Promise<CustomActionStatus[]>
  createActionStatus: (data: Omit<CustomActionStatus, 'id'>) => Promise<CustomActionStatus>
  updateActionStatus: (
    id: string,
    updates: Partial<Omit<CustomActionStatus, 'id' | 'isDefault'>>
  ) => Promise<CustomActionStatus | null>
  deleteActionStatus: (id: string) => Promise<boolean>
  reorderActionStatuses: (orderedIds: string[]) => Promise<void>
  getCaptureTemplates: () => Promise<CustomCaptureTemplate[]>
  createCaptureTemplate: (data: Omit<CustomCaptureTemplate, 'id'>) => Promise<CustomCaptureTemplate>
  updateCaptureTemplate: (
    id: string,
    updates: Partial<Omit<CustomCaptureTemplate, 'id' | 'isDefault'>>
  ) => Promise<CustomCaptureTemplate | null>
  deleteCaptureTemplate: (id: string) => Promise<boolean>
  reorderCaptureTemplates: (orderedIds: string[]) => Promise<void>

  // Structured Templates
  getStructuredTemplates: () => Promise<StructuredTemplate[]>
  getStructuredTemplateById: (id: string) => Promise<StructuredTemplate | null>
  createStructuredTemplate: (
    data: Omit<StructuredTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<StructuredTemplate>
  updateStructuredTemplate: (
    id: string,
    updates: Partial<Omit<StructuredTemplate, 'id' | 'isDefault' | 'createdAt' | 'updatedAt'>>
  ) => Promise<StructuredTemplate | null>
  deleteStructuredTemplate: (id: string) => Promise<boolean>
  reorderStructuredTemplates: (orderedIds: string[]) => Promise<void>

  // Capture Snippets
  getCaptureSnippets: () => Promise<CaptureSnippet[]>
  searchCaptureSnippets: (query: string) => Promise<CaptureSnippet[]>
  createCaptureSnippet: (data: Omit<CaptureSnippet, 'id' | 'createdAt' | 'usageCount'>) => Promise<CaptureSnippet>
  updateCaptureSnippet: (
    id: string,
    updates: Partial<Omit<CaptureSnippet, 'id' | 'isDefault' | 'createdAt' | 'usageCount'>>
  ) => Promise<CaptureSnippet | null>
  deleteCaptureSnippet: (id: string) => Promise<boolean>
  incrementSnippetUsage: (id: string) => Promise<void>

  // AI Auto-fill
  autoFillTemplateFields: (templateId: string, filledFields: Record<string, string>) => Promise<Record<string, string>>

  // Events
  onFocusCaptureInput: (callback: () => void) => void

  // Connections
  createConnection: (data: {
    sourceEntryId: string
    targetEntryId: string
    connectionType: ConnectionType
    description?: string
  }) => Promise<EntryConnection>
  getConnectionsByEntry: (entryId: string) => Promise<ConnectedEntry[]>
  deleteConnection: (connectionId: string) => Promise<{ success: boolean }>
  searchEntriesForConnection: (query: string, excludeEntryId: string) => Promise<Entry[]>
  getConnectionGraphData: (filters?: {
    projectId?: string
    dateFrom?: string
    minConnections?: number
    connectionType?: string
  }) => Promise<{ entries: Entry[]; connections: EntryConnection[]; truncated: boolean }>
  discoverConnections: (projectId?: string) => Promise<{ created: number; suggestions: EntryConnection[] }>

  // Theme
  setNativeTheme: (theme: 'dark' | 'light') => Promise<void>

  // Updater
  checkForUpdates: () => Promise<UpdateStatusPayload>
  downloadUpdate: () => Promise<void>
  quitAndInstall: () => Promise<void>
  getUpdateStatus: () => Promise<UpdateStatusPayload>
  onUpdateStatusChanged: (callback: (status: UpdateStatusPayload) => void) => void

  // App Info
  getAppVersion: () => Promise<string>

  // System
  openLogsFolder: () => Promise<void>
  openUserDataFolder: () => Promise<void>

  // Agent Studio
  agentGetAll: () => Promise<AgentDefinition[]>
  agentGetById: (id: string) => Promise<AgentDefinition | null>
  agentCreate: (data: AgentCreateData) => Promise<AgentDefinition>
  agentCreateFromTemplate: (templateId: string, overrides?: AgentTemplateOverrides) => Promise<AgentDefinition>
  agentUpdate: (id: string, data: AgentUpdateData) => Promise<AgentDefinition | null>
  agentDelete: (id: string) => Promise<boolean>
  agentToggleActive: (id: string) => Promise<AgentDefinition | null>
  agentRun: (agentId: string, input: string) => Promise<AgentRunResult>
  agentCancelExecution: (executionId: string) => Promise<{ success: boolean }>
  agentGetExecutions: (agentId: string, limit?: number) => Promise<AgentExecutionSummary[]>
  agentGetRecentExecutions: (limit?: number) => Promise<AgentExecutionSummary[]>
  agentGetExecutionDetails: (executionId: string) => Promise<AgentExecution | null>
  agentGetTemplates: () => Promise<AgentTemplate[]>
  agentGetAvailableSkills: () => Promise<{ skill: AgentSkill; description: string }[]>
  agentGetToolDefinitions: () => Promise<ToolDefinition[]>
  agentCleanup: (olderThanDays?: number) => Promise<number>
  agentGenerateFromDescription: (description: string) => Promise<{
    name: string
    description: string
    persona: string
    icon: string
    color: string
    skills: string[]
    maxSteps: number
  }>
  onAgentExecutionEvent: (callback: (event: AgentExecutionEvent) => void) => void

  // Agent Teams
  teamGetAll: () => Promise<AgentTeam[]>
  teamGetById: (id: string) => Promise<AgentTeam | null>
  teamCreate: (data: TeamCreateData) => Promise<AgentTeam>
  teamUpdate: (id: string, data: TeamUpdateData) => Promise<AgentTeam | null>
  teamDelete: (id: string) => Promise<boolean>
  teamRunDiscussion: (teamId: string, input: string) => Promise<TeamExecution>
  teamGetExecutions: (teamId: string, limit?: number) => Promise<TeamExecutionSummary[]>
  teamGetRecentExecutions: (limit?: number) => Promise<TeamExecutionSummary[]>
  teamGetExecutionDetails: (executionId: string) => Promise<TeamExecution | null>
  onTeamExecutionEvent: (callback: (event: TeamExecutionEvent) => void) => void

  // MCP (Model Context Protocol)
  mcpGetServers: () => Promise<MCPServerConfig[]>
  mcpAddServer: (data: {
    name: string
    command: string
    args: string[]
    env?: Record<string, string>
    enabled: boolean
  }) => Promise<MCPServerConfig>
  mcpUpdateServer: (id: string, updates: Partial<Omit<MCPServerConfig, 'id'>>) => Promise<MCPServerConfig | null>
  mcpRemoveServer: (id: string) => Promise<boolean>
  mcpConnect: (id: string) => Promise<{ success: boolean }>
  mcpDisconnect: (id: string) => Promise<{ success: boolean }>
  mcpConnectAll: () => Promise<{ success: boolean }>
  mcpGetStatuses: () => Promise<MCPServerStatus[]>
  mcpGetTools: () => Promise<MCPToolInfo[]>
  onMCPStatusChanged: (callback: (event: MCPServerStatus) => void) => void
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Workspaces
  getWorkspaces: () => ipcRenderer.invoke('workspace:list'),
  getActiveWorkspace: () => ipcRenderer.invoke('workspace:getActive'),
  createWorkspace: (data: { name: string; emoji: string; databasePath: string }) =>
    ipcRenderer.invoke('workspace:create', data),
  updateWorkspace: (id: string, updates: { name?: string; emoji?: string }) =>
    ipcRenderer.invoke('workspace:update', id, updates),
  deleteWorkspace: (id: string) => ipcRenderer.invoke('workspace:delete', id),
  switchWorkspace: (workspaceId: string) => ipcRenderer.invoke('workspace:switch', workspaceId),
  selectWorkspaceFolder: () => ipcRenderer.invoke('workspace:selectFolder'),

  // Entries
  createEntry: (rawText: string) => ipcRenderer.invoke('entry:create', rawText),
  previewEntry: (rawText: string, projectIdHint?: string) =>
    ipcRenderer.invoke('entry:preview', rawText, projectIdHint),
  previewBatchEntries: (rawText: string) => ipcRenderer.invoke('entry:previewBatch', rawText),
  confirmEntry: (data: EntryConfirmRequest) => ipcRenderer.invoke('entry:confirm', data),
  getEntries: (projectId?: string) => ipcRenderer.invoke('entry:getAll', projectId),
  getEntriesPaginated: (params: PaginationParams & { projectId?: string }) =>
    ipcRenderer.invoke('entry:getPaginated', params),
  updateEntry: (id: string, updates: EntryUpdateData) => ipcRenderer.invoke('entry:update', id, updates),
  deleteEntry: (id: string) => ipcRenderer.invoke('entry:delete', id),
  getEntryActivityHeatmap: (weeks?: number) => ipcRenderer.invoke('entry:getActivityHeatmap', weeks),

  // Projects
  getProjects: (includeInactive?: boolean) => ipcRenderer.invoke('project:getAll', includeInactive),
  createProject: (name: string, description?: string) => ipcRenderer.invoke('project:create', name, description),
  updateProject: (id: string, updates: ProjectUpdateData) => ipcRenderer.invoke('project:update', id, updates),
  setProjectActive: (id: string, active: boolean) => ipcRenderer.invoke('project:setActive', id, active),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),

  // Tasks
  getTasksByProject: (projectId: string) => ipcRenderer.invoke('task:getByProject', projectId),
  getAllTasks: () => ipcRenderer.invoke('task:getAll'),
  getTasksPaginated: (params: PaginationParams & { projectId?: string; status?: TaskStatus }) =>
    ipcRenderer.invoke('task:getPaginated', params),
  getTasksDueThisWeek: () => ipcRenderer.invoke('task:getDueThisWeek'),
  getOverdueTasks: () => ipcRenderer.invoke('task:getOverdue'),
  createTask: (data: { projectId: string; title: string; description?: string; dueDate?: string | null }) =>
    ipcRenderer.invoke('task:create', data),
  updateTask: (id: string, updates: TaskUpdateData) => ipcRenderer.invoke('task:update', id, updates),
  deleteTask: (id: string) => ipcRenderer.invoke('task:delete', id),

  // AI
  generateSummary: (projectId: string) => ipcRenderer.invoke('ai:generateSummary', projectId),
  generateGlobalSummary: () => ipcRenderer.invoke('ai:generateGlobalSummary'),

  // Daily Digest
  generateDailyDigest: () => ipcRenderer.invoke('digest:generate'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  secureStorageAvailable: () => ipcRenderer.invoke('settings:secureStorageAvailable'),
  updateSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', settings),
  toggleTray: (enabled: boolean) => ipcRenderer.invoke('tray:toggle', enabled),

  // Global Search
  globalSearch: (query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }) =>
    ipcRenderer.invoke('search:global', query, filters),

  // Export
  exportProject: (projectId: string, format: 'markdown' | 'pdf') =>
    ipcRenderer.invoke('export:project', projectId, format),

  // Meetings
  createMeeting: (data: { projectId: string; title: string; participants?: string[]; meetingDate?: string }) =>
    ipcRenderer.invoke('meeting:create', data),
  getMeetings: (projectId?: string) => ipcRenderer.invoke('meeting:getAll', projectId),
  getMeetingById: (id: string) => ipcRenderer.invoke('meeting:getById', id),
  getActiveMeeting: () => ipcRenderer.invoke('meeting:getActive'),
  addMeetingNote: (id: string, note: string) => ipcRenderer.invoke('meeting:addNote', id, note),
  setMeetingTranscription: (id: string, transcription: string) =>
    ipcRenderer.invoke('meeting:setTranscription', id, transcription),
  endMeeting: (id: string) => ipcRenderer.invoke('meeting:end', id),
  processMeeting: (id: string) => ipcRenderer.invoke('meeting:process', id),
  saveSelectedMeetingItems: (
    meetingId: string,
    selectedEntries: { text: string; type: EntryType; action: ActionStatus }[],
    selectedTasks: { title: string; description?: string; assignee?: string }[],
    resolvedTaskIds?: string[]
  ) => ipcRenderer.invoke('meeting:saveSelected', meetingId, selectedEntries, selectedTasks, resolvedTaskIds),
  deleteMeeting: (id: string) => ipcRenderer.invoke('meeting:delete', id),
  deleteMeetingWithData: (meetingId: string, entryIds: string[], taskIds: string[]) =>
    ipcRenderer.invoke('meeting:deleteWithData', meetingId, entryIds, taskIds),
  prepareMeeting: (projectId: string, title: string, participants: string[]) =>
    ipcRenderer.invoke('meeting:prepare', projectId, title, participants),

  // Backup
  listBackups: () => ipcRenderer.invoke('backup:list'),
  createManualBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  importBackupForOnboarding: () => ipcRenderer.invoke('backup:importForOnboarding'),
  deleteBackup: (filePath: string) => ipcRenderer.invoke('backup:delete', filePath),
  resetDatabase: () => ipcRenderer.invoke('database:reset'),

  // Database Path
  getDatabasePath: () => ipcRenderer.invoke('database:getPath'),
  selectDatabaseFolder: () => ipcRenderer.invoke('database:selectFolder'),
  checkDatabaseExists: (dbPath: string) => ipcRenderer.invoke('database:checkExists', dbPath),
  setDatabasePath: (newPath: string, mode: 'move' | 'new' | 'existing') =>
    ipcRenderer.invoke('database:setPath', newPath, mode),
  resetDatabasePath: (mode: 'move' | 'new' | 'existing') => ipcRenderer.invoke('database:resetPath', mode),

  // AI Usage
  getAIUsageSummary: (dateFrom?: string, dateTo?: string) =>
    ipcRenderer.invoke('ai-usage:getSummary', dateFrom, dateTo),
  getAIUsageDailyUsage: (dateFrom?: string, dateTo?: string) =>
    ipcRenderer.invoke('ai-usage:getDailyUsage', dateFrom, dateTo),
  getAIUsageHistory: (limit?: number, offset?: number) => ipcRenderer.invoke('ai-usage:getHistory', limit, offset),

  // Smart Chat
  smartChatSend: (message: string, conversationId?: string) =>
    ipcRenderer.invoke('smart-chat:send', message, conversationId),
  smartChatGetConversations: () => ipcRenderer.invoke('smart-chat:getConversations'),
  smartChatGetMessages: (conversationId: string) => ipcRenderer.invoke('smart-chat:getMessages', conversationId),
  smartChatCreateConversation: (title?: string) => ipcRenderer.invoke('smart-chat:createConversation', title),
  smartChatRenameConversation: (id: string, title: string) =>
    ipcRenderer.invoke('smart-chat:renameConversation', id, title),
  smartChatDeleteConversation: (id: string) => ipcRenderer.invoke('smart-chat:deleteConversation', id),
  smartChatClearAll: () => ipcRenderer.invoke('smart-chat:clearAll'),

  // Proactive Insights
  generateInsights: (forceRefresh?: boolean) => ipcRenderer.invoke('insights:generate', forceRefresh),
  getInsightsLastGeneratedAt: () => ipcRenderer.invoke('insights:getLastGeneratedAt'),

  // Embeddings
  embeddingsGetStatus: () => ipcRenderer.invoke('embeddings:getStatus'),
  embeddingsIndexAll: () => ipcRenderer.invoke('embeddings:indexAll'),
  embeddingsReindexAll: () => ipcRenderer.invoke('embeddings:reindexAll'),
  embeddingsSupportsEmbeddings: () => ipcRenderer.invoke('embeddings:supportsEmbeddings'),

  // Reports
  getReportsData: (period: ReportPeriod) => ipcRenderer.invoke('reports:getData', period),
  generateReportNarrative: (period: ReportPeriod) => ipcRenderer.invoke('reports:generateNarrative', period),

  // Notifications
  getNotifications: () => ipcRenderer.invoke('notification:getAll'),
  getUnreadNotificationCount: () => ipcRenderer.invoke('notification:getUnreadCount'),
  markNotificationRead: (id: string) => ipcRenderer.invoke('notification:markRead', id),
  markAllNotificationsRead: () => ipcRenderer.invoke('notification:markAllRead'),
  dismissNotification: (id: string) => ipcRenderer.invoke('notification:dismiss', id),
  dismissAllNotifications: () => ipcRenderer.invoke('notification:dismissAll'),
  onNewNotification: (callback: (notification: AppNotification) => void) => {
    ipcRenderer.on('notification:new', (_event: Electron.IpcRendererEvent, notification: AppNotification) =>
      callback(notification)
    )
  },

  // Error Logs
  getErrorLogs: (filters?: { category?: ErrorCategory; severity?: ErrorSeverity; resolved?: boolean }) =>
    ipcRenderer.invoke('error-log:getAll', filters),
  getUnresolvedErrorCount: () => ipcRenderer.invoke('error-log:getUnresolvedCount'),
  resolveError: (id: string) => ipcRenderer.invoke('error-log:resolve', id),
  resolveAllErrors: () => ipcRenderer.invoke('error-log:resolveAll'),
  deleteError: (id: string) => ipcRenderer.invoke('error-log:delete', id),
  clearAllErrors: () => ipcRenderer.invoke('error-log:clearAll'),
  onErrorCountChanged: (callback: (count: number) => void) => {
    ipcRenderer.on('error-log:countChanged', (_event: Electron.IpcRendererEvent, count: number) => callback(count))
  },

  // Custom Fields
  getEntryTypes: () => ipcRenderer.invoke('custom-fields:getEntryTypes'),
  createEntryType: (data: Omit<CustomEntryType, 'id'>) => ipcRenderer.invoke('custom-fields:createEntryType', data),
  updateEntryType: (id: string, updates: Partial<Omit<CustomEntryType, 'id' | 'isDefault'>>) =>
    ipcRenderer.invoke('custom-fields:updateEntryType', id, updates),
  deleteEntryType: (id: string) => ipcRenderer.invoke('custom-fields:deleteEntryType', id),
  reorderEntryTypes: (orderedIds: string[]) => ipcRenderer.invoke('custom-fields:reorderEntryTypes', orderedIds),
  getActionStatuses: () => ipcRenderer.invoke('custom-fields:getActionStatuses'),
  createActionStatus: (data: Omit<CustomActionStatus, 'id'>) =>
    ipcRenderer.invoke('custom-fields:createActionStatus', data),
  updateActionStatus: (id: string, updates: Partial<Omit<CustomActionStatus, 'id' | 'isDefault'>>) =>
    ipcRenderer.invoke('custom-fields:updateActionStatus', id, updates),
  deleteActionStatus: (id: string) => ipcRenderer.invoke('custom-fields:deleteActionStatus', id),
  reorderActionStatuses: (orderedIds: string[]) =>
    ipcRenderer.invoke('custom-fields:reorderActionStatuses', orderedIds),
  getCaptureTemplates: () => ipcRenderer.invoke('custom-fields:getCaptureTemplates'),
  createCaptureTemplate: (data: Omit<CustomCaptureTemplate, 'id'>) =>
    ipcRenderer.invoke('custom-fields:createCaptureTemplate', data),
  updateCaptureTemplate: (id: string, updates: Partial<Omit<CustomCaptureTemplate, 'id' | 'isDefault'>>) =>
    ipcRenderer.invoke('custom-fields:updateCaptureTemplate', id, updates),
  deleteCaptureTemplate: (id: string) => ipcRenderer.invoke('custom-fields:deleteCaptureTemplate', id),
  reorderCaptureTemplates: (orderedIds: string[]) =>
    ipcRenderer.invoke('custom-fields:reorderCaptureTemplates', orderedIds),

  // Structured Templates
  getStructuredTemplates: () => ipcRenderer.invoke('custom-fields:getStructuredTemplates'),
  getStructuredTemplateById: (id: string) => ipcRenderer.invoke('custom-fields:getStructuredTemplateById', id),
  createStructuredTemplate: (data: Omit<StructuredTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
    ipcRenderer.invoke('custom-fields:createStructuredTemplate', data),
  updateStructuredTemplate: (
    id: string,
    updates: Partial<Omit<StructuredTemplate, 'id' | 'isDefault' | 'createdAt' | 'updatedAt'>>
  ) => ipcRenderer.invoke('custom-fields:updateStructuredTemplate', id, updates),
  deleteStructuredTemplate: (id: string) => ipcRenderer.invoke('custom-fields:deleteStructuredTemplate', id),
  reorderStructuredTemplates: (orderedIds: string[]) =>
    ipcRenderer.invoke('custom-fields:reorderStructuredTemplates', orderedIds),

  // Capture Snippets
  getCaptureSnippets: () => ipcRenderer.invoke('custom-fields:getCaptureSnippets'),
  searchCaptureSnippets: (query: string) => ipcRenderer.invoke('custom-fields:searchCaptureSnippets', query),
  createCaptureSnippet: (data: Omit<CaptureSnippet, 'id' | 'createdAt' | 'usageCount'>) =>
    ipcRenderer.invoke('custom-fields:createCaptureSnippet', data),
  updateCaptureSnippet: (
    id: string,
    updates: Partial<Omit<CaptureSnippet, 'id' | 'isDefault' | 'createdAt' | 'usageCount'>>
  ) => ipcRenderer.invoke('custom-fields:updateCaptureSnippet', id, updates),
  deleteCaptureSnippet: (id: string) => ipcRenderer.invoke('custom-fields:deleteCaptureSnippet', id),
  incrementSnippetUsage: (id: string) => ipcRenderer.invoke('custom-fields:incrementSnippetUsage', id),

  // AI Auto-fill
  autoFillTemplateFields: (templateId: string, filledFields: Record<string, string>) =>
    ipcRenderer.invoke('custom-fields:autoFillTemplateFields', templateId, filledFields),

  // Events
  onFocusCaptureInput: (callback: () => void) => {
    ipcRenderer.on('focus-capture-input', () => callback())
  },

  // Connections
  createConnection: (data: {
    sourceEntryId: string
    targetEntryId: string
    connectionType: ConnectionType
    description?: string
  }) => ipcRenderer.invoke('connection:create', data),
  getConnectionsByEntry: (entryId: string) => ipcRenderer.invoke('connection:getByEntry', entryId),
  deleteConnection: (connectionId: string) => ipcRenderer.invoke('connection:delete', connectionId),
  searchEntriesForConnection: (query: string, excludeEntryId: string) =>
    ipcRenderer.invoke('connection:searchEntries', query, excludeEntryId),
  getConnectionGraphData: (filters?: {
    projectId?: string
    dateFrom?: string
    minConnections?: number
    connectionType?: string
  }) => ipcRenderer.invoke('connection:getGraphData', filters),
  discoverConnections: (projectId?: string) => ipcRenderer.invoke('connection:discover', projectId),

  // Theme
  setNativeTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke('theme:set', theme),

  // Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
  downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
  getUpdateStatus: () => ipcRenderer.invoke('updater:getStatus'),
  onUpdateStatusChanged: (callback: (status: UpdateStatusPayload) => void) => {
    ipcRenderer.on('updater:status-changed', (_event: Electron.IpcRendererEvent, status: UpdateStatusPayload) =>
      callback(status)
    )
  },

  // App Info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // System
  openLogsFolder: () => ipcRenderer.invoke('system:openLogsFolder'),
  openUserDataFolder: () => ipcRenderer.invoke('system:openUserDataFolder'),

  // Agent Studio
  agentGetAll: () => ipcRenderer.invoke('agent:getAll'),
  agentGetById: (id: string) => ipcRenderer.invoke('agent:getById', id),
  agentCreate: (data: AgentCreateData) => ipcRenderer.invoke('agent:create', data),
  agentCreateFromTemplate: (templateId: string, overrides?: AgentTemplateOverrides) =>
    ipcRenderer.invoke('agent:createFromTemplate', templateId, overrides),
  agentUpdate: (id: string, data: AgentUpdateData) => ipcRenderer.invoke('agent:update', id, data),
  agentDelete: (id: string) => ipcRenderer.invoke('agent:delete', id),
  agentToggleActive: (id: string) => ipcRenderer.invoke('agent:toggleActive', id),
  agentRun: (agentId: string, input: string) => ipcRenderer.invoke('agent:run', agentId, input),
  agentCancelExecution: (executionId: string) => ipcRenderer.invoke('agent:cancelExecution', executionId),
  agentGetExecutions: (agentId: string, limit?: number) => ipcRenderer.invoke('agent:getExecutions', agentId, limit),
  agentGetRecentExecutions: (limit?: number) => ipcRenderer.invoke('agent:getRecentExecutions', limit),
  agentGetExecutionDetails: (executionId: string) => ipcRenderer.invoke('agent:getExecutionDetails', executionId),
  agentGetTemplates: () => ipcRenderer.invoke('agent:getTemplates'),
  agentGetAvailableSkills: () => ipcRenderer.invoke('agent:getAvailableSkills'),
  agentGetToolDefinitions: () => ipcRenderer.invoke('agent:getToolDefinitions'),
  agentCleanup: (olderThanDays?: number) => ipcRenderer.invoke('agent:cleanup', olderThanDays),
  agentGenerateFromDescription: (description: string) =>
    ipcRenderer.invoke('agent:generateFromDescription', description),
  onAgentExecutionEvent: (callback: (event: AgentExecutionEvent) => void) =>
    ipcRenderer.on('agent:execution-event', (_event: Electron.IpcRendererEvent, data: AgentExecutionEvent) =>
      callback(data)
    ),

  // Agent Teams
  teamGetAll: () => ipcRenderer.invoke('team:getAll'),
  teamGetById: (id: string) => ipcRenderer.invoke('team:getById', id),
  teamCreate: (data: TeamCreateData) => ipcRenderer.invoke('team:create', data),
  teamUpdate: (id: string, data: TeamUpdateData) => ipcRenderer.invoke('team:update', id, data),
  teamDelete: (id: string) => ipcRenderer.invoke('team:delete', id),
  teamRunDiscussion: (teamId: string, input: string) => ipcRenderer.invoke('team:runDiscussion', teamId, input),
  teamGetExecutions: (teamId: string, limit?: number) => ipcRenderer.invoke('team:getExecutions', teamId, limit),
  teamGetRecentExecutions: (limit?: number) => ipcRenderer.invoke('team:getRecentExecutions', limit),
  teamGetExecutionDetails: (executionId: string) => ipcRenderer.invoke('team:getExecutionDetails', executionId),
  onTeamExecutionEvent: (callback: (event: TeamExecutionEvent) => void) =>
    ipcRenderer.on('team:execution-event', (_event: Electron.IpcRendererEvent, data: TeamExecutionEvent) =>
      callback(data)
    ),

  // MCP (Model Context Protocol)
  mcpGetServers: () => ipcRenderer.invoke('mcp:getServers'),
  mcpAddServer: (data: {
    name: string
    command: string
    args: string[]
    env?: Record<string, string>
    enabled: boolean
  }) => ipcRenderer.invoke('mcp:addServer', data),
  mcpUpdateServer: (id: string, updates: Partial<Omit<MCPServerConfig, 'id'>>) =>
    ipcRenderer.invoke('mcp:updateServer', id, updates),
  mcpRemoveServer: (id: string) => ipcRenderer.invoke('mcp:removeServer', id),
  mcpConnect: (id: string) => ipcRenderer.invoke('mcp:connect', id),
  mcpDisconnect: (id: string) => ipcRenderer.invoke('mcp:disconnect', id),
  mcpConnectAll: () => ipcRenderer.invoke('mcp:connectAll'),
  mcpGetStatuses: () => ipcRenderer.invoke('mcp:getStatuses'),
  mcpGetTools: () => ipcRenderer.invoke('mcp:getTools'),
  onMCPStatusChanged: (callback: (event: MCPServerStatus) => void) =>
    ipcRenderer.on('mcp:status-changed', (_event: Electron.IpcRendererEvent, data: MCPServerStatus) => callback(data)),
} satisfies ElectronAPI)
