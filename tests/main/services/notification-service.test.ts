import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { NotificationService } from '../../../src/main/services/notification-service'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'
import { NotificationRepository } from '../../../src/main/database/repositories/notification-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

// Mock Electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  Notification: {
    isSupported: vi.fn(() => false),
  },
}))

describe('NotificationService', () => {
  let service: NotificationService
  let taskRepo: TaskRepository
  let notificationRepo: NotificationRepository
  let projectRepo: ProjectRepository
  let projectId: string

  beforeEach(() => {
    createTestDatabase()
    service = new NotificationService()
    taskRepo = new TaskRepository()
    notificationRepo = new NotificationRepository()
    projectRepo = new ProjectRepository()

    const project = projectRepo.create('Projeto Teste')
    projectId = project.id

    vi.clearAllMocks()
  })

  afterEach(() => {
    service.stop()
    closeTestDatabase()
  })

  describe('notify', () => {
    it('deve criar notificação e persistir no banco', () => {
      const result = service.notify({
        type: 'task_overdue',
        title: 'Tarefa vencida',
        body: 'Sua tarefa está atrasada',
      })

      expect(result).not.toBeNull()
      expect(result!.id).toBeDefined()
      expect(result!.type).toBe('task_overdue')
      expect(result!.title).toBe('Tarefa vencida')

      // Verifica que foi persistida
      const all = notificationRepo.getAll()
      expect(all).toHaveLength(1)
    })

    it('deve criar notificação com metadata', () => {
      const result = service.notify({
        type: 'task_due_today',
        title: 'Tarefa para hoje',
        body: 'Body',
        metadata: { taskId: 'abc', count: '3' },
      })

      expect(result!.metadata).toEqual({ taskId: 'abc', count: '3' })
    })

    it('deve evitar duplicatas do mesmo tipo em 60 minutos', () => {
      service.notify({
        type: 'task_overdue',
        title: 'Primeira',
        body: 'Body 1',
      })

      const second = service.notify({
        type: 'task_overdue',
        title: 'Segunda',
        body: 'Body 2',
      })

      // Segunda deve ser bloqueada (mesmo tipo em menos de 60 min)
      expect(second).toBeNull()

      const all = notificationRepo.getAll()
      expect(all).toHaveLength(1)
    })

    it('deve permitir notificações de tipos diferentes', () => {
      service.notify({
        type: 'task_overdue',
        title: 'Overdue',
        body: 'Body',
      })

      const second = service.notify({
        type: 'task_due_today',
        title: 'Due today',
        body: 'Body',
      })

      expect(second).not.toBeNull()
      expect(notificationRepo.getAll()).toHaveLength(2)
    })
  })

  describe('notifyDigestReady', () => {
    it('deve criar notificação de digest pronto', () => {
      const result = service.notifyDigestReady()

      expect(result).not.toBeNull()
      expect(result!.type).toBe('digest_ready')
      expect(result!.title).toContain('Digest')
    })
  })

  describe('notifyInsightsGenerated', () => {
    it('deve criar notificação com contagem de insights', () => {
      const result = service.notifyInsightsGenerated(3)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('insight_generated')
      expect(result!.body).toContain('3')
    })

    it('deve usar singular quando count é 1', () => {
      const result = service.notifyInsightsGenerated(1)

      expect(result!.body).toContain('1 insight')
      expect(result!.body).not.toContain('insights')
    })
  })

  describe('notifyAIError', () => {
    it('deve criar notificação de erro de AI', () => {
      const result = service.notifyAIError('Bedrock timeout após 30s')

      expect(result).not.toBeNull()
      expect(result!.type).toBe('ai_error')
      expect(result!.body).toBe('Bedrock timeout após 30s')
    })
  })

  describe('notifyMeetingReminder', () => {
    it('deve criar notificação de lembrete de reunião', () => {
      const result = service.notifyMeetingReminder('Sprint Planning')

      expect(result).not.toBeNull()
      expect(result!.type).toBe('meeting_reminder')
      expect(result!.body).toContain('Sprint Planning')
      expect(result!.metadata).toEqual({ meetingTitle: 'Sprint Planning' })
    })
  })

  describe('scheduleTaskCheck', () => {
    it('não deve agendar quando taskCheckInterval é disabled', () => {
      const db = getTestDatabase()
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run('taskCheckInterval', 'disabled')

      service.scheduleTaskCheck()

      // Não deve haver interval ativo (sem erros)
      service.stop()
    })
  })

  describe('checkDueTasks (indiretamente via start)', () => {
    it('deve gerar notificação para tasks vencidas ao iniciar', () => {
      const db = getTestDatabase()
      const { v4: uuidv4 } = require('uuid')

      // Cria task com due date passada
      db.prepare(`
        INSERT INTO tasks (id, project_id, title, status, due_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(uuidv4(), projectId, 'Task atrasada', 'todo', '2020-01-01')

      // Configura interval como disabled para não ficar rodando
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run('taskCheckInterval', 'disabled')

      service.start()

      const all = notificationRepo.getAll()
      const overdueNotif = all.find(n => n.type === 'task_overdue')
      expect(overdueNotif).toBeDefined()
      expect(overdueNotif!.title).toContain('vencida')

      service.stop()
    })

    it('deve gerar notificação para tasks que vencem hoje', () => {
      const db = getTestDatabase()
      const { v4: uuidv4 } = require('uuid')

      const today = new Date().toISOString().split('T')[0]
      db.prepare(`
        INSERT INTO tasks (id, project_id, title, status, due_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(uuidv4(), projectId, 'Task para hoje', 'todo', today)

      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run('taskCheckInterval', 'disabled')

      service.start()

      const all = notificationRepo.getAll()
      const dueTodayNotif = all.find(n => n.type === 'task_due_today')
      expect(dueTodayNotif).toBeDefined()
      expect(dueTodayNotif!.title).toContain('hoje')

      service.stop()
    })

    it('não deve gerar notificação quando não há tasks vencidas', () => {
      const db = getTestDatabase()
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run('taskCheckInterval', 'disabled')

      service.start()

      const all = notificationRepo.getAll()
      expect(all).toHaveLength(0)

      service.stop()
    })
  })
})
