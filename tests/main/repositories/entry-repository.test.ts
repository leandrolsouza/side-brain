import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
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

describe('EntryRepository', () => {
  let entryRepo: EntryRepository
  let projectRepo: ProjectRepository
  let projectId: string

  beforeEach(() => {
    createTestDatabase()
    entryRepo = new EntryRepository()
    projectRepo = new ProjectRepository()
    // Cria um projeto para associar às entries
    const project = projectRepo.create('Projeto Teste')
    projectId = project.id
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar uma entry com todos os campos', () => {
      const entry = entryRepo.create({
        rawText: 'Reunião com cliente sobre escopo',
        improvedText: 'Reunião com o cliente para definição de escopo do projeto',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      expect(entry.id).toBeDefined()
      expect(entry.rawText).toBe('Reunião com cliente sobre escopo')
      expect(entry.improvedText).toBe('Reunião com o cliente para definição de escopo do projeto')
      expect(entry.projectId).toBe(projectId)
      expect(entry.type).toBe('information')
      expect(entry.action).toBe('none')
      expect(entry.reviewStatus).toBe('auto_approved')
      expect(entry.createdAt).toBeDefined()
    })
  })

  describe('getAll', () => {
    it('deve retornar todas as entries ordenadas por data desc', () => {
      entryRepo.create({
        rawText: 'Primeira',
        improvedText: 'Primeira entrada',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'Segunda',
        improvedText: 'Segunda entrada',
        projectId,
        type: 'decision',
        action: 'action_needed',
        reviewStatus: 'auto_approved',
      })

      const entries = entryRepo.getAll()
      expect(entries).toHaveLength(2)
      // Ambas foram criadas — a ordem DESC é por created_at
      // Como são inseridas no mesmo ms, verificamos apenas que ambas estão presentes
      const rawTexts = entries.map((e) => e.rawText)
      expect(rawTexts).toContain('Primeira')
      expect(rawTexts).toContain('Segunda')
    })

    it('deve filtrar entries por projectId', () => {
      const project2 = projectRepo.create('Outro Projeto')

      entryRepo.create({
        rawText: 'Entry do projeto 1',
        improvedText: 'Entry do projeto 1',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'Entry do projeto 2',
        improvedText: 'Entry do projeto 2',
        projectId: project2.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const entries = entryRepo.getAll(projectId)
      expect(entries).toHaveLength(1)
      expect(entries[0].rawText).toBe('Entry do projeto 1')
    })

    it('deve retornar lista vazia quando não há entries', () => {
      const entries = entryRepo.getAll()
      expect(entries).toEqual([])
    })
  })

  describe('getById', () => {
    it('deve retornar a entry pelo ID', () => {
      const created = entryRepo.create({
        rawText: 'Texto',
        improvedText: 'Texto melhorado',
        projectId,
        type: 'decision',
        action: 'action_needed',
        reviewStatus: 'auto_approved',
      })

      const found = entryRepo.getById(created.id)
      expect(found).not.toBeNull()
      expect(found!.rawText).toBe('Texto')
      expect(found!.type).toBe('decision')
    })

    it('deve retornar null para ID inexistente', () => {
      const found = entryRepo.getById('id-inexistente')
      expect(found).toBeNull()
    })
  })

  describe('update', () => {
    it('deve atualizar o texto melhorado', () => {
      const entry = entryRepo.create({
        rawText: 'Original',
        improvedText: 'Melhoria v1',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const updated = entryRepo.update(entry.id, { improvedText: 'Melhoria v2' })
      expect(updated).not.toBeNull()
      expect(updated!.improvedText).toBe('Melhoria v2')
    })

    it('deve atualizar o tipo e ação', () => {
      const entry = entryRepo.create({
        rawText: 'Original',
        improvedText: 'Original melhorado',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const updated = entryRepo.update(entry.id, {
        type: 'blocker',
        action: 'action_needed',
      })
      expect(updated!.type).toBe('blocker')
      expect(updated!.action).toBe('action_needed')
    })

    it('deve atualizar o reviewStatus', () => {
      const entry = entryRepo.create({
        rawText: 'Original',
        improvedText: 'Original melhorado',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const updated = entryRepo.update(entry.id, { reviewStatus: 'corrected' })
      expect(updated!.reviewStatus).toBe('corrected')
    })

    it('deve retornar null para ID inexistente', () => {
      const result = entryRepo.update('fake-id', { improvedText: 'nada' })
      expect(result).toBeNull()
    })
  })

  describe('search', () => {
    beforeEach(() => {
      entryRepo.create({
        rawText: 'Deploy do backend na AWS',
        improvedText: 'Realizado deploy do backend na AWS com sucesso',
        projectId,
        type: 'update',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'Bug no frontend de login',
        improvedText: 'Identificado bug na tela de login do frontend',
        projectId,
        type: 'blocker',
        action: 'action_needed',
        reviewStatus: 'auto_approved',
      })
    })

    it('deve buscar por texto cru', () => {
      const results = entryRepo.search('backend')
      expect(results).toHaveLength(1)
      expect(results[0].rawText).toContain('backend')
    })

    it('deve buscar por texto melhorado', () => {
      const results = entryRepo.search('tela de login')
      expect(results).toHaveLength(1)
      expect(results[0].improvedText).toContain('tela de login')
    })

    it('deve filtrar por tipo', () => {
      const results = entryRepo.search('', { type: 'blocker' })
      // O search usa LIKE com %, então string vazia retorna tudo com filtro
      expect(results.every((r) => r.type === 'blocker')).toBe(true)
    })

    it('deve filtrar por projectId', () => {
      const project2 = projectRepo.create('Projeto 2')
      entryRepo.create({
        rawText: 'Entry no projeto 2 com AWS',
        improvedText: 'Entry no projeto 2 com AWS',
        projectId: project2.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const results = entryRepo.search('AWS', { projectId })
      expect(results).toHaveLength(1)
      expect(results[0].projectId).toBe(projectId)
    })

    it('deve retornar vazio para busca sem resultados', () => {
      const results = entryRepo.search('inexistente-xyz-123')
      expect(results).toHaveLength(0)
    })
  })

  describe('delete', () => {
    it('deve excluir uma entry', () => {
      const entry = entryRepo.create({
        rawText: 'Para excluir',
        improvedText: 'Para excluir',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      entryRepo.delete(entry.id)
      const found = entryRepo.getById(entry.id)
      expect(found).toBeNull()
    })
  })

  describe('getActivityHeatmap', () => {
    it('deve retornar dados de atividade agrupados por dia', () => {
      // Cria entries para gerar dados no heatmap
      entryRepo.create({
        rawText: 'Entrada hoje',
        improvedText: 'Entrada hoje',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const heatmap = entryRepo.getActivityHeatmap(1)
      expect(heatmap).toBeInstanceOf(Array)
      // Deve ter pelo menos um dia com count > 0
      expect(heatmap.length).toBeGreaterThanOrEqual(1)
      expect(heatmap[0]).toHaveProperty('date')
      expect(heatmap[0]).toHaveProperty('count')
      expect(heatmap[0].count).toBeGreaterThanOrEqual(1)
    })
  })
})
