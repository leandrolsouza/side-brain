import type { AgentDefinition, AgentSkill, ToolDefinition, ToolCall, ToolCallResult } from '../../shared/types'
import type { EntryRepository } from '../database/repositories/entry-repository'
import type { ProjectRepository } from '../database/repositories/project-repository'
import type { TaskRepository } from '../database/repositories/task-repository'
import type { MeetingRepository } from '../database/repositories/meeting-repository'
import type { NotificationRepository } from '../database/repositories/notification-repository'
import type { EmbeddingsService } from './embeddings-service'
import type { AIService } from './ai-service'
import type { SettingsRepository } from '../database/repositories/settings-repository'

type ToolHandler = (args: Record<string, any>, scope: AgentDefinition['scope']) => Promise<any>

interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

/**
 * Registry that maps AgentSkills to concrete tool definitions and handlers.
 * Each tool has a JSON schema (for LLM function calling) and an executor function.
 */
export class AgentToolRegistry {
  private tools: Map<AgentSkill, RegisteredTool> = new Map()

  constructor(
    private entryRepo: EntryRepository,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private meetingRepo: MeetingRepository,
    private notificationRepo: NotificationRepository,
    private settingsRepo: SettingsRepository,
    private embeddingsService: EmbeddingsService,
    private aiService: AIService
  ) {
    this.registerAllTools()
  }

  /**
   * Get tool definitions available to a specific agent (filtered by its skills).
   */
  getToolsForAgent(agent: AgentDefinition): ToolDefinition[] {
    return agent.skills
      .map((skill) => this.tools.get(skill)?.definition)
      .filter((def): def is ToolDefinition => def !== undefined)
  }

  /**
   * Execute a tool call within the scope of an agent.
   */
  async executeTool(call: ToolCall, agent: AgentDefinition): Promise<ToolCallResult> {
    const skill = call.name as AgentSkill
    const registered = this.tools.get(skill)

    if (!registered) {
      return { toolCallId: call.id, success: false, result: null, error: `Tool '${call.name}' not found` }
    }

    if (!agent.skills.includes(skill)) {
      return {
        toolCallId: call.id,
        success: false,
        result: null,
        error: `Agent does not have permission to use '${call.name}'`,
      }
    }

    try {
      const prepared = this.prepareCall(call, agent)
      const result = await registered.handler(prepared.arguments, agent.scope)
      return { toolCallId: call.id, success: true, result }
    } catch (error: any) {
      return { toolCallId: call.id, success: false, result: null, error: error.message }
    }
  }

  validateArguments(definition: ToolDefinition, args: unknown): void {
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Argumentos inválidos.')
    const values = args as Record<string, unknown>
    for (const name of definition.requiredParams) {
      if (values[name] === undefined || values[name] === null || values[name] === '') {
        throw new Error(`Parâmetro obrigatório: ${name}`)
      }
    }
    for (const [name, value] of Object.entries(values)) {
      const schema = definition.parameters[name]
      if (!schema) throw new Error(`Parâmetro desconhecido: ${name}`)
      const validType =
        schema.type === 'array'
          ? Array.isArray(value)
          : schema.type === 'object'
            ? typeof value === 'object' && value !== null && !Array.isArray(value)
            : typeof value === schema.type
      if (!validType || (schema.enum && !schema.enum.includes(value as string))) {
        throw new Error(`Parâmetro inválido: ${name}`)
      }
    }
  }

