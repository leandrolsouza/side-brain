import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AgentService } from '../../../src/main/services/agent-service'
import type { AgentRepository } from '../../../src/main/database/repositories/agent-repository'
import type { AgentRuntime } from '../../../src/main/services/agent-runtime'
import type { AgentToolRegistry } from '../../../src/main/services/agent-tool-registry'
import type { AgentDefinition } from '../../../src/shared/types'

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'agent-1',
    name: 'Agente Teste',
    description: 'desc',
    persona: 'persona',
    icon: 'Bot',
    color: 'cyan',
    skills: ['read_entries'],
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

describe('AgentService', () => {
  let service: AgentService
  let mockRepo: {
    getAll: ReturnType<typeof vi.fn>
    getActive: ReturnType<typeof vi.fn>
    getById: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    getExecutionsForAgent: ReturnType<typeof vi.fn>
    getRecentExecutions: ReturnType<typeof vi.fn>
    getExecution: ReturnType<typeof vi.fn>
    deleteOldExecutions: ReturnType<typeof vi.fn>
  }
  let mockRuntime: { execute: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }
  let mockRegistry: { getAllToolDefinitions: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockRepo = {
      getAll: vi.fn(() => []),
      getActive: vi.fn(() => []),
      getById: vi.fn(() => null),
      create: vi.fn((data: any) => makeAgent(data)),
      update: vi.fn(() => null),
      delete: vi.fn(() => true),
      getExecutionsForAgent: vi.fn(() => []),
      getRecentExecutions: vi.fn(() => []),
      getExecution: vi.fn(() => null),
      deleteOldExecutions: vi.fn(() => 0),
    }
    mockRuntime = {
      execute: vi.fn().mockResolvedValue({ executionId: 'exec-1', agentId: 'agent-1', status: 'completed', steps: [] }),
      cancel: vi.fn(),
    }
    mockRegistry = {
      getAllToolDefinitions: vi.fn(() => [
        { name: 'read_entries', description: 'Lê entradas', parameters: {}, requiredParams: [] },
      ]),
    }

    service = new AgentService(
      mockRepo as unknown as AgentRepository,
      mockRuntime as unknown as AgentRuntime,
      mockRegistry as unknown as AgentToolRegistry
    )
  })

  afterEach(() => {
    service.stopAllSchedules()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('CRUD', () => {
    it('getAll deve delegar ao repository', () => {
      const agents = [makeAgent()]
      mockRepo.getAll.mockReturnValue(agents)

      expect(service.getAll()).toEqual(agents)
    })

    it('getById deve delegar ao repository', () => {
      const agent = makeAgent()
      mockRepo.getById.mockReturnValue(agent)

      expect(service.getById('agent-1')).toEqual(agent)
      expect(mockRepo.getById).toHaveBeenCalledWith('agent-1')
    })

    it('create deve criar agente via repository', () => {
      const data = {
        name: 'Novo',
        description: 'd',
        persona: 'p',
        icon: 'Bot',
        color: 'red',
        skills: ['read_tasks'] as any,
        scope: { projectIds: 'all' as const },
        triggers: [{ type: 'manual' as const }],
        canDelegate: [],
        maxSteps: 5,
        isActive: true,
        requiresApproval: false,
      }

      const agent = service.create(data)

      expect(mockRepo.create).toHaveBeenCalledWith(data)
      expect(agent.name).toBe('Novo')
    })

    it('delete deve delegar ao repository', () => {
      expect(service.delete('agent-1')).toBe(true)
      expect(mockRepo.delete).toHaveBeenCalledWith('agent-1')
    })

    it('toggleActive deve inverter isActive', () => {
      const agent = makeAgent({ isActive: true })
      mockRepo.getById.mockReturnValue(agent)
      mockRepo.update.mockReturnValue(makeAgent({ isActive: false }))

      const updated = service.toggleActive('agent-1')

      expect(mockRepo.update).toHaveBeenCalledWith('agent-1', { isActive: false })
      expect(updated!.isActive).toBe(false)
    })

    it('toggleActive deve retornar null quando agente não existe', () => {
      mockRepo.getById.mockReturnValue(null)

      expect(service.toggleActive('inexistente')).toBeNull()
      expect(mockRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('createFromTemplate', () => {
    it('deve lançar erro para template inexistente', () => {
      expect(() => service.createFromTemplate('template-fake')).toThrow('not found')
    })

    it('deve criar agente a partir de template com overrides', () => {
      service.createFromTemplate('template-arq-software', { name: 'Meu Advisor' })

      expect(mockRepo.create).toHaveBeenCalledTimes(1)
      const arg = mockRepo.create.mock.calls[0][0]
      expect(arg.name).toBe('Meu Advisor')
      expect(arg.skills).toContain('read_entries')
      expect(arg.isActive).toBe(true)
      expect(arg.canDelegate).toEqual([])
    })

    it('deve popular canDelegate com agentes ativos no template de líder', () => {
      mockRepo.getActive.mockReturnValue([makeAgent({ id: 'a1' }), makeAgent({ id: 'a2' })])

      service.createFromTemplate('template-lider-equipe')

      const arg = mockRepo.create.mock.calls[0][0]
      expect(arg.canDelegate).toEqual(['a1', 'a2'])
      expect(arg.skills).toContain('delegate')
    })

    it('getTemplates deve retornar os 4 templates embutidos', () => {
      const templates = service.getTemplates()

      expect(templates).toHaveLength(4)
      expect(templates.map((t) => t.id)).toContain('template-lider-equipe')
    })
  })

  describe('execução', () => {
    it('run deve delegar ao runtime com trigger manual', async () => {
      const result = await service.run('agent-1', 'analise isso')

      expect(mockRuntime.execute).toHaveBeenCalledWith('agent-1', 'analise isso', { trigger: 'manual' })
      expect(result.status).toBe('completed')
    })

    it('cancelExecution deve delegar ao runtime', () => {
      service.cancelExecution('exec-1')

      expect(mockRuntime.cancel).toHaveBeenCalledWith('exec-1')
    })

    it('getExecutions deve usar limite padrão de 20', () => {
      service.getExecutions('agent-1')

      expect(mockRepo.getExecutionsForAgent).toHaveBeenCalledWith('agent-1', 20)
    })
  })

  describe('skills disponíveis', () => {
    it('getAvailableSkills deve incluir tools do registry mais delegate', () => {
      const skills = service.getAvailableSkills()

      expect(skills.map((s) => s.skill)).toEqual(['read_entries', 'delegate'])
    })
  })

  describe('agendamento', () => {
    it('deve agendar execução para trigger every:Nm', () => {
      vi.useFakeTimers()
      const agent = makeAgent({
        id: 'agent-sched',
        triggers: [{ type: 'schedule', scheduleConfig: { expression: 'every:5m' } }],
      })
      mockRepo.create.mockReturnValue(agent)

      service.create(agent as any)
      vi.advanceTimersByTime(5 * 60 * 1000)

      expect(mockRuntime.execute).toHaveBeenCalledWith('agent-sched', expect.stringContaining('every:5m'), {
        trigger: 'schedule',
      })
    })

    it('deve agendar execução horária para expressão hourly', () => {
      vi.useFakeTimers()
      const agent = makeAgent({
        id: 'agent-hourly',
        triggers: [{ type: 'schedule', scheduleConfig: { expression: 'hourly' } }],
      })
      mockRepo.create.mockReturnValue(agent)

      service.create(agent as any)
      vi.advanceTimersByTime(59 * 60 * 1000)
      expect(mockRuntime.execute).not.toHaveBeenCalled()

      vi.advanceTimersByTime(60 * 1000)
      expect(mockRuntime.execute).toHaveBeenCalledTimes(1)
    })

    it('não deve agendar para expressão inválida', () => {
      vi.useFakeTimers()
      const agent = makeAgent({
        triggers: [{ type: 'schedule', scheduleConfig: { expression: 'every:abcm' } }],
      })
      mockRepo.create.mockReturnValue(agent)

      service.create(agent as any)
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)

      expect(mockRuntime.execute).not.toHaveBeenCalled()
    })

    it('não deve agendar agente inativo', () => {
      vi.useFakeTimers()
      const agent = makeAgent({
        isActive: false,
        triggers: [{ type: 'schedule', scheduleConfig: { expression: 'every:1m' } }],
      })
      mockRepo.create.mockReturnValue(agent)

      service.create(agent as any)
      vi.advanceTimersByTime(10 * 60 * 1000)

      expect(mockRuntime.execute).not.toHaveBeenCalled()
    })

    it('delete deve cancelar agendamentos do agente', () => {
      vi.useFakeTimers()
      const agent = makeAgent({
        id: 'agent-del',
        triggers: [{ type: 'schedule', scheduleConfig: { expression: 'every:5m' } }],
      })
      mockRepo.create.mockReturnValue(agent)
      service.create(agent as any)

      service.delete('agent-del')
      vi.advanceTimersByTime(30 * 60 * 1000)

      expect(mockRuntime.execute).not.toHaveBeenCalled()
    })

    it('stopAllSchedules deve cancelar todos os timers', () => {
      vi.useFakeTimers()
      const agent = makeAgent({
        triggers: [{ type: 'schedule', scheduleConfig: { expression: 'every:5m' } }],
      })
      mockRepo.create.mockReturnValue(agent)
      service.create(agent as any)

      service.stopAllSchedules()
      vi.advanceTimersByTime(60 * 60 * 1000)

      expect(mockRuntime.execute).not.toHaveBeenCalled()
    })

    it('initializeSchedules deve agendar todos os agentes ativos', () => {
      vi.useFakeTimers()
      mockRepo.getActive.mockReturnValue([
        makeAgent({ id: 'a1', triggers: [{ type: 'schedule', scheduleConfig: { expression: 'every:10m' } }] }),
        makeAgent({ id: 'a2', triggers: [{ type: 'manual' }] }),
      ])

      service.initializeSchedules()
      vi.advanceTimersByTime(10 * 60 * 1000)

      expect(mockRuntime.execute).toHaveBeenCalledTimes(1)
      expect(mockRuntime.execute).toHaveBeenCalledWith('a1', expect.any(String), { trigger: 'schedule' })
    })
  })

  describe('cleanup', () => {
    it('deve delegar limpeza de execuções antigas ao repository', () => {
      mockRepo.deleteOldExecutions.mockReturnValue(3)

      expect(service.cleanup()).toBe(3)
      expect(mockRepo.deleteOldExecutions).toHaveBeenCalledWith(30)
    })
  })
})
