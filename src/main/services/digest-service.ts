import { DailyDigestData, Task, Entry } from '../../shared/types'
import { EntryRepository } from '../database/repositories/entry-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIService } from './ai-service'

export class DigestService {
  private entryRepo = new EntryRepository()
  private taskRepo = new TaskRepository()
  private projectRepo = new ProjectRepository()
  private settingsRepo = new SettingsRepository()
  private aiService = new AIService()

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
    if (hour < 12) return 'Bom dia! ☀️'
    if (hour < 18) return 'Boa tarde! 🌤️'
    return 'Boa noite! 🌙'
  }

  private categorizeTasks(allTasks: Task[]): DailyDigestData['tasksNeedingAttention'] {
    const activeTasks = allTasks.filter((t) => t.status !== 'done')

    return {
      overdue: activeTasks.filter((t) => t.status === 'todo'),
      inProgress: activeTasks.filter((t) => t.status === 'in_progress'),
      waiting: activeTasks.filter((t) => t.status === 'waiting'),
    }
  }

  private getYesterdayActivity(allTasks: Task[]): DailyDigestData['yesterdayActivity'] {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString()
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59).toISOString()

    // Entries created yesterday
    const allEntries = this.entryRepo.getAll()
    const entriesCreated = allEntries.filter((e) =>
      e.createdAt >= yesterdayStart && e.createdAt <= yesterdayEnd
    )

    // Tasks completed yesterday (updatedAt within yesterday and status = done)
    const tasksCompleted = allTasks.filter((t) =>
      t.status === 'done' && t.updatedAt >= yesterdayStart && t.updatedAt <= yesterdayEnd
    )

    // Tasks created yesterday
    const tasksCreated = allTasks.filter((t) =>
      t.createdAt >= yesterdayStart && t.createdAt <= yesterdayEnd
    )

    return { entriesCreated, tasksCompleted, tasksCreated }
  }

  private async generateFocusSuggestion(
    tasksNeedingAttention: DailyDigestData['tasksNeedingAttention'],
    yesterdayActivity: DailyDigestData['yesterdayActivity']
  ): Promise<string> {
    const settings = this.settingsRepo.get()

    if (!settings.bedrockApiKey) {
      return 'Configure sua API Key nas configurações para receber sugestões personalizadas.'
    }

    const projects = this.projectRepo.getAll()
    const projectMap = new Map(projects.map((p) => [p.id, p.name]))

    const pendingTasksText = [...tasksNeedingAttention.inProgress, ...tasksNeedingAttention.overdue, ...tasksNeedingAttention.waiting]
      .slice(0, 15)
      .map((t) => `[${t.status}] ${t.title} (Projeto: ${projectMap.get(t.projectId) || 'Desconhecido'})`)
      .join('\n')

    const yesterdayText = yesterdayActivity.entriesCreated
      .slice(0, 10)
      .map((e) => `[${e.type}] ${e.improvedText}`)
      .join('\n')

    const systemPrompt = `Você é um assistente pessoal de produtividade. Baseado nas tasks pendentes e na atividade de ontem, sugira em 2-3 frases o que a pessoa deveria focar hoje. Seja direto, motivacional e prático. Responda em português.`

    const userMessage = `Tasks pendentes:
${pendingTasksText || '(nenhuma task pendente)'}

Atividade de ontem:
${yesterdayText || '(nenhuma atividade ontem)'}

Tasks completadas ontem: ${yesterdayActivity.tasksCompleted.length}
Tasks criadas ontem: ${yesterdayActivity.tasksCreated.length}

Sugira o foco para hoje em 2-3 frases.`

    return this.aiService.invokeConversePublic(systemPrompt, userMessage, settings)
  }
}
