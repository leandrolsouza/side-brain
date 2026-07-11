import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import { Entry, EntryType, ActionStatus, ReviewStatus, PaginatedResult, PaginationParams } from '../../../shared/types'

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

  getPaginated(params: PaginationParams & { projectId?: string }): PaginatedResult<Entry> {
    const db = getDatabase()
    const { page, pageSize, projectId } = params
    const offset = (page - 1) * pageSize

    let countQuery = 'SELECT COUNT(*) as total FROM entries'
    let dataQuery = `
      SELECT id, raw_text as rawText, improved_text as improvedText,
             project_id as projectId, type, action, review_status as reviewStatus,
             created_at as createdAt
      FROM entries
    `

    const queryParams: any[] = []

    if (projectId) {
      countQuery += ' WHERE project_id = ?'
      dataQuery += ' WHERE project_id = ?'
      queryParams.push(projectId)
    }

    dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'

    const { total } = db.prepare(countQuery).get(...queryParams) as { total: number }
    const data = db.prepare(dataQuery).all(...queryParams, pageSize, offset) as Entry[]

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
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

    // Use FTS5 for full-text search when available
    try {
      const ftsConditions: string[] = []
      const ftsParams: any[] = []

      // Escape FTS5 special characters and build match expression
      const escapedQuery = query.replace(/['"\\*()^~\-:]/g, ' ').trim()
      if (!escapedQuery) return []

      // Use FTS5 MATCH with the escaped query (prefix search with *)
      const ftsMatchExpr = escapedQuery.split(/\s+/).map(term => `"${term}"*`).join(' ')

      let sql = `
        SELECT e.id, e.raw_text as rawText, e.improved_text as improvedText,
               e.project_id as projectId, e.type, e.action, e.review_status as reviewStatus,
               e.created_at as createdAt
        FROM entries e
        JOIN entries_fts fts ON e.rowid = fts.rowid
        WHERE entries_fts MATCH ?
      `
      ftsParams.push(ftsMatchExpr)

      if (filters?.type) {
        sql += ' AND e.type = ?'
        ftsParams.push(filters.type)
      }
      if (filters?.projectId) {
        sql += ' AND e.project_id = ?'
        ftsParams.push(filters.projectId)
      }
      if (filters?.dateFrom) {
        sql += ' AND e.created_at >= ?'
        ftsParams.push(filters.dateFrom)
      }
      if (filters?.dateTo) {
        sql += ' AND e.created_at <= ?'
        ftsParams.push(filters.dateTo)
      }

      sql += ' ORDER BY rank LIMIT 50'

      return db.prepare(sql).all(...ftsParams) as Entry[]
    } catch {
      // Fallback to LIKE search if FTS5 table not available (e.g. in tests or pre-migration)
      return this.searchFallback(query, filters)
    }
  }

  private searchFallback(query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }): Entry[] {
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

  getActivityHeatmap(weeks: number = 20): { date: string; count: number }[] {
    const db = getDatabase()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (weeks * 7))
    const startStr = startDate.toISOString()

    const rows = db.prepare(`
      SELECT SUBSTR(created_at, 1, 10) as date, COUNT(*) as count
      FROM entries
      WHERE created_at >= ?
      GROUP BY SUBSTR(created_at, 1, 10)
      ORDER BY date ASC
    `).all(startStr) as { date: string; count: number }[]

    return rows
  }

  delete(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM entries WHERE id = ?').run(id)
  }
}
