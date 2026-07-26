import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { AgentRepository } from '../../../src/main/database/repositories/agent-repository'
import type { AgentDefinition } from '../../../src/shared/types'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

function baseAgentData(
  overrides: Partial<Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'>> = {}
): Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Agente Teste',
    description: 'Agente para testes',
    persona: 'Você é um assistente de testes',
    icon: 'Bot',
    color: 'blue',
    skills: ['read_entries', 'create_task'],
    scope: { projectIds: 'all' },
    triggers: [{ type: 'manual' }],
    canDelegate: [],
    maxSteps: 5,
    isActive: true,
    requiresApproval: true,
    ...overrides,
  }
}

describe('AgentRepository', () => {
  let repo: AgentRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new AgentRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar um agente com todos os campos', () => {
      const agent = repo.create(baseAgentData())

      expect(agent.id).toBeDefined()
      expect(agent.name).toBe('Agente Teste')
      expect(agent.description).toBe('Agente para testes')
      expect(agent.persona).toBe('Você é um assistente de testes')
      expect(agent.icon).toBe('Bot')
      expect(agent.color).toBe('blue')
      expect(agent.skills).toEqual(['read_entries', 'create_task'])
      expect(agent.scope).toEqual({ projectIds: 'all' })
      expect(agent.triggers).toEqual([{ type: 'manual' }])
      expect(agent.canDelegate).toEqual([])
      expect(agent.maxSteps).toBe(5)
      expect(agent.isActive).toBe(true)
      expect(agent.requiresApproval).toBe(true)
      expect(agent.createdAt).toBeDefined()
      expect(agent.updatedAt).toBeDefined()
    })

    it('deve serializar e desserializar campos JSON complexos', () => {
      const agent = repo.create(
        baseAgentData({
          skills: ['search_semantic', 'delegate'],
          scope: {
            projectIds: ['proj-1', 'proj-2'],
            dateRange: { from: '2026-01-01', to: '2026-12-31' },
            entryTypes: ['decision'],
          },
          triggers: [{ type: 'schedule', scheduleConfig: { expression: 'daily:09:00' } }],
          canDelegate: ['agent-x', 'agent-y'],
        })
      )

      const found = repo.getById(agent.id)
      expect(found!.skills).toEqual(['search_semantic', 'delegate'])
      expect(found!.scope.projectIds).toEqual(['proj-1', 'proj-2'])
      expect(found!.scope.dateRange).toEqual({ from: '2026-01-01', to: '2026-12-31' })
      expect(found!.scope.entryTypes).toEqual(['decision'])
      expect(found!.triggers).toEqual([{ type: 'schedule', scheduleConfig: { expression: 'daily:09:00' } }])
      expect(found!.canDelegate).toEqual(['agent-x', 'agent-y'])
    })

    it('deve mapear booleanos para inteiros e de volta', () => {
      const agent = repo.create(baseAgentData({ isActive: false, requiresApproval: false }))

      const found = repo.getById(agent.id)
      expect(found!.isActive).toBe(false)
      expect(found!.requiresApproval).toBe(false)
    })
  })

  describe('getAll', () => {
    it('deve retornar lista vazia quando não há agentes', () => {
      expect(repo.getAll()).toEqual([])
    })

    it('deve retornar agentes ordenados por created_at desc', () => {
      const db = getTestDatabase()
      const antigo = repo.create(baseAgentData({ name: 'Antigo' }))
      const recente = repo.create(baseAgentData({ name: 'Recente' }))
      db.prepare('UPDATE agents SET created_at = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z', antigo.id)
      db.prepare('UPDATE agents SET created_at = ? WHERE id = ?').run('2026-02-01T00:00:00.000Z', recente.id)

      const agents = repo.getAll()
      expect(agents).toHaveLength(2)
      expect(agents[0].name).toBe('Recente')
      expect(agents[1].name).toBe('Antigo')
    })
  })

  describe('getActive', () => {
    it('deve retornar apenas agentes ativos ordenados por nome', () => {
      repo.create(baseAgentData({ name: 'Zebra' }))
      repo.create(baseAgentData({ name: 'Alpha' }))
      repo.create(baseAgentData({ name: 'Inativo', isActive: false }))

      const active = repo.getActive()
      expect(active).toHaveLength(2)
      expect(active.map((a) => a.name)).toEqual(['Alpha', 'Zebra'])
    })

    it('deve retornar lista vazia quando não há agentes ativos', () => {
      repo.create(baseAgentData({ isActive: false }))
      expect(repo.getActive()).toEqual([])
    })
  })

  describe('getById', () => {
    it('deve retornar o agente pelo ID', () => {
      const created = repo.create(baseAgentData())
      const found = repo.getById(created.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.getById('nao-existe')).toBeNull()
    })
  })

  describe('update', () => {
    it('deve atualizar campos parciais mantendo os demais', () => {
      const agent = repo.create(baseAgentData())

      const updated = repo.update(agent.id, { name: 'Novo Nome', maxSteps: 10 })
      expect(updated!.name).toBe('Novo Nome')
      expect(updated!.maxSteps).toBe(10)
      expect(updated!.persona).toBe('Você é um assistente de testes')
      expect(updated!.skills).toEqual(['read_entries', 'create_task'])
    })

    it('deve atualizar campos JSON', () => {
      const agent = repo.create(baseAgentData())

      const updated = repo.update(agent.id, {
        skills: ['generate_report'],
        canDelegate: ['outro-agente'],
      })
      expect(updated!.skills).toEqual(['generate_report'])
      expect(updated!.canDelegate).toEqual(['outro-agente'])
    })

    it('deve desativar um agente', () => {
      const agent = repo.create(baseAgentData())
      const updated = repo.update(agent.id, { isActive: false })
      expect(updated!.isActive).toBe(false)
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.update('fake-id', { name: 'Nada' })).toBeNull()
    })
  })

  describe('delete', () => {
    it('deve excluir um agente e retornar true', () => {
      const agent = repo.create(baseAgentData())
      expect(repo.delete(agent.id)).toBe(true)
      expect(repo.getById(agent.id)).toBeNull()
    })

    it('deve retornar false para ID inexistente', () => {
      expect(repo.delete('fake-id')).toBe(false)
    })

    it('deve excluir execuções em cascata ao excluir o agente', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'analise os dados')

      repo.delete(agent.id)
      expect(repo.getExecution(execution.id)).toBeNull()
    })
  })

  describe('createExecution', () => {
    it('deve criar execução com trigger manual por padrão', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'faça algo')

      expect(execution.id).toBeDefined()
      expect(execution.agentId).toBe(agent.id)
      expect(execution.trigger).toBe('manual')
      expect(execution.input).toBe('faça algo')
      expect(execution.status).toBe('running')
      expect(execution.steps).toEqual([])
      expect(execution.delegatedByAgentId).toBeUndefined()
    })

    it('deve registrar delegação quando delegatedBy é informado', () => {
      const delegante = repo.create(baseAgentData({ name: 'Delegante' }))
      const agent = repo.create(baseAgentData({ name: 'Executor' }))

      const execution = repo.createExecution(agent.id, 'tarefa delegada', 'delegation', delegante.id)
      expect(execution.trigger).toBe('delegation')
      expect(execution.delegatedByAgentId).toBe(delegante.id)

      const found = repo.getExecution(execution.id)
      expect(found!.delegatedByAgentId).toBe(delegante.id)
    })
  })

  describe('getExecution', () => {
    it('deve retornar execução com seus steps', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')
      repo.addStep(execution.id, { skill: 'read_entries', input: { limit: 10 }, reasoning: 'buscar entradas' })

      const found = repo.getExecution(execution.id)
      expect(found).not.toBeNull()
      expect(found!.steps).toHaveLength(1)
      expect(found!.steps[0].skill).toBe('read_entries')
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.getExecution('fake-id')).toBeNull()
    })
  })

  describe('getExecutionsForAgent', () => {
    it('deve retornar execuções do agente com contagem de steps', () => {
      const agent = repo.create(baseAgentData())
      const outro = repo.create(baseAgentData({ name: 'Outro' }))
      const execution = repo.createExecution(agent.id, 'exec 1')
      repo.createExecution(outro.id, 'exec do outro')
      repo.addStep(execution.id, { skill: 'read_tasks', input: {}, reasoning: 'passo 1' })
      repo.addStep(execution.id, { skill: 'create_task', input: {}, reasoning: 'passo 2' })

      const summaries = repo.getExecutionsForAgent(agent.id)
      expect(summaries).toHaveLength(1)
      expect(summaries[0].agentName).toBe('Agente Teste')
      expect(summaries[0].stepCount).toBe(2)
      expect(summaries[0].status).toBe('running')
    })

    it('deve respeitar o limite', () => {
      const agent = repo.create(baseAgentData())
      const db = getTestDatabase()
      for (let i = 0; i < 5; i++) {
        const exec = repo.createExecution(agent.id, `exec ${i}`)
        db.prepare('UPDATE agent_executions SET created_at = ? WHERE id = ?').run(
          `2026-01-0${i + 1}T00:00:00.000Z`,
          exec.id
        )
      }

      const summaries = repo.getExecutionsForAgent(agent.id, 3)
      expect(summaries).toHaveLength(3)
      expect(summaries[0].input).toBe('exec 4')
    })

    it('deve retornar lista vazia quando não há execuções', () => {
      const agent = repo.create(baseAgentData())
      expect(repo.getExecutionsForAgent(agent.id)).toEqual([])
    })
  })

  describe('getRecentExecutions', () => {
    it('deve retornar execuções de todos os agentes ordenadas por data desc', () => {
      const db = getTestDatabase()
      const a1 = repo.create(baseAgentData({ name: 'A1' }))
      const a2 = repo.create(baseAgentData({ name: 'A2' }))
      const e1 = repo.createExecution(a1.id, 'antiga')
      const e2 = repo.createExecution(a2.id, 'recente')
      db.prepare('UPDATE agent_executions SET created_at = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z', e1.id)
      db.prepare('UPDATE agent_executions SET created_at = ? WHERE id = ?').run('2026-02-01T00:00:00.000Z', e2.id)

      const recent = repo.getRecentExecutions()
      expect(recent).toHaveLength(2)
      expect(recent[0].input).toBe('recente')
      expect(recent[0].agentName).toBe('A2')
      expect(recent[1].input).toBe('antiga')
    })

    it('deve retornar lista vazia quando não há execuções', () => {
      expect(repo.getRecentExecutions()).toEqual([])
    })
  })

  describe('updateExecutionStatus', () => {
    it('deve definir completed_at para status terminal', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')

      repo.updateExecutionStatus(execution.id, 'completed', 'resultado final')

      const found = repo.getExecution(execution.id)
      expect(found!.status).toBe('completed')
      expect(found!.result).toBe('resultado final')
      expect(found!.completedAt).toBeDefined()
    })

    it('deve registrar erro em execução falhada', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')

      repo.updateExecutionStatus(execution.id, 'failed', undefined, 'estourou o limite')

      const found = repo.getExecution(execution.id)
      expect(found!.status).toBe('failed')
      expect(found!.error).toBe('estourou o limite')
      expect(found!.completedAt).toBeDefined()
    })

    it('não deve definir completed_at para status não terminal', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')

      repo.updateExecutionStatus(execution.id, 'awaiting_approval')

      const found = repo.getExecution(execution.id)
      expect(found!.status).toBe('awaiting_approval')
      expect(found!.completedAt).toBeUndefined()
    })
  })

  describe('addStep', () => {
    it('deve incrementar step_number automaticamente', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')

      const step1 = repo.addStep(execution.id, { skill: 'read_entries', input: {}, reasoning: 'r1' })
      const step2 = repo.addStep(execution.id, { skill: 'create_task', input: {}, reasoning: 'r2' })

      expect(step1.stepNumber).toBe(1)
      expect(step2.stepNumber).toBe(2)
    })

    it('deve serializar o input como JSON', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')

      repo.addStep(execution.id, {
        skill: 'search_semantic',
        input: { query: 'deploy', topK: 3 },
        reasoning: 'buscar contexto',
      })

      const steps = repo.getStepsForExecution(execution.id)
      expect(steps[0].input).toEqual({ query: 'deploy', topK: 3 })
      expect(steps[0].output).toBeNull()
      expect(steps[0].status).toBe('running')
    })

    it('deve registrar delegação no step', () => {
      const agent = repo.create(baseAgentData())
      const outro = repo.create(baseAgentData({ name: 'Delegado' }))
      const execution = repo.createExecution(agent.id, 'input')

      const step = repo.addStep(execution.id, {
        skill: 'delegate',
        input: {},
        reasoning: 'delegar',
        delegatedToAgentId: outro.id,
      })

      expect(step.delegatedToAgentId).toBe(outro.id)
      const steps = repo.getStepsForExecution(execution.id)
      expect(steps[0].delegatedToAgentId).toBe(outro.id)
    })
  })

  describe('completeStep', () => {
    it('deve completar um step com output serializado', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')
      const step = repo.addStep(execution.id, { skill: 'read_entries', input: {}, reasoning: 'r' })

      repo.completeStep(step.id, { count: 3, items: ['a', 'b', 'c'] })

      const steps = repo.getStepsForExecution(execution.id)
      expect(steps[0].status).toBe('completed')
      expect(steps[0].output).toEqual({ count: 3, items: ['a', 'b', 'c'] })
      expect(steps[0].completedAt).toBeDefined()
    })

    it('deve marcar step como failed quando informado', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')
      const step = repo.addStep(execution.id, { skill: 'read_entries', input: {}, reasoning: 'r' })

      repo.completeStep(step.id, { error: 'falhou' }, 'failed')

      const steps = repo.getStepsForExecution(execution.id)
      expect(steps[0].status).toBe('failed')
      expect(steps[0].output).toEqual({ error: 'falhou' })
    })
  })

  describe('updateStepStatus', () => {
    it('deve atualizar apenas o status do step', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')
      const step = repo.addStep(execution.id, { skill: 'create_task', input: {}, reasoning: 'r' })

      repo.updateStepStatus(step.id, 'approved')

      const steps = repo.getStepsForExecution(execution.id)
      expect(steps[0].status).toBe('approved')
      expect(steps[0].completedAt).toBeUndefined()
    })
  })

  describe('getStepsForExecution', () => {
    it('deve retornar steps ordenados por step_number asc', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')
      repo.addStep(execution.id, { skill: 'read_entries', input: {}, reasoning: 'primeiro' })
      repo.addStep(execution.id, { skill: 'read_tasks', input: {}, reasoning: 'segundo' })
      repo.addStep(execution.id, { skill: 'create_task', input: {}, reasoning: 'terceiro' })

      const steps = repo.getStepsForExecution(execution.id)
      expect(steps.map((s) => s.reasoning)).toEqual(['primeiro', 'segundo', 'terceiro'])
      expect(steps.map((s) => s.stepNumber)).toEqual([1, 2, 3])
    })

    it('deve retornar lista vazia para execução sem steps', () => {
      const agent = repo.create(baseAgentData())
      const execution = repo.createExecution(agent.id, 'input')
      expect(repo.getStepsForExecution(execution.id)).toEqual([])
    })
  })

  describe('deleteExecutionsForAgent', () => {
    it('deve excluir todas as execuções do agente', () => {
      const agent = repo.create(baseAgentData())
      const outro = repo.create(baseAgentData({ name: 'Outro' }))
      repo.createExecution(agent.id, 'e1')
      repo.createExecution(agent.id, 'e2')
      const preservada = repo.createExecution(outro.id, 'e3')

      repo.deleteExecutionsForAgent(agent.id)

      expect(repo.getExecutionsForAgent(agent.id)).toEqual([])
      expect(repo.getExecution(preservada.id)).not.toBeNull()
    })
  })

  describe('deleteOldExecutions', () => {
    it('deve excluir apenas execuções antigas em status terminal', () => {
      const db = getTestDatabase()
      const agent = repo.create(baseAgentData())

      const antigaCompleta = repo.createExecution(agent.id, 'antiga completa')
      repo.updateExecutionStatus(antigaCompleta.id, 'completed')
      const antigaRodando = repo.createExecution(agent.id, 'antiga rodando')
      const recenteCompleta = repo.createExecution(agent.id, 'recente completa')
      repo.updateExecutionStatus(recenteCompleta.id, 'completed')

      const oldDate = '2020-01-01T00:00:00.000Z'
      db.prepare('UPDATE agent_executions SET created_at = ? WHERE id = ?').run(oldDate, antigaCompleta.id)
      db.prepare('UPDATE agent_executions SET created_at = ? WHERE id = ?').run(oldDate, antigaRodando.id)

      const deleted = repo.deleteOldExecutions(30)

      expect(deleted).toBe(1)
      expect(repo.getExecution(antigaCompleta.id)).toBeNull()
      expect(repo.getExecution(antigaRodando.id)).not.toBeNull()
      expect(repo.getExecution(recenteCompleta.id)).not.toBeNull()
    })

    it('deve retornar 0 quando não há execuções antigas', () => {
      const agent = repo.create(baseAgentData())
      const exec = repo.createExecution(agent.id, 'recente')
      repo.updateExecutionStatus(exec.id, 'completed')

      expect(repo.deleteOldExecutions(30)).toBe(0)
    })
  })
})
