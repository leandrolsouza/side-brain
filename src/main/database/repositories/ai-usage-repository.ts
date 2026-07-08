import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../schema'
import type { AIOperationType, AIUsageRecord, AIUsageSummary, AIUsageDailyPoint } from '../../../shared/types'

export class AIUsageRepository {
  record(data: {
    operationType: AIOperationType
    model: string
    inputTokens: number
    outputTokens: number
    estimatedCost: number
    latencyMs: number
  }): AIUsageRecord {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO ai_usage (id, operation_type, model, input_tokens, output_tokens, estimated_cost, latency_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.operationType, data.model, data.inputTokens, data.outputTokens, data.estimatedCost, data.latencyMs, now)

    return {
      id,
      operationType: data.operationType,
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      estimatedCost: data.estimatedCost,
      latencyMs: data.latencyMs,
      createdAt: now,
    }
  }

  getSummary(dateFrom?: string, dateTo?: string): AIUsageSummary {
    const db = getDatabase()

    let whereClause = ''
    const params: string[] = []

    if (dateFrom) {
      whereClause += ' WHERE created_at >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      whereClause += whereClause ? ' AND created_at <= ?' : ' WHERE created_at <= ?'
      params.push(dateTo)
    }

    // Totals
    const totals = db.prepare(`
      SELECT
        COUNT(*) as totalCalls,
        COALESCE(SUM(input_tokens), 0) as totalInputTokens,
        COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
        COALESCE(SUM(estimated_cost), 0) as totalEstimatedCost
      FROM ai_usage${whereClause}
    `).get(...params) as {
      totalCalls: number
      totalInputTokens: number
      totalOutputTokens: number
      totalEstimatedCost: number
    }

    // By operation type
    const byOperation = db.prepare(`
      SELECT
        operation_type as operationType,
        COUNT(*) as calls,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(SUM(estimated_cost), 0) as estimatedCost
      FROM ai_usage${whereClause}
      GROUP BY operation_type
      ORDER BY calls DESC
    `).all(...params) as {
      operationType: AIOperationType
      calls: number
      inputTokens: number
      outputTokens: number
      estimatedCost: number
    }[]

    return {
      totalCalls: totals.totalCalls,
      totalInputTokens: totals.totalInputTokens,
      totalOutputTokens: totals.totalOutputTokens,
      totalEstimatedCost: totals.totalEstimatedCost,
      byOperation,
    }
  }

  getDailyUsage(dateFrom?: string, dateTo?: string): AIUsageDailyPoint[] {
    const db = getDatabase()

    let whereClause = ''
    const params: string[] = []

    if (dateFrom) {
      whereClause += ' WHERE created_at >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      whereClause += whereClause ? ' AND created_at <= ?' : ' WHERE created_at <= ?'
      params.push(dateTo)
    }

    return db.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as calls,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(SUM(estimated_cost), 0) as estimatedCost
      FROM ai_usage${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 90
    `).all(...params) as AIUsageDailyPoint[]
  }

  getHistory(limit: number = 50, offset: number = 0): AIUsageRecord[] {
    const db = getDatabase()

    const rows = db.prepare(`
      SELECT id, operation_type, model, input_tokens, output_tokens, estimated_cost, latency_ms, created_at
      FROM ai_usage
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as {
      id: string
      operation_type: string
      model: string
      input_tokens: number
      output_tokens: number
      estimated_cost: number
      latency_ms: number
      created_at: string
    }[]

    return rows.map((row) => ({
      id: row.id,
      operationType: row.operation_type as AIOperationType,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      estimatedCost: row.estimated_cost,
      latencyMs: row.latency_ms,
      createdAt: row.created_at,
    }))
  }
}
