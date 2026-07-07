import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import { Entry, EntryType, ActionStatus, ReviewStatus } from '../../../shared/types'

export class EntryRepository {
  getAll(projectId?: string): Entry[] {
    const db = getDatabase()

    let query = `
      SELECT id, raw_text as rawText, improved_text as improvedText,
             project_id as projectId, type, action, review_status as reviewStatus,
             created_at as createdAt
      FROM entries
    `

    if (projectId) {
      query += ' WHERE project_id = ?'
      query += ' ORDER BY created_at DESC'
      return db.prepare(query).all(projectId) as Entry[]
    }

    query += ' ORDER BY created_at DESC'
    return db.prepare(query).all() as Entry[]
  }

  getById(id: string): Entry | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, raw_text as rawText, improved_text as improvedText,
             project_id as projectId, type, action, review_status as reviewStatus,
             created_at as createdAt
      FROM entries WHERE id = ?
    `).get(id) as Entry | undefined

    return row || null
  }

  getPending(): Entry[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT id, raw_text as rawText, improved_text as improvedText,
             project_id as projectId, type, action, review_status as reviewStatus,
             created_at as createdAt
      FROM entries WHERE review_status = 'pending'
      ORDER BY created_at DESC
    `).all() as Entry[]
  }

  create(data: {
    rawText: string
    improvedText: string
    projectId: string
    type: EntryType
    action: ActionStatus
    reviewStatus: ReviewStatus
  }): Entry {
    const db = getDatabase()
    const id = uuid()
    const createdAt = new Date().toISOString()

    db.prepare(`
      INSERT INTO entries (id, raw_text, improved_text, project_id, type, action, review_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.rawText, data.improvedText, data.projectId, data.type, data.action, data.reviewStatus, createdAt)

    return {
      id,
      rawText: data.rawText,
      improvedText: data.improvedText,
      projectId: data.projectId,
      type: data.type,
      action: data.action,
      reviewStatus: data.reviewStatus,
      createdAt,
    }
  }

  update(id: string, updates: Partial<Pick<Entry, 'improvedText' | 'projectId' | 'type' | 'action' | 'reviewStatus'>>): Entry | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const improvedText = updates.improvedText ?? existing.improvedText
    const projectId = updates.projectId ?? existing.projectId
    const type = updates.type ?? existing.type
    const action = updates.action ?? existing.action
    const reviewStatus = updates.reviewStatus ?? existing.reviewStatus

    db.prepare(`
      UPDATE entries SET improved_text = ?, project_id = ?, type = ?, action = ?, review_status = ?
      WHERE id = ?
    `).run(improvedText, projectId, type, action, reviewStatus, id)

    return { ...existing, improvedText, projectId, type, action, reviewStatus }
  }

  search(query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }): Entry[] {
    const db = getDatabase()
    const conditions: string[] = ['(raw_text LIKE ? OR improved_text LIKE ?)']
    const params: any[] = [`%${query}%`, `%${query}%`]

    if (filters?.type) {
      conditions.push('type = ?')
      params.push(filters.type)
    }
    if (filters?.projectId) {
      conditions.push('project_id = ?')
      params.push(filters.projectId)
    }
    if (filters?.dateFrom) {
      conditions.push('created_at >= ?')
      params.push(filters.dateFrom)
    }
    if (filters?.dateTo) {
      conditions.push('created_at <= ?')
      params.push(filters.dateTo)
    }

    const sql = `
      SELECT id, raw_text as rawText, improved_text as improvedText,
             project_id as projectId, type, action, review_status as reviewStatus,
             created_at as createdAt
      FROM entries
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 50
    `

    return db.prepare(sql).all(...params) as Entry[]
  }

  delete(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM entries WHERE id = ?').run(id)
  }
}
