import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../schema'
import type { ErrorLog, ErrorCategory, ErrorSeverity } from '../../../shared/types'

interface ErrorLogRow {
  id: string
  timestamp: string
  category: string
  severity: string
  message: string
  stack: string | null
  context: string | null
  resolved: number
  occurrences: number
  last_occurrence: string
}

export class ErrorLogRepository {
  private mapRow(row: ErrorLogRow): ErrorLog {
    return {
      id: row.id,
      timestamp: row.timestamp,
      category: row.category as ErrorCategory,
      severity: row.severity as ErrorSeverity,
      message: row.message,
      stack: row.stack || undefined,
      context: row.context || undefined,
      resolved: row.resolved === 1,
      occurrences: row.occurrences,
      lastOccurrence: row.last_occurrence,
    }
  }

  /**
   * Insere ou agrupa um erro (incrementa occurrences se já existir um não-resolvido com mesma message+category).
   */
  create(data: {
    category: ErrorCategory
    severity: ErrorSeverity
    message: string
    stack?: string
    context?: string
  }): ErrorLog {
    const db = getDatabase()

    // Tenta agrupar com erro existente não resolvido (mesma mensagem + categoria)
    const existing = db
      .prepare(`
      SELECT * FROM error_logs
      WHERE message = ? AND category = ? AND resolved = 0
      ORDER BY timestamp DESC
      LIMIT 1
    `)
      .get(data.message, data.category) as ErrorLogRow | undefined

    if (existing) {
      db.prepare(`
        UPDATE error_logs
        SET occurrences = occurrences + 1,
            last_occurrence = datetime('now'),
            severity = ?
        WHERE id = ?
      `).run(data.severity, existing.id)

      const updated = db.prepare('SELECT * FROM error_logs WHERE id = ?').get(existing.id) as ErrorLogRow
      return this.mapRow(updated)
    }

    // Cria novo registro
    const id = uuidv4()
    db.prepare(`
      INSERT INTO error_logs (id, category, severity, message, stack, context)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.category, data.severity, data.message, data.stack || null, data.context || null)

    const row = db.prepare('SELECT * FROM error_logs WHERE id = ?').get(id) as ErrorLogRow
    return this.mapRow(row)
  }

  getAll(filters?: { category?: ErrorCategory; severity?: ErrorSeverity; resolved?: boolean }): ErrorLog[] {
    const db = getDatabase()
    const conditions: string[] = []
    const params: any[] = []

    if (filters?.category) {
      conditions.push('category = ?')
      params.push(filters.category)
    }
    if (filters?.severity) {
      conditions.push('severity = ?')
      params.push(filters.severity)
    }
    if (filters?.resolved !== undefined) {
      conditions.push('resolved = ?')
      params.push(filters.resolved ? 1 : 0)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = db
      .prepare(`
      SELECT * FROM error_logs ${where}
      ORDER BY last_occurrence DESC
      LIMIT 500
    `)
      .all(...params) as ErrorLogRow[]

    return rows.map((row) => this.mapRow(row))
  }

  getUnresolvedCount(): number {
    const db = getDatabase()
    const result = db.prepare('SELECT COUNT(*) as count FROM error_logs WHERE resolved = 0').get() as { count: number }
    return result.count
  }

  resolve(id: string): void {
    const db = getDatabase()
    db.prepare('UPDATE error_logs SET resolved = 1 WHERE id = ?').run(id)
  }

  resolveAll(): void {
    const db = getDatabase()
    db.prepare('UPDATE error_logs SET resolved = 1 WHERE resolved = 0').run()
  }

  delete(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM error_logs WHERE id = ?').run(id)
  }

  clearAll(): void {
    const db = getDatabase()
    db.prepare('DELETE FROM error_logs').run()
  }

  /**
   * Remove logs resolvidos com mais de X dias.
   */
  cleanOld(daysToKeep: number = 30): number {
    const db = getDatabase()
    const result = db
      .prepare(`
      DELETE FROM error_logs
      WHERE resolved = 1 AND timestamp < datetime('now', '-' || ? || ' days')
    `)
      .run(daysToKeep)
    return result.changes
  }
}
