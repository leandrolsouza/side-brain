import type { ProactiveInsight } from '../../shared/types'
import type { EntryRepository } from '../database/repositories/entry-repository'
import type { ProjectRepository } from '../database/repositories/project-repository'
import type { TaskRepository } from '../database/repositories/task-repository'
import type { SettingsRepository } from '../database/repositories/settings-repository'
import type { AIService } from './ai-service'
import { t, tp } from '../i18n'
import { v4 as uuid } from 'uuid'
import { createScopedLogger } from './logger'

const logger = createScopedLogger('insights')

interface InsightsCache {
  insights: ProactiveInsight[]
  generatedAt: number
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

export class InsightsService {
  private cache: InsightsCache | null = null

  constructor(
    private entryRepo: EntryRepository,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private settingsRepo: SettingsRepository,
    private aiService: AIService
  ) {}

  /**
   * Generates proactive insights by analyzing patterns in tasks and entries.
   * Uses a 4-hour cache to avoid excessive AI token usage.
   * @param forceRefresh - If true, bypasses the cache and regenerates insights.
   */
  async generateInsights(forceRefresh = false): Promise<ProactiveInsight[]> {
    if (!forceRefresh && this.cache) {
      const age = Date.now() - this.cache.generatedAt
      if (age < CACHE_TTL_MS) {
        return this.cache.insights
      }
    }

    const insights = await this._generateInsightsInternal()
    this.cache = { insights, generatedAt: Date.now() }
    return insights
  }

  /**
   * Returns the timestamp of when insights were last generated, or null if no cache.
   */
  getLastGeneratedAt(): number | null {
    return this.cache?.generatedAt ?? null
  }

  private async _generateInsightsInternal(): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = []
    const projects = this.projectRepo.getAll()
    const allTasks = this.taskRepo.getAll()
    const allEntries = this.entryRepo.getAll()
    const now = new Date()

    // Rule 1: Tasks waiting too long (> 4 days)
    const staleTasks = allTasks.filter((task) => {
      if (task.status !== 'waiting') return false
      const updated = new Date(task.updatedAt)
      const daysDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
      return daysDiff > 4
    })

    if (staleTasks.length > 0) {
      const taskNames = staleTasks
        .slice(0, 3)
        .map((task) => `"${task.title}"`)
        .join(', ')
      const projectId = staleTasks[0].projectId
      const projectName = projects.find((p) => p.id === projectId)?.name
      const extra =
        staleTasks.length > 3 ? t('prompts.insights.stale_tasks_extra', { count: staleTasks.length - 3 }) : ''
      insights.push({
        id: uuid(),
        type: 'stale_tasks',
        title: tp('prompts.insights.stale_tasks_title', { count: staleTasks.length }),
        description: t('prompts.insights.stale_tasks_description', { taskNames, extra }),
        priority: 'high',
        relatedProjectId: projectId,
        relatedProjectName: projectName,
      })
    }

    // Rule 2: Projects idle for > 7 days
    for (const project of projects) {
      const projectEntries = allEntries.filter((e) => e.projectId === project.id)
      if (projectEntries.length === 0) continue

      const lastEntry = projectEntries[0] // already sorted DESC
      const daysSinceActivity = (now.getTime() - new Date(lastEntry.createdAt).getTime()) / (1000 * 60 * 60 * 24)

      const projectTasks = allTasks.filter((task) => task.projectId === project.id && task.status !== 'done')

      if (daysSinceActivity > 7 && projectTasks.length > 0) {
        insights.push({
          id: uuid(),
          type: 'idle_project',
          title: t('prompts.insights.idle_project_title', { name: project.name, days: Math.floor(daysSinceActivity) }),
          description: tp('prompts.insights.idle_project_description', { count: projectTasks.length }),
          priority: 'medium',
          relatedProjectId: project.id,
          relatedProjectName: project.name,
        })
      }
    }

    // Rule 3: Tasks without deadline
    const noDeadlineTasks = allTasks.filter((task) => task.status !== 'done' && !task.dueDate)
    if (noDeadlineTasks.length >= 5) {
      insights.push({
        id: uuid(),
        type: 'no_deadline',
        title: t('prompts.insights.no_deadline_title', { count: noDeadlineTasks.length }),
        description: t('prompts.insights.no_deadline_description'),
        priority: 'low',
      })
    }

    // Rule 4: Recurring blockers in same project
    for (const project of projects) {
      const blockers = allEntries.filter((e) => e.projectId === project.id && e.type === 'blocker')
      const recentBlockers = blockers.filter((b) => {
        const daysDiff = (now.getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        return daysDiff <= 14
      })

      if (recentBlockers.length >= 3) {
        insights.push({
          id: uuid(),
          type: 'recurring_blockers',
          title: t('prompts.insights.recurring_blockers_title', { count: recentBlockers.length, name: project.name }),
          description: t('prompts.insights.recurring_blockers_description'),
          priority: 'high',
          relatedProjectId: project.id,
          relatedProjectName: project.name,
        })
      }
    }

    // Rule 5: Overloaded (many pending tasks)
    const pendingTasks = allTasks.filter((task) => task.status === 'todo' || task.status === 'in_progress')
    if (pendingTasks.length > 15) {
      insights.push({
        id: uuid(),
        type: 'overloaded',
        title: t('prompts.insights.overloaded_title', { count: pendingTasks.length }),
        description: t('prompts.insights.overloaded_description'),
        priority: 'medium',
      })
    }

    // AI-powered suggestion (if we have enough data)
    if (allEntries.length >= 5) {
      try {
        const aiInsights = await this.generateAISuggestions(projects, allTasks, allEntries)
        insights.push(...aiInsights)
      } catch (e) {
        logger.error('Failed to generate AI insights:', e)
        // Non-fatal — rule-based insights still work
      }
    }

    // Sort by priority and limit
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 5)
  }

  private async generateAISuggestions(projects: any[], tasks: any[], entries: any[]): Promise<ProactiveInsight[]> {
    const settings = this.settingsRepo.get()

    // Build context for AI
    const projectsSummary = projects
      .map((p) => {
        const pTasks = tasks.filter((task: any) => task.projectId === p.id && task.status !== 'done')
        const pEntries = entries.filter((e: any) => e.projectId === p.id).slice(0, 5)
        return `${p.name}: ${pTasks.length} ${t('prompts.insights.context_pending_tasks')}, ${t('prompts.insights.context_last_entries')} ${pEntries.map((e: any) => `[${e.type}] ${e.improvedText.slice(0, 50)}`).join('; ')}`
      })
      .join('\n')

    const pendingTasks = tasks
      .filter((task: any) => task.status !== 'done')
      .slice(0, 15)
      .map((task: any) => {
        const pName = projects.find((p) => p.id === task.projectId)?.name || '?'
        const age = Math.floor((Date.now() - new Date(task.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        return `[${task.status}][${pName}] ${task.title} (${t('prompts.insights.context_days_without_update', { days: age })})`
      })
      .join('\n')

    const userMessage = t('prompts.insights.user_message', { projectsSummary, pendingTasks })

    const responseText = await this.aiService.invokeConverseForChat(
      t('prompts.insights.system'),
      userMessage,
      settings,
      'insights'
    )

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return []

      const parsed = JSON.parse(jsonMatch[0]) as {
        title: string
        description: string
        priority: 'high' | 'medium' | 'low'
      }[]
      return parsed.map((item) => ({
        id: uuid(),
        type: 'suggestion' as const,
        title: item.title,
        description: item.description,
        priority: item.priority,
      }))
    } catch {
      return []
    }
  }
}
