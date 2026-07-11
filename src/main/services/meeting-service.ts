import { Meeting, MeetingProcessResult, EntryType, ActionStatus } from '../../shared/types'
import { MeetingRepository } from '../database/repositories/meeting-repository'
import { EntryRepository } from '../database/repositories/entry-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { NotificationRepository } from '../database/repositories/notification-repository'
import { getErrorService } from './error-service'
import { AIService } from './ai-service'

const MEETING_PREP_PROMPT = `Você é um assistente que prepara pautas inteligentes para reuniões de trabalho.
Dado o contexto do projeto (atividades recentes, tarefas pendentes, decisões e bloqueios), gere uma pauta sugerida para a reunião.

A pauta deve:
- Ser em markdown
- Começar com os itens mais urgentes (bloqueios, tarefas atrasadas)
- Incluir pontos de acompanhamento (tarefas em andamento, aguardando resposta)
- Mencionar decisões recentes que podem precisar de follow-up
- Sugerir tópicos com base nos padrões observados
- Ser concisa e acionável (não mais que 10 tópicos)
- Incluir um campo "Decisões a tomar" se houver pontos pendentes

Formato esperado:
# Pauta Sugerida — [título da reunião]

## Urgente
- ...

## Acompanhamento
- ...

## Decisões a tomar
- ...

## Outros pontos
- ...

Se não houver dados suficientes para uma seção, omita-a.
Responda APENAS com o markdown da pauta.`

export class MeetingService {
  constructor(
    private meetingRepo: MeetingRepository,
    private entryRepo: EntryRepository,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private settingsRepo: SettingsRepository,
    private notificationRepo: NotificationRepository,
    private aiService: AIService
  ) { }

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
    return this.meetingRepo.delete(id)
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
    const overdue = tasks.filter((t) => {
      if (t.status === 'done' || !t.dueDate) return false
      return t.dueDate < new Date().toISOString().split('T')[0]
    })
    const inProgress = tasks.filter((t) => t.status === 'in_progress')
    const waiting = tasks.filter((t) => t.status === 'waiting')
    const todo = tasks.filter((t) => t.status === 'todo')

    // Build context message
    const contextParts: string[] = []
    contextParts.push(`Reunião: "${meetingTitle}"`)
    contextParts.push(`Projeto: ${project.name}`)
    if (participants.length > 0) {
      contextParts.push(`Participantes: ${participants.join(', ')}`)
    }

    if (overdue.length > 0) {
      contextParts.push(`\nTarefas atrasadas (${overdue.length}):`)
      overdue.forEach((t) => contextParts.push(`- ${t.title} (prazo: ${t.dueDate})`))
    }

    if (blockers.length > 0) {
      contextParts.push(`\nBloqueios recentes (${blockers.length}):`)
      blockers.slice(0, 5).forEach((e) => contextParts.push(`- [${e.createdAt.split('T')[0]}] ${e.improvedText}`))
    }

    if (inProgress.length > 0) {
      contextParts.push(`\nTarefas em andamento (${inProgress.length}):`)
      inProgress.forEach((t) => contextParts.push(`- ${t.title}`))
    }

    if (waiting.length > 0) {
      contextParts.push(`\nAguardando resposta (${waiting.length}):`)
      waiting.forEach((t) => contextParts.push(`- ${t.title}`))
    }

    if (decisions.length > 0) {
      contextParts.push(`\nDecisões recentes (${decisions.length}):`)
      decisions.slice(0, 5).forEach((e) => contextParts.push(`- [${e.createdAt.split('T')[0]}] ${e.improvedText}`))
    }

    if (demands.length > 0) {
      contextParts.push(`\nDemandas recentes (${demands.length}):`)
      demands.slice(0, 5).forEach((e) => contextParts.push(`- [${e.createdAt.split('T')[0]}] ${e.improvedText}`))
    }

    if (todo.length > 0) {
      contextParts.push(`\nBacklog (${todo.length} tarefas a fazer):`)
      todo.slice(0, 5).forEach((t) => contextParts.push(`- ${t.title}`))
      if (todo.length > 5) contextParts.push(`  ... e mais ${todo.length - 5}`)
    }

    if (updates.length > 0) {
      contextParts.push(`\nAtualizações recentes:`)
      updates.slice(0, 5).forEach((e) => contextParts.push(`- [${e.createdAt.split('T')[0]}] ${e.improvedText}`))
    }

    const userMessage = contextParts.join('\n')

    return this.aiService.invokeConverseForChat(
      MEETING_PREP_PROMPT,
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
      .filter((t) => t.status !== 'done')
      .map((t) => ({ id: t.id, title: t.title, status: t.status }))

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
          title: 'Erro ao processar reunião',
          body: error?.message || 'A IA retornou uma resposta com formato inválido. Tente reprocessar.',
          metadata: { meetingId: id, meetingTitle: meeting.title },
        })
      } catch { /* ignore notification creation failures */ }

      // Register in error center with AI response for debugging
      getErrorService().logError({
        category: 'ai',
        severity: 'error',
        message: error?.message || 'Erro ao processar reunião com IA',
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
