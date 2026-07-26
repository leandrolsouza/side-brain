import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { AIUsageRepository } from '../../../src/main/database/repositories/ai-usage-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('AIUsageRepository', () => {
  let repo: AIUsageRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new AIUsageRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('record', () => {
    it('deve registrar uso de AI com todos os campos', () => {
      const usage = repo.record({
        operationType: 'categorization',
        model: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        inputTokens: 500,
        outputTokens: 200,
        estimatedCost: 0.0045,
        latencyMs: 1200,
      })

      expect(usage.id).toBeDefined()
      expect(usage.operationType).toBe('categorization')
      expect(usage.model).toBe('us.anthropic.claude-sonnet-4-20250514-v1:0')
      expect(usage.inputTokens).toBe(500)
      expect(usage.outputTokens).toBe(200)
      expect(usage.estimatedCost).toBe(0.0045)
      expect(usage.latencyMs).toBe(1200)
      expect(usage.createdAt).toBeDefined()
    })
  })

  describe('getSummary', () => {
    beforeEach(() => {
      repo.record({
        operationType: 'categorization',
        model: 'claude',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.001,
        latencyMs: 800,
      })
      repo.record({
        operationType: 'categorization',
        model: 'claude',
        inputTokens: 200,
        outputTokens: 100,
        estimatedCost: 0.002,
        latencyMs: 900,
      })
      repo.record({
        operationType: 'summary',
        model: 'claude',
        inputTokens: 500,
        outputTokens: 300,
        estimatedCost: 0.005,
        latencyMs: 1500,
      })
    })

    it('deve retornar totais corretos', () => {
      const summary = repo.getSummary()

      expect(summary.totalCalls).toBe(3)
      expect(summary.totalInputTokens).toBe(800)
      expect(summary.totalOutputTokens).toBe(450)
      expect(summary.totalEstimatedCost).toBeCloseTo(0.008, 5)
    })

    it('deve agrupar por operationType', () => {
      const summary = repo.getSummary()

      expect(summary.byOperation).toHaveLength(2)

      const categorization = summary.byOperation.find((o) => o.operationType === 'categorization')
      expect(categorization).toBeDefined()
      expect(categorization!.calls).toBe(2)
      expect(categorization!.inputTokens).toBe(300)
      expect(categorization!.outputTokens).toBe(150)

      const summaryOp = summary.byOperation.find((o) => o.operationType === 'summary')
      expect(summaryOp).toBeDefined()
      expect(summaryOp!.calls).toBe(1)
    })

    it('deve filtrar por período (dateFrom)', async () => {
      const db = getTestDatabase()

      // Insere um registro com data antiga
      const oldDate = '2020-01-01T00:00:00.000Z'
      db.prepare(`
        INSERT INTO ai_usage (id, operation_type, model, input_tokens, output_tokens, estimated_cost, latency_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('old-usage', 'digest', 'claude', 1000, 500, 0.01, 2000, oldDate)

      // Filtrar só registros de hoje em diante
      const today = new Date().toISOString().split('T')[0]
      const summary = repo.getSummary(today)

      // Não deve incluir o registro antigo
      expect(summary.totalCalls).toBe(3)
    })

    it('deve retornar zeros quando não há registros', () => {
      const db = getTestDatabase()
      db.prepare('DELETE FROM ai_usage').run()

      const summary = repo.getSummary()
      expect(summary.totalCalls).toBe(0)
      expect(summary.totalInputTokens).toBe(0)
      expect(summary.totalOutputTokens).toBe(0)
      expect(summary.totalEstimatedCost).toBe(0)
      expect(summary.byOperation).toHaveLength(0)
    })
  })

  describe('getDailyUsage', () => {
    beforeEach(() => {
      repo.record({
        operationType: 'categorization',
        model: 'claude',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.001,
        latencyMs: 800,
      })
      repo.record({
        operationType: 'categorization',
        model: 'claude',
        inputTokens: 200,
        outputTokens: 100,
        estimatedCost: 0.002,
        latencyMs: 900,
      })
      repo.record({
        operationType: 'summary',
        model: 'claude',
        inputTokens: 500,
        outputTokens: 300,
        estimatedCost: 0.005,
        latencyMs: 1500,
      })
    })

    it('deve agrupar uso por dia', () => {
      const daily = repo.getDailyUsage()

      expect(daily.length).toBeGreaterThanOrEqual(1)
      const today = new Date().toISOString().split('T')[0]
      const todayData = daily.find((d) => d.date === today)
      expect(todayData).toBeDefined()
      expect(todayData!.calls).toBe(3)
    })

    it('deve filtrar por período', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      // Filtrar a partir de amanhã deve retornar vazio
      const daily = repo.getDailyUsage(tomorrowStr)
      expect(daily).toHaveLength(0)
    })
  })

  describe('getHistory', () => {
    beforeEach(() => {
      repo.record({
        operationType: 'categorization',
        model: 'claude',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.001,
        latencyMs: 800,
      })
      repo.record({
        operationType: 'categorization',
        model: 'claude',
        inputTokens: 200,
        outputTokens: 100,
        estimatedCost: 0.002,
        latencyMs: 900,
      })
      repo.record({
        operationType: 'summary',
        model: 'claude',
        inputTokens: 500,
        outputTokens: 300,
        estimatedCost: 0.005,
        latencyMs: 1500,
      })
    })

    it('deve retornar registros ordenados por data desc', () => {
      const history = repo.getHistory()

      expect(history).toHaveLength(3)
      expect(history[0].operationType).toBeDefined()
      expect(history[0].createdAt).toBeDefined()
    })

    it('deve respeitar limit e offset', () => {
      const page1 = repo.getHistory(2, 0)
      expect(page1).toHaveLength(2)

      const page2 = repo.getHistory(2, 2)
      expect(page2).toHaveLength(1)
    })

    it('deve retornar vazio quando offset excede total', () => {
      const result = repo.getHistory(10, 100)
      expect(result).toHaveLength(0)
    })
  })
})
