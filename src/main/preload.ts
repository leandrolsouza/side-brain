import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  // Entries
  createEntry: (rawText: string) => Promise<any>
  getEntries: (projectId?: string) => Promise<any[]>
  updateEntry: (id: string, updates: Record<string, any>) => Promise<any>
  deleteEntry: (id: string) => Promise<void>

  // Projects
  getProjects: () => Promise<any[]>
  createProject: (name: string, description?: string) => Promise<any>
  updateProject: (id: string, updates: Record<string, any>) => Promise<any>
  deleteProject: (id: string) => Promise<void>

  // Tasks
  getTasksByProject: (projectId: string) => Promise<any[]>
  getAllTasks: () => Promise<any[]>
  createTask: (data: { projectId: string; title: string; description?: string }) => Promise<any>
  updateTask: (id: string, updates: Record<string, any>) => Promise<any>
  deleteTask: (id: string) => Promise<void>

  // AI
  generateSummary: (projectId: string) => Promise<string>
  generateGlobalSummary: () => Promise<string>

  // Daily Digest
  generateDailyDigest: () => Promise<any>

  // Review
  approveEntry: (id: string) => Promise<void>
  correctEntry: (id: string, corrections: Record<string, any>) => Promise<void>

  // Settings
  getSettings: () => Promise<Record<string, any>>
  updateSettings: (settings: Record<string, any>) => Promise<void>

  // Global Search
  globalSearch: (query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }) => Promise<{ entries: any[]; tasks: any[]; projects: any[] }>

  // Events
  onFocusCaptureInput: (callback: () => void) => void
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Entries
  createEntry: (rawText: string) =>
    ipcRenderer.invoke('entry:create', rawText),
  getEntries: (projectId?: string) =>
    ipcRenderer.invoke('entry:getAll', projectId),
  updateEntry: (id: string, updates: Record<string, any>) =>
    ipcRenderer.invoke('entry:update', id, updates),
  deleteEntry: (id: string) =>
    ipcRenderer.invoke('entry:delete', id),

  // Projects
  getProjects: () =>
    ipcRenderer.invoke('project:getAll'),
  createProject: (name: string, description?: string) =>
    ipcRenderer.invoke('project:create', name, description),
  updateProject: (id: string, updates: Record<string, any>) =>
    ipcRenderer.invoke('project:update', id, updates),
  deleteProject: (id: string) =>
    ipcRenderer.invoke('project:delete', id),

  // Tasks
  getTasksByProject: (projectId: string) =>
    ipcRenderer.invoke('task:getByProject', projectId),
  getAllTasks: () =>
    ipcRenderer.invoke('task:getAll'),
  createTask: (data: { projectId: string; title: string; description?: string }) =>
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

  // Review
  approveEntry: (id: string) =>
    ipcRenderer.invoke('entry:approve', id),
  correctEntry: (id: string, corrections: Record<string, any>) =>
    ipcRenderer.invoke('entry:correct', id, corrections),

  // Settings
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Record<string, any>) =>
    ipcRenderer.invoke('settings:update', settings),

  // Global Search
  globalSearch: (query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }) =>
    ipcRenderer.invoke('search:global', query, filters),

  // Events
  onFocusCaptureInput: (callback: () => void) => {
    ipcRenderer.on('focus-capture-input', () => callback())
  },
} satisfies ElectronAPI)
