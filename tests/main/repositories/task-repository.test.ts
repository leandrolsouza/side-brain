import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('TaskRepository', () => {
  let taskRepo: TaskRepository
  let projectRepo: ProjectRepository
  let projectId: string

  beforeEach(() => {
    createTestDatabase()
    taskRepo = new TaskRepository()
    projectRepo = new ProjectRepository()
    const project = projectRepo.create('Projeto Teste')
    projectId = project.id
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar uma task com dados básicos', () => {
      const task = taskRepo.create({
        projectId,
        title: 'Implementar autenticação',
        description: 'Usar OAuth2 com AWS Cognito',
      })

      expect(task.id).toBeDefined()
      expect(task.projectId).toBe(projectId)
      expect(task.title).toBe('Implementar autenticação')
      expect(task.description).toBe('Usar OAuth2 com AWS Cognito')
      expect(task.status).toBe('todo')
      expect(task.assignee).toBeNull()
      expect(task.dueDate).toBeNull()
      expect(task.createdAt).toBeDefined()
      expect(task.updatedAt).toBeDefined()
    })

    it('deve criar uma task com status custom', () => {
      const task = taskRepo.create({
        projectId,
        title: 'Task em progresso',
        status: 'in_progress',
      })

      expect(task.status).toBe('in_progress')
    })

    it('deve criar uma task com assignee e dueDate', () => {
      const task = taskRepo.create({
        projectId,
        title: 'Task com responsável',
        assignee: 'João',
        dueDate: '2025-12-31',
      })

      expect(task.assignee).toBe('João')
      expect(task.dueDate).toBe('2025-12-31')
    })

    it('deve criar uma task vinculada a uma entry', () => {
      // Primeiro cria uma entry real para satisfazer a FK
      const entryRepo = new EntryRepository()
      const entry = entryRepo.create({
        rawText: 'Entry para vincular',
        improvedText: 'Entry para vincular',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const task = taskRepo.create({
        projectId,
        title: 'Task de entry',
        sourceEntryId: entry.id,
      })

      expect(task.sourceEntryId).toBe(entry.id)
    })
  })

  describe('getAll', () => {
    it('deve retornar todas as tasks', () => {
      taskRepo.create({ projectId, title: 'Task 1' })
      taskRepo.create({ projectId, title: 'Task 2' })

      const tasks = taskRepo.getAll()
      expect(tasks).toHaveLength(2)
    })

    it('deve filtrar por projectId', () => {
      const project2 = projectRepo.create('Projeto 2')
      taskRepo.create({ projectId, title: 'Task do P1' })
      taskRepo.create({ projectId: project2.id, title: 'Task do P2' })

      const tasks = taskRepo.getAll(projectId)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Task do P1')
    })

    it('deve retornar vazio quando não há tasks', () => {
      const tasks = taskRepo.getAll()
      expect(tasks).toEqual([])
    })
  })

  describe('getByProject', () => {
    it('deve retornar tasks do projeto ordenadas por criação ASC', () => {
      taskRepo.create({ projectId, title: 'Primeira' })
      taskRepo.create({ projectId, title: 'Segunda' })

      const tasks = taskRepo.getByProject(projectId)
      expect(tasks).toHaveLength(2)
      expect(tasks[0].title).toBe('Primeira')
      expect(tasks[1].title).toBe('Segunda')
    })
  })

  describe('getById', () => {
    it('deve retornar a task pelo ID', () => {
      const created = taskRepo.create({ projectId, title: 'Minha Task' })

      const found = taskRepo.getById(created.id)
      expect(found).not.toBeNull()
      expect(found!.title).toBe('Minha Task')
    })

    it('deve retornar null para ID inexistente', () => {
      const found = taskRepo.getById('id-fake')
      expect(found).toBeNull()
    })
  })

  describe('findSimilar', () => {
    it('deve encontrar task com título idêntico (case insensitive) não concluída', () => {
      taskRepo.create({ projectId, title: 'Revisar documentação' })

      const found = taskRepo.findSimilar(projectId, 'revisar documentação')
      expect(found).not.toBeNull()
      expect(found!.title).toBe('Revisar documentação')
    })

    it('não deve encontrar task com status done', () => {
      const task = taskRepo.create({ projectId, title: 'Task concluída' })
      taskRepo.update(task.id, { status: 'done' })

      const found = taskRepo.findSimilar(projectId, 'Task concluída')
      expect(found).toBeNull()
    })

    it('não deve encontrar task de outro projeto', () => {
      const project2 = projectRepo.create('Projeto 2')
      taskRepo.create({ projectId: project2.id, title: 'Task do P2' })

      const found = taskRepo.findSimilar(projectId, 'Task do P2')
      expect(found).toBeNull()
    })
  })

  describe('update', () => {
    it('deve atualizar o status da task', async () => {
      const task = taskRepo.create({ projectId, title: 'Mover para in_progress' })

      // Aguarda 1ms para garantir que updatedAt será diferente
      await new Promise((resolve) => setTimeout(resolve, 5))

      const updated = taskRepo.update(task.id, { status: 'in_progress' })
      expect(updated).not.toBeNull()
      expect(updated!.status).toBe('in_progress')
      // updatedAt deve ser >= ao original (pode ser igual no mesmo ms)
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(task.updatedAt).getTime())
    })

    it('deve atualizar título e descrição', () => {
      const task = taskRepo.create({ projectId, title: 'Original', description: 'Desc original' })

      const updated = taskRepo.update(task.id, {
        title: 'Atualizado',
        description: 'Desc nova',
      })
      expect(updated!.title).toBe('Atualizado')
      expect(updated!.description).toBe('Desc nova')
    })

    it('deve atualizar assignee e dueDate', () => {
      const task = taskRepo.create({ projectId, title: 'Task' })

      const updated = taskRepo.update(task.id, {
        assignee: 'Maria',
        dueDate: '2025-06-15',
      })
      expect(updated!.assignee).toBe('Maria')
      expect(updated!.dueDate).toBe('2025-06-15')
    })

    it('deve permitir limpar assignee e dueDate com null', () => {
      const task = taskRepo.create({
        projectId,
        title: 'Task',
        assignee: 'João',
        dueDate: '2025-12-31',
      })

      const updated = taskRepo.update(task.id, {
        assignee: null,
        dueDate: null,
      })
      expect(updated!.assignee).toBeNull()
      expect(updated!.dueDate).toBeNull()
    })

    it('deve retornar null para ID inexistente', () => {
      const result = taskRepo.update('fake-id', { title: 'Novo' })
      expect(result).toBeNull()
    })
  })

  describe('search', () => {
    beforeEach(() => {
      taskRepo.create({ projectId, title: 'Configurar CI/CD', description: 'Pipeline no GitHub Actions' })
      taskRepo.create({ projectId, title: 'Escrever testes unitários', description: 'Cobertura mínima de 80%' })
    })

    it('deve buscar por título', () => {
      const results = taskRepo.search('CI/CD')
      expect(results).toHaveLength(1)
      expect(results[0].title).toContain('CI/CD')
    })

    it('deve buscar por descrição', () => {
      const results = taskRepo.search('GitHub Actions')
      expect(results).toHaveLength(1)
      expect(results[0].description).toContain('GitHub Actions')
    })

    it('deve filtrar por projectId', () => {
      const project2 = projectRepo.create('Projeto 2')
      taskRepo.create({ projectId: project2.id, title: 'Outra task com testes' })

      const results = taskRepo.search('testes', { projectId })
      expect(results).toHaveLength(1)
      expect(results[0].projectId).toBe(projectId)
    })

    it('deve retornar vazio para busca sem resultados', () => {
      const results = taskRepo.search('blockchain-xyz')
      expect(results).toHaveLength(0)
    })
  })

  describe('getOverdue', () => {
    it('deve retornar tasks com dueDate passada e não concluídas', () => {
      taskRepo.create({
        projectId,
        title: 'Task atrasada',
        dueDate: '2020-01-01',
      })
      taskRepo.create({
        projectId,
        title: 'Task futura',
        dueDate: '2099-12-31',
      })
      const done = taskRepo.create({
        projectId,
        title: 'Task done com data passada',
        dueDate: '2020-01-01',
      })
      taskRepo.update(done.id, { status: 'done' })

      const overdue = taskRepo.getOverdue()
      expect(overdue).toHaveLength(1)
      expect(overdue[0].title).toBe('Task atrasada')
    })
  })

  describe('getDueThisWeek', () => {
    it('deve retornar tasks com dueDate nesta semana e não concluídas', () => {
      // Cria uma task com due date hoje (deve estar na semana)
      const today = new Date().toISOString().split('T')[0]
      taskRepo.create({
        projectId,
        title: 'Task para esta semana',
        dueDate: today,
      })
      taskRepo.create({
        projectId,
        title: 'Task longínqua',
        dueDate: '2099-12-31',
      })

      const dueThisWeek = taskRepo.getDueThisWeek()
      expect(dueThisWeek.length).toBeGreaterThanOrEqual(1)
      expect(dueThisWeek.some((t) => t.title === 'Task para esta semana')).toBe(true)
      expect(dueThisWeek.some((t) => t.title === 'Task longínqua')).toBe(false)
    })
  })

  describe('delete', () => {
    it('deve excluir uma task', () => {
      const task = taskRepo.create({ projectId, title: 'Para excluir' })

      taskRepo.delete(task.id)
      const found = taskRepo.getById(task.id)
      expect(found).toBeNull()
    })
  })
})
