export interface Meeting {
  id: string
  projectId: string
  title: string
  participants: string[]
  meetingDate: string
  startedAt: string
  endedAt: string | null
  status: string
  rawNotes: string[]
  pastedTranscription: string | null
  generatedMinutes: string | null
}

export interface Project {
  id: string
  name: string
}

export interface ProcessedEntry {
  text: string
  type: string
  action: string
  selected: boolean
}

export interface ProcessedTask {
  title: string
  description?: string
  assignee?: string
  similarTo?: {
    taskId: string
    taskTitle: string
    reason: string
  }
  selected: boolean
}

export interface ResolvedTask {
  taskId: string
  taskTitle: string
  reason: string
  selected: boolean
}

export type MeetingStep = 'setup' | 'active' | 'review' | 'select' | 'saved'

export interface MeetingModeProps {
  projectId?: string
  onFinished?: (projectId: string) => void
}