  /** Resolve an update target before it is shown for approval. */
  prepareCall(call: ToolCall, agent: AgentDefinition): ToolCall {
    const definition = this.tools.get(call.name as AgentSkill)?.definition
    if (!definition || !agent.skills.includes(call.name as AgentSkill)) throw new Error('Ferramenta não autorizada.')
    this.validateArguments(definition, call.arguments)
    const args = { ...call.arguments }
    if (call.name === 'update_task') {
      let task = args.taskId ? this.taskRepo.getById(args.taskId) : null
      if (args.taskId && !task) throw new Error('Tarefa não encontrada.')
      if (!task && args.taskTitle) {
        const project = args.projectName ? this.projectRepo.findByName(args.projectName) : null
        if (args.projectName && !project) throw new Error('Projeto não encontrado.')
        const matches = this.taskRepo
          .getAll(project?.id)
          .filter(
            (item) =>
              item.title.toLowerCase().includes(args.taskTitle.toLowerCase()) &&
              item.status !== 'done' &&
              (agent.scope.projectIds === 'all' || agent.scope.projectIds.includes(item.projectId))
          )
        if (matches.length > 1) throw new Error('Há várias tarefas correspondentes. Informe o ID da tarefa.')
        task = matches[0] || null
      }
      if (!task) throw new Error('Tarefa não encontrada.')
      if (agent.scope.projectIds !== 'all' && !agent.scope.projectIds.includes(task.projectId)) {
        throw new Error('Tarefa pertence a projeto fora do escopo deste agente.')
      }
      args.taskId = task.id
      args.taskTitle = task.title
      args.projectName = this.projectRepo.getById(task.projectId)?.name
    }
    if ((call.name === 'create_task' || call.name === 'create_entry') && agent.scope.projectIds !== 'all') {
      const project = this.projectRepo.findByName(args.projectName)
      if (!project || !agent.scope.projectIds.includes(project.id))
        throw new Error('Projeto fora do escopo deste agente.')
    }
    return { ...call, arguments: args }
  }

  getApprovalDetails(call: ToolCall): Record<string, unknown> {
    if (call.name === 'update_task' && call.arguments.taskId) {
      return { arguments: call.arguments, target: this.taskRepo.getById(call.arguments.taskId) }
    }
    if (call.name === 'create_task' || call.name === 'create_entry') {
      const project = this.projectRepo.findByName(call.arguments.projectName)
      return { arguments: call.arguments, project: project ? { id: project.id, name: project.name } : null }
    }
    return { arguments: call.arguments }
  }

