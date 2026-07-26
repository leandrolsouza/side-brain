import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { NotificationRepository } from '../../../src/main/database/repositories/notification-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('NotificationRepository', () => {
  let repo: NotificationRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new NotificationRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar uma notificação com dados básicos', () => {
      const notification = repo.create({
        type: 'task_overdue',
        title: 'Tarefa vencida',
        body: 'Você tem uma tarefa vencida',
      })

      expect(notification.id).toBeDefined()
      expect(notification.type).toBe('task_overdue')
      expect(notification.title).toBe('Tarefa vencida')
      expect(notification.body).toBe('Você tem uma tarefa vencida')
      expect(notification.read).toBe(false)
      expect(notification.dismissed).toBe(false)
      expect(notification.metadata).toBeUndefined()
      expect(notification.createdAt).toBeDefined()
    })

    it('deve criar notificação com metadata', () => {
      const notification = repo.create({
        type: 'task_due_today',
        title: 'Tarefa para hoje',
        body: 'Deploy vence hoje',
        metadata: { taskId: 'abc-123', projectName: 'Backend' },
      })

      expect(notification.metadata).toEqual({ taskId: 'abc-123', projectName: 'Backend' })
    })
  })

  describe('getAll', () => {
    it('deve retornar notificações não dismissadas ordenadas por data desc', () => {
      repo.create({ type: 'task_overdue', title: 'Primeira', body: 'Body 1' })
      repo.create({ type: 'task_due_today', title: 'Segunda', body: 'Body 2' })

      const all = repo.getAll()
      expect(all).toHaveLength(2)
      // Mais recente primeiro
      const titles = all.map((n) => n.title)
      expect(titles).toContain('Primeira')
      expect(titles).toContain('Segunda')
    })

    it('não deve retornar notificações dismissadas', () => {
      const n1 = repo.create({ type: 'task_overdue', title: 'Dismissada', body: 'Body' })
      repo.create({ type: 'task_due_today', title: 'Visível', body: 'Body' })
      repo.dismiss(n1.id)

      const all = repo.getAll()
      expect(all).toHaveLength(1)
      expect(all[0].title).toBe('Visível')
    })

    it('deve respeitar o limite', () => {
      for (let i = 0; i < 5; i++) {
        repo.create({ type: 'task_overdue', title: `Notif ${i}`, body: 'Body' })
      }

      const limited = repo.getAll(3)
      expect(limited).toHaveLength(3)
    })

    it('deve retornar lista vazia quando não há notificações', () => {
      expect(repo.getAll()).toEqual([])
    })
  })

  describe('getUnreadCount', () => {
    it('deve contar apenas notificações não lidas e não dismissadas', () => {
      repo.create({ type: 'task_overdue', title: 'N1', body: 'B' })
      repo.create({ type: 'task_due_today', title: 'N2', body: 'B' })
      const n3 = repo.create({ type: 'digest_ready', title: 'N3', body: 'B' })

      repo.markRead(n3.id)

      expect(repo.getUnreadCount()).toBe(2)
    })

    it('deve retornar 0 quando não há notificações', () => {
      expect(repo.getUnreadCount()).toBe(0)
    })
  })

  describe('markRead', () => {
    it('deve marcar uma notificação como lida', () => {
      const n = repo.create({ type: 'task_overdue', title: 'N1', body: 'B' })

      repo.markRead(n.id)

      const all = repo.getAll()
      expect(all[0].read).toBe(true)
    })
  })

  describe('markAllRead', () => {
    it('deve marcar todas as notificações como lidas', () => {
      repo.create({ type: 'task_overdue', title: 'N1', body: 'B' })
      repo.create({ type: 'task_due_today', title: 'N2', body: 'B' })

      repo.markAllRead()

      expect(repo.getUnreadCount()).toBe(0)
    })
  })

  describe('dismiss', () => {
    it('deve dismissar uma notificação', () => {
      const n = repo.create({ type: 'task_overdue', title: 'N1', body: 'B' })
      repo.create({ type: 'task_due_today', title: 'N2', body: 'B' })

      repo.dismiss(n.id)

      const all = repo.getAll()
      expect(all).toHaveLength(1)
      expect(all[0].title).toBe('N2')
    })
  })

  describe('dismissAll', () => {
    it('deve dismissar todas as notificações', () => {
      repo.create({ type: 'task_overdue', title: 'N1', body: 'B' })
      repo.create({ type: 'task_due_today', title: 'N2', body: 'B' })

      repo.dismissAll()

      expect(repo.getAll()).toHaveLength(0)
    })
  })

  describe('hasRecentOfType', () => {
    it('deve retornar true se há notificação recente do tipo', () => {
      repo.create({ type: 'task_overdue', title: 'N1', body: 'B' })

      expect(repo.hasRecentOfType('task_overdue', 60)).toBe(true)
    })

    it('deve retornar false se não há notificação do tipo', () => {
      repo.create({ type: 'task_overdue', title: 'N1', body: 'B' })

      expect(repo.hasRecentOfType('digest_ready', 60)).toBe(false)
    })

    it('deve retornar false se notificação é mais antiga que o intervalo', async () => {
      // Insere manualmente com data antiga
      const { getTestDatabase } = await import('../setup')
      const db = getTestDatabase()
      const oldDate = new Date(Date.now() - 120 * 60 * 1000).toISOString() // 2h atrás
      db.prepare(`
        INSERT INTO notifications (id, type, title, body, read, dismissed, created_at)
        VALUES (?, ?, ?, ?, 0, 0, ?)
      `).run('old-id', 'task_overdue', 'Antiga', 'Body', oldDate)

      expect(repo.hasRecentOfType('task_overdue', 60)).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('deve remover notificações dismissadas antigas', async () => {
      const { getTestDatabase } = await import('../setup')
      const db = getTestDatabase()

      // Cria notificação antiga e dismissada
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() // 45 dias atrás
      db.prepare(`
        INSERT INTO notifications (id, type, title, body, read, dismissed, created_at)
        VALUES (?, ?, ?, ?, 1, 1, ?)
      `).run('old-dismissed', 'task_overdue', 'Antiga', 'Body', oldDate)

      // Cria notificação recente e dismissada (não deve ser removida)
      const recentN = repo.create({ type: 'task_due_today', title: 'Recente', body: 'B' })
      repo.dismiss(recentN.id)

      const removed = repo.cleanup(30)
      expect(removed).toBe(1)
    })

    it('não deve remover notificações não-dismissadas', async () => {
      const { getTestDatabase } = await import('../setup')
      const db = getTestDatabase()

      // Notificação antiga mas NÃO dismissada
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
      db.prepare(`
        INSERT INTO notifications (id, type, title, body, read, dismissed, created_at)
        VALUES (?, ?, ?, ?, 0, 0, ?)
      `).run('old-not-dismissed', 'task_overdue', 'Antiga', 'Body', oldDate)

      const removed = repo.cleanup(30)
      expect(removed).toBe(0)
    })
  })
})
