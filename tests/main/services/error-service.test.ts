import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { ErrorService } from '../../../src/main/services/error-service'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

// Mock Electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}))

describe('ErrorService', () => {
  let service: ErrorService

  beforeEach(() => {
    createTestDatabase()
    service = new ErrorService()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('logError', () => {
    it('deve registrar um erro e retornar ErrorLog', () => {
      const log = service.logError({
        category: 'ai',
        message: 'Bedrock API timeout',
      })

      expect(log.id).toBeDefined()
      expect(log.category).toBe('ai')
      expect(log.severity).toBe('error') // default
      expect(log.message).toBe('Bedrock API timeout')
      expect(log.resolved).toBe(false)
    })

    it('deve registrar erro com severity customizada', () => {
      const log = service.logError({
        category: 'system',
        severity: 'critical',
        message: 'Out of memory',
      })

      expect(log.severity).toBe('critical')
    })

    it('deve registrar erro com stack e context', () => {
      const log = service.logError({
        category: 'database',
        message: 'SQLITE_BUSY',
        stack: 'Error: SQLITE_BUSY\n  at exec()',
        context: { table: 'entries', operation: 'insert' },
      })

      expect(log.stack).toBe('Error: SQLITE_BUSY\n  at exec()')
      expect(log.context).toBe('{"table":"entries","operation":"insert"}')
    })

    it('deve agrupar erros duplicados (mesma mensagem + categoria)', () => {
      service.logError({ category: 'ai', message: 'Rate limited' })
      const second = service.logError({ category: 'ai', message: 'Rate limited' })

      expect(second.occurrences).toBe(2)

      const all = service.getAll()
      expect(all).toHaveLength(1)
    })
  })

  describe('getAll', () => {
    it('deve retornar todos os logs', () => {
      service.logError({ category: 'ai', message: 'Erro 1' })
      service.logError({ category: 'database', message: 'Erro 2' })

      expect(service.getAll()).toHaveLength(2)
    })

    it('deve filtrar por categoria', () => {
      service.logError({ category: 'ai', message: 'AI Error' })
      service.logError({ category: 'database', message: 'DB Error' })

      const filtered = service.getAll({ category: 'ai' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].category).toBe('ai')
    })

    it('deve filtrar por severity', () => {
      service.logError({ category: 'ai', severity: 'warning', message: 'Warning' })
      service.logError({ category: 'ai', severity: 'critical', message: 'Critical' })

      const filtered = service.getAll({ severity: 'critical' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].message).toBe('Critical')
    })

    it('deve filtrar por resolved', () => {
      const log = service.logError({ category: 'ai', message: 'Resolvido' })
      service.logError({ category: 'ai', message: 'Aberto' })
      service.resolve(log.id)

      expect(service.getAll({ resolved: true })).toHaveLength(1)
      expect(service.getAll({ resolved: false })).toHaveLength(1)
    })
  })

  describe('getUnresolvedCount', () => {
    it('deve contar erros não resolvidos', () => {
      service.logError({ category: 'ai', message: 'E1' })
      service.logError({ category: 'ai', message: 'E2' })
      const e3 = service.logError({ category: 'ai', message: 'E3' })
      service.resolve(e3.id)

      expect(service.getUnresolvedCount()).toBe(2)
    })
  })

  describe('resolve', () => {
    it('deve marcar erro como resolvido', () => {
      const log = service.logError({ category: 'ai', message: 'Erro' })

      service.resolve(log.id)

      const all = service.getAll({ resolved: true })
      expect(all).toHaveLength(1)
    })
  })

  describe('resolveAll', () => {
    it('deve resolver todos os erros', () => {
      service.logError({ category: 'ai', message: 'E1' })
      service.logError({ category: 'database', message: 'E2' })

      service.resolveAll()

      expect(service.getUnresolvedCount()).toBe(0)
    })
  })

  describe('delete', () => {
    it('deve excluir um log', () => {
      const log = service.logError({ category: 'ai', message: 'Para excluir' })

      service.delete(log.id)

      expect(service.getAll()).toHaveLength(0)
    })
  })

  describe('clearAll', () => {
    it('deve limpar todos os logs', () => {
      service.logError({ category: 'ai', message: 'E1' })
      service.logError({ category: 'database', message: 'E2' })

      service.clearAll()

      expect(service.getAll()).toHaveLength(0)
    })
  })

  describe('cleanOldLogs', () => {
    it('deve remover logs antigos resolvidos', async () => {
      const db = getTestDatabase()
      const { v4: uuidv4 } = await import('uuid')

      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
      db.prepare(`
        INSERT INTO error_logs (id, category, severity, message, resolved, occurrences, timestamp, last_occurrence)
        VALUES (?, ?, ?, ?, 1, 1, ?, ?)
      `).run(uuidv4(), 'ai', 'error', 'Erro antigo resolvido', oldDate, oldDate)

      const removed = service.cleanOldLogs()
      expect(removed).toBe(1)
    })
  })
})
