import type { Meeting, MeetingProcessResult, EntryType, ActionStatus } from '../../shared/types'
import type { MeetingRepository } from '../database/repositories/meeting-repository'
import type { EntryRepository } from '../database/repositories/entry-repository'
import type { ProjectRepository } from '../database/repositories/project-repository'
import type { TaskRepository } from '../database/repositories/task-repository'
import type { SettingsRepository } from '../database/repositories/settings-repository'
import type { NotificationRepository } from '../database/repositories/notification-repository'
import { getErrorService } from './error-service'
import type { AIService } from './ai-service'
import { t } from '../i18n'

export class MeetingService {
  constructor(
    private meetingRepo: MeetingRepository,
    private entryRepo: EntryRepository,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private settingsRepo: SettingsRepository,
    private notificationRepo: NotificationRepository,
    private aiService: AIService
  ) {}

  create(data: { projectId: string; title: string; participants?: string[]; meetingDate?: string }): Meeting {
    return this.meetingRepo.create(data)
  }

  getAll(projectId?: string): Meeting[] {
    return this.meetingRepo.getAll(projectId)
  }

  getById(id: string): Meeting | null {
    return this.meetingRepo.getById(id)
  }

  getActive(): Meeting | null {
    return this.meetingRepo.getActive()
  }

  addNote(id: string, note: string): Meeting | null {
    return this.meetingRepo.addNote(id, note)
  }

  setTranscription(id: string, transcription: string): Meeting | null {
    return this.meetingRepo.setTranscription(id, transcription)
  }

  end(id: string): Meeting | null {
    return this.meetingRepo.end(id)
  }

  delete(id: string): void {
    this.meetingRepo.delete(id)
  }

  /**
   * Delete a meeting and its associated entries/tasks (by ID list).
   */
  deleteWithData(meetingId: string, entryIds: string[], taskIds: string[]): void {
    for (const entryId of entryIds) {
      this.entryRepo.delete(entryId)
    }
    for (const taskId of taskIds) {
      this.taskRepo.delete(taskId)
    }
    this.meetingRepo.delete(meetingId)
  }

  /**
   * AI-powered meeting preparation.
   * Gathers recent activities, pending tasks, decisions and blockers for the project,
   * then generates a suggested agenda.
   */
  async prepareMeeting(projectId: string, meetingTitle: string, participants: string[]): Promise<string> {
    const settings = this.settingsRepo.get()
    const project = this.projectRepo.getById(projectId)
    if (!project) throw new Error('Project not found')

    // Gather project context
    const entries = this.entryRepo.getAll(projectId)
    const tasks = this.taskRepo.getByProject(projectId)

    // Recent entries (last 20)
    const recentEntries = entries.slice(0, 20)

    // Categorize entries
    const decisions = recentEntries.filter((e) => e.type === 'decision')
    const blockers = recentEntries.filter((e) => e.type === 'blocker')
    const demands = recentEntries.filter((e) => e.type === 'demand')
    const updates = recentEntries.filter((e) => e.type === 'update' || e.type === 'information')

    // Task groups
    const overdue = tasks.filter((task) => {
      if (task.status === 'done' || !task.dueDate) return false
      return task.dueDate < new Date().toISOString().split('T')[0]
    })
    const inProgress = tasks.filter((task) => task.status === 'in_progress')
    const waiting = tasks.filter((task) => task.status === 'waiting')
    const todo = tasks.filter((task) => task.status === 'todo')

    // Build context message
    const contextParts: string[] = []
    contextParts.push(t('prompts.meeting_context.meeting_label', { title: meetingTitle }))
    contextParts.push(t('prompts.meeting_context.project_label', { name: project.name }))
    if (participants.length > 0) {
      contextParts.push(t('prompts.meeting_context.participants_label', { participants: participants.join(', ') }))
    }

    if (overdue.length > 0) {
      contextParts.push(`\n${t('prompts.meeting_context.overdue_tasks', { count: overdue.length })}`)
      overdue.forEach((task) => {
        contextParts.push(`- ${task.title} (${t('prompts.meeting_context.deadline_label', { date: task.dueDate! })})`)
      })
    }

    if (blockers.length > 0) {
      contextParts.push(`\n${t('prompts.meeting_context.recent_blockers', { count: blockers.length })}`)
      blockers.slice(0, 5).forEach((e) => {
        contextParts.push(`- [${e.createdAt.split('T')[0]}] ${e.improvedText}`)
      })
    }

    if (inProgress.length > 0) {
      contextParts.push(`\n${t('prompts.meeting_context.in_progress_tasks', { count: inProgress.length })}`)
      inProgress.forEach((task) => {
        contextParts.push(`- ${task.title}`)
      })
    }

    if (waiting.length > 0) {
      contextParts.push(`\n${t('prompts.meeting_context.waiting_tasks', { count: waiting.length })}`)
      waiting.forEach((task) => {
        contextParts.push(`- ${task.title}`)
      })
    }

    if (decisions.length > 0) {
      contextParts.push(`\n${t('prompts.meeting_context.recent_decisions', { count: decisions.length })}`)
      decisions.slice(0, 5).forEach((e) => {
        contextParts.push(`- [${e.createdAt.split('T')[0]}] ${e.improvedText}`)
      })
    }

    if (demands.length > 0) {
      contextParts.push(`\n${t('prompts.meeting_context.recent_demands', { count: demands.length })}`)
      demands.slice(0, 5).forEach((e) => {
        contextParts.push(`- [${e.createdAt.split('T')[0]}] ${e.improvedText}`)
      })
    }

    if (todo.length > 0) {
      contextParts.push(`\n${t('prompts.meeting_context.backlog', { count: todo.length })}`)
      todo.slice(0, 5).forEach((task) => {
        contextParts.push(`- ${task.title}`)
      })
      if (todo.length > 5) contextParts.push(t('prompts.meeting_context.backlog_more', { count: todo.length - 5 }))
    }

    if (updates.length > 0) {
      contextParts.push(`\n${t('prompts.meeting_context.recent_updates')}`)
      updates.slice(0, 5).forEach((e) => {
        contextParts.push(`- [${e.createdAt.split('T')[0]}] ${e.improvedText}`)
      })
    }

    const userMessage = contextParts.join('\n')

    return this.aiService.invokeConverseForChat(
      t('prompts.meeting_prep.system'),
      userMessage,
      settings,
      'meeting_processing'
    )
  }

