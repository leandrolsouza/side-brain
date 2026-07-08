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
    id: 'request',
    label: 'Pedido',
    prefix: 'Pedido de ',
    placeholder: '[pessoa]: [o que foi solicitado e prazo]',
    icon: 'MessageSquare',
    hintType: 'request',
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
