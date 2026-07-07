import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import { Project } from '../../../shared/types'

export class ProjectRepository {
  getAll(): Project[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT id, name, description, created_at as createdAt, is_auto_suggested as isAutoSuggested
      FROM projects ORDER BY created_at DESC
    `).all() as any[]

    return rows.map((row) => ({
      ...row,
      isAutoSuggested: Boolean(row.isAutoSuggested),
    }))
  }

  getById(id: string): Project | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, name, description, created_at as createdAt, is_auto_suggested as isAutoSuggested
      FROM projects WHERE id = ?
    `).get(id) as any | undefined

    if (!row) return null
    return { ...row, isAutoSuggested: Boolean(row.isAutoSuggested) }
  }

  findByName(name: string): Project | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, name, description, created_at as createdAt, is_auto_suggested as isAutoSuggested
      FROM projects WHERE LOWER(name) = LOWER(?)
    `).get(name) as any | undefined

    if (!row) return null
    return { ...row, isAutoSuggested: Boolean(row.isAutoSuggested) }
  }

  create(name: string, description?: string, isAutoSuggested = false): Project {
    const db = getDatabase()
    const id = uuid()
    const createdAt = new Date().toISOString()

    db.prepare(`
      INSERT INTO projects (id, name, description, created_at, is_auto_suggested)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description || null, createdAt, isAutoSuggested ? 1 : 0)

    return { id, name, description, createdAt, isAutoSuggested }
  }

  update(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'isAutoSuggested'>>): Project | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const name = updates.name ?? existing.name
    const description = updates.description ?? existing.description
    const isAutoSuggested = updates.isAutoSuggested ?? existing.isAutoSuggested

    db.prepare(`
      UPDATE projects SET name = ?, description = ?, is_auto_suggested = ? WHERE id = ?
    `).run(name, description || null, isAutoSuggested ? 1 : 0, id)

    return { ...existing, name, description, isAutoSuggested }
  }

  search(query: string): Project[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT id, name, description, created_at as createdAt, is_auto_suggested as isAutoSuggested
      FROM projects
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`) as any[]

    return rows.map((row) => ({
      ...row,
      isAutoSuggested: Boolean(row.isAutoSuggested),
    }))
  }

  delete(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  }
}
