import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../schema'
import type { AppNotification, NotificationType } from '../../../shared/types'

export class NotificationRepository {
  create(data: {
    type: NotificationType
    title: string
    body: string
    metadata?: Record<string, string>
  }): AppNotification {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null

    db.prepare(`
      INSERT INTO notifications (id, type, title, body, read, dismissed, metadata, created_at)
      VALUES (?, ?, ?, ?, 0, 0, ?, ?)
    `).run(id, data.type, data.title, data.body, metadataJson, now)

    return {
      id,
      type: data.type,
      title: data.title,
      body: data.body,
      read: false,
      dismissed: false,
      metadata: data.metadata,
      createdAt: now,
    }
  }

  getAll(limit: number = 50): AppNotification[] {
    const db = getDatabase()

    const rows = db.prepare(`
      SELECT id, type, title, body, read, dismissed, metadata, created_at
      FROM notifications
      WHERE dismissed = 0
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as {
      id: string
      type: string
      title: string
      body: string
      read: number
      dismissed: number
      metadata: string | null
      created_at: string
    }[]

    return rows.map((row) => ({
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      read: row.read === 1,
      dismissed: row.dismissed === 1,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    }))
  }

  getUnreadCount(): number {
    const db = getDatabase()

    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE read = 0 AND dismissed = 0
    `).get() as { count: number }

    return result.count
  }

  markRead(id: string): void {
    const db = getDatabase()
    db.prepare(`UPDATE notifications SET read = 1 WHERE id = ?`).run(id)
  }

  markAllRead(): void {
    const db = getDatabase()
    db.prepare(`UPDATE notifications SET read = 1 WHERE read = 0`).run()
  }

  dismiss(id: string): void {
    const db = getDatabase()
    db.prepare(`UPDATE notifications SET dismissed = 1 WHERE id = ?`).run(id)
  }

  dismissAll(): void {
    const db = getDatabase()
    db.prepare(`UPDATE notifications SET dismissed = 1 WHERE dismissed = 0`).run()
  }

  /**
   * Verifica se já existe uma notificação do mesmo tipo criada hoje
   * para evitar duplicatas (ex: múltiplas notificações de task_overdue no mesmo dia)
   */
  hasRecentOfType(type: NotificationType, withinMinutes: number = 60): boolean {
    const db = getDatabase()
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString()

    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE type = ? AND created_at >= ?
    `).get(type, cutoff) as { count: number }

    return result.count > 0
  }

  /**
   * Remove notificações antigas (mais de 30 dias) para manter o banco limpo
   */
  cleanup(daysToKeep: number = 30): number {
    const db = getDatabase()
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

    const result = db.prepare(`
      DELETE FROM notifications WHERE created_at < ? AND dismissed = 1
    `).run(cutoff)

    return result.changes
  }
}
