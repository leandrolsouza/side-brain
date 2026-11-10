import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import type { ChatActionResult, ChatConversation, SmartChatMessage, SmartChatSource } from '../../../shared/types'

export class ChatHistoryRepository {
  // === Conversations ===

  getConversations(): ChatConversation[] {
    const db = getDatabase()
    return db
      .prepare(`
      SELECT id, title, created_at as createdAt, updated_at as updatedAt
      FROM chat_conversations
      ORDER BY updated_at DESC
    `)
      .all() as ChatConversation[]
  }

  getConversationById(id: string): ChatConversation | null {
    const db = getDatabase()
    const row = db
      .prepare(`
      SELECT id, title, created_at as createdAt, updated_at as updatedAt
      FROM chat_conversations
      WHERE id = ?
    `)
      .get(id) as ChatConversation | undefined
    return row || null
  }

  createConversation(title: string): ChatConversation {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO chat_conversations (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(id, title, now, now)

    return { id, title, createdAt: now, updatedAt: now }
  }

  updateConversationTitle(id: string, title: string): void {
    const db = getDatabase()
    db.prepare(`
      UPDATE chat_conversations SET title = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(title, id)
  }

  touchConversation(id: string): void {
    const db = getDatabase()
    db.prepare(`
      UPDATE chat_conversations SET updated_at = datetime('now')
      WHERE id = ?
    `).run(id)
  }

  deleteConversation(id: string): void {
    const db = getDatabase()
    // Messages are deleted via CASCADE
    db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(id)
  }

  clearAllConversations(): void {
    const db = getDatabase()
    db.prepare('DELETE FROM chat_messages').run()
    db.prepare('DELETE FROM chat_conversations').run()
  }

  // === Messages ===

  getMessages(conversationId: string): SmartChatMessage[] {
    const db = getDatabase()
    const rows = db
      .prepare(`
      SELECT id, conversation_id as conversationId, role, content, sources, actions, created_at as createdAt
      FROM chat_messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `)
      .all(conversationId) as (Omit<SmartChatMessage, 'sources' | 'actions'> & {
      sources: string | null
      actions: string | null
    })[]

    return rows.map((row) => ({
      ...row,
      sources: row.sources ? (JSON.parse(row.sources) as SmartChatSource[]) : undefined,
      actions: row.actions ? (JSON.parse(row.actions) as ChatActionResult[]) : undefined,
    }))
  }

  getRecentMessages(conversationId: string, limit: number): SmartChatMessage[] {
    const db = getDatabase()
    const rows = db
      .prepare(`
      SELECT id, conversation_id as conversationId, role, content, sources, actions, created_at as createdAt
      FROM chat_messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
      .all(conversationId, limit) as (Omit<SmartChatMessage, 'sources' | 'actions'> & {
      sources: string | null
      actions: string | null
    })[]

    // Reverse to get chronological order
    return rows.reverse().map((row) => ({
      ...row,
      sources: row.sources ? (JSON.parse(row.sources) as SmartChatSource[]) : undefined,
      actions: row.actions ? (JSON.parse(row.actions) as ChatActionResult[]) : undefined,
    }))
  }

  getMessageCount(conversationId: string): number {
    const db = getDatabase()
    const result = db
      .prepare(`
      SELECT COUNT(*) as count FROM chat_messages WHERE conversation_id = ?
    `)
      .get(conversationId) as { count: number }
    return result.count
  }

  addMessage(conversationId: string, message: Omit<SmartChatMessage, 'conversationId'>): SmartChatMessage {
    const db = getDatabase()
    const id = message.id || uuid()
    const now = message.createdAt || new Date().toISOString()
    const sourcesJson = message.sources ? JSON.stringify(message.sources) : null

    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, role, content, sources, actions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      conversationId,
      message.role,
      message.content,
      sourcesJson,
      message.actions ? JSON.stringify(message.actions) : null,
      now
    )

    // Touch conversation to update its timestamp
    this.touchConversation(conversationId)

    return {
      id,
      conversationId,
      role: message.role,
      content: message.content,
      sources: message.sources,
      actions: message.actions,
      createdAt: now,
    }
  }

  deleteMessage(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id)
  }
}
