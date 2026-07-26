import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { EmbeddingsRepository } from '../../../src/main/database/repositories/embeddings-repository'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('EmbeddingsRepository', () => {
  let repo: EmbeddingsRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new EmbeddingsRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('upsert', () => {
    it('deve inserir um novo embedding', () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3])

      repo.upsert('entry', 'entry-1', embedding, 'text-embedding-3-small')

      const record = repo.getByEntity('entry', 'entry-1')
      expect(record).not.toBeNull()
      expect(record!.entityType).toBe('entry')
      expect(record!.entityId).toBe('entry-1')
      expect(record!.model).toBe('text-embedding-3-small')
      expect(record!.dimensions).toBe(3)
      expect(Array.from(record!.embedding)).toEqual(Array.from(embedding))
    })

    it('deve atualizar embedding existente sem duplicar', () => {
      repo.upsert('entry', 'entry-1', new Float32Array([1, 2, 3]), 'modelo-v1')
      repo.upsert('entry', 'entry-1', new Float32Array([4, 5, 6, 7]), 'modelo-v2')

      expect(repo.count('entry')).toBe(1)
      const record = repo.getByEntity('entry', 'entry-1')
      expect(record!.model).toBe('modelo-v2')
      expect(record!.dimensions).toBe(4)
      expect(Array.from(record!.embedding)).toEqual([4, 5, 6, 7])
    })

    it('deve manter embeddings separados por tipo de entidade', () => {
      repo.upsert('entry', 'mesmo-id', new Float32Array([1]), 'modelo')
      repo.upsert('task', 'mesmo-id', new Float32Array([2]), 'modelo')

      expect(repo.count()).toBe(2)
      expect(Array.from(repo.getByEntity('entry', 'mesmo-id')!.embedding)).toEqual([1])
      expect(Array.from(repo.getByEntity('task', 'mesmo-id')!.embedding)).toEqual([2])
    })
  })

  describe('getByEntity', () => {
    it('deve preservar os valores do vetor após round-trip binário', () => {
      const original = new Float32Array([0.123456, -0.98765, 42.5, 0])
      repo.upsert('task', 'task-1', original, 'modelo')

      const record = repo.getByEntity('task', 'task-1')
      expect(record!.embedding).toBeInstanceOf(Float32Array)
      expect(record!.embedding.length).toBe(4)
      expect(Array.from(record!.embedding)).toEqual(Array.from(original))
    })

    it('deve retornar null quando não existe embedding', () => {
      expect(repo.getByEntity('entry', 'nao-existe')).toBeNull()
    })
  })

  describe('getAllByType', () => {
    it('deve retornar apenas embeddings do tipo informado', () => {
      repo.upsert('entry', 'entry-1', new Float32Array([1]), 'modelo')
      repo.upsert('entry', 'entry-2', new Float32Array([2]), 'modelo')
      repo.upsert('task', 'task-1', new Float32Array([3]), 'modelo')

      const entries = repo.getAllByType('entry')
      expect(entries).toHaveLength(2)
      expect(entries.every((e) => e.entityType === 'entry')).toBe(true)

      const tasks = repo.getAllByType('task')
      expect(tasks).toHaveLength(1)
      expect(tasks[0].entityId).toBe('task-1')
    })

    it('deve retornar lista vazia quando não há embeddings', () => {
      expect(repo.getAllByType('entry')).toEqual([])
    })
  })

  describe('hasEmbedding', () => {
    it('deve retornar true quando o embedding existe', () => {
      repo.upsert('entry', 'entry-1', new Float32Array([1]), 'modelo')
      expect(repo.hasEmbedding('entry', 'entry-1')).toBe(true)
    })

    it('deve retornar false quando não existe', () => {
      expect(repo.hasEmbedding('entry', 'entry-1')).toBe(false)
    })

    it('deve diferenciar por tipo de entidade', () => {
      repo.upsert('entry', 'id-x', new Float32Array([1]), 'modelo')
      expect(repo.hasEmbedding('task', 'id-x')).toBe(false)
    })
  })

  describe('getMissingEntryIds', () => {
    it('deve retornar IDs de entries sem embedding', () => {
      const projectRepo = new ProjectRepository()
      const entryRepo = new EntryRepository()
      const project = projectRepo.create('Projeto')
      const comEmbedding = entryRepo.create({
        rawText: 'Com embedding',
        improvedText: 'Com embedding',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      const semEmbedding = entryRepo.create({
        rawText: 'Sem embedding',
        improvedText: 'Sem embedding',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      repo.upsert('entry', comEmbedding.id, new Float32Array([1]), 'modelo')

      const missing = repo.getMissingEntryIds()
      expect(missing).toEqual([semEmbedding.id])
    })

    it('deve retornar lista vazia quando não há entries', () => {
      expect(repo.getMissingEntryIds()).toEqual([])
    })
  })

  describe('getMissingTaskIds', () => {
    it('deve retornar IDs de tasks sem embedding', () => {
      const db = getTestDatabase()
      const projectRepo = new ProjectRepository()
      const project = projectRepo.create('Projeto')
      db.prepare('INSERT INTO tasks (id, project_id, title) VALUES (?, ?, ?)').run('task-1', project.id, 'Tarefa 1')
      db.prepare('INSERT INTO tasks (id, project_id, title) VALUES (?, ?, ?)').run('task-2', project.id, 'Tarefa 2')
      repo.upsert('task', 'task-1', new Float32Array([1]), 'modelo')

      const missing = repo.getMissingTaskIds()
      expect(missing).toEqual(['task-2'])
    })

    it('deve retornar lista vazia quando não há tasks', () => {
      expect(repo.getMissingTaskIds()).toEqual([])
    })
  })

  describe('deleteByEntity', () => {
    it('deve excluir o embedding da entidade', () => {
      repo.upsert('entry', 'entry-1', new Float32Array([1]), 'modelo')
      repo.upsert('entry', 'entry-2', new Float32Array([2]), 'modelo')

      repo.deleteByEntity('entry', 'entry-1')

      expect(repo.hasEmbedding('entry', 'entry-1')).toBe(false)
      expect(repo.hasEmbedding('entry', 'entry-2')).toBe(true)
    })

    it('não deve falhar ao excluir entidade inexistente', () => {
      expect(() => repo.deleteByEntity('entry', 'nao-existe')).not.toThrow()
    })
  })

  describe('deleteAll', () => {
    it('deve excluir todos os embeddings', () => {
      repo.upsert('entry', 'entry-1', new Float32Array([1]), 'modelo')
      repo.upsert('task', 'task-1', new Float32Array([2]), 'modelo')

      repo.deleteAll()

      expect(repo.count()).toBe(0)
    })
  })

  describe('count', () => {
    it('deve contar todos os embeddings sem filtro', () => {
      repo.upsert('entry', 'entry-1', new Float32Array([1]), 'modelo')
      repo.upsert('entry', 'entry-2', new Float32Array([2]), 'modelo')
      repo.upsert('task', 'task-1', new Float32Array([3]), 'modelo')

      expect(repo.count()).toBe(3)
    })

    it('deve contar por tipo de entidade', () => {
      repo.upsert('entry', 'entry-1', new Float32Array([1]), 'modelo')
      repo.upsert('task', 'task-1', new Float32Array([2]), 'modelo')

      expect(repo.count('entry')).toBe(1)
      expect(repo.count('task')).toBe(1)
    })

    it('deve retornar 0 quando não há embeddings', () => {
      expect(repo.count()).toBe(0)
      expect(repo.count('entry')).toBe(0)
    })
  })
})
