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
