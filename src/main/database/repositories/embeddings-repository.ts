import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'

export interface EmbeddingRecord {
  id: string
  entityType: 'entry' | 'task'
  entityId: string
  embedding: Float32Array
  model: string
  dimensions: number
  createdAt: string
}

export class EmbeddingsRepository {
  /**
   * Store or update an embedding for a given entity.
   */
  upsert(entityType: 'entry' | 'task', entityId: string, embedding: Float32Array, model: string): void {
    const db = getDatabase()
    const existing = db.prepare(
      'SELECT id FROM embeddings WHERE entity_type = ? AND entity_id = ?'
    ).get(entityType, entityId) as { id: string } | undefined

    const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength)

    if (existing) {
      db.prepare(`
        UPDATE embeddings SET embedding = ?, model = ?, dimensions = ?, created_at = datetime('now')
        WHERE id = ?
      `).run(buffer, model, embedding.length, existing.id)
    } else {
      db.prepare(`
        INSERT INTO embeddings (id, entity_type, entity_id, embedding, model, dimensions, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(uuid(), entityType, entityId, buffer, model, embedding.length)
    }
  }

  /**
   * Get the embedding for a specific entity.
   */
  getByEntity(entityType: 'entry' | 'task', entityId: string): EmbeddingRecord | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, entity_type as entityType, entity_id as entityId, embedding, model, dimensions, created_at as createdAt
      FROM embeddings WHERE entity_type = ? AND entity_id = ?
    `).get(entityType, entityId) as (Omit<EmbeddingRecord, 'embedding'> & { embedding: Buffer }) | undefined

    if (!row) return null

    return {
      ...row,
      embedding: new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4),
    }
  }

  /**
   * Get all embeddings of a given type (for similarity search).
   */
  getAllByType(entityType: 'entry' | 'task'): EmbeddingRecord[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT id, entity_type as entityType, entity_id as entityId, embedding, model, dimensions, created_at as createdAt
      FROM embeddings WHERE entity_type = ?
    `).all(entityType) as (Omit<EmbeddingRecord, 'embedding'> & { embedding: Buffer })[]

    return rows.map((row) => ({
      ...row,
      embedding: new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4),
    }))
  }

  /**
   * Check if an entity has an embedding.
   */
  hasEmbedding(entityType: 'entry' | 'task', entityId: string): boolean {
    const db = getDatabase()
    const row = db.prepare(
      'SELECT 1 FROM embeddings WHERE entity_type = ? AND entity_id = ?'
    ).get(entityType, entityId)
    return !!row
  }

  /**
   * Get entity IDs that don't have embeddings yet (for batch indexing).
   */
  getMissingEntryIds(): string[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT e.id FROM entries e
      LEFT JOIN embeddings emb ON emb.entity_type = 'entry' AND emb.entity_id = e.id
      WHERE emb.id IS NULL
    `).all() as { id: string }[]
    return rows.map((r) => r.id)
  }

  /**
   * Get task IDs that don't have embeddings yet.
   */
  getMissingTaskIds(): string[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT t.id FROM tasks t
      LEFT JOIN embeddings emb ON emb.entity_type = 'task' AND emb.entity_id = t.id
      WHERE emb.id IS NULL
    `).all() as { id: string }[]
    return rows.map((r) => r.id)
  }

  /**
   * Delete embedding for an entity (when entry/task is deleted).
   */
  deleteByEntity(entityType: 'entry' | 'task', entityId: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM embeddings WHERE entity_type = ? AND entity_id = ?').run(entityType, entityId)
  }

  /**
   * Delete all embeddings (for full re-index).
   */
  deleteAll(): void {
    const db = getDatabase()
    db.prepare('DELETE FROM embeddings').run()
  }

  /**
   * Count embeddings by type.
   */
  count(entityType?: 'entry' | 'task'): number {
    const db = getDatabase()
    if (entityType) {
      const row = db.prepare('SELECT COUNT(*) as count FROM embeddings WHERE entity_type = ?').get(entityType) as { count: number }
      return row.count
    }
    const row = db.prepare('SELECT COUNT(*) as count FROM embeddings').get() as { count: number }
    return row.count
  }
}
