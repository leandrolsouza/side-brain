import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { SettingsRepository } from '../../../src/main/database/repositories/settings-repository'
import { DEFAULT_SETTINGS } from '../../../src/shared/types'
import { safeStorage } from 'electron'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('SettingsRepository', () => {
  let repo: SettingsRepository

  beforeEach(() => {
    createTestDatabase()
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
    repo = new SettingsRepository()
  })

  afterEach(() => {
    closeTestDatabase()
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
  })

  describe('get', () => {
    it('protege credenciais antigas em texto puro quando o chaveiro está disponível', async () => {
      const { getTestDatabase } = await import('../setup')
      const db = getTestDatabase()
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('openaiApiKey', 'legacy-secret')
      expect(repo.get().openaiApiKey).toBe('legacy-secret')
      expect(
        (db.prepare('SELECT value FROM settings WHERE key = ?').get('openaiApiKey') as { value: string }).value
      ).toMatch(/^enc::/)
    })

    it('preserva o valor criptografado se o armazenamento estiver indisponível', async () => {
      const { getTestDatabase } = await import('../setup')
      repo.update({ openaiApiKey: 'existing-secret' })
      const db = getTestDatabase()
      const before = db.prepare('SELECT value FROM settings WHERE key = ?').get('openaiApiKey')
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
      expect(repo.get().openaiApiKey).toBe('')
      repo.update({ openaiApiKey: '', fontSize: '18' })
      expect(db.prepare('SELECT value FROM settings WHERE key = ?').get('openaiApiKey')).toEqual(before)
      expect(() => repo.update({ openaiApiKey: 'new-secret' })).toThrow()
      expect(db.prepare('SELECT value FROM settings WHERE key = ?').get('openaiApiKey')).toEqual(before)
    })

    it('não apaga credenciais se a descriptografia falhar', async () => {
      const { getTestDatabase } = await import('../setup')
      repo.update({ openaiApiKey: 'existing-secret' })
      const db = getTestDatabase()
      const before = db.prepare('SELECT value FROM settings WHERE key = ?').get('openaiApiKey')
      vi.mocked(safeStorage.decryptString).mockImplementationOnce(() => {
        throw new Error('failed')
      })
      expect(repo.get().openaiApiKey).toBe('')
      expect(db.prepare('SELECT value FROM settings WHERE key = ?').get('openaiApiKey')).toEqual(before)
    })
    it('deve retornar DEFAULT_SETTINGS quando não há dados no banco', () => {
      const settings = repo.get()

      expect(settings).toEqual(DEFAULT_SETTINGS)
    })

    it('deve retornar valores do banco quando existem', () => {
      // Salva um valor no banco diretamente
      repo.update({ awsRegion: 'eu-west-1' })

      const settings = repo.get()
      expect(settings.awsRegion).toBe('eu-west-1')
      // Outros campos permanecem com default
      expect(settings.aiProvider).toBe('bedrock')
    })

    it('deve ignorar chaves que não existem em AppSettings', async () => {
      // Insere uma chave desconhecida diretamente
      const { getTestDatabase } = await import('../setup')
      const db = getTestDatabase()
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('chave_inexistente', 'valor')

      const settings = repo.get()
      expect((settings as any).chave_inexistente).toBeUndefined()
      expect(settings).toEqual(DEFAULT_SETTINGS)
    })
  })

  describe('update', () => {
    it('deve atualizar uma única configuração', () => {
      repo.update({ bedrockApiKey: 'my-secret-key' })

      const settings = repo.get()
      expect(settings.bedrockApiKey).toBe('my-secret-key')
    })

    it('deve atualizar múltiplas configurações de uma vez', () => {
      repo.update({
        awsRegion: 'us-west-2',
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        fontSize: '16',
      })

      const settings = repo.get()
      expect(settings.awsRegion).toBe('us-west-2')
      expect(settings.modelId).toBe('anthropic.claude-3-haiku-20240307-v1:0')
      expect(settings.fontSize).toBe('16')
    })

    it('deve fazer upsert (atualizar valor já existente)', () => {
      repo.update({ awsRegion: 'eu-west-1' })
      repo.update({ awsRegion: 'ap-southeast-1' })

      const settings = repo.get()
      expect(settings.awsRegion).toBe('ap-southeast-1')
    })

    it('deve manter configurações não alteradas', () => {
      repo.update({ awsRegion: 'eu-west-1', fontSize: '18' })
      repo.update({ fontSize: '20' })

      const settings = repo.get()
      expect(settings.awsRegion).toBe('eu-west-1')
      expect(settings.fontSize).toBe('20')
    })

    it('deve converter valores numéricos para string', () => {
      repo.update({ fontSize: '12' })

      const settings = repo.get()
      expect(settings.fontSize).toBe('12')
      expect(typeof settings.fontSize).toBe('string')
    })
  })
})
