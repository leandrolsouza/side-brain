import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'

export interface CategorizationFeedback {
  id: string
  rawText: string
  aiType: string
  aiAction: string
  aiProjectId: string | null
  correctedType: string
  correctedAction: string
  correctedProjectId: string | null
  correctedProjectName: string | null
  createdAt: string
}

export class CategorizationFeedbackRepository {
  /**
   * Record a user correction to AI categorization.
   */
  add(data: Omit<CategorizationFeedback, 'id' | 'createdAt'>): CategorizationFeedback {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO categorization_feedback (id, raw_text, ai_type, ai_action, ai_project_id, corrected_type, corrected_action, corrected_project_id, corrected_project_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.rawText,
      data.aiType,
      data.aiAction,
      data.aiProjectId || null,
      data.correctedType,
      data.correctedAction,
      data.correctedProjectId || null,
      data.correctedProjectName || null,
      now
    )

    return { id, ...data, createdAt: now }
  }

  /**
   * Get the most recent feedback examples for few-shot prompting.
   * Returns diverse examples (avoids repeating the same correction).
   */
  getRecentExamples(limit = 5): CategorizationFeedback[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT id, raw_text as rawText, ai_type as aiType, ai_action as aiAction,
             ai_project_id as aiProjectId, corrected_type as correctedType,
             corrected_action as correctedAction, corrected_project_id as correctedProjectId,
             corrected_project_name as correctedProjectName, created_at as createdAt
      FROM categorization_feedback
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as CategorizationFeedback[]
  }

  /**
   * Get feedback count.
   */
  count(): number {
    const db = getDatabase()
    const row = db.prepare('SELECT COUNT(*) as count FROM categorization_feedback').get() as { count: number }
    return row.count
  }

  /**
   * Clear old feedback (keep only the most recent N entries).
   */
  pruneOld(keepCount = 50): void {
    const db = getDatabase()
    db.prepare(`
      DELETE FROM categorization_feedback
      WHERE id NOT IN (
        SELECT id FROM categorization_feedback ORDER BY created_at DESC LIMIT ?
      )
    `).run(keepCount)
  }
}
