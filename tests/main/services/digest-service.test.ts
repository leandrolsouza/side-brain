import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { DigestService } from '../../../src/main/services/digest-service'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'
import { SettingsRepository } from '../../../src/main/database/repositories/settings-repository'
import type { AIService } from '../../../src/main/services/ai-service'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

const mockAIService = {
  invokeConversePublic: vi.fn().mockResolvedValue('Foque nas tarefas de backend hoje.'),
} as unknown as AIService

describe('DigestService', () => {
  let service: DigestService
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
    service = new DigestService(entryRepo, taskRepo, projectRepo, settingsRepo, mockAIService)

    vi.clearAllMocks()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('generateDailyDigest', () => {
    it('deve gerar digest com estrutura completa', async () => {
      const digest = await service.generateDailyDigest()

      expect(digest.greeting).toBeDefined()
      expect(digest.tasksNeedingAttention).toBeDefined()
      expect(digest.tasksNeedingAttention.overdue).toBeDefined()
      expect(digest.tasksNeedingAttention.inProgress).toBeDefined()
      expect(digest.tasksNeedingAttention.waiting).toBeDefined()
      expect(digest.yesterdayActivity).toBeDefined()
      expect(digest.yesterdayActivity.entriesCreated).toBeDefined()
      expect(digest.yesterdayActivity.tasksCompleted).toBeDefined()
      expect(digest.yesterdayActivity.tasksCreated).toBeDefined()
      expect(digest.generatedAt).toBeDefined()
    })

    it('deve categorizar tasks corretamente', async () => {
      const project = projectRepo.create('Projeto')

      taskRepo.create({ projectId: project.id, title: 'Task todo', status: 'todo' })
      taskRepo.create({ projectId: project.id, title: 'Task in progress', status: 'in_progress' })
      taskRepo.create({ projectId: project.id, title: 'Task waiting', status: 'waiting' })
      taskRepo.create({ projectId: project.id, title: 'Task done', status: 'done' })

      const digest = await service.generateDailyDigest()

      // 'todo' tasks são listadas em overdue no digest
      expect(digest.tasksNeedingAttention.overdue).toHaveLength(1)
      expect(digest.tasksNeedingAttention.overdue[0].title).toBe('Task todo')
      expect(digest.tasksNeedingAttention.inProgress).toHaveLength(1)
      expect(digest.tasksNeedingAttention.inProgress[0].title).toBe('Task in progress')
      expect(digest.tasksNeedingAttention.waiting).toHaveLength(1)
      expect(digest.tasksNeedingAttention.waiting[0].title).toBe('Task waiting')
    })

    it('não deve incluir tasks com status done nas categorias de atenção', async () => {
      const project = projectRepo.create('Projeto')
      taskRepo.create({ projectId: project.id, title: 'Task concluída', status: 'done' })

      const digest = await service.generateDailyDigest()

      const allAttention = [
        ...digest.tasksNeedingAttention.overdue,
        ...digest.tasksNeedingAttention.inProgress,
        ...digest.tasksNeedingAttention.waiting,
      ]
      expect(allAttention).toHaveLength(0)
    })

    it('deve retornar greeting baseado na hora do dia', async () => {
      const digest = await service.generateDailyDigest()
      const hour = new Date().getHours()

      if (hour < 12) {
        expect(digest.greeting).toContain('Bom dia')
      } else if (hour < 18) {
        expect(digest.greeting).toContain('Boa tarde')
      } else {
        expect(digest.greeting).toContain('Boa noite')
      }
    })

    it('deve retornar atividade de ontem (entries criadas)', async () => {
      const project = projectRepo.create('Projeto')

      // Cria entry com data de ontem
      const db = getTestDatabase()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(14, 0, 0, 0)
      const yesterdayStr = yesterday.toISOString()

      const { v4: uuidv4 } = await import('uuid')
      db.prepare(`
        INSERT INTO entries (id, raw_text, improved_text, project_id, type, action, review_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        'Nota de ontem',
        'Nota de ontem melhorada',
        project.id,
        'information',
        'none',
        'auto_approved',
        yesterdayStr
      )

      // Cria entry com data de hoje (não deve aparecer)
      entryRepo.create({
        rawText: 'Nota de hoje',
        improvedText: 'Nota de hoje melhorada',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const digest = await service.generateDailyDigest()

      expect(digest.yesterdayActivity.entriesCreated).toHaveLength(1)
      expect(digest.yesterdayActivity.entriesCreated[0].rawText).toBe('Nota de ontem')
    })

    it('deve retornar tasks completadas ontem', async () => {
      const project = projectRepo.create('Projeto')
      const db = getTestDatabase()

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(10, 0, 0, 0)
      const yesterdayStr = yesterday.toISOString()

      const { v4: uuidv4 } = await import('uuid')
      const taskId = uuidv4()
      db.prepare(`
        INSERT INTO tasks (id, project_id, title, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(taskId, project.id, 'Task completada ontem', 'done', yesterdayStr, yesterdayStr)

      const digest = await service.generateDailyDigest()

      expect(digest.yesterdayActivity.tasksCompleted).toHaveLength(1)
      expect(digest.yesterdayActivity.tasksCompleted[0].title).toBe('Task completada ontem')
    })

    it('deve incluir sugestão da AI quando API key está configurada', async () => {
      settingsRepo.update({ bedrockApiKey: 'test-key' })
      const project = projectRepo.create('Backend')
      taskRepo.create({ projectId: project.id, title: 'Revisar PR' })

      const digest = await service.generateDailyDigest()

      expect(digest.aiSuggestion).toBe('Foque nas tarefas de backend hoje.')
      expect(mockAIService.invokeConversePublic).toHaveBeenCalled()
    })

    it('deve retornar aiSuggestion como mensagem default quando não há API key', async () => {
      // Sem API key (default é vazio)
      const digest = await service.generateDailyDigest()

      expect(digest.aiSuggestion).toBe('Configure sua API Key nas configurações para receber sugestões personalizadas.')
    })

    it('deve retornar aiSuggestion null quando AI falha', async () => {
      settingsRepo.update({ bedrockApiKey: 'test-key' })
      mockAIService.invokeConversePublic = vi.fn().mockRejectedValue(new Error('API timeout'))

      const digest = await service.generateDailyDigest()

      expect(digest.aiSuggestion).toBeNull()
    })

    it('deve incluir generatedAt com timestamp válido', async () => {
      const before = new Date().toISOString()
      const digest = await service.generateDailyDigest()
      const after = new Date().toISOString()

      expect(digest.generatedAt >= before).toBe(true)
      expect(digest.generatedAt <= after).toBe(true)
    })
  })
})
