// === Core Domain Types ===

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  isAutoSuggested: boolean
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

export type EntryType =
  | 'information'
  | 'decision'
  | 'request'
  | 'idea'
  | 'blocker'
  | 'update'

export type ActionStatus =
  | 'none'
  | 'action_needed'
  | 'waiting_response'
  | 'done'

export type ReviewStatus =
  | 'auto_approved'
  | 'pending'
  | 'approved'
  | 'corrected'

// === AI Response Types ===

export interface AICategorizationResult {
  project: {
    id: string | null
    suggestedName: string | null
    confidence: number
  }
  type: EntryType
  action: ActionStatus
  improvedText: string
  reasoning: string
  suggestedTask: {
    title: string
    description?: string
  } | null
}

// === Task Types ===

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
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

// === Settings ===

export interface AppSettings {
  awsRegion: string
  bedrockApiKey: string
  reviewEnabled: boolean
  modelId: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  awsRegion: 'us-east-1',
  bedrockApiKey: '',
  reviewEnabled: true,
  modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
}