  /**
   * Get all tool definitions (for documentation/UI).
   */
  getAllToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition)
  }

  // ─── Tool Registration ────────────────────────────────────────

  private registerAllTools(): void {
    this.registerReadEntries()
    this.registerReadTasks()
    this.registerReadProjects()
    this.registerReadMeetings()
    this.registerCreateTask()
    this.registerUpdateTask()
    this.registerCreateEntry()
    this.registerGenerateSummary()
    this.registerGenerateReport()
    this.registerSearchSemantic()
    this.registerDiscoverConnections()
    this.registerSendNotification()
    // 'delegate' is handled by the AgentRuntime, not by the registry
  }

  // ─── Read Tools ───────────────────────────────────────────────

  private registerReadEntries(): void {
    this.tools.set('read_entries', {
      definition: {
        name: 'read_entries',
        description: 'Busca entradas/registros do usuário. Pode filtrar por projeto, tipo, ou texto.',
        parameters: {
          projectId: { type: 'string', description: 'ID do projeto para filtrar (opcional)', required: false },
          projectName: { type: 'string', description: 'Nome do projeto para filtrar (opcional)', required: false },
          type: {
            type: 'string',
            description: 'Tipo da entrada para filtrar (ex: information, decision, demand, idea, blocker, update)',
            required: false,
          },
          limit: { type: 'number', description: 'Quantidade máxima de resultados (padrão: 20)', required: false },
          search: { type: 'string', description: 'Texto para buscar nas entradas', required: false },
        },
        requiredParams: [],
      },
      handler: async (args, scope) => {
        let projectId = args.projectId
        if (!projectId && args.projectName) {
          const project = this.projectRepo.findByName(args.projectName)
          if (project) projectId = project.id
        }

        // Apply scope filter
        if (scope.projectIds !== 'all' && projectId && !scope.projectIds.includes(projectId)) {
          return { entries: [], message: 'Projeto fora do escopo deste agente.' }
        }

        let entries = this.entryRepo.getAll(projectId)

        // Filter by scope projects
        if (scope.projectIds !== 'all') {
          entries = entries.filter((e) => scope.projectIds.includes(e.projectId))
        }

        if (args.type) {
          entries = entries.filter((e) => e.type === args.type)
        }

        if (scope.entryTypes && scope.entryTypes.length > 0) {
          entries = entries.filter((e) => scope.entryTypes!.includes(e.type))
        }

        const limit = args.limit || 20
        entries = entries.slice(0, limit)

        return {
          entries: entries.map((e) => ({
            id: e.id,
            text: e.improvedText,
            type: e.type,
            action: e.action,
            projectId: e.projectId,
            createdAt: e.createdAt,
          })),
          total: entries.length,
        }
      },
    })
  }

  private registerReadTasks(): void {
    this.tools.set('read_tasks', {
      definition: {
        name: 'read_tasks',
        description: 'Busca tarefas do usuário. Pode filtrar por projeto, status, ou buscar por texto.',
        parameters: {
          projectId: { type: 'string', description: 'ID do projeto para filtrar', required: false },
          projectName: { type: 'string', description: 'Nome do projeto para filtrar', required: false },
          status: {
            type: 'string',
            description: 'Status da tarefa (todo, in_progress, waiting, done)',
            required: false,
            enum: ['todo', 'in_progress', 'waiting', 'done'],
          },
          limit: { type: 'number', description: 'Quantidade máxima de resultados (padrão: 30)', required: false },
          search: { type: 'string', description: 'Texto para buscar nas tarefas', required: false },
        },
        requiredParams: [],
      },
      handler: async (args, scope) => {
        let projectId = args.projectId
        if (!projectId && args.projectName) {
          const project = this.projectRepo.findByName(args.projectName)
          if (project) projectId = project.id
        }

        if (scope.projectIds !== 'all' && projectId && !scope.projectIds.includes(projectId)) {
          return { tasks: [], message: 'Projeto fora do escopo deste agente.' }
        }

        let tasks = this.taskRepo.getAll(projectId)

        if (scope.projectIds !== 'all') {
          tasks = tasks.filter((t) => scope.projectIds.includes(t.projectId))
        }

        if (args.status) {
          tasks = tasks.filter((t) => t.status === args.status)
        }

        if (args.search) {
          const q = args.search.toLowerCase()
          tasks = tasks.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
        }

        const limit = args.limit || 30
        tasks = tasks.slice(0, limit)

        const projects = this.projectRepo.getAll()
        const projectMap = new Map(projects.map((p) => [p.id, p.name]))

        return {
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            projectId: t.projectId,
            projectName: projectMap.get(t.projectId) || '?',
            assignee: t.assignee,
            dueDate: t.dueDate,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
          total: tasks.length,
        }
      },
    })
  }

  private registerReadProjects(): void {
    this.tools.set('read_projects', {
      definition: {
        name: 'read_projects',
        description: 'Lista os projetos do usuário com informações básicas.',
        parameters: {
          includeInactive: {
            type: 'boolean',
            description: 'Incluir projetos inativos (padrão: false)',
            required: false,
          },
        },
        requiredParams: [],
      },
      handler: async (args, scope) => {
        let projects = this.projectRepo.getAll(args.includeInactive || false)

        if (scope.projectIds !== 'all') {
          projects = projects.filter((p) => scope.projectIds.includes(p.id))
        }

        return {
          projects: projects.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            active: p.active,
            createdAt: p.createdAt,
          })),
        }
      },
    })
  }

  private registerReadMeetings(): void {
    this.tools.set('read_meetings', {
      definition: {
        name: 'read_meetings',
        description: 'Busca reuniões registradas pelo usuário.',
        parameters: {
          projectId: { type: 'string', description: 'ID do projeto para filtrar', required: false },
          status: {
            type: 'string',
            description: 'Status da reunião (active, ended, processed)',
            required: false,
            enum: ['active', 'ended', 'processed'],
          },
          limit: { type: 'number', description: 'Quantidade máxima (padrão: 10)', required: false },
        },
        requiredParams: [],
      },
      handler: async (args, scope) => {
        let meetings = this.meetingRepo.getAll(args.projectId)

        if (scope.projectIds !== 'all') {
          meetings = meetings.filter((m) => scope.projectIds.includes(m.projectId))
        }

        if (args.status) {
          meetings = meetings.filter((m) => m.status === args.status)
        }

        const limit = args.limit || 10
        meetings = meetings.slice(0, limit)

        return {
          meetings: meetings.map((m) => ({
            id: m.id,
            title: m.title,
            projectId: m.projectId,
            participants: m.participants,
            status: m.status,
            meetingDate: m.meetingDate,
            hasMinutes: !!m.generatedMinutes,
          })),
        }
      },
    })
  }

  // ─── Write Tools ──────────────────────────────────────────────

  private registerCreateTask(): void {
    this.tools.set('create_task', {
      definition: {
        name: 'create_task',
        description: 'Cria uma nova tarefa em um projeto.',
        parameters: {
          title: { type: 'string', description: 'Título da tarefa', required: true },
          description: { type: 'string', description: 'Descrição detalhada', required: false },
          projectName: { type: 'string', description: 'Nome do projeto onde criar a tarefa', required: true },
          status: {
            type: 'string',
            description: 'Status inicial (padrão: todo)',
            required: false,
            enum: ['todo', 'in_progress', 'waiting'],
          },
          dueDate: { type: 'string', description: 'Data limite no formato YYYY-MM-DD', required: false },
          assignee: { type: 'string', description: 'Responsável pela tarefa', required: false },
        },
        requiredParams: ['title', 'projectName'],
      },
      handler: async (args, scope) => {
        let project = this.projectRepo.findByName(args.projectName)
        if (!project) {
          if (scope.projectIds !== 'all') throw new Error('Projeto fora do escopo deste agente.')
          project = this.projectRepo.create(args.projectName, undefined, true)
        }

        if (scope.projectIds !== 'all' && !scope.projectIds.includes(project.id)) {
          throw new Error('Projeto fora do escopo deste agente.')
        }

        const task = this.taskRepo.create({
          projectId: project.id,
          title: args.title,
          description: args.description,
          status: args.status || 'todo',
          dueDate: args.dueDate,
          assignee: args.assignee,
        })

        return {
          success: true,
          task: { id: task.id, title: task.title, projectName: project.name, status: task.status },
          message: `Tarefa "${task.title}" criada no projeto "${project.name}".`,
        }
      },
    })
  }

  private registerUpdateTask(): void {
    this.tools.set('update_task', {
      definition: {
        name: 'update_task',
        description: 'Atualiza uma tarefa existente (status, título, descrição, etc).',
        parameters: {
          taskId: { type: 'string', description: 'ID da tarefa para atualizar', required: false },
          taskTitle: {
            type: 'string',
            description: 'Título da tarefa para buscar (se não tiver o ID)',
            required: false,
          },
          projectName: {
            type: 'string',
            description: 'Nome do projeto da tarefa (ajuda na busca por título)',
            required: false,
          },
          status: {
            type: 'string',
            description: 'Novo status',
            required: false,
            enum: ['todo', 'in_progress', 'waiting', 'done'],
          },
          title: { type: 'string', description: 'Novo título', required: false },
          description: { type: 'string', description: 'Nova descrição', required: false },
          assignee: { type: 'string', description: 'Novo responsável', required: false },
          dueDate: { type: 'string', description: 'Nova data limite (YYYY-MM-DD)', required: false },
        },
        requiredParams: [],
      },
      handler: async (args, scope) => {
        let taskId = args.taskId

        // Find task by title if no ID
        if (!taskId && args.taskTitle) {
          let projectId: string | undefined
          if (args.projectName) {
            const project = this.projectRepo.findByName(args.projectName)
            if (project) projectId = project.id
          }

          const tasks = this.taskRepo.getAll(projectId)
          const matches = tasks.filter(
            (t) => t.title.toLowerCase().includes(args.taskTitle.toLowerCase()) && t.status !== 'done'
          )
          if (matches.length > 1) throw new Error('Há várias tarefas correspondentes. Informe o ID da tarefa.')
          if (matches.length === 1) taskId = matches[0].id
        }

        if (!taskId) {
          throw new Error('Tarefa não encontrada. Forneça taskId ou taskTitle.')
        }

        const existing = this.taskRepo.getById(taskId)
        if (!existing) {
          throw new Error(`Tarefa com ID "${taskId}" não encontrada.`)
        }

        if (scope.projectIds !== 'all' && !scope.projectIds.includes(existing.projectId)) {
          throw new Error('Tarefa pertence a projeto fora do escopo deste agente.')
        }

        const updates: any = {}
        if (args.status) updates.status = args.status
        if (args.title) updates.title = args.title
        if (args.description !== undefined) updates.description = args.description
        if (args.assignee !== undefined) updates.assignee = args.assignee
        if (args.dueDate !== undefined) updates.dueDate = args.dueDate

        const updated = this.taskRepo.update(taskId, updates)

        return {
          success: true,
          task: updated,
          message: `Tarefa "${updated?.title}" atualizada.`,
        }
      },
    })
  }

  private registerCreateEntry(): void {
    this.tools.set('create_entry', {
      definition: {
        name: 'create_entry',
        description: 'Cria uma nova entrada/registro em um projeto.',
        parameters: {
          text: { type: 'string', description: 'Texto da entrada', required: true },
          projectName: { type: 'string', description: 'Nome do projeto', required: true },
          type: {
            type: 'string',
            description: 'Tipo da entrada (information, decision, demand, idea, blocker, update)',
            required: false,
          },
          action: { type: 'string', description: 'Status de ação (none, pending, in_progress, done)', required: false },
        },
        requiredParams: ['text', 'projectName'],
      },
      handler: async (args, scope) => {
        let project = this.projectRepo.findByName(args.projectName)
        if (!project) {
          if (scope.projectIds !== 'all') throw new Error('Projeto fora do escopo deste agente.')
          project = this.projectRepo.create(args.projectName, undefined, true)
        }

        if (scope.projectIds !== 'all' && !scope.projectIds.includes(project.id)) {
          throw new Error('Projeto fora do escopo deste agente.')
        }

        const entry = this.entryRepo.create({
          rawText: args.text,
          improvedText: args.text,
          projectId: project.id,
          type: args.type || 'information',
          action: args.action || 'none',
          reviewStatus: 'auto_approved',
        })

        return {
          success: true,
          entry: { id: entry.id, text: entry.improvedText, projectName: project.name, type: entry.type },
          message: `Entrada registrada no projeto "${project.name}".`,
        }
      },
    })
  }

  // ─── AI Tools ─────────────────────────────────────────────────

  private registerGenerateSummary(): void {
    this.tools.set('generate_summary', {
      definition: {
        name: 'generate_summary',
        description: 'Gera um resumo de um projeto ou de todas as atividades recentes.',
        parameters: {
          projectName: {
            type: 'string',
            description: 'Nome do projeto para resumir (se omitido, resume tudo)',
            required: false,
          },
        },
        requiredParams: [],
      },
      handler: async (args, scope) => {
        const settings = this.settingsRepo.get()
        let projectId: string | undefined

        if (args.projectName) {
          const project = this.projectRepo.findByName(args.projectName)
          if (project) {
            if (scope.projectIds !== 'all' && !scope.projectIds.includes(project.id)) {
              throw new Error('Projeto fora do escopo deste agente.')
            }
            projectId = project.id
          }
        }

        if (projectId) {
          const project = this.projectRepo.getById(projectId)!
          const entries = this.entryRepo.getAll(projectId).slice(0, 20)
          const tasks = this.taskRepo.getAll(projectId)

          const summary = await this.aiService.generateSummary(
            project.name,
            entries.map((e) => ({
              improvedText: e.improvedText,
              type: e.type,
              action: e.action,
              createdAt: e.createdAt,
            })),
            tasks.map((t) => ({ title: t.title, status: t.status, description: t.description })),
            settings
          )

          return { summary, projectName: project.name }
        }

        // Global summary
        const projects = this.projectRepo.getAll()
        const filteredProjects =
          scope.projectIds === 'all' ? projects : projects.filter((p) => scope.projectIds.includes(p.id))

        const projectsData = filteredProjects.slice(0, 5).map((p) => {
          const entries = this.entryRepo.getAll(p.id).slice(0, 5)
          const tasks = this.taskRepo.getAll(p.id)
          return {
            name: p.name,
            entries: entries.map((e) => ({
              improvedText: e.improvedText,
              type: e.type,
              action: e.action,
              createdAt: e.createdAt,
            })),
            tasks: tasks.map((t) => ({ title: t.title, status: t.status })),
          }
        })

        const summary = await this.aiService.generateGlobalSummary(projectsData, settings)
        return { summary, scope: 'global' }
      },
    })
  }

  private registerGenerateReport(): void {
    this.tools.set('generate_report', {
      definition: {
        name: 'generate_report',
        description: 'Gera um relatório analítico com métricas de produtividade.',
        parameters: {
          projectName: {
            type: 'string',
            description: 'Projeto específico (se omitido, relatório geral)',
            required: false,
          },
          period: {
            type: 'string',
            description: 'Período: "week", "month", "quarter" (padrão: week)',
            required: false,
            enum: ['week', 'month', 'quarter'],
          },
        },
        requiredParams: [],
      },
      handler: async (args, scope) => {
        const period = args.period || 'week'
        const now = new Date()
        const daysBack = period === 'week' ? 7 : period === 'month' ? 30 : 90
        const fromDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString()

        let tasks = this.taskRepo.getAll()
        let entries = this.entryRepo.getAll()

        if (scope.projectIds !== 'all') {
          tasks = tasks.filter((t) => scope.projectIds.includes(t.projectId))
          entries = entries.filter((e) => scope.projectIds.includes(e.projectId))
        }

        if (args.projectName) {
          const project = this.projectRepo.findByName(args.projectName)
          if (project) {
            tasks = tasks.filter((t) => t.projectId === project.id)
            entries = entries.filter((e) => e.projectId === project.id)
          }
        }

        const recentEntries = entries.filter((e) => e.createdAt >= fromDate)
        const recentTasksCompleted = tasks.filter((t) => t.status === 'done' && t.updatedAt >= fromDate)
        const pendingTasks = tasks.filter((t) => t.status !== 'done')

        return {
          period,
          metrics: {
            entriesCreated: recentEntries.length,
            tasksCompleted: recentTasksCompleted.length,
            tasksPending: pendingTasks.length,
            tasksByStatus: {
              todo: tasks.filter((t) => t.status === 'todo').length,
              in_progress: tasks.filter((t) => t.status === 'in_progress').length,
              waiting: tasks.filter((t) => t.status === 'waiting').length,
              done: tasks.filter((t) => t.status === 'done').length,
            },
            entriesByType: recentEntries.reduce(
              (acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1
                return acc
              },
              {} as Record<string, number>
            ),
          },
          summary: `No período de ${daysBack} dias: ${recentEntries.length} entradas criadas, ${recentTasksCompleted.length} tarefas concluídas, ${pendingTasks.length} tarefas pendentes.`,
        }
      },
    })
  }

  private registerSearchSemantic(): void {
    this.tools.set('search_semantic', {
      definition: {
        name: 'search_semantic',
        description:
          'Busca semântica por entradas e tarefas similares a um texto. Usa embeddings para encontrar conteúdo relacionado.',
        parameters: {
          query: { type: 'string', description: 'Texto para buscar semanticamente', required: true },
          entityType: {
            type: 'string',
            description: 'Tipo de entidade para buscar (entry, task, all)',
            required: false,
            enum: ['entry', 'task', 'all'],
          },
          limit: { type: 'number', description: 'Quantidade máxima de resultados (padrão: 10)', required: false },
        },
        requiredParams: ['query'],
      },
      handler: async (args, scope) => {
        const results = await this.embeddingsService.searchSimilar(
          args.query,
          args.entityType || 'all',
          args.limit || 10
        )

        // Enrich results with actual content
        const enriched = results
          .map((r) => {
            if (r.entityType === 'entry') {
              const entry = this.entryRepo.getById(r.entityId)
              if (!entry) return null
              if (scope.projectIds !== 'all' && !scope.projectIds.includes(entry.projectId)) return null
              return {
                type: 'entry',
                id: r.entityId,
                text: entry.improvedText,
                score: r.score,
                projectId: entry.projectId,
              }
            } else {
              const task = this.taskRepo.getById(r.entityId)
              if (!task) return null
              if (scope.projectIds !== 'all' && !scope.projectIds.includes(task.projectId)) return null
              return {
                type: 'task',
                id: r.entityId,
                text: task.title,
                description: task.description,
                score: r.score,
                status: task.status,
              }
            }
          })
          .filter(Boolean)

        return { results: enriched, total: enriched.length }
      },
    })
  }

  private registerDiscoverConnections(): void {
    this.tools.set('discover_connections', {
      definition: {
        name: 'discover_connections',
        description:
          'Analisa entradas e descobre conexões semânticas entre elas (ex: temas relacionados, dependências, evoluções).',
        parameters: {
          projectName: {
            type: 'string',
            description: 'Projeto para analisar (se omitido, analisa todos no escopo)',
            required: false,
          },
          limit: { type: 'number', description: 'Quantidade de entradas a analisar (padrão: 20)', required: false },
        },
        requiredParams: [],
      },
      handler: async (args, scope) => {
        const settings = this.settingsRepo.get()
        let entries = this.entryRepo.getAll()

        if (scope.projectIds !== 'all') {
          entries = entries.filter((e) => scope.projectIds.includes(e.projectId))
        }

        if (args.projectName) {
          const project = this.projectRepo.findByName(args.projectName)
          if (project) {
            entries = entries.filter((e) => e.projectId === project.id)
          }
        }

        const limit = args.limit || 20
        const recentEntries = entries.slice(0, limit).map((e) => ({
          id: e.id,
          improvedText: e.improvedText,
          type: e.type,
          projectId: e.projectId,
          createdAt: e.createdAt,
        }))

        const connections = await this.aiService.discoverConnections(recentEntries, settings)

        return {
          connections,
          analyzed: recentEntries.length,
          found: connections.length,
        }
      },
    })
  }

  private registerSendNotification(): void {
    this.tools.set('send_notification', {
      definition: {
        name: 'send_notification',
        description: 'Envia uma notificação para o usuário dentro do app.',
        parameters: {
          title: { type: 'string', description: 'Título da notificação', required: true },
          body: { type: 'string', description: 'Corpo/conteúdo da notificação', required: true },
        },
        requiredParams: ['title', 'body'],
      },
      handler: async (args) => {
        this.notificationRepo.create({
          type: 'agent_message',
          title: args.title,
          body: args.body,
        })

        return { success: true, message: `Notificação "${args.title}" enviada.` }
      },
    })
  }
}
