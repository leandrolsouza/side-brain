import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * O safe-storage-service lê NODE_ENV no momento do import (constante isDev).
 * Por isso cada cenário recarrega o módulo com vi.resetModules() + vi.stubEnv().
 * O mock de electron.safeStorage vem do setup global (tests/main/setup.ts).
 */
async function loadModule(nodeEnv: 'production' | 'development') {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', nodeEnv)
  const electron = await import('electron')
  const safeStorage = vi.mocked(electron.safeStorage)

  // A instância mockada de electron persiste entre resetModules —
  // restaura o comportamento padrão e limpa histórico de chamadas.
  safeStorage.isEncryptionAvailable.mockReset().mockReturnValue(false)
  safeStorage.encryptString.mockReset().mockImplementation((str: string) => Buffer.from(str))
  safeStorage.decryptString.mockReset().mockImplementation((buf: Buffer) => buf.toString())

  const mod = await import('../../../src/main/services/safe-storage-service')
  return { mod, safeStorage }
}

describe('safe-storage-service', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe('modo produção', () => {
    it('encryptValue deve retornar valor vazio inalterado', async () => {
      const { mod } = await loadModule('production')

      expect(mod.encryptValue('')).toBe('')
    })

    it('encryptValue deve rejeitar segredos quando safeStorage não está disponível', async () => {
      const { mod, safeStorage } = await loadModule('production')
      safeStorage.isEncryptionAvailable.mockReturnValue(false)

      expect(() => mod.encryptValue('minha-chave')).toThrow()
    })

    it('encryptValue deve criptografar com prefixo enc:: quando disponível', async () => {
      const { mod, safeStorage } = await loadModule('production')
      safeStorage.isEncryptionAvailable.mockReturnValue(true)

      const stored = mod.encryptValue('api-key-secreta')

      expect(stored.startsWith('enc::')).toBe(true)
      expect(Buffer.from(stored.slice('enc::'.length), 'base64').toString()).toBe('api-key-secreta')
    })

    it('decryptValue deve fazer roundtrip de valor criptografado', async () => {
      const { mod, safeStorage } = await loadModule('production')
      safeStorage.isEncryptionAvailable.mockReturnValue(true)

      const stored = mod.encryptValue('api-key-secreta')
      expect(mod.decryptValue(stored, 'bedrockApiKey')).toBe('api-key-secreta')
    })

    it('decryptValue deve retornar plain-text sem prefixo como está', async () => {
      const { mod } = await loadModule('production')

      expect(mod.decryptValue('valor-plano')).toBe('valor-plano')
      expect(mod.decryptValue('')).toBe('')
    })

    it('decryptValue deve retornar string vazia quando safeStorage não está disponível', async () => {
      const { mod, safeStorage } = await loadModule('production')
      safeStorage.isEncryptionAvailable.mockReturnValue(false)

      expect(mod.decryptValue('enc::abc123')).toBe('')
    })

    it('decryptValue deve lançar DecryptionError quando decryptString falha', async () => {
      const { mod, safeStorage } = await loadModule('production')
      safeStorage.isEncryptionAvailable.mockReturnValue(true)
      safeStorage.decryptString.mockImplementation(() => {
        throw new Error('DPAPI mismatch')
      })

      expect(() => mod.decryptValue('enc::abc123', 'openaiApiKey')).toThrow(mod.DecryptionError)
      try {
        mod.decryptValue('enc::abc123', 'openaiApiKey')
      } catch (error: any) {
        expect(error.key).toBe('openaiApiKey')
        expect(error.name).toBe('DecryptionError')
      }
    })
  })

  describe('modo desenvolvimento (fallback dev)', () => {
    it('encryptValue também criptografa no desenvolvimento', async () => {
      const { mod, safeStorage } = await loadModule('development')
      safeStorage.isEncryptionAvailable.mockReturnValue(true)

      expect(mod.encryptValue('api-key')).toMatch(/^enc::/)
      expect(safeStorage.encryptString).toHaveBeenCalled()
    })

    it('decryptValue preserva credenciais quando o armazenamento está indisponível', async () => {
      const { mod } = await loadModule('development')

      expect(mod.decryptValue('enc::abc', 'geminiApiKey')).toBe('')
    })

    it('decryptValue deve retornar plain-text sem prefixo normalmente', async () => {
      const { mod } = await loadModule('development')

      expect(mod.decryptValue('plano')).toBe('plano')
    })
  })

  describe('isSensitiveKey / SENSITIVE_KEYS', () => {
    it('deve identificar chaves sensíveis', async () => {
      const { mod } = await loadModule('production')

      expect(mod.isSensitiveKey('bedrockApiKey')).toBe(true)
      expect(mod.isSensitiveKey('openaiApiKey')).toBe(true)
      expect(mod.isSensitiveKey('geminiApiKey')).toBe(true)
      expect(mod.isSensitiveKey('grokApiKey')).toBe(true)
      expect(mod.isSensitiveKey('localApiKey')).toBe(true)
    })

    it('deve retornar false para chaves não sensíveis', async () => {
      const { mod } = await loadModule('production')

      expect(mod.isSensitiveKey('userName')).toBe(false)
      expect(mod.isSensitiveKey('modelId')).toBe(false)
    })
  })
})
