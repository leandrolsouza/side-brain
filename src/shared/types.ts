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

// === Custom Fields Types (user-configurable) ===

export interface CustomEntryType {
  id: string
  key: string        // machine-readable identifier (e.g. 'information', 'decision')
  label: string      // display name (e.g. 'Informação', 'Decisão')
  icon: string       // lucide icon name (e.g. 'Info', 'Gavel')
  color: string      // badge color variant (e.g. 'info', 'warning', 'error', 'success', 'neutral')
  isDefault: boolean // built-in types that can't be deleted
  sortOrder: number
  allowsAction: boolean // whether entries of this type can have actions (or always 'none')
}

export interface CustomActionStatus {
  id: string
  key: string        // machine-readable identifier (e.g. 'none', 'action_needed')
  label: string      // display name (e.g. 'Sem ação', 'Ação necessária')
  icon: string       // lucide icon name
  color: string      // badge color variant
  isDefault: boolean
  isFinal: boolean   // whether this status means "done" / completed
  sortOrder: number
}

export interface CustomCaptureTemplate {
  id: string
  label: string
  prefix: string
  placeholder: string
  icon: string       // lucide icon name
  hintType: string   // links to a CustomEntryType key
  isDefault: boolean
  sortOrder: number
}

// Default entry types (seeded on first run)
export const DEFAULT_ENTRY_TYPES: Omit<CustomEntryType, 'id'>[] = [
  { key: 'information', label: 'Informação', icon: 'Info', color: 'info', isDefault: true, sortOrder: 0, allowsAction: false },
  { key: 'decision', label: 'Decisão', icon: 'Gavel', color: 'warning', isDefault: true, sortOrder: 1, allowsAction: true },
  { key: 'demand', label: 'Demanda', icon: 'MessageSquare', color: 'neutral', isDefault: true, sortOrder: 2, allowsAction: true },
  { key: 'idea', label: 'Ideia', icon: 'Lightbulb', color: 'success', isDefault: true, sortOrder: 3, allowsAction: true },
  { key: 'blocker', label: 'Bloqueio', icon: 'AlertTriangle', color: 'error', isDefault: true, sortOrder: 4, allowsAction: true },
  { key: 'update', label: 'Atualização', icon: 'RefreshCw', color: 'info', isDefault: true, sortOrder: 5, allowsAction: false },
]

export const DEFAULT_ACTION_STATUSES: Omit<CustomActionStatus, 'id'>[] = [
  { key: 'none', label: 'Sem ação', icon: 'Minus', color: 'neutral', isDefault: true, isFinal: false, sortOrder: 0 },
  { key: 'action_needed', label: 'Ação necessária', icon: 'AlertCircle', color: 'warning', isDefault: true, isFinal: false, sortOrder: 1 },
  { key: 'waiting_response', label: 'Aguardando resposta', icon: 'Clock', color: 'info', isDefault: true, isFinal: false, sortOrder: 2 },
  { key: 'done', label: 'Concluído', icon: 'CheckCircle2', color: 'success', isDefault: true, isFinal: true, sortOrder: 3 },
]

export const DEFAULT_CAPTURE_TEMPLATES: Omit<CustomCaptureTemplate, 'id'>[] = [
  { label: 'Reunião', prefix: 'Reunião com ', placeholder: '[pessoa/equipe]: [o que foi discutido/decidido]', icon: 'Users', hintType: 'information', isDefault: true, sortOrder: 0 },
  { label: 'Decisão', prefix: 'Decisão sobre ', placeholder: '[assunto]: [o que foi decidido e por quê]', icon: 'Gavel', hintType: 'decision', isDefault: true, sortOrder: 1 },
  { label: 'Bloqueio', prefix: 'Bloqueio em ', placeholder: '[projeto/tarefa]: [descrição do impedimento]', icon: 'AlertTriangle', hintType: 'blocker', isDefault: true, sortOrder: 2 },
  { label: 'Demanda', prefix: 'Demanda de ', placeholder: '[pessoa/área]: [o que foi solicitado e prazo]', icon: 'MessageSquare', hintType: 'demand', isDefault: true, sortOrder: 3 },
  { label: 'Ideia', prefix: 'Ideia: ', placeholder: '[descrição da ideia ou sugestão]', icon: 'Lightbulb', hintType: 'idea', isDefault: true, sortOrder: 4 },
  { label: 'Atualização', prefix: 'Atualização: ', placeholder: '[o que mudou ou progresso feito]', icon: 'RefreshCw', hintType: 'update', isDefault: true, sortOrder: 5 },
]

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
  // Appearance settings
  fontFamily: string
  fontSize: string
  // User identity
  userName: string
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
  fontFamily: 'system-ui',
  fontSize: '14',
  userName: '',
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
    assignee?: string
    similarTo?: {
      taskId: string
      taskTitle: string
      reason: string
    }
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

// === Capture Templates (legacy alias) ===
// CaptureTemplate is now CustomCaptureTemplate from the customizable fields section above
export type CaptureTemplate = CustomCaptureTemplate

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


// === Error Log Types ===

export type ErrorCategory = 'ai' | 'database' | 'ipc' | 'renderer' | 'system'
export type ErrorSeverity = 'warning' | 'error' | 'critical'

export interface ErrorLog {
  id: string
  timestamp: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  stack?: string
  context?: string
  resolved: boolean
  occurrences: number
  lastOccurrence: string
}

// === Notification Types ===

export type NotificationType =
  | 'task_overdue'
  | 'task_due_today'
  | 'task_due_tomorrow'
  | 'review_pending'
  | 'meeting_reminder'
  | 'insight_generated'
  | 'digest_ready'
  | 'ai_error'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  dismissed: boolean
  metadata?: Record<string, string>
  createdAt: string
}


// === Reports & Metrics Types ===

export type ReportPeriod = '7d' | '30d' | '90d' | 'all'

export interface ProductivityOverview {
  totalEntries: number
  totalTasks: number
  tasksCompleted: number
  tasksPending: number
  completionRate: number // percentage
  activeProjects: number
  totalProjects: number
  totalMeetings: number
  avgTaskResolutionDays: number | null
}

export interface ActivityTimelinePoint {
  date: string
  entries: number
  tasksCreated: number
  tasksCompleted: number
}

export interface EntryTypeDistribution {
  type: EntryType
  count: number
  percentage: number
}

export interface ProjectRanking {
  projectId: string
  projectName: string
  entryCount: number
  taskCount: number
  completedTasks: number
  blockerCount: number
  lastActivityDate: string | null
}

export interface TaskFlowStats {
  todo: number
  inProgress: number
  waiting: number
  done: number
  avgLeadTimeDays: number | null
  longestWaitingTask: { id: string; title: string; projectName: string; daysSinceUpdate: number } | null
}

export interface WeekdayActivity {
  dayOfWeek: number // 0=Sunday, 6=Saturday
  label: string
  entries: number
  tasksCompleted: number
}

export interface ReportsData {
  overview: ProductivityOverview
  activityTimeline: ActivityTimelinePoint[]
  entryTypeDistribution: EntryTypeDistribution[]
  projectRanking: ProjectRanking[]
  taskFlow: TaskFlowStats
  weekdayActivity: WeekdayActivity[]
}
