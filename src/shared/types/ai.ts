import type { EntryType, ActionStatus } from './domain'

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
