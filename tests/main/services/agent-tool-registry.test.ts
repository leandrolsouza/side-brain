import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { AgentToolRegistry } from '../../../src/main/services/agent-tool-registry'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'
import { MeetingRepository } from '../../../src/main/database/repositories/meeting-repository'
import { NotificationRepository } from '../../../src/main/database/repositories/notification-repository'
import { SettingsRepository } from '../../../src/main/database/repositories/settings-repository'
import type { EmbeddingsService } from '../../../src/main/services/embeddings-service'
import type { AIService } from '../../../src/main/services/ai-service'
import type { AgentDefinition, AgentSkill } from '../../../src/shared/types'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

const mockEmbeddings = {
  searchSimilar: vi.fn(),
} as unknown as EmbeddingsService

const mockAIService = {
  generateSummary: vi.fn(),
  generateGlobalSummary: vi.fn(),
  discoverConnections: vi.fn(),
} as unknown as AIService

const ALL_SKILLS: AgentSkill[] = [
  'read_entries',
  'read_tasks',
  'read_projects',
  'read_meetings',
  'create_task',
  'update_task',
  'create_entry',
  'generate_summary',
  'generate_report',
  'search_semantic',
  'discover_connections',
  'send_notification',
]

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'agent-1',
    name: 'Agente Teste',
    description: 'desc',
    persona: 'persona',
    icon: 'Bot',
    color: 'cyan',
    skills: ALL_SKILLS,
    scope: { projectIds: 'all' },
    triggers: [{ type: 'manual' }],
    canDelegate: [],
    maxSteps: 8,
    isActive: true,
    requiresApproval: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('AgentToolRegistry', () => {
  let registry: AgentToolRegistry
  let entryRepo: EntryRepository
  let projectRepo: ProjectRepository
  let taskRepo: TaskRepository
  let meetingRepo: MeetingRepository
  let notificationRepo: NotificationRepository
  let settingsRepo: SettingsRepository

  beforeEach(() => {
    createTestDatabase()
    entryRepo = new EntryRepository()
    projectRepo = new ProjectRepository()
    taskRepo = new TaskRepository()
    meetingRepo = new MeetingRepository()
    notificationRepo = new NotificationRepository()
    settingsRepo = new SettingsRepository()
    registry = new AgentToolRegistry(
      entryRepo,
      projectRepo,
      taskRepo,
      meetingRepo,
      notificationRepo,
      settingsRepo,
      mockEmbeddings,
      mockAIService
    )
    vi.clearAllMocks()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('getToolsForAgent', () => {
    it('deve retornar apenas as tools correspondentes às skills do agente', () => {
      const agent = makeAgent({ skills: ['read_entries', 'create_task'] })

      const tools = registry.getToolsForAgent(agent)

      expect(tools.map((t) => t.name).sort()).toEqual(['create_task', 'read_entries'])
    })

    it('deve ignorar skills sem tool registrada (ex: delegate)', () => {
      const agent = makeAgent({ skills: ['delegate', 'read_tasks'] })

      const tools = registry.getToolsForAgent(agent)

      expect(tools.map((t) => t.name)).toEqual(['read_tasks'])
    })
  })

  describe('getAllToolDefinitions', () => {
    it('deve retornar todas as 12 tools registradas', () => {
      const defs = registry.getAllToolDefinitions()

      expect(defs).toHaveLength(12)
      expect(defs.map((d) => d.name)).toEqual(expect.arrayContaining(ALL_SKILLS))
    })
  })

  describe('executeTool — validações', () => {
    it('deve falhar para tool inexistente', async () => {
      const result = await registry.executeTool({ id: 'c1', name: 'tool_fake', arguments: {} }, makeAgent())

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('deve falhar quando agente não tem a skill', async () => {
      const agent = makeAgent({ skills: ['read_entries'] })

      const result = await registry.executeTool({ id: 'c1', name: 'create_task', arguments: { title: 'X' } }, agent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('permission')
    })

    it('deve capturar exceções do handler e retornar erro', async () => {
      const project = projectRepo.create('Fora do Escopo')
      const agent = makeAgent({ scope: { projectIds: ['outro-id'] } })

      const result = await registry.executeTool(
        { id: 'c1', name: 'create_task', arguments: { title: 'X', projectName: project.name } },
        agent
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('fora do escopo')
    })
  })

  describe('read_entries', () => {
    it('deve retornar entries com filtro de tipo e limite', async () => {
      const project = projectRepo.create('P1')
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId: project.id,
        type: 'decision',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'E2',
        improvedText: 'E2',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const result = await registry.executeTool(
        { id: 'c1', name: 'read_entries', arguments: { type: 'decision' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      expect(result.result.entries).toHaveLength(1)
      expect(result.result.entries[0].type).toBe('decision')
    })

    it('deve respeitar o escopo de projetos do agente', async () => {
      const inScope = projectRepo.create('Dentro')
      const outScope = projectRepo.create('Fora')
      entryRepo.create({
        rawText: 'In',
        improvedText: 'In',
        projectId: inScope.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'Out',
        improvedText: 'Out',
        projectId: outScope.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const agent = makeAgent({ scope: { projectIds: [inScope.id] } })
      const result = await registry.executeTool({ id: 'c1', name: 'read_entries', arguments: {} }, agent)

      expect(result.success).toBe(true)
      expect(result.result.entries).toHaveLength(1)
      expect(result.result.entries[0].projectId).toBe(inScope.id)
    })

    it('deve retornar mensagem quando projeto solicitado está fora do escopo', async () => {
      const outScope = projectRepo.create('Fora')
      const agent = makeAgent({ scope: { projectIds: ['algum-outro'] } })

      const result = await registry.executeTool(
        { id: 'c1', name: 'read_entries', arguments: { projectName: outScope.name } },
        agent
      )

      expect(result.success).toBe(true)
      expect(result.result.entries).toHaveLength(0)
      expect(result.result.message).toContain('fora do escopo')
    })
  })

  describe('read_tasks', () => {
    it('deve filtrar por status e busca textual', async () => {
      const project = projectRepo.create('P1')
      taskRepo.create({ projectId: project.id, title: 'Revisar deploy', status: 'todo' })
      taskRepo.create({ projectId: project.id, title: 'Outra coisa', status: 'todo' })
      const done = taskRepo.create({ projectId: project.id, title: 'Revisar docs' })
      taskRepo.update(done.id, { status: 'done' })

      const result = await registry.executeTool(
        { id: 'c1', name: 'read_tasks', arguments: { status: 'todo', search: 'revisar' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      expect(result.result.tasks).toHaveLength(1)
      expect(result.result.tasks[0].title).toBe('Revisar deploy')
      expect(result.result.tasks[0].projectName).toBe('P1')
    })
  })

  describe('read_projects', () => {
    it('deve listar projetos filtrados pelo escopo', async () => {
      const p1 = projectRepo.create('P1')
      projectRepo.create('P2')

      const agent = makeAgent({ scope: { projectIds: [p1.id] } })
      const result = await registry.executeTool({ id: 'c1', name: 'read_projects', arguments: {} }, agent)

      expect(result.success).toBe(true)
      expect(result.result.projects).toHaveLength(1)
      expect(result.result.projects[0].name).toBe('P1')
    })
  })

  describe('read_meetings', () => {
    it('deve listar reuniões com filtro de status', async () => {
      const project = projectRepo.create('P1')
      meetingRepo.create({ projectId: project.id, title: 'Reunião ativa' })

      const result = await registry.executeTool(
        { id: 'c1', name: 'read_meetings', arguments: { status: 'active' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      expect(result.result.meetings).toHaveLength(1)
      expect(result.result.meetings[0].title).toBe('Reunião ativa')
    })
  })

  describe('create_task', () => {
    it('deve criar task criando o projeto se não existir', async () => {
      const result = await registry.executeTool(
        { id: 'c1', name: 'create_task', arguments: { title: 'Nova task', projectName: 'Projeto Novo' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      expect(result.result.task.title).toBe('Nova task')
      const project = projectRepo.findByName('Projeto Novo')
      expect(project).not.toBeNull()
      expect(taskRepo.getByProject(project!.id)).toHaveLength(1)
    })
  })

  describe('update_task', () => {
    it('deve atualizar task encontrada pelo título (ignorando concluídas)', async () => {
      const project = projectRepo.create('P1')
      const doneTask = taskRepo.create({ projectId: project.id, title: 'Deploy staging' })
      taskRepo.update(doneTask.id, { status: 'done' })
      const openTask = taskRepo.create({ projectId: project.id, title: 'Deploy produção' })

      const result = await registry.executeTool(
        { id: 'c1', name: 'update_task', arguments: { taskTitle: 'deploy produção', status: 'in_progress' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      expect(taskRepo.getById(openTask.id)!.status).toBe('in_progress')
    })

    it('deve falhar quando task não é encontrada', async () => {
      const result = await registry.executeTool(
        { id: 'c1', name: 'update_task', arguments: { taskTitle: 'inexistente', status: 'done' } },
        makeAgent()
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('não encontrada')
    })
  })

  describe('create_entry', () => {
    it('deve criar entry no projeto informado', async () => {
      const project = projectRepo.create('P1')

      const result = await registry.executeTool(
        { id: 'c1', name: 'create_entry', arguments: { text: 'Registro novo', projectName: 'P1' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      expect(result.result.entry.text).toBe('Registro novo')
      expect(entryRepo.getAll(project.id)).toHaveLength(1)
    })
  })

  describe('generate_summary', () => {
    it('deve gerar resumo de projeto específico via AIService', async () => {
      const project = projectRepo.create('Backend')
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      mockAIService.generateSummary = vi.fn().mockResolvedValue('Resumo do backend')

      const result = await registry.executeTool(
        { id: 'c1', name: 'generate_summary', arguments: { projectName: 'Backend' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      expect(result.result.summary).toBe('Resumo do backend')
      expect(result.result.projectName).toBe('Backend')
      expect(mockAIService.generateSummary).toHaveBeenCalledTimes(1)
    })

    it('deve gerar resumo global quando nenhum projeto é informado', async () => {
      projectRepo.create('P1')
      mockAIService.generateGlobalSummary = vi.fn().mockResolvedValue('Resumo global')

      const result = await registry.executeTool({ id: 'c1', name: 'generate_summary', arguments: {} }, makeAgent())

      expect(result.success).toBe(true)
      expect(result.result.summary).toBe('Resumo global')
      expect(result.result.scope).toBe('global')
    })
  })

  describe('generate_report', () => {
    it('deve calcular métricas de tasks e entries', async () => {
      const project = projectRepo.create('P1')
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId: project.id,
        type: 'decision',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      taskRepo.create({ projectId: project.id, title: 'Aberta' })
      const done = taskRepo.create({ projectId: project.id, title: 'Feita' })
      taskRepo.update(done.id, { status: 'done' })

      const result = await registry.executeTool(
        { id: 'c1', name: 'generate_report', arguments: { period: 'week' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      expect(result.result.period).toBe('week')
      expect(result.result.metrics.entriesCreated).toBe(1)
      expect(result.result.metrics.tasksCompleted).toBe(1)
      expect(result.result.metrics.tasksPending).toBe(1)
      expect(result.result.metrics.tasksByStatus.todo).toBe(1)
      expect(result.result.metrics.entriesByType.decision).toBe(1)
    })
  })

  describe('search_semantic', () => {
    it('deve enriquecer resultados com conteúdo de entries e tasks', async () => {
      const project = projectRepo.create('P1')
      const entry = entryRepo.create({
        rawText: 'E1',
        improvedText: 'Texto da entry',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      const task = taskRepo.create({ projectId: project.id, title: 'Título da task' })

      mockEmbeddings.searchSimilar = vi.fn().mockResolvedValue([
        { entityType: 'entry', entityId: entry.id, score: 0.9 },
        { entityType: 'task', entityId: task.id, score: 0.8 },
        { entityType: 'entry', entityId: 'id-que-nao-existe', score: 0.7 },
      ])

      const result = await registry.executeTool(
        { id: 'c1', name: 'search_semantic', arguments: { query: 'busca' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      expect(result.result.total).toBe(2)
      expect(result.result.results[0]).toMatchObject({ type: 'entry', text: 'Texto da entry', score: 0.9 })
      expect(result.result.results[1]).toMatchObject({ type: 'task', text: 'Título da task', score: 0.8 })
    })

    it('deve filtrar resultados fora do escopo do agente', async () => {
      const outScope = projectRepo.create('Fora')
      const entry = entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId: outScope.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      mockEmbeddings.searchSimilar = vi
        .fn()
        .mockResolvedValue([{ entityType: 'entry', entityId: entry.id, score: 0.9 }])

      const agent = makeAgent({ scope: { projectIds: ['outro-projeto'] } })
      const result = await registry.executeTool({ id: 'c1', name: 'search_semantic', arguments: { query: 'x' } }, agent)

      expect(result.success).toBe(true)
      expect(result.result.total).toBe(0)
    })
  })

  describe('discover_connections', () => {
    it('deve delegar análise ao AIService', async () => {
      const project = projectRepo.create('P1')
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      const connections = [{ sourceId: 'a', targetId: 'b', type: 'related' }]
      mockAIService.discoverConnections = vi.fn().mockResolvedValue(connections)

      const result = await registry.executeTool({ id: 'c1', name: 'discover_connections', arguments: {} }, makeAgent())

      expect(result.success).toBe(true)
      expect(result.result.connections).toEqual(connections)
      expect(result.result.analyzed).toBe(1)
      expect(result.result.found).toBe(1)
    })
  })

  describe('send_notification', () => {
    it('deve criar notificação no repositório', async () => {
      const result = await registry.executeTool(
        { id: 'c1', name: 'send_notification', arguments: { title: 'Aviso', body: 'Corpo do aviso' } },
        makeAgent()
      )

      expect(result.success).toBe(true)
      const notifications = notificationRepo.getAll()
      expect(notifications).toHaveLength(1)
      expect(notifications[0].title).toBe('Aviso')
      expect(notifications[0].type).toBe('agent_message')
    })
  })
})
