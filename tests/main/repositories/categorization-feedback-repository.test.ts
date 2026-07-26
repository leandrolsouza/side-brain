import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import {
  CategorizationFeedbackRepository,
  type CategorizationFeedback,
} from '../../../src/main/database/repositories/categorization-feedback-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

function baseFeedbackData(
  overrides: Partial<Omit<CategorizationFeedback, 'id' | 'createdAt'>> = {}
): Omit<CategorizationFeedback, 'id' | 'createdAt'> {
  return {
    rawText: 'reunião sobre orçamento amanhã',
    aiType: 'information',
    aiAction: 'none',
    aiProjectId: 'proj-ai',
    correctedType: 'decision',
    correctedAction: 'action_needed',
    correctedProjectId: 'proj-user',
    correctedProjectName: 'Projeto Correto',
    ...overrides,
  }
}

describe('CategorizationFeedbackRepository', () => {
  let repo: CategorizationFeedbackRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new CategorizationFeedbackRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('add', () => {
    it('deve registrar um feedback com todos os campos', () => {
      const feedback = repo.add(baseFeedbackData())

      expect(feedback.id).toBeDefined()
      expect(feedback.rawText).toBe('reunião sobre orçamento amanhã')
      expect(feedback.aiType).toBe('information')
      expect(feedback.aiAction).toBe('none')
      expect(feedback.aiProjectId).toBe('proj-ai')
      expect(feedback.correctedType).toBe('decision')
      expect(feedback.correctedAction).toBe('action_needed')
      expect(feedback.correctedProjectId).toBe('proj-user')
      expect(feedback.correctedProjectName).toBe('Projeto Correto')
      expect(feedback.createdAt).toBeDefined()
    })

    it('deve aceitar campos de projeto nulos', () => {
      repo.add(
        baseFeedbackData({
          aiProjectId: null,
          correctedProjectId: null,
          correctedProjectName: null,
        })
      )

      const examples = repo.getRecentExamples()
      expect(examples).toHaveLength(1)
      expect(examples[0].aiProjectId).toBeNull()
      expect(examples[0].correctedProjectId).toBeNull()
      expect(examples[0].correctedProjectName).toBeNull()
    })

    it('deve persistir o feedback no banco', () => {
      const feedback = repo.add(baseFeedbackData())

      const examples = repo.getRecentExamples()
      expect(examples[0].id).toBe(feedback.id)
      expect(examples[0].rawText).toBe(feedback.rawText)
    })
  })

  describe('getRecentExamples', () => {
    it('deve retornar lista vazia quando não há feedbacks', () => {
      expect(repo.getRecentExamples()).toEqual([])
    })

    it('deve retornar feedbacks ordenados por created_at desc', () => {
      const db = getTestDatabase()
      const antigo = repo.add(baseFeedbackData({ rawText: 'antigo' }))
      const recente = repo.add(baseFeedbackData({ rawText: 'recente' }))
      db.prepare('UPDATE categorization_feedback SET created_at = ? WHERE id = ?').run(
        '2026-01-01T00:00:00.000Z',
        antigo.id
      )
      db.prepare('UPDATE categorization_feedback SET created_at = ? WHERE id = ?').run(
        '2026-02-01T00:00:00.000Z',
        recente.id
      )

      const examples = repo.getRecentExamples()
      expect(examples.map((e) => e.rawText)).toEqual(['recente', 'antigo'])
    })

    it('deve respeitar o limite padrão de 5', () => {
      const db = getTestDatabase()
      for (let i = 1; i <= 7; i++) {
        const feedback = repo.add(baseFeedbackData({ rawText: `feedback ${i}` }))
        db.prepare('UPDATE categorization_feedback SET created_at = ? WHERE id = ?').run(
          `2026-01-0${i}T00:00:00.000Z`,
          feedback.id
        )
      }

      const examples = repo.getRecentExamples()
      expect(examples).toHaveLength(5)
      expect(examples[0].rawText).toBe('feedback 7')
    })

    it('deve respeitar limite customizado', () => {
      repo.add(baseFeedbackData())
      repo.add(baseFeedbackData())
      repo.add(baseFeedbackData())

      expect(repo.getRecentExamples(2)).toHaveLength(2)
    })
  })

  describe('count', () => {
    it('deve retornar 0 quando não há feedbacks', () => {
      expect(repo.count()).toBe(0)
    })

    it('deve contar os feedbacks registrados', () => {
      repo.add(baseFeedbackData())
      repo.add(baseFeedbackData())

      expect(repo.count()).toBe(2)
    })
  })

  describe('pruneOld', () => {
    it('deve manter apenas os N feedbacks mais recentes', () => {
      const db = getTestDatabase()
      for (let i = 1; i <= 5; i++) {
        const feedback = repo.add(baseFeedbackData({ rawText: `feedback ${i}` }))
        db.prepare('UPDATE categorization_feedback SET created_at = ? WHERE id = ?').run(
          `2026-01-0${i}T00:00:00.000Z`,
          feedback.id
        )
      }

      repo.pruneOld(2)

      expect(repo.count()).toBe(2)
      const remaining = repo.getRecentExamples()
      expect(remaining.map((e) => e.rawText)).toEqual(['feedback 5', 'feedback 4'])
    })

    it('não deve excluir nada quando o total é menor que keepCount', () => {
      repo.add(baseFeedbackData())
      repo.add(baseFeedbackData())

      repo.pruneOld(50)

      expect(repo.count()).toBe(2)
    })
  })
})
