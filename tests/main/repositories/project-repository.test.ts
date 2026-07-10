import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('ProjectRepository', () => {
  let repo: ProjectRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new ProjectRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar um projeto com dados básicos', () => {
      const project = repo.create('Projeto Alpha', 'Descrição do projeto')

      expect(project.id).toBeDefined()
      expect(project.name).toBe('Projeto Alpha')
      expect(project.description).toBe('Descrição do projeto')
      expect(project.isAutoSuggested).toBe(false)
      expect(project.active).toBe(true)
      expect(project.createdAt).toBeDefined()
    })

    it('deve criar um projeto auto-sugerido', () => {
      const project = repo.create('Sugerido pela IA', undefined, true)

      expect(project.isAutoSuggested).toBe(true)
      expect(project.active).toBe(true)
    })

    it('deve criar um projeto sem descrição', () => {
      const project = repo.create('Sem Descrição')

      expect(project.description).toBeUndefined()
    })
  })

  describe('getAll', () => {
    it('deve retornar lista vazia quando não há projetos', () => {
      const projects = repo.getAll()
      expect(projects).toEqual([])
    })

    it('deve retornar apenas projetos ativos por padrão', () => {
      const p1 = repo.create('Ativo 1')
      const p2 = repo.create('Ativo 2')
      const p3 = repo.create('Inativo')
      repo.setActive(p3.id, false)

      const projects = repo.getAll()
      expect(projects).toHaveLength(2)
      expect(projects.map(p => p.name)).toContain('Ativo 1')
      expect(projects.map(p => p.name)).toContain('Ativo 2')
      expect(projects.map(p => p.name)).not.toContain('Inativo')
    })

    it('deve retornar todos os projetos quando includeInactive=true', () => {
      repo.create('Ativo')
      const inativo = repo.create('Inativo')
      repo.setActive(inativo.id, false)

      const projects = repo.getAll(true)
      expect(projects).toHaveLength(2)
    })
  })

  describe('getById', () => {
    it('deve retornar o projeto pelo ID', () => {
      const created = repo.create('Meu Projeto', 'Desc')

      const found = repo.getById(created.id)
      expect(found).not.toBeNull()
      expect(found!.name).toBe('Meu Projeto')
      expect(found!.description).toBe('Desc')
    })

    it('deve retornar null para ID inexistente', () => {
      const found = repo.getById('id-que-nao-existe')
      expect(found).toBeNull()
    })
  })

  describe('findByName', () => {
    it('deve encontrar projeto por nome (case insensitive)', () => {
      repo.create('Projeto Frontend')

      const found = repo.findByName('projeto frontend')
      expect(found).not.toBeNull()
      expect(found!.name).toBe('Projeto Frontend')
    })

    it('deve retornar null para nome inexistente', () => {
      const found = repo.findByName('Não Existe')
      expect(found).toBeNull()
    })
  })

  describe('update', () => {
    it('deve atualizar o nome do projeto', () => {
      const project = repo.create('Nome Original')

      const updated = repo.update(project.id, { name: 'Nome Atualizado' })
      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('Nome Atualizado')
    })

    it('deve atualizar a descrição do projeto', () => {
      const project = repo.create('Projeto', 'Desc original')

      const updated = repo.update(project.id, { description: 'Desc nova' })
      expect(updated!.description).toBe('Desc nova')
    })

    it('deve retornar null ao atualizar ID inexistente', () => {
      const result = repo.update('fake-id', { name: 'Novo' })
      expect(result).toBeNull()
    })

    it('deve manter campos não alterados', () => {
      const project = repo.create('Projeto', 'Descrição')

      const updated = repo.update(project.id, { name: 'Novo Nome' })
      expect(updated!.name).toBe('Novo Nome')
      expect(updated!.description).toBe('Descrição')
    })
  })

  describe('setActive', () => {
    it('deve desativar um projeto', () => {
      const project = repo.create('Para Desativar')

      const updated = repo.setActive(project.id, false)
      expect(updated!.active).toBe(false)
    })

    it('deve reativar um projeto', () => {
      const project = repo.create('Para Reativar')
      repo.setActive(project.id, false)

      const updated = repo.setActive(project.id, true)
      expect(updated!.active).toBe(true)
    })
  })

  describe('search', () => {
    it('deve buscar projetos por nome', () => {
      repo.create('Backend API')
      repo.create('Frontend React')
      repo.create('Mobile App')

      const results = repo.search('front')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Frontend React')
    })

    it('deve buscar projetos por descrição', () => {
      repo.create('Projeto X', 'Sistema de pagamentos')
      repo.create('Projeto Y', 'Sistema de cadastro')

      const results = repo.search('pagamentos')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Projeto X')
    })

    it('deve retornar vazio para busca sem resultados', () => {
      repo.create('Projeto Alpha')

      const results = repo.search('inexistente')
      expect(results).toHaveLength(0)
    })
  })

  describe('delete', () => {
    it('deve excluir um projeto', () => {
      const project = repo.create('Para Excluir')

      repo.delete(project.id)
      const found = repo.getById(project.id)
      expect(found).toBeNull()
    })
  })
})
