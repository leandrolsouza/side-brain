import type { EntryType } from './domain'

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
