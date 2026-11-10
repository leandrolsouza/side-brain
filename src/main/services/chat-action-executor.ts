import type { ChatActionType, ChatActionResult } from '../../shared/types'
import type { EntryRepository } from '../database/repositories/entry-repository'
import type { ProjectRepository } from '../database/repositories/project-repository'
import type { TaskRepository } from '../database/repositories/task-repository'
import { confirmAction } from './action-approval-service'
import { t } from '../i18n'

interface ActionPayload {
  action: ChatActionType
  [key: string]: any
}

/**
 * Executes actions requested by the Smart Chat AI.
 * Parses action markers from AI response and performs the corresponding operations.
 */
export class ChatActionExecutor {
  constructor(
    private entryRepo: EntryRepository,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository
  ) {}

  /**
   * Parse action blocks from AI response text.
   * Format: [ACTION]{"action":"create_task",...}[/ACTION]
   */
  parseActions(responseText: string): { cleanText: string; payloads: ActionPayload[] } {
    const actionRegex = /\[ACTION\]([\s\S]*?)\[\/ACTION\]/g
    const payloads: ActionPayload[] = []

    let cleanText = responseText

    for (const match of responseText.matchAll(actionRegex)) {
      try {
        const parsed = JSON.parse(match[1].trim())
        if (parsed.action) {
          payloads.push(parsed as ActionPayload)
        }
      } catch {
        // Malformed action JSON — skip
      }
    }

    // Remove action blocks from the text shown to the user
    cleanText = cleanText.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/g, '').trim()

