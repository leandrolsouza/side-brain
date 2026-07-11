import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { initI18n } from '../../src/renderer/i18n'

// Initialize i18n for tests with pt-BR locale
initI18n('pt-BR')

/**
 * Mock global window.electronAPI used by all renderer components.
 * Each test can override specific methods via vi.mocked().
 */
const mockElectronAPI = {
  // Entries
  createEntry: vi.fn().mockResolvedValue({}),
  previewEntry: vi.fn().mockResolvedValue({
    rawText: '',
    improvedText: '',
    project: { id: null, suggestedName: null, confidence: 0 },
    type: 'information',
    action: 'none',
    reasoning: '',
    suggestedTask: null,
  }),
  confirmEntry: vi.fn().mockResolvedValue({}),
  getEntries: vi.fn().mockResolvedValue([]),
  updateEntry: vi.fn().mockResolvedValue(null),
  deleteEntry: vi.fn().mockResolvedValue(undefined),
  getEntryActivityHeatmap: vi.fn().mockResolvedValue([]),

  // Projects
  getProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn().mockResolvedValue({}),
  updateProject: vi.fn().mockResolvedValue(null),
  setProjectActive: vi.fn().mockResolvedValue(null),
  deleteProject: vi.fn().mockResolvedValue(undefined),

  // Tasks
  getTasksByProject: vi.fn().mockResolvedValue([]),
  getAllTasks: vi.fn().mockResolvedValue([]),
  getTasksDueThisWeek: vi.fn().mockResolvedValue([]),
  getOverdueTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockResolvedValue({}),
  updateTask: vi.fn().mockResolvedValue(null),
  deleteTask: vi.fn().mockResolvedValue(undefined),

  // AI
  generateSummary: vi.fn().mockResolvedValue(''),
  generateGlobalSummary: vi.fn().mockResolvedValue(''),

  // Daily Digest
  generateDailyDigest: vi.fn().mockResolvedValue({
    greeting: 'Bom dia!',
    tasksNeedingAttention: { overdue: [], inProgress: [], waiting: [] },
    yesterdayActivity: { entriesCreated: [], tasksCompleted: [], tasksCreated: [] },
    aiSuggestion: null,
    generatedAt: new Date().toISOString(),
  }),

  // Settings
  getSettings: vi.fn().mockResolvedValue({}),
  updateSettings: vi.fn().mockResolvedValue(undefined),

  // Global Search
  globalSearch: vi.fn().mockResolvedValue({ entries: [], tasks: [], projects: [] }),

  // Custom Fields
  getEntryTypes: vi.fn().mockResolvedValue([]),
  getActionStatuses: vi.fn().mockResolvedValue([]),
  getCaptureTemplates: vi.fn().mockResolvedValue([]),
  createEntryType: vi.fn().mockResolvedValue({}),
  updateEntryType: vi.fn().mockResolvedValue(null),
  deleteEntryType: vi.fn().mockResolvedValue(false),
  reorderEntryTypes: vi.fn().mockResolvedValue(undefined),
  createActionStatus: vi.fn().mockResolvedValue({}),
  updateActionStatus: vi.fn().mockResolvedValue(null),
  deleteActionStatus: vi.fn().mockResolvedValue(false),
  reorderActionStatuses: vi.fn().mockResolvedValue(undefined),
  createCaptureTemplate: vi.fn().mockResolvedValue({}),
  updateCaptureTemplate: vi.fn().mockResolvedValue(null),
  deleteCaptureTemplate: vi.fn().mockResolvedValue(false),
  reorderCaptureTemplates: vi.fn().mockResolvedValue(undefined),

  // Meetings
  createMeeting: vi.fn().mockResolvedValue({}),
  getMeetings: vi.fn().mockResolvedValue([]),
  getMeetingById: vi.fn().mockResolvedValue(null),
  getActiveMeeting: vi.fn().mockResolvedValue(null),
  addMeetingNote: vi.fn().mockResolvedValue(null),
  endMeeting: vi.fn().mockResolvedValue(null),
  processMeeting: vi.fn().mockResolvedValue(null),
  deleteMeeting: vi.fn().mockResolvedValue(undefined),

  // Notifications
  getNotifications: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  dismissNotification: vi.fn().mockResolvedValue(undefined),
  dismissAllNotifications: vi.fn().mockResolvedValue(undefined),
  onNewNotification: vi.fn(),

  // Error Logs
  getErrorLogs: vi.fn().mockResolvedValue([]),
  getUnresolvedErrorCount: vi.fn().mockResolvedValue(0),
  resolveError: vi.fn().mockResolvedValue(undefined),
  resolveAllErrors: vi.fn().mockResolvedValue(undefined),
  deleteError: vi.fn().mockResolvedValue(undefined),
  clearAllErrors: vi.fn().mockResolvedValue(undefined),
  onErrorCountChanged: vi.fn(),

  // Export
  exportProject: vi.fn().mockResolvedValue({ success: true }),

  // Connections
  createConnection: vi.fn().mockResolvedValue({}),
  getConnectionsByEntry: vi.fn().mockResolvedValue([]),
  deleteConnection: vi.fn().mockResolvedValue({ success: true }),
  searchEntriesForConnection: vi.fn().mockResolvedValue([]),
  getConnectionGraphData: vi.fn().mockResolvedValue({ entries: [], connections: [], truncated: false }),
  discoverConnections: vi.fn().mockResolvedValue({ created: 0, suggestions: [] }),

  // Reports
  getReportsData: vi.fn().mockResolvedValue({}),

  // AI Usage
  getAIUsageSummary: vi.fn().mockResolvedValue({ totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, totalEstimatedCost: 0, byOperation: [] }),
  getAIUsageDailyUsage: vi.fn().mockResolvedValue([]),
  getAIUsageHistory: vi.fn().mockResolvedValue([]),

  // Smart Chat
  smartChatSend: vi.fn().mockResolvedValue({ id: '1', role: 'assistant', content: '', createdAt: '' }),

  // Insights
  generateInsights: vi.fn().mockResolvedValue([]),
  getInsightsLastGeneratedAt: vi.fn().mockResolvedValue(null),

  // Backup
  listBackups: vi.fn().mockResolvedValue([]),
  createManualBackup: vi.fn().mockResolvedValue({ success: true }),

  // Events
  onFocusCaptureInput: vi.fn(),

  // Theme
  setNativeTheme: vi.fn().mockResolvedValue(undefined),

  // Updater
  checkForUpdates: vi.fn().mockResolvedValue(null),
  getUpdateStatus: vi.fn().mockResolvedValue(null),
  onUpdateStatusChanged: vi.fn(),

  // App info
  getAppVersion: vi.fn().mockResolvedValue('0.0.0-test'),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
