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

export type EntryType =
  | 'information'
  | 'decision'
  | 'demand'
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

// === Entry Preview Types ===

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

// === Task Types ===

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
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

// === Backup ===

export interface BackupInfo {
  filename: string
  filePath: string
  createdAt: string
  sizeBytes: number
}

// === Settings ===

export type AIProvider = 'bedrock' | 'local'

export interface AppSettings {
  aiProvider: AIProvider
  // Bedrock settings
  awsRegion: string
  bedrockApiKey: string
  modelId: string
  aiPriceInputPer1k: string
  aiPriceOutputPer1k: string
  // Local LLM settings (OpenAI-compatible, e.g. LM Studio)
  localEndpoint: string
  localModelId: string
  localApiKey: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'bedrock',
  awsRegion: 'us-east-1',
  bedrockApiKey: '',
  modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  aiPriceInputPer1k: '0.003',
  aiPriceOutputPer1k: '0.015',
  localEndpoint: 'http://localhost:1234',
  localModelId: '',
  localApiKey: '',
}

// === Meeting Types ===

export interface Meeting {
  id: string
  projectId: string
  title: string
  participants: string[]
  startedAt: string
  endedAt: string | null
  status: MeetingStatus
  rawNotes: string[]
  pastedTranscription: string | null
  generatedMinutes: string | null
  createdAt: string
}

export type MeetingStatus = 'active' | 'ended' | 'processed'

export interface MeetingProcessResult {
  minutes: string
  entries: {
    text: string
    type: EntryType
    action: ActionStatus
  }[]
  tasks: {
    title: string
    description?: string
  }[]
}

// === AI Usage Types ===

export type AIOperationType =
  | 'categorization'
  | 'summary'
  | 'global_summary'
  | 'digest'
  | 'meeting_processing'
  | 'smart_chat'
  | 'insights'

export interface AIUsageRecord {
  id: string
  operationType: AIOperationType
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  latencyMs: number
  createdAt: string
}

export interface AIUsageSummary {
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  totalEstimatedCost: number
  byOperation: {
    operationType: AIOperationType
    calls: number
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }[]
}

export interface AIUsageDailyPoint {
  date: string
  calls: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number
}

// === Capture Templates ===

export interface CaptureTemplate {
  id: string
  label: string
  prefix: string
  placeholder: string
  icon: string
  hintType: EntryType
}

export const CAPTURE_TEMPLATES: CaptureTemplate[] = [
  {
    id: 'meeting',
    label: 'Reunião',
    prefix: 'Reunião com ',
    placeholder: '[pessoa/equipe]: [o que foi discutido/decidido]',
    icon: 'Users',
    hintType: 'information',
  },
  {
    id: 'decision',
    label: 'Decisão',
    prefix: 'Decisão sobre ',
    placeholder: '[assunto]: [o que foi decidido e por quê]',
    icon: 'Gavel',
    hintType: 'decision',
  },
  {
    id: 'blocker',
    label: 'Bloqueio',
    prefix: 'Bloqueio em ',
    placeholder: '[projeto/tarefa]: [descrição do impedimento]',
    icon: 'AlertTriangle',
    hintType: 'blocker',
  },
  {
    id: 'demand',
    label: 'Demanda',
    prefix: 'Demanda de ',
    placeholder: '[pessoa/área]: [o que foi solicitado e prazo]',
    icon: 'MessageSquare',
    hintType: 'demand',
  },
  {
    id: 'idea',
    label: 'Ideia',
    prefix: 'Ideia: ',
    placeholder: '[descrição da ideia ou sugestão]',
    icon: 'Lightbulb',
    hintType: 'idea',
  },
  {
    id: 'update',
    label: 'Atualização',
    prefix: 'Atualização: ',
    placeholder: '[o que mudou ou progresso feito]',
    icon: 'RefreshCw',
    hintType: 'update',
  },
]

// === Smart Chat Types ===

export interface SmartChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SmartChatSource[]
  createdAt: string
}

export interface SmartChatSource {
  type: 'entry' | 'task' | 'project'
  id: string
  label: string
  projectName?: string
}

// === Proactive Insights Types ===

export interface ProactiveInsight {
  id: string
  type: 'stale_tasks' | 'recurring_blockers' | 'no_deadline' | 'idle_project' | 'overloaded' | 'suggestion'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  relatedProjectId?: string
  relatedProjectName?: string
}
