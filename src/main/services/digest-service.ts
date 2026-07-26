import type { DailyDigestData, Task } from '../../shared/types'
import type { EntryRepository } from '../database/repositories/entry-repository'
import type { TaskRepository } from '../database/repositories/task-repository'
import type { ProjectRepository } from '../database/repositories/project-repository'
import type { SettingsRepository } from '../database/repositories/settings-repository'
import type { AIService } from './ai-service'
import { t } from '../i18n'

export class DigestService {
  constructor(
    private entryRepo: EntryRepository,
    private taskRepo: TaskRepository,
    private projectRepo: ProjectRepository,
    private settingsRepo: SettingsRepository,
    private aiService: AIService
  ) {}

  async generateDailyDigest(): Promise<DailyDigestData> {
    const now = new Date()
    const greeting = this.getGreeting(now)

    // Get all tasks that need attention (not done)
    const allTasks = this.taskRepo.getAll()
    const tasksNeedingAttention = this.categorizeTasks(allTasks)

    // Get yesterday's activity
    const yesterdayActivity = this.getYesterdayActivity(allTasks)

    // Generate AI suggestion for what to focus on today
    let aiSuggestion: string | null = null
    try {
      aiSuggestion = await this.generateFocusSuggestion(tasksNeedingAttention, yesterdayActivity)
    } catch {
      // If AI fails, we still return the digest without suggestion
      aiSuggestion = null
    }

    return {
      greeting,
      tasksNeedingAttention,
      yesterdayActivity,
      aiSuggestion,
      generatedAt: now.toISOString(),
    }
  }

  private getGreeting(now: Date): string {
    const hour = now.getHours()
    if (hour < 12) return t('prompts.digest.greeting_morning')
    if (hour < 18) return t('prompts.digest.greeting_afternoon')
    return t('prompts.digest.greeting_evening')
  }

  private categorizeTasks(allTasks: Task[]): DailyDigestData['tasksNeedingAttention'] {
    const activeTasks = allTasks.filter((task) => task.status !== 'done')

    return {
      overdue: activeTasks.filter((task) => task.status === 'todo'),
      inProgress: activeTasks.filter((task) => task.status === 'in_progress'),
      waiting: activeTasks.filter((task) => task.status === 'waiting'),
    }
  }

  private getYesterdayActivity(allTasks: Task[]): DailyDigestData['yesterdayActivity'] {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString()
    const yesterdayEnd = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate(),
      23,
      59,
      59
    ).toISOString()

    // Entries created yesterday
    const allEntries = this.entryRepo.getAll()
    const entriesCreated = allEntries.filter((e) => e.createdAt >= yesterdayStart && e.createdAt <= yesterdayEnd)

    // Tasks completed yesterday (updatedAt within yesterday and status = done)
    const tasksCompleted = allTasks.filter(
      (task) => task.status === 'done' && task.updatedAt >= yesterdayStart && task.updatedAt <= yesterdayEnd
    )

    // Tasks created yesterday
    const tasksCreated = allTasks.filter((task) => task.createdAt >= yesterdayStart && task.createdAt <= yesterdayEnd)

    return { entriesCreated, tasksCompleted, tasksCreated }
  }

  private async generateFocusSuggestion(
    tasksNeedingAttention: DailyDigestData['tasksNeedingAttention'],
    yesterdayActivity: DailyDigestData['yesterdayActivity']
  ): Promise<string> {
    const settings = this.settingsRepo.get()

    if (!settings.bedrockApiKey) {
      return t('prompts.digest.no_api_key')
    }

    const projects = this.projectRepo.getAll()
    const projectMap = new Map(projects.map((p) => [p.id, p.name]))

    const pendingTasksText = [
      ...tasksNeedingAttention.inProgress,
      ...tasksNeedingAttention.overdue,
      ...tasksNeedingAttention.waiting,
    ]
      .slice(0, 15)
      .map(
        (task) =>
          `[${task.status}] ${task.title} (Projeto: ${projectMap.get(task.projectId) || t('prompts.digest.unknown_project')})`
      )
      .join('\n')

    const yesterdayText = yesterdayActivity.entriesCreated
      .slice(0, 10)
      .map((e) => `[${e.type}] ${e.improvedText}`)
      .join('\n')

    const systemPrompt = t('prompts.digest.focus_system')

    const userMessage = t('prompts.digest.focus_user', {
      pendingTasksText: pendingTasksText || t('prompts.digest.no_pending_tasks'),
      yesterdayText: yesterdayText || t('prompts.digest.no_activity'),
      completedCount: yesterdayActivity.tasksCompleted.length,
      createdCount: yesterdayActivity.tasksCreated.length,
    })

    return this.aiService.invokeConversePublic(systemPrompt, userMessage, settings)
  }
}
