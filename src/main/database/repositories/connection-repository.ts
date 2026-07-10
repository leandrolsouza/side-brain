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

  getAllForGraph(filters?: {
    projectId?: string
    dateFrom?: string
    minConnections?: number
    connectionType?: string
  }): { entries: Entry[]; connections: EntryConnection[] } {
    const db = getDatabase()

    // Build dynamic conditions for connections
    const connConditions: string[] = []
    const connParams: any[] = []

    if (filters?.connectionType) {
      connConditions.push('c.connection_type = ?')
      connParams.push(filters.connectionType)
    }

    const connWhereClause = connConditions.length > 0
      ? 'WHERE ' + connConditions.join(' AND ')
      : ''

    // If filtering by project or date, first find the entries that match,
    // then find ALL connections involving those entries (including cross-project)
    if (filters?.projectId || filters?.dateFrom) {
      const entryConditions: string[] = []
      const entryParams: any[] = []

      if (filters.projectId) {
        entryConditions.push('e.project_id = ?')
        entryParams.push(filters.projectId)
      }
      if (filters.dateFrom) {
        entryConditions.push('e.created_at >= ?')
        entryParams.push(filters.dateFrom)
      }

      const entryWhereClause = entryConditions.join(' AND ')

      // Get matching entry IDs
      const matchingEntries = db.prepare(`
        SELECT e.id FROM entries e WHERE ${entryWhereClause}
      `).all(...entryParams) as { id: string }[]

      const matchingIds = new Set(matchingEntries.map(e => e.id))

      if (matchingIds.size === 0) {
        return { entries: [], connections: [] }
      }

      // Get all connections where AT LEAST ONE side is in the matching set
      const allConnections = db.prepare(`
        SELECT c.id, c.source_entry_id as sourceEntryId, c.target_entry_id as targetEntryId,
               c.connection_type as connectionType, c.description, c.is_ai_suggested as isAiSuggested,
               c.created_at as createdAt
        FROM entry_connections c
        ${connWhereClause}
        ORDER BY c.created_at DESC
      `).all(...connParams).map((row: any) => ({
        ...row,
        isAiSuggested: Boolean(row.isAiSuggested),
        description: row.description || undefined,
      })) as EntryConnection[]

      // Filter: at least one side must be in the matching entries
      const filteredConnections = allConnections.filter(c =>
        matchingIds.has(c.sourceEntryId) || matchingIds.has(c.targetEntryId)
      )

      // Collect all entry IDs we need (both sides of filtered connections)
      const neededIds = new Set<string>()
      for (const conn of filteredConnections) {
        neededIds.add(conn.sourceEntryId)
        neededIds.add(conn.targetEntryId)
      }

      if (neededIds.size === 0) {
        return { entries: [], connections: [] }
      }

      // Fetch all needed entries
      const placeholders = Array.from(neededIds).map(() => '?').join(',')
      const entries = db.prepare(`
        SELECT DISTINCT e.id, e.raw_text as rawText, e.improved_text as improvedText,
               e.project_id as projectId, e.type, e.action, e.review_status as reviewStatus,
               e.created_at as createdAt
        FROM entries e
        WHERE e.id IN (${placeholders})
        ORDER BY e.created_at DESC
      `).all(...Array.from(neededIds)) as Entry[]

      // Apply minConnections filter
      if (filters?.minConnections && filters.minConnections > 1) {
        return this.applyMinConnections(entries, filteredConnections, filters.minConnections)
      }

      return { entries, connections: filteredConnections }
    }

    // No project/date filter — get all connections
    const connections = db.prepare(`
      SELECT c.id, c.source_entry_id as sourceEntryId, c.target_entry_id as targetEntryId,
             c.connection_type as connectionType, c.description, c.is_ai_suggested as isAiSuggested,
             c.created_at as createdAt
      FROM entry_connections c
      ${connWhereClause}
      ORDER BY c.created_at DESC
    `).all(...connParams).map((row: any) => ({
      ...row,
      isAiSuggested: Boolean(row.isAiSuggested),
      description: row.description || undefined,
    })) as EntryConnection[]

    // Collect all entry IDs from connections
    const entryIdsInConnections = new Set<string>()
    for (const conn of connections) {
      entryIdsInConnections.add(conn.sourceEntryId)
      entryIdsInConnections.add(conn.targetEntryId)
    }

    if (entryIdsInConnections.size === 0) {
      return { entries: [], connections: [] }
    }

    // Get all entries that participate in connections
    const placeholders = Array.from(entryIdsInConnections).map(() => '?').join(',')
    const entries = db.prepare(`
      SELECT DISTINCT e.id, e.raw_text as rawText, e.improved_text as improvedText,
             e.project_id as projectId, e.type, e.action, e.review_status as reviewStatus,
             e.created_at as createdAt
      FROM entries e
      WHERE e.id IN (${placeholders})
      ORDER BY e.created_at DESC
    `).all(...Array.from(entryIdsInConnections)) as Entry[]

    // Apply minConnections filter
    if (filters?.minConnections && filters.minConnections > 1) {
      return this.applyMinConnections(entries, connections, filters.minConnections)
    }

    return { entries, connections }
  }

  private applyMinConnections(
    entries: Entry[],
    connections: EntryConnection[],
    minConnections: number
  ): { entries: Entry[]; connections: EntryConnection[] } {
    const degreeMap = new Map<string, number>()
    for (const conn of connections) {
      degreeMap.set(conn.sourceEntryId, (degreeMap.get(conn.sourceEntryId) || 0) + 1)
      degreeMap.set(conn.targetEntryId, (degreeMap.get(conn.targetEntryId) || 0) + 1)
    }

    const filteredEntries = entries.filter(e => (degreeMap.get(e.id) || 0) >= minConnections)
    const validIds = new Set(filteredEntries.map(e => e.id))
    const filteredConnections = connections.filter(c =>
      validIds.has(c.sourceEntryId) && validIds.has(c.targetEntryId)
    )

    return { entries: filteredEntries, connections: filteredConnections }
  }
}
