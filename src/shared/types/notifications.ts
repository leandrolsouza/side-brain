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