    return { cleanText, payloads }
  }

  /**
   * Execute a list of parsed action payloads and return results.
   */
  async executeActions(payloads: ActionPayload[]): Promise<ChatActionResult[]> {
    const results: ChatActionResult[] = []

    for (const payload of payloads) {
      try {
        const prepared = this.prepareAction(payload)
        if (['create_task', 'update_task_status', 'create_entry'].includes(prepared.action)) {
          const approved = await confirmAction('Smart Chat', prepared.action, prepared)
          if (!approved) {
            results.push({
              type: prepared.action,
              success: false,
              description: t('notifications.action_approval.rejected'),
            })
            continue
          }
          if (JSON.stringify(this.prepareAction(prepared)) !== JSON.stringify(prepared)) {
            throw new Error(t('notifications.action_approval.changed'))
          }
        }
        const result = await this.executeOne(prepared)
        results.push(result)
      } catch (error: any) {
        results.push({
          type: payload.action,
          success: false,
          description: `Erro: ${error.message}`,
        })
      }
    }

    return results
  }

  private prepareAction(payload: ActionPayload): ActionPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Ação inválida.')
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value !== 'string' && value !== undefined && value !== null) {
        throw new Error(`Parâmetro inválido: ${key}`)
      }
    }
    const prepared = { ...payload }
    if (prepared.action === 'create_task' && !prepared.title?.trim()) throw new Error('Título da task é obrigatório.')
    if (prepared.action === 'create_entry' && !prepared.text?.trim()) throw new Error('Texto da entrada é obrigatório.')
    if (prepared.action === 'update_task_status') {
      if (!['todo', 'in_progress', 'waiting', 'done'].includes(prepared.status))
        throw new Error(`Status inválido: ${prepared.status}`)
      let task = prepared.taskId ? this.taskRepo.getById(prepared.taskId) : null
      if (prepared.taskId && !task) throw new Error('Task não encontrada.')
      if (!task && prepared.taskTitle) {
        let matches = this.taskRepo.search(prepared.taskTitle)
        if (prepared.projectName) {
          const project = this.projectRepo.findByName(prepared.projectName)
          if (!project) throw new Error(t('notifications.action_approval.project_missing'))
          matches = matches.filter((candidate) => candidate.projectId === project.id)
        }
        if (matches.length > 1) throw new Error(t('notifications.action_approval.ambiguous_task'))
        task = matches[0] || null
      }
      if (!task) throw new Error('Task não encontrada.')
      prepared.taskId = task.id
      prepared.taskTitle = task.title
      prepared.projectName = this.projectRepo.getById(task.projectId)?.name
      prepared.currentStatus = task.status
    }
    if (prepared.action === 'create_task' || prepared.action === 'create_entry') {
      if (prepared.projectId) {
        const project = this.projectRepo.getById(prepared.projectId)
        if (!project) throw new Error(t('notifications.action_approval.project_missing'))
        prepared.projectName = project.name
      } else if (prepared.projectName) {
        const project = this.projectRepo.findByName(prepared.projectName)
        if (project) {
          prepared.projectId = project.id
          delete prepared.projectCreation
        } else if (
          prepared.action === 'create_entry' &&
          !(prepared.projectName === 'Geral' && this.projectRepo.getAll().length === 0)
        ) {
          throw new Error(t('notifications.action_approval.project_missing'))
        } else prepared.projectCreation = t('notifications.action_approval.yes')
      } else {
        const projects = this.projectRepo.getAll()
        if (projects.length > 1) throw new Error(t('notifications.action_approval.select_project'))
        if (projects.length === 1) {
          prepared.projectId = projects[0].id
          prepared.projectName = projects[0].name
        } else {
          prepared.projectName = 'Geral'
          prepared.projectCreation = t('notifications.action_approval.yes')
        }
      }
    }
    return prepared
  }

  private async executeOne(payload: ActionPayload): Promise<ChatActionResult> {
    switch (payload.action) {
      case 'create_task':
        return this.executeCreateTask(payload)
      case 'update_task_status':
        return this.executeUpdateTaskStatus(payload)
      case 'create_entry':
        return this.executeCreateEntry(payload)
      case 'list_tasks':
        return this.executeListTasks(payload)
      default:
        return { type: payload.action, success: false, description: `Ação desconhecida: ${payload.action}` }
    }
  }

  private async executeCreateTask(payload: ActionPayload): Promise<ChatActionResult> {
    const { title, description, projectName, projectId, dueDate } = payload

    if (!title) {
      return { type: 'create_task', success: false, description: 'Título da task é obrigatório.' }
    }

    // Resolve project
    let resolvedProjectId = projectId
    if (!resolvedProjectId && projectName) {
      const project = this.projectRepo.findByName(projectName)
      if (project) {
        resolvedProjectId = project.id
      } else {
        // Create the project
        const newProject = this.projectRepo.create(projectName, undefined, true)
        resolvedProjectId = newProject.id
      }
    }

    if (!resolvedProjectId) {
      // Use first active project or create default
      const projects = this.projectRepo.getAll()
      if (projects.length > 0) {
        resolvedProjectId = projects[0].id
      } else {
        const fallback = this.projectRepo.create('Geral')
        resolvedProjectId = fallback.id
      }
    }

    const task = this.taskRepo.create({
      projectId: resolvedProjectId,
      title,
      description: description || undefined,
      status: 'todo',
      dueDate: dueDate || undefined,
    })

    const projectObj = this.projectRepo.getById(resolvedProjectId)

    return {
      type: 'create_task',
      success: true,
      description: `Task "${task.title}" criada no projeto ${projectObj?.name || ''}`,
      data: { taskId: task.id, projectName: projectObj?.name },
    }
  }

  private async executeUpdateTaskStatus(payload: ActionPayload): Promise<ChatActionResult> {
    const { taskTitle, taskId, status, projectName } = payload

    const validStatuses = ['todo', 'in_progress', 'waiting', 'done']
    if (!status || !validStatuses.includes(status)) {
      return { type: 'update_task_status', success: false, description: `Status inválido: ${status}` }
    }

    let task = null

    // Try by ID first
    if (taskId) {
      task = this.taskRepo.getById(taskId)
    }

    // Try by title search
    if (!task && taskTitle) {
      const results = this.taskRepo.search(taskTitle)
      if (results.length > 0) {
        // If projectName specified, prefer matching project
        if (projectName) {
          const project = this.projectRepo.findByName(projectName)
          if (project) {
            task = results.find((t) => t.projectId === project.id) || results[0]
          } else {
            task = results[0]
          }
        } else {
          task = results[0]
        }
      }
    }

    if (!task) {
      return {
        type: 'update_task_status',
        success: false,
        description: `Task não encontrada: "${taskTitle || taskId}"`,
      }
    }

    this.taskRepo.update(task.id, { status })

    const statusLabels: Record<string, string> = {
      todo: 'A Fazer',
      in_progress: 'Em Andamento',
      waiting: 'Aguardando',
      done: 'Concluído',
    }

    return {
      type: 'update_task_status',
      success: true,
      description: `Task "${task.title}" movida para ${statusLabels[status] || status}`,
      data: { taskId: task.id, newStatus: status },
    }
  }

  private async executeCreateEntry(payload: ActionPayload): Promise<ChatActionResult> {
    const { text, projectName, projectId, type } = payload

    if (!text) {
      return { type: 'create_entry', success: false, description: 'Texto da entrada é obrigatório.' }
    }

    // Resolve project
    let resolvedProjectId = projectId
    if (!resolvedProjectId && projectName) {
      const project = this.projectRepo.findByName(projectName)
      if (project) {
        resolvedProjectId = project.id
      }
    }

    if (!resolvedProjectId) {
      const projects = this.projectRepo.getAll()
      if (projects.length > 0) {
        resolvedProjectId = projects[0].id
      } else {
        const fallback = this.projectRepo.create('Geral')
        resolvedProjectId = fallback.id
      }
    }

    const entry = this.entryRepo.create({
      rawText: text,
      improvedText: text,
      projectId: resolvedProjectId,
      type: type || 'information',
      action: 'none',
      reviewStatus: 'auto_approved',
    })

    const projectObj = this.projectRepo.getById(resolvedProjectId)

    return {
      type: 'create_entry',
      success: true,
      description: `Entrada criada no projeto ${projectObj?.name || ''}`,
      data: { entryId: entry.id, projectName: projectObj?.name },
    }
  }

  private async executeListTasks(payload: ActionPayload): Promise<ChatActionResult> {
    const { projectName, status } = payload

    let tasks = this.taskRepo.getAll()

    // Filter by project
    if (projectName) {
      const project = this.projectRepo.findByName(projectName)
      if (project) {
        tasks = tasks.filter((t) => t.projectId === project.id)
      } else {
        return { type: 'list_tasks', success: false, description: t('notifications.action_approval.project_missing') }
      }
    }

    // Filter by status
    if (status) {
      tasks = tasks.filter((t) => t.status === status)
    } else {
      // Default: show non-done tasks
      tasks = tasks.filter((t) => t.status !== 'done')
    }

    const taskList = tasks
      .slice(0, 15)
      .map((t) => {
        const project = this.projectRepo.getById(t.projectId)
        return `- [${t.status}] ${t.title}${project ? ` (${project.name})` : ''}`
      })
      .join('\n')

    return {
      type: 'list_tasks',
      success: true,
      description: `${tasks.length} task(s) encontrada(s)`,
      data: { count: tasks.length, list: taskList },
    }
  }
}
