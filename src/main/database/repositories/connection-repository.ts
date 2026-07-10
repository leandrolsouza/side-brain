import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import { EntryConnection, ConnectedEntry, ConnectionType, Entry } from '../../../shared/types'

export class ConnectionRepository {
  create(data: {
    sourceEntryId: string
    targetEntryId: string
    connectionType: ConnectionType
    description?: string
    isAiSuggested?: boolean
  }): EntryConnection {
    const db = getDatabase()
    const id = uuid()
    const createdAt = new Date().toISOString()

    db.prepare(`
      INSERT INTO entry_connections (id, source_entry_id, target_entry_id, connection_type, description, is_ai_suggested, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.sourceEntryId,
      data.targetEntryId,
      data.connectionType,
      data.description || null,
      data.isAiSuggested ? 1 : 0,
      createdAt
    )

    return {
      id,
      sourceEntryId: data.sourceEntryId,
      targetEntryId: data.targetEntryId,
      connectionType: data.connectionType,
      description: data.description,
      isAiSuggested: data.isAiSuggested ?? false,
      createdAt,
    }
  }

  getByEntryId(entryId: string): ConnectedEntry[] {
    const db = getDatabase()

    // Get connections where entry is the source
    const asSource = db.prepare(`
      SELECT
        c.id, c.source_entry_id as sourceEntryId, c.target_entry_id as targetEntryId,
        c.connection_type as connectionType, c.description, c.is_ai_suggested as isAiSuggested,
        c.created_at as createdAt,
        e.id as eId, e.raw_text as eRawText, e.improved_text as eImprovedText,
        e.project_id as eProjectId, e.type as eType, e.action as eAction,
        e.review_status as eReviewStatus, e.created_at as eCreatedAt
      FROM entry_connections c
      JOIN entries e ON e.id = c.target_entry_id
      WHERE c.source_entry_id = ?
      ORDER BY c.created_at DESC
    `).all(entryId) as any[]

    // Get connections where entry is the target
    const asTarget = db.prepare(`
      SELECT
        c.id, c.source_entry_id as sourceEntryId, c.target_entry_id as targetEntryId,
        c.connection_type as connectionType, c.description, c.is_ai_suggested as isAiSuggested,
        c.created_at as createdAt,
        e.id as eId, e.raw_text as eRawText, e.improved_text as eImprovedText,
        e.project_id as eProjectId, e.type as eType, e.action as eAction,
        e.review_status as eReviewStatus, e.created_at as eCreatedAt
      FROM entry_connections c
      JOIN entries e ON e.id = c.source_entry_id
      WHERE c.target_entry_id = ?
      ORDER BY c.created_at DESC
    `).all(entryId) as any[]

    const mapRow = (row: any): ConnectedEntry => ({
      connection: {
        id: row.id,
        sourceEntryId: row.sourceEntryId,
        targetEntryId: row.targetEntryId,
        connectionType: row.connectionType as ConnectionType,
        description: row.description || undefined,
        isAiSuggested: Boolean(row.isAiSuggested),
        createdAt: row.createdAt,
      },
      entry: {
        id: row.eId,
        rawText: row.eRawText,
        improvedText: row.eImprovedText,
        projectId: row.eProjectId,
        type: row.eType,
        action: row.eAction,
        reviewStatus: row.eReviewStatus,
        createdAt: row.eCreatedAt,
      },
    })

    return [...asSource.map(mapRow), ...asTarget.map(mapRow)]
  }

  delete(connectionId: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM entry_connections WHERE id = ?').run(connectionId)
  }

  exists(sourceEntryId: string, targetEntryId: string): boolean {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id FROM entry_connections
      WHERE (source_entry_id = ? AND target_entry_id = ?)
         OR (source_entry_id = ? AND target_entry_id = ?)
    `).get(sourceEntryId, targetEntryId, targetEntryId, sourceEntryId)

    return !!row
  }

  getConnectionCount(entryId: string): number {
    const db = getDatabase()
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM entry_connections
      WHERE source_entry_id = ? OR target_entry_id = ?
    `).get(entryId, entryId) as { count: number }

    return result.count
  }

  searchEntries(query: string, excludeEntryId: string, limit: number = 20): Entry[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT id, raw_text as rawText, improved_text as improvedText,
             project_id as projectId, type, action, review_status as reviewStatus,
             created_at as createdAt
      FROM entries
      WHERE id != ?
        AND (raw_text LIKE ? OR improved_text LIKE ?)
      ORDER BY created_at DESC
      LIMIT ?
    `).all(excludeEntryId, `%${query}%`, `%${query}%`, limit) as Entry[]
  }

  getAllForGraph(): { entries: Entry[]; connections: EntryConnection[] } {
    const db = getDatabase()

    // Get all entries that have at least one connection
    const entries = db.prepare(`
      SELECT DISTINCT e.id, e.raw_text as rawText, e.improved_text as improvedText,
             e.project_id as projectId, e.type, e.action, e.review_status as reviewStatus,
             e.created_at as createdAt
      FROM entries e
      WHERE e.id IN (
        SELECT source_entry_id FROM entry_connections
        UNION
        SELECT target_entry_id FROM entry_connections
      )
      ORDER BY e.created_at DESC
    `).all() as Entry[]

    // Get all connections
    const connections = db.prepare(`
      SELECT id, source_entry_id as sourceEntryId, target_entry_id as targetEntryId,
             connection_type as connectionType, description, is_ai_suggested as isAiSuggested,
             created_at as createdAt
      FROM entry_connections
      ORDER BY created_at DESC
    `).all().map((row: any) => ({
      ...row,
      isAiSuggested: Boolean(row.isAiSuggested),
      description: row.description || undefined,
    })) as EntryConnection[]

    return { entries, connections }
  }
}