  /**
   * Step 1: Analyze the meeting content with AI.
   * Returns the AI result WITHOUT saving entries/tasks.
   * The user will select which items to keep.
   */
  async analyze(id: string): Promise<MeetingProcessResult | null> {
    const meeting = this.meetingRepo.getById(id)
    if (!meeting) return null

    const settings = this.settingsRepo.get()
    const content = this.buildMeetingContent(meeting)

    // Fetch existing tasks for the project (not done) to detect duplicates
    const projectTasks = this.taskRepo.getByProject(meeting.projectId)
    const existingTasks = projectTasks
      .filter((task) => task.status !== 'done')
      .map((task) => ({ id: task.id, title: task.title, status: task.status }))

    try {
      const result = await this.aiService.processMeeting(
        meeting.title,
        meeting.participants,
        content,
        settings,
        existingTasks.length > 0 ? existingTasks : undefined,
        settings.userName || undefined
      )

      // Save the generated minutes on the meeting record
      this.meetingRepo.setProcessed(id, result.minutes)

      return result
    } catch (error: any) {
      // Register error in notification center
      try {
        this.notificationRepo.create({
          type: 'ai_error',
          title: t('notifications.errors.meeting_process'),
          body: error?.message || t('notifications.errors.meeting_process_detail'),
          metadata: { meetingId: id, meetingTitle: meeting.title },
        })
      } catch {
        /* ignore notification creation failures */
      }

      // Register in error center with AI response for debugging
      getErrorService().logError({
        category: 'ai',
        severity: 'error',
        message: error?.message || t('notifications.errors.meeting_process_ai'),
        stack: error?.stack,
        context: {
          meetingId: id,
          meetingTitle: meeting.title,
          aiResponse: error?.aiResponse || undefined,
        },
      })

      throw error
    }
  }

  /**
   * Step 2: Save only the selected entries and tasks.
   * Called after the user reviews and picks what they want.
   * Returns the IDs of created entries and tasks so they can be undone.
   */
  saveSelected(
    meetingId: string,
    selectedEntries: { text: string; type: EntryType; action: ActionStatus }[],
    selectedTasks: { title: string; description?: string; assignee?: string }[],
    resolvedTaskIds?: string[]
  ): { entryIds: string[]; taskIds: string[]; resolvedTaskIds: string[] } {
    const meeting = this.meetingRepo.getById(meetingId)
    if (!meeting) return { entryIds: [], taskIds: [], resolvedTaskIds: [] }

    const entryIds: string[] = []
    const taskIds: string[] = []
    const resolvedIds: string[] = []

    // Create selected entries
    for (const entry of selectedEntries) {
      const created = this.entryRepo.create({
        rawText: entry.text,
        improvedText: entry.text,
        projectId: meeting.projectId,
        type: entry.type,
        action: entry.action,
        reviewStatus: 'auto_approved',
      })
      entryIds.push(created.id)
    }

    // Create selected tasks
    for (const task of selectedTasks) {
      const existing = this.taskRepo.findSimilar(meeting.projectId, task.title)
      if (!existing) {
        const created = this.taskRepo.create({
          projectId: meeting.projectId,
          title: task.title,
          description: task.description,
          assignee: task.assignee || null,
          status: 'todo',
        })
        taskIds.push(created.id)
      }
    }

    // Mark resolved tasks as done
    if (resolvedTaskIds && resolvedTaskIds.length > 0) {
      for (const taskId of resolvedTaskIds) {
        const task = this.taskRepo.getById(taskId)
        if (task && task.status !== 'done') {
          this.taskRepo.update(taskId, { status: 'done' })
          resolvedIds.push(taskId)
        }
      }
    }

    return { entryIds, taskIds, resolvedTaskIds: resolvedIds }
  }

  private buildMeetingContent(meeting: Meeting): string {
    const parts: string[] = []

    if (meeting.rawNotes.length > 0) {
      parts.push('Notas manuais:')
      meeting.rawNotes.forEach((note, i) => {
        parts.push(`${i + 1}. ${note}`)
      })
    }

    if (meeting.pastedTranscription) {
      parts.push('')
      parts.push('Transcrição:')
      parts.push(meeting.pastedTranscription)
    }

    return parts.join('\n')
  }
}
