import { ProactiveInsight } from '../../shared/types'
import { EntryRepository } from '../database/repositories/entry-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIService } from './ai-service'
import { v4 as uuid } from 'uuid'

const INSIGHTS_PROMPT = `Você é um assistente de produtividade que analisa dados de trabalho e gera sugestões proativas.
Dado o contexto abaixo sobre projetos, tarefas e entradas do usuário, gere 1-2 sugestões inteligentes e acionáveis.

Regras:
- Responda APENAS em português brasileiro
- Foque em padrões que o usuário talvez não perceba sozinho
- Seja específico — cite projetos e tarefas pelo nome
- Cada sugestão deve ter: um título curto e uma descrição com ação concreta
- Evite conselhos genéricos tipo "priorize suas tarefas"
- Se não houver nada relevante para sugerir, retorne array vazio

Exemplos de boas sugestões:
- "Projeto X parado há 8 dias — talvez valha reagendar ou arquivar"
- "Você tem 3 bloqueios no projeto Y — considere uma reunião de alinhamento"
- "A tarefa 'Enviar proposta' está em aguardando há 5 dias — quer cobrar?"

Responda APENAS com JSON válido:
[
  {"title": "Título curto", "description": "Descrição com ação sugerida", "priority": "high|medium|low"}
]
`

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
  ) { }

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
    const staleTasks = allTasks.filter((t) => {
      if (t.status !== 'waiting') return false
      const updated = new Date(t.updatedAt)
      const daysDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
      return daysDiff > 4
    })

    if (staleTasks.length > 0) {
      const taskNames = staleTasks.slice(0, 3).map((t) => `"${t.title}"`).join(', ')
      const projectId = staleTasks[0].projectId
      const projectName = projects.find((p) => p.id === projectId)?.name
      insights.push({
        id: uuid(),
        type: 'stale_tasks',
        title: `${staleTasks.length} tarefa${staleTasks.length > 1 ? 's' : ''} aguardando há dias`,
        description: `${taskNames} ${staleTasks.length > 3 ? `e mais ${staleTasks.length - 3}` : ''} sem atualização. Considere cobrar ou reclassificar.`,
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

      const projectTasks = allTasks.filter((t) => t.projectId === project.id && t.status !== 'done')

      if (daysSinceActivity > 7 && projectTasks.length > 0) {
        insights.push({
          id: uuid(),
          type: 'idle_project',
          title: `${project.name} parado há ${Math.floor(daysSinceActivity)} dias`,
          description: `Ainda tem ${projectTasks.length} tarefa${projectTasks.length > 1 ? 's' : ''} pendente${projectTasks.length > 1 ? 's' : ''}. Precisa de atenção ou pode arquivar?`,
          priority: 'medium',
          relatedProjectId: project.id,
          relatedProjectName: project.name,
        })
      }
    }

    // Rule 3: Tasks without deadline
    const noDeadlineTasks = allTasks.filter((t) => t.status !== 'done' && !t.dueDate)
    if (noDeadlineTasks.length >= 5) {
      insights.push({
        id: uuid(),
        type: 'no_deadline',
        title: `${noDeadlineTasks.length} tarefas sem prazo definido`,
        description: 'Tarefas sem data tendem a ficar esquecidas. Considere definir prazos para as mais importantes.',
        priority: 'low',
      })
    }

    // Rule 4: Recurring blockers in same project
    for (const project of projects) {
      const blockers = allEntries.filter(
        (e) => e.projectId === project.id && e.type === 'blocker'
      )
      const recentBlockers = blockers.filter((b) => {
        const daysDiff = (now.getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        return daysDiff <= 14
      })

      if (recentBlockers.length >= 3) {
        insights.push({
          id: uuid(),
          type: 'recurring_blockers',
          title: `${recentBlockers.length} bloqueios recentes em ${project.name}`,
          description: 'Padrão de bloqueios frequentes. Talvez valha uma reunião para resolver a causa raiz.',
          priority: 'high',
          relatedProjectId: project.id,
          relatedProjectName: project.name,
        })
      }
    }

    // Rule 5: Overloaded (many pending tasks)
    const pendingTasks = allTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
    if (pendingTasks.length > 15) {
      insights.push({
        id: uuid(),
        type: 'overloaded',
        title: `${pendingTasks.length} tarefas ativas — carga alta`,
        description: 'Volume de tarefas pendentes acima do normal. Considere delegar, adiar ou concluir algumas.',
        priority: 'medium',
      })
    }

    // AI-powered suggestion (if we have enough data)
    if (allEntries.length >= 5) {
      try {
        const aiInsights = await this.generateAISuggestions(projects, allTasks, allEntries)
        insights.push(...aiInsights)
      } catch (e) {
        console.error('Failed to generate AI insights:', e)
        // Non-fatal — rule-based insights still work
      }
    }

    // Sort by priority and limit
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return insights
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, 5)
  }

  private async generateAISuggestions(
    projects: any[],
    tasks: any[],
    entries: any[]
  ): Promise<ProactiveInsight[]> {
    const settings = this.settingsRepo.get()

    // Build context for AI
    const projectsSummary = projects.map((p) => {
      const pTasks = tasks.filter((t: any) => t.projectId === p.id && t.status !== 'done')
      const pEntries = entries.filter((e: any) => e.projectId === p.id).slice(0, 5)
      return `${p.name}: ${pTasks.length} tarefas pendentes, últimas entradas: ${pEntries.map((e: any) => `[${e.type}] ${e.improvedText.slice(0, 50)}`).join('; ')}`
    }).join('\n')

    const pendingTasks = tasks
      .filter((t: any) => t.status !== 'done')
      .slice(0, 15)
      .map((t: any) => {
        const pName = projects.find((p) => p.id === t.projectId)?.name || '?'
        const age = Math.floor((Date.now() - new Date(t.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        return `[${t.status}][${pName}] ${t.title} (${age}d sem atualizar)`
      }).join('\n')

    const userMessage = `Contexto atual do usuário:

Projetos:
${projectsSummary}

Tarefas pendentes:
${pendingTasks}

Gere sugestões inteligentes baseadas nos padrões que você observa.`

    const responseText = await this.aiService.invokeConverseForChat(
      INSIGHTS_PROMPT,
      userMessage,
      settings,
      'insights'
    )

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return []

      const parsed = JSON.parse(jsonMatch[0]) as { title: string; description: string; priority: 'high' | 'medium' | 'low' }[]
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
