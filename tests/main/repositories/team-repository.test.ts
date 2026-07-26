import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { TeamRepository } from '../../../src/main/database/repositories/team-repository'
import type { TeamDiscussionEntry } from '../../../src/shared/types'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

function baseTeamData(overrides: Partial<Parameters<TeamRepository['create']>[0]> = {}) {
  return {
    name: 'Time Teste',
    description: 'Time para testes',
    memberIds: ['agent-1', 'agent-2'],
    collaborationMode: 'sequential' as const,
    generateSynthesis: true,
    ...overrides,
  }
}

function makeDiscussionEntry(overrides: Partial<TeamDiscussionEntry> = {}): TeamDiscussionEntry {
  return {
    agentId: 'agent-1',
    agentName: 'Agente 1',
    agentIcon: 'Bot',
    agentColor: 'blue',
    response: 'Minha análise do tema',
    durationMs: 1200,
    status: 'completed',
    ...overrides,
  }
}

describe('TeamRepository', () => {
  let repo: TeamRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new TeamRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar um time com todos os campos', () => {
      const team = repo.create(baseTeamData({ synthesisPrompt: 'Resuma em tópicos' }))

      expect(team.id).toBeDefined()
      expect(team.name).toBe('Time Teste')
      expect(team.description).toBe('Time para testes')
      expect(team.memberIds).toEqual(['agent-1', 'agent-2'])
      expect(team.collaborationMode).toBe('sequential')
      expect(team.generateSynthesis).toBe(true)
      expect(team.synthesisPrompt).toBe('Resuma em tópicos')
      expect(team.createdAt).toBeDefined()
      expect(team.updatedAt).toBeDefined()
    })

    it('deve criar time sem synthesisPrompt', () => {
      const team = repo.create(baseTeamData())
      expect(team.synthesisPrompt).toBeUndefined()
    })

    it('deve mapear generateSynthesis=false corretamente', () => {
      const team = repo.create(baseTeamData({ generateSynthesis: false }))
      expect(team.generateSynthesis).toBe(false)
    })

    it('deve serializar memberIds como JSON', () => {
      const team = repo.create(baseTeamData({ memberIds: [] }))
      const found = repo.getById(team.id)
      expect(found!.memberIds).toEqual([])
    })
  })

  describe('getAll', () => {
    it('deve retornar lista vazia quando não há times', () => {
      expect(repo.getAll()).toEqual([])
    })

    it('deve retornar times ordenados por created_at desc', () => {
      const db = getTestDatabase()
      const antigo = repo.create(baseTeamData({ name: 'Antigo' }))
      const recente = repo.create(baseTeamData({ name: 'Recente' }))
      db.prepare('UPDATE agent_teams SET created_at = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z', antigo.id)
      db.prepare('UPDATE agent_teams SET created_at = ? WHERE id = ?').run('2026-02-01T00:00:00.000Z', recente.id)

      const teams = repo.getAll()
      expect(teams.map((t) => t.name)).toEqual(['Recente', 'Antigo'])
    })
  })

  describe('getById', () => {
    it('deve retornar o time pelo ID', () => {
      const created = repo.create(baseTeamData())
      const found = repo.getById(created.id)
      expect(found).not.toBeNull()
      expect(found!.name).toBe('Time Teste')
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.getById('nao-existe')).toBeNull()
    })
  })

  describe('update', () => {
    it('deve atualizar campos parciais mantendo os demais', () => {
      const team = repo.create(baseTeamData({ synthesisPrompt: 'Original' }))

      const updated = repo.update(team.id, { name: 'Novo Nome' })
      expect(updated!.name).toBe('Novo Nome')
      expect(updated!.description).toBe('Time para testes')
      expect(updated!.memberIds).toEqual(['agent-1', 'agent-2'])
      expect(updated!.synthesisPrompt).toBe('Original')
    })

    it('deve atualizar memberIds e collaborationMode', () => {
      const team = repo.create(baseTeamData())

      const updated = repo.update(team.id, {
        memberIds: ['agent-3'],
        collaborationMode: 'parallel',
      })
      expect(updated!.memberIds).toEqual(['agent-3'])
      expect(updated!.collaborationMode).toBe('parallel')
    })

    it('deve atualizar generateSynthesis para false', () => {
      const team = repo.create(baseTeamData({ generateSynthesis: true }))
      const updated = repo.update(team.id, { generateSynthesis: false })
      expect(updated!.generateSynthesis).toBe(false)
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.update('fake-id', { name: 'Nada' })).toBeNull()
    })
  })

  describe('delete', () => {
    it('deve excluir um time e retornar true', () => {
      const team = repo.create(baseTeamData())
      expect(repo.delete(team.id)).toBe(true)
      expect(repo.getById(team.id)).toBeNull()
    })

    it('deve retornar false para ID inexistente', () => {
      expect(repo.delete('fake-id')).toBe(false)
    })

    it('deve excluir execuções em cascata ao excluir o time', () => {
      const team = repo.create(baseTeamData())
      const execution = repo.createExecution(team.id, 'discutir tema')

      repo.delete(team.id)
      expect(repo.getExecution(execution.id)).toBeNull()
    })
  })

  describe('createExecution', () => {
    it('deve criar execução com status running e entries vazio', () => {
      const team = repo.create(baseTeamData())
      const execution = repo.createExecution(team.id, 'qual a melhor arquitetura?')

      expect(execution.id).toBeDefined()
      expect(execution.teamId).toBe(team.id)
      expect(execution.input).toBe('qual a melhor arquitetura?')
      expect(execution.entries).toEqual([])
      expect(execution.status).toBe('running')
      expect(execution.createdAt).toBeDefined()
    })
  })

  describe('getExecution', () => {
    it('deve retornar execução com entries desserializadas', () => {
      const team = repo.create(baseTeamData())
      const execution = repo.createExecution(team.id, 'tema')
      const entry = makeDiscussionEntry()
      repo.updateExecution(execution.id, { entries: [entry] })

      const found = repo.getExecution(execution.id)
      expect(found).not.toBeNull()
      expect(found!.entries).toEqual([entry])
      expect(found!.synthesis).toBeUndefined()
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.getExecution('fake-id')).toBeNull()
    })
  })

  describe('updateExecution', () => {
    it('deve atualizar entries preservando status', () => {
      const team = repo.create(baseTeamData())
      const execution = repo.createExecution(team.id, 'tema')

      repo.updateExecution(execution.id, {
        entries: [makeDiscussionEntry(), makeDiscussionEntry({ agentId: 'agent-2', agentName: 'Agente 2' })],
      })

      const found = repo.getExecution(execution.id)
      expect(found!.entries).toHaveLength(2)
      expect(found!.status).toBe('running')
      expect(found!.completedAt).toBeUndefined()
    })

    it('deve definir completed_at ao concluir a execução', () => {
      const team = repo.create(baseTeamData())
      const execution = repo.createExecution(team.id, 'tema')

      repo.updateExecution(execution.id, { status: 'completed', synthesis: 'Síntese final' })

      const found = repo.getExecution(execution.id)
      expect(found!.status).toBe('completed')
      expect(found!.synthesis).toBe('Síntese final')
      expect(found!.completedAt).toBeDefined()
    })

    it('deve definir completed_at para status failed e cancelled', () => {
      const team = repo.create(baseTeamData())

      const failed = repo.createExecution(team.id, 'tema 1')
      repo.updateExecution(failed.id, { status: 'failed' })
      expect(repo.getExecution(failed.id)!.completedAt).toBeDefined()

      const cancelled = repo.createExecution(team.id, 'tema 2')
      repo.updateExecution(cancelled.id, { status: 'cancelled' })
      expect(repo.getExecution(cancelled.id)!.completedAt).toBeDefined()
    })

    it('deve preservar entries existentes ao atualizar apenas o status', () => {
      const team = repo.create(baseTeamData())
      const execution = repo.createExecution(team.id, 'tema')
      const entry = makeDiscussionEntry()
      repo.updateExecution(execution.id, { entries: [entry] })

      repo.updateExecution(execution.id, { status: 'completed' })

      const found = repo.getExecution(execution.id)
      expect(found!.entries).toEqual([entry])
    })

    it('não deve fazer nada para execução inexistente', () => {
      expect(() => repo.updateExecution('fake-id', { status: 'completed' })).not.toThrow()
    })
  })

  describe('getExecutionsForTeam', () => {
    it('deve retornar execuções do time com memberCount baseado nas entries', () => {
      const team = repo.create(baseTeamData())
      const outro = repo.create(baseTeamData({ name: 'Outro Time' }))
      const execution = repo.createExecution(team.id, 'tema do time')
      repo.createExecution(outro.id, 'tema do outro')
      repo.updateExecution(execution.id, {
        entries: [makeDiscussionEntry(), makeDiscussionEntry({ agentId: 'agent-2' })],
      })

      const summaries = repo.getExecutionsForTeam(team.id)
      expect(summaries).toHaveLength(1)
      expect(summaries[0].teamName).toBe('Time Teste')
      expect(summaries[0].memberCount).toBe(2)
      expect(summaries[0].input).toBe('tema do time')
    })

    it('deve respeitar o limite', () => {
      const db = getTestDatabase()
      const team = repo.create(baseTeamData())
      for (let i = 0; i < 4; i++) {
        const exec = repo.createExecution(team.id, `exec ${i}`)
        db.prepare('UPDATE team_executions SET created_at = ? WHERE id = ?').run(
          `2026-01-0${i + 1}T00:00:00.000Z`,
          exec.id
        )
      }

      const summaries = repo.getExecutionsForTeam(team.id, 2)
      expect(summaries).toHaveLength(2)
      expect(summaries[0].input).toBe('exec 3')
    })

    it('deve retornar lista vazia quando não há execuções', () => {
      const team = repo.create(baseTeamData())
      expect(repo.getExecutionsForTeam(team.id)).toEqual([])
    })
  })

  describe('getRecentExecutions', () => {
    it('deve retornar execuções de todos os times ordenadas por data desc', () => {
      const db = getTestDatabase()
      const t1 = repo.create(baseTeamData({ name: 'Time 1' }))
      const t2 = repo.create(baseTeamData({ name: 'Time 2' }))
      const e1 = repo.createExecution(t1.id, 'antiga')
      const e2 = repo.createExecution(t2.id, 'recente')
      db.prepare('UPDATE team_executions SET created_at = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z', e1.id)
      db.prepare('UPDATE team_executions SET created_at = ? WHERE id = ?').run('2026-02-01T00:00:00.000Z', e2.id)

      const recent = repo.getRecentExecutions()
      expect(recent).toHaveLength(2)
      expect(recent[0].input).toBe('recente')
      expect(recent[0].teamName).toBe('Time 2')
    })

    it('deve retornar lista vazia quando não há execuções', () => {
      expect(repo.getRecentExecutions()).toEqual([])
    })
  })
})
