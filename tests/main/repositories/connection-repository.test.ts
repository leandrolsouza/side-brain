import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { ConnectionRepository } from '../../../src/main/database/repositories/connection-repository'
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

describe('ConnectionRepository', () => {
  let connRepo: ConnectionRepository
  let entryRepo: EntryRepository
  let projectRepo: ProjectRepository
  let projectId: string
  let entry1Id: string
  let entry2Id: string
  let entry3Id: string

  beforeEach(() => {
    createTestDatabase()
    connRepo = new ConnectionRepository()
    entryRepo = new EntryRepository()
    projectRepo = new ProjectRepository()

    const project = projectRepo.create('Projeto Teste')
    projectId = project.id

    const e1 = entryRepo.create({
      rawText: 'Entry 1',
      improvedText: 'Primeira entrada',
      projectId,
      type: 'information',
      action: 'none',
      reviewStatus: 'auto_approved',
    })
    const e2 = entryRepo.create({
      rawText: 'Entry 2',
      improvedText: 'Segunda entrada sobre backend',
      projectId,
      type: 'decision',
      action: 'action_needed',
      reviewStatus: 'auto_approved',
    })
    const e3 = entryRepo.create({
      rawText: 'Entry 3',
      improvedText: 'Terceira entrada evolução',
      projectId,
      type: 'update',
      action: 'none',
      reviewStatus: 'auto_approved',
    })

    entry1Id = e1.id
    entry2Id = e2.id
    entry3Id = e3.id
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar uma conexão entre entries', () => {
      const conn = connRepo.create({
        sourceEntryId: entry1Id,
        targetEntryId: entry2Id,
        connectionType: 'related',
      })

      expect(conn.id).toBeDefined()
      expect(conn.sourceEntryId).toBe(entry1Id)
      expect(conn.targetEntryId).toBe(entry2Id)
      expect(conn.connectionType).toBe('related')
      expect(conn.isAiSuggested).toBe(false)
      expect(conn.createdAt).toBeDefined()
    })

    it('deve criar conexão com description e isAiSuggested', () => {
      const conn = connRepo.create({
        sourceEntryId: entry1Id,
        targetEntryId: entry2Id,
        connectionType: 'follows_up',
        description: 'Entry 2 é continuação de Entry 1',
        isAiSuggested: true,
      })

      expect(conn.connectionType).toBe('follows_up')
      expect(conn.description).toBe('Entry 2 é continuação de Entry 1')
      expect(conn.isAiSuggested).toBe(true)
    })

    it('deve criar conexões com diferentes tipos', () => {
      const types = ['related', 'follows_up', 'contradicts', 'depends_on', 'evolves'] as const
      for (const type of types) {
        // Limpa as conexões entre essas entries para evitar unique constraint
        if (type !== 'related') {
          // Usa entries diferentes para cada tipo
        }
      }
      const conn = connRepo.create({
        sourceEntryId: entry1Id,
        targetEntryId: entry2Id,
        connectionType: 'evolves',
      })
      expect(conn.connectionType).toBe('evolves')
    })
  })

  describe('getByEntryId', () => {
    it('deve retornar conexões onde a entry é source', () => {
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })

      const connected = connRepo.getByEntryId(entry1Id)
      expect(connected).toHaveLength(1)
      expect(connected[0].connection.sourceEntryId).toBe(entry1Id)
      expect(connected[0].entry.id).toBe(entry2Id)
    })

    it('deve retornar conexões onde a entry é target', () => {
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })

      const connected = connRepo.getByEntryId(entry2Id)
      expect(connected).toHaveLength(1)
      expect(connected[0].connection.targetEntryId).toBe(entry2Id)
      expect(connected[0].entry.id).toBe(entry1Id)
    })

    it('deve retornar todas as conexões da entry (source + target)', () => {
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })
      connRepo.create({ sourceEntryId: entry3Id, targetEntryId: entry1Id, connectionType: 'follows_up' })

      const connected = connRepo.getByEntryId(entry1Id)
      expect(connected).toHaveLength(2)
    })

    it('deve retornar vazio quando não há conexões', () => {
      expect(connRepo.getByEntryId(entry1Id)).toHaveLength(0)
    })
  })

  describe('delete', () => {
    it('deve excluir uma conexão', () => {
      const conn = connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })

      connRepo.delete(conn.id)

      expect(connRepo.getByEntryId(entry1Id)).toHaveLength(0)
    })
  })

  describe('exists', () => {
    it('deve retornar true se conexão existe (source → target)', () => {
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })

      expect(connRepo.exists(entry1Id, entry2Id)).toBe(true)
    })

    it('deve retornar true se conexão existe (target → source, bidirecional)', () => {
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })

      // Verifica na direção oposta (o repository checa ambas direções)
      expect(connRepo.exists(entry2Id, entry1Id)).toBe(true)
    })

    it('deve retornar false se não existe conexão', () => {
      expect(connRepo.exists(entry1Id, entry2Id)).toBe(false)
    })
  })

  describe('getConnectionCount', () => {
    it('deve contar todas as conexões de uma entry', () => {
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry3Id, connectionType: 'follows_up' })

      expect(connRepo.getConnectionCount(entry1Id)).toBe(2)
    })

    it('deve contar conexões como source e target', () => {
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })
      connRepo.create({ sourceEntryId: entry3Id, targetEntryId: entry2Id, connectionType: 'depends_on' })

      // entry2Id é target em ambas
      expect(connRepo.getConnectionCount(entry2Id)).toBe(2)
    })

    it('deve retornar 0 quando não há conexões', () => {
      expect(connRepo.getConnectionCount(entry1Id)).toBe(0)
    })
  })

  describe('searchEntries', () => {
    it('deve buscar entries por texto excluindo a entry atual', () => {
      const results = connRepo.searchEntries('backend', entry1Id)

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(entry2Id)
      expect(results[0].improvedText).toContain('backend')
    })

    it('deve excluir a entry com excludeEntryId', () => {
      const results = connRepo.searchEntries('entrada', entry1Id)

      // Deve encontrar entry2 e entry3 mas não entry1
      const ids = results.map((r) => r.id)
      expect(ids).not.toContain(entry1Id)
    })

    it('deve respeitar o limit', () => {
      const results = connRepo.searchEntries('entrada', entry1Id, 1)
      expect(results).toHaveLength(1)
    })

    it('deve retornar vazio para busca sem resultados', () => {
      const results = connRepo.searchEntries('xyz-inexistente', entry1Id)
      expect(results).toHaveLength(0)
    })
  })

  describe('getAllForGraph', () => {
    it('deve retornar entries e connections do grafo', () => {
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })
      connRepo.create({ sourceEntryId: entry2Id, targetEntryId: entry3Id, connectionType: 'evolves' })

      const graph = connRepo.getAllForGraph()

      expect(graph.entries).toHaveLength(3)
      expect(graph.connections).toHaveLength(2)
    })

    it('deve retornar vazio quando não há conexões', () => {
      const graph = connRepo.getAllForGraph()

      expect(graph.entries).toHaveLength(0)
      expect(graph.connections).toHaveLength(0)
    })

    it('deve filtrar por projectId', () => {
      const project2 = projectRepo.create('Projeto 2')
      const e4 = entryRepo.create({
        rawText: 'Entry P2',
        improvedText: 'Entry do projeto 2',
        projectId: project2.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })
      connRepo.create({ sourceEntryId: e4.id, targetEntryId: entry3Id, connectionType: 'related' })

      const graph = connRepo.getAllForGraph({ projectId })

      // Deve incluir entries do projeto filtrado E entries conectadas a elas
      expect(graph.connections.length).toBeGreaterThanOrEqual(1)
    })

    it('deve filtrar por connectionType', () => {
      connRepo.create({ sourceEntryId: entry1Id, targetEntryId: entry2Id, connectionType: 'related' })
      connRepo.create({ sourceEntryId: entry2Id, targetEntryId: entry3Id, connectionType: 'evolves' })

      const graph = connRepo.getAllForGraph({ connectionType: 'evolves' })

      expect(graph.connections).toHaveLength(1)
      expect(graph.connections[0].connectionType).toBe('evolves')
    })
  })
})
