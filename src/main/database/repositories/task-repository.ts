import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import { Task, TaskStatus } from '../../../shared/types'

export class TaskRepository {
  getAll(projectId?: string): Task[] {
    const db = getDatabase()

    let query = `
      SELECT id, project_id as projectId, title, description, status, due_date as dueDate,
             source_entry_id as sourceEntryId, created_at as createdAt, updated_at as updatedAt
      FROM tasks
    `

    if (projectId) {
      query += ' WHERE project_id = ?'
      query += ' ORDER BY created_at DESC'
      return db.prepare(query).all(projectId) as Task[]
    }

    query += ' ORDER BY created_at DESC'
    return db.prepare(query).all() as Task[]
  }

  getByProject(projectId: string): Task[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT id, project_id as projectId, title, description, status, due_date as dueDate,
             source_entry_id as sourceEntryId, created_at as createdAt, updated_at as updatedAt
      FROM tasks WHERE project_id = ?
      ORDER BY created_at ASC
    `).all(projectId) as Task[]
  }

  getById(id: string): Task | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, project_id as projectId, title, description, status, due_date as dueDate,
             source_entry_id as sourceEntryId, created_at as createdAt, updated_at as updatedAt
      FROM tasks WHERE id = ?
    `).get(id) as Task | undefined

    return row || null
  }

  findSimilar(projectId: string, title: string): Task | null {
    const db = getDatabase()
    // Simple similarity: check if a task with very similar title exists and is not done
    const row = db.prepare(`
      SELECT id, project_id as projectId, title, description, status, due_date as dueDate,
             source_entry_id as sourceEntryId, created_at as createdAt, updated_at as updatedAt
      FROM tasks
      WHERE project_id = ? AND status != 'done' AND LOWER(title) = LOWER(?)
    `).get(projectId, title) as Task | undefined

    return row || null
  }

  create(data: {
    projectId: string
    title: string
    description?: string
    status?: TaskStatus
    dueDate?: string | null
    sourceEntryId?: string
  }): Task {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()
    const status = data.status || 'todo'
    const dueDate = data.dueDate || null

    db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, due_date, source_entry_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.projectId, data.title, data.description || null, status, dueDate, data.sourceEntryId || null, now, now)

    return {
      id,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      status,
      dueDate,
      sourceEntryId: data.sourceEntryId,
      createdAt: now,
      updatedAt: now,
    }
  }

  update(id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'dueDate'>>): Task | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const title = updates.title ?? existing.title
    const description = updates.description ?? existing.description
    const status = updates.status ?? existing.status
    const dueDate = updates.dueDate !== undefined ? updates.dueDate : existing.dueDate
    const updatedAt = new Date().toISOString()

    db.prepare(`
      UPDATE tasks SET title = ?, description = ?, status = ?, due_date = ?, updated_at = ? WHERE id = ?
    `).run(title, description || null, status, dueDate || null, updatedAt, id)

    return { ...existing, title, description, status, dueDate, updatedAt }
  }

  search(query: string, filters?: { projectId?: string; dateFrom?: string; dateTo?: string }): Task[] {
    const db = getDatabase()
    const conditions: string[] = ['(title LIKE ? OR description LIKE ?)']
    const params: any[] = [`%${query}%`, `%${query}%`]

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
      SELECT id, project_id as projectId, title, description, status, due_date as dueDate,
             source_entry_id as sourceEntryId, created_at as createdAt, updated_at as updatedAt
      FROM tasks
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 50
    `

    return db.prepare(sql).all(...params) as Task[]
  }

  getDueThisWeek(): Task[] {
    const db = getDatabase()
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // End of week (Sunday)
    const dayOfWeek = now.getDay()
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    const endOfWeek = new Date(now)
    endOfWeek.setDate(now.getDate() + daysUntilSunday)
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0]

    return db.prepare(`
      SELECT id, project_id as projectId, title, description, status, due_date as dueDate,
             source_entry_id as sourceEntryId, created_at as createdAt, updated_at as updatedAt
      FROM tasks
      WHERE due_date IS NOT NULL
        AND due_date <= ?
        AND due_date >= ?
        AND status != 'done'
      ORDER BY due_date ASC
    `).all(endOfWeekStr, today) as Task[]
  }

  getOverdue(): Task[] {
    const db = getDatabase()
    const today = new Date().toISOString().split('T')[0]

    return db.prepare(`
      SELECT id, project_id as projectId, title, description, status, due_date as dueDate,
             source_entry_id as sourceEntryId, created_at as createdAt, updated_at as updatedAt
      FROM tasks
      WHERE due_date IS NOT NULL
        AND due_date < ?
        AND status != 'done'
      ORDER BY due_date ASC
    `).all(today) as Task[]
  }

  delete(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }
}
