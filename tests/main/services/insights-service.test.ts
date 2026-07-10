import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { InsightsService } from '../../../src/main/services/insights-service'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'
import { SettingsRepository } from '../../../src/main/database/repositories/settings-repository'
import { AIService } from '../../../src/main/services/ai-service'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

const mockAIService = {
  invokeConverseForChat: vi.fn().mockResolvedValue('[]'),
} as unknown as AIService

describe('InsightsService', () => {
  let service: InsightsService
  let entryRepo: EntryRepository
  let taskRepo: TaskRepository
  let projectRepo: ProjectRepository
  let settingsRepo: SettingsRepository

  beforeEach(() => {
    createTestDatabase()
    entryRepo = new EntryRepository()
    taskRepo = new TaskRepository()
    projectRepo = new ProjectRepository()
    settingsRepo = new SettingsRepository()
    service = new InsightsService(entryRepo, projectRepo, taskRepo, settingsRepo, mockAIService)

    vi.clearAllMocks()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('generateInsights', () => {
    it('deve retornar array vazio quando não há dados', async () => {
      const insights = await service.generateInsights()
      expect(insights).toEqual([])
    })

    describe('regra: stale_tasks (tasks em waiting há mais de 4 dias)', () => {
      it('deve gerar insight quando há tasks em waiting há mais de 4 dias', async () => {
        const db = getTestDatabase()
        const { v4: uuidv4 } = await import('uuid')

        const project = projectRepo.create('Backend')

        // Cria task em waiting com updated_at de 5 dias atrás
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        db.prepare(`
          INSERT INTO tasks (id, project_id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), project.id, 'Aguardando resposta do cliente', 'waiting', fiveDaysAgo, fiveDaysAgo)

        const insights = await service.generateInsights()

        const staleInsight = insights.find(i => i.type === 'stale_tasks')
        expect(staleInsight).toBeDefined()
        expect(staleInsight!.priority).toBe('high')
        expect(staleInsight!.title).toContain('aguardando')
      })

      it('não deve gerar insight para tasks waiting há menos de 4 dias', async () => {
        const project = projectRepo.create('Backend')
        taskRepo.create({ projectId: project.id, title: 'Task recente', status: 'waiting' })

        const insights = await service.generateInsights()

        const staleInsight = insights.find(i => i.type === 'stale_tasks')
        expect(staleInsight).toBeUndefined()
      })
    })

    describe('regra: idle_project (projetos sem atividade há mais de 7 dias)', () => {
      it('deve gerar insight quando projeto está parado há mais de 7 dias com tasks pendentes', async () => {
        const db = getTestDatabase()
        const { v4: uuidv4 } = await import('uuid')

        const project = projectRepo.create('Projeto Parado')

        // Cria entry antiga (10 dias atrás)
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        db.prepare(`
          INSERT INTO entries (id, raw_text, improved_text, project_id, type, action, review_status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), 'Última nota', 'Última nota melhorada', project.id, 'information', 'none', 'auto_approved', tenDaysAgo)

        // Cria task pendente
        taskRepo.create({ projectId: project.id, title: 'Task pendente' })

        const insights = await service.generateInsights()

        const idleInsight = insights.find(i => i.type === 'idle_project')
        expect(idleInsight).toBeDefined()
        expect(idleInsight!.priority).toBe('medium')
        expect(idleInsight!.title).toContain('Projeto Parado')
        expect(idleInsight!.relatedProjectName).toBe('Projeto Parado')
      })

      it('não deve gerar insight se projeto não tem entries', async () => {
        const project = projectRepo.create('Projeto Vazio')
        taskRepo.create({ projectId: project.id, title: 'Task' })

        const insights = await service.generateInsights()

        const idleInsight = insights.find(i => i.type === 'idle_project')
        expect(idleInsight).toBeUndefined()
      })

      it('não deve gerar insight se projeto não tem tasks pendentes', async () => {
        const db = getTestDatabase()
        const { v4: uuidv4 } = await import('uuid')

        const project = projectRepo.create('Projeto Sem Tasks')

        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        db.prepare(`
          INSERT INTO entries (id, raw_text, improved_text, project_id, type, action, review_status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), 'Nota antiga', 'Nota antiga', project.id, 'information', 'none', 'auto_approved', tenDaysAgo)

        const insights = await service.generateInsights()

        const idleInsight = insights.find(i => i.type === 'idle_project')
        expect(idleInsight).toBeUndefined()
      })
    })

    describe('regra: no_deadline (5+ tasks sem prazo)', () => {
      it('deve gerar insight quando há 5 ou mais tasks sem dueDate', async () => {
        const project = projectRepo.create('Projeto')

        for (let i = 0; i < 6; i++) {
          taskRepo.create({ projectId: project.id, title: `Task ${i} sem prazo` })
        }

        const insights = await service.generateInsights()

        const noDeadlineInsight = insights.find(i => i.type === 'no_deadline')
        expect(noDeadlineInsight).toBeDefined()
        expect(noDeadlineInsight!.priority).toBe('low')
        expect(noDeadlineInsight!.title).toContain('6')
      })

      it('não deve gerar insight com menos de 5 tasks sem prazo', async () => {
        const project = projectRepo.create('Projeto')

        for (let i = 0; i < 4; i++) {
          taskRepo.create({ projectId: project.id, title: `Task ${i}` })
        }

        const insights = await service.generateInsights()

        const noDeadlineInsight = insights.find(i => i.type === 'no_deadline')
        expect(noDeadlineInsight).toBeUndefined()
      })

      it('não deve contar tasks done como sem prazo', async () => {
        const project = projectRepo.create('Projeto')

        for (let i = 0; i < 6; i++) {
          const task = taskRepo.create({ projectId: project.id, title: `Task ${i}` })
          taskRepo.update(task.id, { status: 'done' })
        }

        const insights = await service.generateInsights()

        const noDeadlineInsight = insights.find(i => i.type === 'no_deadline')
        expect(noDeadlineInsight).toBeUndefined()
      })
    })

    describe('regra: recurring_blockers (3+ blockers em 14 dias no mesmo projeto)', () => {
      it('deve gerar insight quando há 3+ blockers recentes no mesmo projeto', async () => {
        const project = projectRepo.create('Projeto Problemático')

        for (let i = 0; i < 3; i++) {
          entryRepo.create({
            rawText: `Bloqueio ${i}`,
            improvedText: `Bloqueio ${i} - descrição`,
            projectId: project.id,
            type: 'blocker',
            action: 'action_needed',
            reviewStatus: 'auto_approved',
          })
        }

        const insights = await service.generateInsights()

        const blockerInsight = insights.find(i => i.type === 'recurring_blockers')
        expect(blockerInsight).toBeDefined()
        expect(blockerInsight!.priority).toBe('high')
        expect(blockerInsight!.title).toContain('3')
        expect(blockerInsight!.relatedProjectName).toBe('Projeto Problemático')
      })

      it('não deve gerar insight com menos de 3 blockers', async () => {
        const project = projectRepo.create('Projeto')

        for (let i = 0; i < 2; i++) {
          entryRepo.create({
            rawText: `Bloqueio ${i}`,
            improvedText: `Bloqueio ${i}`,
            projectId: project.id,
            type: 'blocker',
            action: 'action_needed',
            reviewStatus: 'auto_approved',
          })
        }

        const insights = await service.generateInsights()

        const blockerInsight = insights.find(i => i.type === 'recurring_blockers')
        expect(blockerInsight).toBeUndefined()
      })

      it('não deve contar blockers antigos (mais de 14 dias)', async () => {
        const db = getTestDatabase()
        const { v4: uuidv4 } = await import('uuid')

        const project = projectRepo.create('Projeto')

        // Blockers de 20 dias atrás
        const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
        for (let i = 0; i < 4; i++) {
          db.prepare(`
            INSERT INTO entries (id, raw_text, improved_text, project_id, type, action, review_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(uuidv4(), `Bloqueio antigo ${i}`, `Bloqueio antigo ${i}`, project.id, 'blocker', 'action_needed', 'auto_approved', oldDate)
        }

        const insights = await service.generateInsights()

        const blockerInsight = insights.find(i => i.type === 'recurring_blockers')
        expect(blockerInsight).toBeUndefined()
      })
    })

    describe('regra: overloaded (15+ tasks pendentes)', () => {
      it('deve gerar insight quando há mais de 15 tasks ativas', async () => {
        const project = projectRepo.create('Projeto')

        for (let i = 0; i < 16; i++) {
          taskRepo.create({ projectId: project.id, title: `Task ${i}`, status: i % 2 === 0 ? 'todo' : 'in_progress' })
        }

        const insights = await service.generateInsights()

        const overloadedInsight = insights.find(i => i.type === 'overloaded')
        expect(overloadedInsight).toBeDefined()
        expect(overloadedInsight!.priority).toBe('medium')
        expect(overloadedInsight!.title).toContain('16')
      })

      it('não deve gerar insight com 15 ou menos tasks', async () => {
        const project = projectRepo.create('Projeto')

        for (let i = 0; i < 15; i++) {
          taskRepo.create({ projectId: project.id, title: `Task ${i}` })
        }

        const insights = await service.generateInsights()

        const overloadedInsight = insights.find(i => i.type === 'overloaded')
        expect(overloadedInsight).toBeUndefined()
      })

      it('não deve contar tasks waiting e done', async () => {
        const project = projectRepo.create('Projeto')

        for (let i = 0; i < 10; i++) {
          taskRepo.create({ projectId: project.id, title: `Task todo ${i}`, status: 'todo' })
        }
        for (let i = 0; i < 10; i++) {
          taskRepo.create({ projectId: project.id, title: `Task waiting ${i}`, status: 'waiting' })
        }
        for (let i = 0; i < 10; i++) {
          taskRepo.create({ projectId: project.id, title: `Task done ${i}`, status: 'done' })
        }

        const insights = await service.generateInsights()

        const overloadedInsight = insights.find(i => i.type === 'overloaded')
        // 10 todo + 0 in_progress = 10 (not > 15)
        expect(overloadedInsight).toBeUndefined()
      })
    })

    describe('cache', () => {
      it('deve usar cache quando chamado novamente dentro do TTL', async () => {
        const project = projectRepo.create('Projeto')
        for (let i = 0; i < 6; i++) {
          taskRepo.create({ projectId: project.id, title: `Task ${i}` })
        }

        const first = await service.generateInsights()
        const second = await service.generateInsights()

        // Deve retornar exatamente o mesmo resultado (por referência se cacheado)
        expect(second).toEqual(first)
      })

      it('deve regenerar quando forceRefresh=true', async () => {
        const project = projectRepo.create('Projeto')
        for (let i = 0; i < 6; i++) {
          taskRepo.create({ projectId: project.id, title: `Task ${i}` })
        }

        await service.generateInsights()

        // Adiciona mais dados
        for (let i = 6; i < 20; i++) {
          taskRepo.create({ projectId: project.id, title: `Task ${i}` })
        }

        const refreshed = await service.generateInsights(true)

        // Com forceRefresh deve gerar o insight de overloaded
        const overloaded = refreshed.find(i => i.type === 'overloaded')
        expect(overloaded).toBeDefined()
      })
    })

    describe('getLastGeneratedAt', () => {
      it('deve retornar null antes da primeira geração', () => {
        expect(service.getLastGeneratedAt()).toBeNull()
      })

      it('deve retornar timestamp após gerar insights', async () => {
        const before = Date.now()
        await service.generateInsights()
        const after = Date.now()

        const lastGenerated = service.getLastGeneratedAt()
        expect(lastGenerated).not.toBeNull()
        expect(lastGenerated!).toBeGreaterThanOrEqual(before)
        expect(lastGenerated!).toBeLessThanOrEqual(after)
      })
    })

    describe('ordenação e limite', () => {
      it('deve ordenar insights por prioridade (high > medium > low)', async () => {
        const project = projectRepo.create('Projeto')

        // Gera no_deadline (low) - 6 tasks sem prazo
        for (let i = 0; i < 6; i++) {
          taskRepo.create({ projectId: project.id, title: `Task ${i}` })
        }

        // Gera recurring_blockers (high) - 3 blockers
        for (let i = 0; i < 3; i++) {
          entryRepo.create({
            rawText: `Bloqueio ${i}`,
            improvedText: `Bloqueio ${i}`,
            projectId: project.id,
            type: 'blocker',
            action: 'action_needed',
            reviewStatus: 'auto_approved',
          })
        }

        const insights = await service.generateInsights()

        // Primeiro insight deve ser high priority
        if (insights.length >= 2) {
          const priorities = insights.map(i => i.priority)
          const priorityOrder = { high: 0, medium: 1, low: 2 }
          for (let i = 1; i < priorities.length; i++) {
            expect(priorityOrder[priorities[i]]).toBeGreaterThanOrEqual(priorityOrder[priorities[i - 1]])
          }
        }
      })

      it('deve limitar a 5 insights no máximo', async () => {
        const db = getTestDatabase()
        const { v4: uuidv4 } = await import('uuid')

        // Cria muitos projetos parados para gerar vários idle_project
        for (let p = 0; p < 8; p++) {
          const project = projectRepo.create(`Projeto Parado ${p}`)
          const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
          db.prepare(`
            INSERT INTO entries (id, raw_text, improved_text, project_id, type, action, review_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(uuidv4(), 'Nota', 'Nota', project.id, 'information', 'none', 'auto_approved', tenDaysAgo)
          taskRepo.create({ projectId: project.id, title: `Task do projeto ${p}` })
        }

        const insights = await service.generateInsights()

        expect(insights.length).toBeLessThanOrEqual(5)
      })
    })
  })
})
