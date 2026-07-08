import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import { Project } from '../../../shared/types'

function mapRow(row: any): Project {
  return {
    ...row,
    isAutoSuggested: Boolean(row.isAutoSuggested),
    active: row.active !== 0,
  }
}

export class ProjectRepository {
  getAll(includeInactive = false): Project[] {
    const db = getDatabase()
    const whereClause = includeInactive ? '' : 'WHERE active = 1'
    const rows = db.prepare(`
      SELECT id, name, description, created_at as createdAt, is_auto_suggested as isAutoSuggested, active
      FROM projects ${whereClause} ORDER BY active DESC, created_at DESC
    `).all() as any[]

    return rows.map(mapRow)
  }

  getById(id: string): Project | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, name, description, created_at as createdAt, is_auto_suggested as isAutoSuggested, active
      FROM projects WHERE id = ?
    `).get(id) as any | undefined

    if (!row) return null
    return mapRow(row)
  }

  findByName(name: string): Project | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, name, description, created_at as createdAt, is_auto_suggested as isAutoSuggested, active
      FROM projects WHERE LOWER(name) = LOWER(?)
    `).get(name) as any | undefined

    if (!row) return null
    return mapRow(row)
  }

  create(name: string, description?: string, isAutoSuggested = false): Project {
    const db = getDatabase()
    const id = uuid()
    const createdAt = new Date().toISOString()

    db.prepare(`
      INSERT INTO projects (id, name, description, created_at, is_auto_suggested, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, name, description || null, createdAt, isAutoSuggested ? 1 : 0)

    return { id, name, description, createdAt, isAutoSuggested, active: true }
  }

  update(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'isAutoSuggested' | 'active'>>): Project | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const name = updates.name ?? existing.name
    const description = updates.description ?? existing.description
    const isAutoSuggested = updates.isAutoSuggested ?? existing.isAutoSuggested
    const active = updates.active ?? existing.active

    db.prepare(`
      UPDATE projects SET name = ?, description = ?, is_auto_suggested = ?, active = ? WHERE id = ?
    `).run(name, description || null, isAutoSuggested ? 1 : 0, active ? 1 : 0, id)

    return { ...existing, name, description, isAutoSuggested, active }
  }

  setActive(id: string, active: boolean): Project | null {
    return this.update(id, { active })
  }

  search(query: string): Project[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT id, name, description, created_at as createdAt, is_auto_suggested as isAutoSuggested, active
      FROM projects
      WHERE (name LIKE ? OR description LIKE ?)
      ORDER BY active DESC, created_at DESC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`) as any[]

    return rows.map(mapRow)
  }

  delete(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  }
}
