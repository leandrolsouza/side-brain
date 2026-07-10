import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { ErrorLogRepository } from '../../../src/main/database/repositories/error-log-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('ErrorLogRepository', () => {
  let repo: ErrorLogRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new ErrorLogRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar um novo log de erro', () => {
      const error = repo.create({
        category: 'ai',
        severity: 'error',
        message: 'Bedrock API timeout',
      })

      expect(error.id).toBeDefined()
      expect(error.category).toBe('ai')
      expect(error.severity).toBe('error')
      expect(error.message).toBe('Bedrock API timeout')
      expect(error.resolved).toBe(false)
      expect(error.occurrences).toBe(1)
      expect(error.timestamp).toBeDefined()
      expect(error.lastOccurrence).toBeDefined()
    })

    it('deve criar erro com stack e context', () => {
      const error = repo.create({
        category: 'database',
        severity: 'critical',
        message: 'SQLITE_BUSY',
        stack: 'Error: SQLITE_BUSY\n  at Database.exec(...)',
        context: '{"table":"entries","operation":"insert"}',
      })

      expect(error.stack).toBe('Error: SQLITE_BUSY\n  at Database.exec(...)')
      expect(error.context).toBe('{"table":"entries","operation":"insert"}')
    })

    it('deve agrupar erros com mesma mensagem e categoria (deduplicação)', () => {
      const first = repo.create({
        category: 'ai',
        severity: 'error',
        message: 'Connection refused',
      })

      const second = repo.create({
        category: 'ai',
        severity: 'error',
        message: 'Connection refused',
      })

      // Deve retornar o mesmo ID (agrupado)
      expect(second.id).toBe(first.id)
      expect(second.occurrences).toBe(2)
    })

    it('não deve agrupar erros de categorias diferentes', () => {
      repo.create({
        category: 'ai',
        severity: 'error',
        message: 'Timeout',
      })

      const second = repo.create({
        category: 'database',
        severity: 'error',
        message: 'Timeout',
      })

      expect(second.occurrences).toBe(1)
      expect(repo.getAll()).toHaveLength(2)
    })

    it('não deve agrupar com erros já resolvidos', () => {
      const first = repo.create({
        category: 'ai',
        severity: 'error',
        message: 'API Error',
      })
      repo.resolve(first.id)

      const second = repo.create({
        category: 'ai',
        severity: 'error',
        message: 'API Error',
      })

      expect(second.id).not.toBe(first.id)
      expect(second.occurrences).toBe(1)
    })
  })

  describe('getAll', () => {
    it('deve retornar todos os logs', () => {
      repo.create({ category: 'ai', severity: 'error', message: 'Erro 1' })
      repo.create({ category: 'database', severity: 'warning', message: 'Erro 2' })

      const all = repo.getAll()
      expect(all).toHaveLength(2)
    })

    it('deve filtrar por categoria', () => {
      repo.create({ category: 'ai', severity: 'error', message: 'AI Error' })
      repo.create({ category: 'database', severity: 'warning', message: 'DB Warning' })

      const filtered = repo.getAll({ category: 'ai' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].category).toBe('ai')
    })

    it('deve filtrar por severity', () => {
      repo.create({ category: 'ai', severity: 'error', message: 'Erro' })
      repo.create({ category: 'ai', severity: 'warning', message: 'Warning' })
      repo.create({ category: 'system', severity: 'critical', message: 'Crítico' })

      const filtered = repo.getAll({ severity: 'critical' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].message).toBe('Crítico')
    })

    it('deve filtrar por resolved', () => {
      const e1 = repo.create({ category: 'ai', severity: 'error', message: 'Resolvido' })
      repo.create({ category: 'ai', severity: 'error', message: 'Aberto' })
      repo.resolve(e1.id)

      const resolved = repo.getAll({ resolved: true })
      expect(resolved).toHaveLength(1)
      expect(resolved[0].message).toBe('Resolvido')

      const unresolved = repo.getAll({ resolved: false })
      expect(unresolved).toHaveLength(1)
      expect(unresolved[0].message).toBe('Aberto')
    })

    it('deve combinar múltiplos filtros', () => {
      repo.create({ category: 'ai', severity: 'error', message: 'AI Error' })
      repo.create({ category: 'ai', severity: 'warning', message: 'AI Warning' })
      repo.create({ category: 'database', severity: 'error', message: 'DB Error' })

      const filtered = repo.getAll({ category: 'ai', severity: 'error' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].message).toBe('AI Error')
    })

    it('deve retornar vazio quando não há logs', () => {
      expect(repo.getAll()).toEqual([])
    })
  })

  describe('getUnresolvedCount', () => {
    it('deve contar erros não resolvidos', () => {
      repo.create({ category: 'ai', severity: 'error', message: 'E1' })
      repo.create({ category: 'ai', severity: 'error', message: 'E2' })
      const e3 = repo.create({ category: 'ai', severity: 'error', message: 'E3' })
      repo.resolve(e3.id)

      expect(repo.getUnresolvedCount()).toBe(2)
    })

    it('deve retornar 0 quando não há erros', () => {
      expect(repo.getUnresolvedCount()).toBe(0)
    })
  })

  describe('resolve', () => {
    it('deve marcar erro como resolvido', () => {
      const error = repo.create({ category: 'ai', severity: 'error', message: 'Erro' })

      repo.resolve(error.id)

      const all = repo.getAll({ resolved: true })
      expect(all).toHaveLength(1)
      expect(all[0].resolved).toBe(true)
    })
  })

  describe('resolveAll', () => {
    it('deve resolver todos os erros abertos', () => {
      repo.create({ category: 'ai', severity: 'error', message: 'E1' })
      repo.create({ category: 'database', severity: 'warning', message: 'E2' })

      repo.resolveAll()

      expect(repo.getUnresolvedCount()).toBe(0)
    })
  })

  describe('delete', () => {
    it('deve excluir um log de erro', () => {
      const error = repo.create({ category: 'ai', severity: 'error', message: 'Para excluir' })

      repo.delete(error.id)

      expect(repo.getAll()).toHaveLength(0)
    })
  })

  describe('clearAll', () => {
    it('deve limpar todos os logs', () => {
      repo.create({ category: 'ai', severity: 'error', message: 'E1' })
      repo.create({ category: 'database', severity: 'warning', message: 'E2' })

      repo.clearAll()

      expect(repo.getAll()).toHaveLength(0)
    })
  })

  describe('cleanOld', () => {
    it('deve remover logs resolvidos mais antigos que o período', async () => {
      const { getTestDatabase } = await import('../setup')
      const db = getTestDatabase()

      // Insere log resolvido antigo (45 dias)
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
      db.prepare(`
        INSERT INTO error_logs (id, category, severity, message, resolved, occurrences, timestamp, last_occurrence)
        VALUES (?, ?, ?, ?, 1, 1, ?, ?)
      `).run('old-resolved', 'ai', 'error', 'Erro antigo', oldDate, oldDate)

      // Insere log NÃO resolvido antigo (não deve ser removido)
      db.prepare(`
        INSERT INTO error_logs (id, category, severity, message, resolved, occurrences, timestamp, last_occurrence)
        VALUES (?, ?, ?, ?, 0, 1, ?, ?)
      `).run('old-unresolved', 'ai', 'error', 'Erro antigo aberto', oldDate, oldDate)

      const removed = repo.cleanOld(30)
      expect(removed).toBe(1)

      const remaining = repo.getAll()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].message).toBe('Erro antigo aberto')
    })
  })
})
