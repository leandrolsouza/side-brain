// === Workspace Types ===

export interface Workspace {
  id: string
  name: string
  emoji: string
  databasePath: string
  createdAt: string
}

export interface WorkspaceConfig {
  activeWorkspaceId: string
  workspaces: Workspace[]
}

// === Core Domain Types ===

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  isAutoSuggested: boolean
  active: boolean
}

export interface Entry {
  id: string
  rawText: string
  improvedText: string
  projectId: string
  type: EntryType
  action: ActionStatus
  reviewStatus: ReviewStatus
  createdAt: string
}

export type EntryType = string

export type ActionStatus = string

export type ReviewStatus =
  | 'auto_approved'
  | 'approved'
  | 'corrected'

// === Task Types ===

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  assignee?: string | null
  dueDate?: string | null
  sourceEntryId?: string
  createdAt: string
  updatedAt: string
}

export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'done'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'A Fazer',
  in_progress: 'Em Andamento',
  waiting: 'Aguardando',
  done: 'Concluído',
}

// === Meeting Types ===

export interface Meeting {
  id: string
  projectId: string
  title: string
  participants: string[]
  meetingDate: string
  startedAt: string
  endedAt: string | null
  status: MeetingStatus
  rawNotes: string[]
  pastedTranscription: string | null
  generatedMinutes: string | null
  createdAt: string
}

export type MeetingStatus = 'active' | 'ended' | 'processed'

// === Entry Preview/Confirm Types ===

export interface EntryPreviewRequest {
  rawText: string
  projectIdHint?: string // optional pre-selected project from the user
}

export interface EntryPreviewResult {
  rawText: string
  improvedText: string
  project: {
    id: string | null
    suggestedName: string | null
    confidence: number
  }
  type: EntryType
  action: ActionStatus
  reasoning: string
  suggestedTask: {
    title: string
    description?: string
  } | null
}

export interface EntryConfirmRequest {
  rawText: string
  improvedText: string
  projectId: string | null
  newProjectName: string | null // if creating a new project
  type: EntryType
  action: ActionStatus
  suggestedTask: {
    title: string
    description?: string
  } | null
}

// === Daily Digest Types ===

export interface DailyDigestData {
  greeting: string
  tasksNeedingAttention: {
    overdue: Task[]
    inProgress: Task[]
    waiting: Task[]
  }
  yesterdayActivity: {
    entriesCreated: Entry[]
    tasksCompleted: Task[]
    tasksCreated: Task[]
  }
  aiSuggestion: string | null
  generatedAt: string
}

// === Entry Connection Types ===

export type ConnectionType = 'related' | 'follows_up' | 'contradicts' | 'depends_on' | 'evolves'

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  related: 'Relacionado',
  follows_up: 'Continuação de',
  contradicts: 'Contradiz',
  depends_on: 'Depende de',
  evolves: 'Evolui',
}

export interface EntryConnection {
  id: string
  sourceEntryId: string
  targetEntryId: string
  connectionType: ConnectionType
  description?: string
  isAiSuggested: boolean
  createdAt: string
}

export interface ConnectedEntry {
  connection: EntryConnection
  entry: Entry
}

// === Backup ===

export interface BackupInfo {
  filename: string
  filePath: string
  createdAt: string
  sizeBytes: number
}
