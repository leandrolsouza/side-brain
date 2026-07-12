import { describe, it, expect, beforeEach } from 'vitest'
import i18n from 'i18next'
import { initI18n, isValidLocale, SUPPORTED_LOCALES } from '../../../src/renderer/i18n'

describe('i18n - initI18n', () => {
  beforeEach(() => {
    if (i18n.isInitialized) {
      i18n.changeLanguage('pt-BR')
    }
  })

  it('deve inicializar com pt-BR como padrão quando nenhum locale é passado', () => {
    initI18n()
    expect(i18n.language).toBe('pt-BR')
  })

  it('deve inicializar com pt-BR quando undefined é passado', () => {
    initI18n(undefined)
    expect(i18n.language).toBe('pt-BR')
  })

  it('deve inicializar com pt-BR quando locale é passado como "pt-BR"', () => {
    initI18n('pt-BR')
    expect(i18n.language).toBe('pt-BR')
  })

  it('deve inicializar com en quando locale é passado como "en"', () => {
    initI18n('en')
    expect(i18n.language).toBe('en')
  })

  it('deve fallback para pt-BR quando locale inválido é passado', () => {
    initI18n('fr')
    expect(i18n.language).toBe('pt-BR')
  })

  it('deve fallback para pt-BR quando string vazia é passada', () => {
    initI18n('')
    expect(i18n.language).toBe('pt-BR')
  })

  it('deve fallback para pt-BR quando locale inexistente é passado', () => {
    initI18n('zh-CN')
    expect(i18n.language).toBe('pt-BR')
  })

  it('deve ter pt-BR como fallbackLng', () => {
    initI18n('en')
    // Keys that exist only in pt-BR should resolve (not return raw key)
    const result = i18n.t('common:loading')
    expect(result).not.toBe('common:loading')
    expect(result.length).toBeGreaterThan(0)
  })

  it('deve resolver chaves do namespace common em pt-BR', () => {
    initI18n('pt-BR')
    expect(i18n.t('common:save')).toBe('Salvar')
    expect(i18n.t('common:cancel')).toBe('Cancelar')
    expect(i18n.t('common:delete')).toBe('Excluir')
  })

  it('deve resolver chaves do namespace common em en', () => {
    initI18n('en')
    expect(i18n.t('common:save')).toBe('Save')
    expect(i18n.t('common:cancel')).toBe('Cancel')
    expect(i18n.t('common:delete')).toBe('Delete')
  })

  it('deve suportar interpolação', () => {
    initI18n('pt-BR')
    const result = i18n.t('common:about.version', { version: '0.5.0' })
    expect(result).toContain('0.5.0')
    expect(result).not.toContain('{{version}}')
  })

  it('deve retornar a chave para keys inexistentes', () => {
    initI18n('pt-BR')
    const result = i18n.t('common:nonexistent_key_xyz')
    expect(result).toBe('nonexistent_key_xyz')
  })

  it('deve ter 8 namespaces configurados', () => {
    initI18n('pt-BR')
    const options = i18n.options
    expect(options.ns).toEqual(
      expect.arrayContaining(['common', 'dashboard', 'settings', 'capture', 'projects', 'meetings', 'reports', 'chat'])
    )
  })

  it('deve usar common como defaultNS', () => {
    initI18n('pt-BR')
    expect(i18n.options.defaultNS).toBe('common')
  })
})

describe('i18n - isValidLocale', () => {
  it('deve retornar true para "pt-BR"', () => {
    expect(isValidLocale('pt-BR')).toBe(true)
  })

  it('deve retornar true para "en"', () => {
    expect(isValidLocale('en')).toBe(true)
  })

  it('deve retornar false para "fr"', () => {
    expect(isValidLocale('fr')).toBe(false)
  })

  it('deve retornar false para "es"', () => {
    expect(isValidLocale('es')).toBe(false)
  })

  it('deve retornar false para string vazia', () => {
    expect(isValidLocale('')).toBe(false)
  })

  it('deve retornar false para null', () => {
    expect(isValidLocale(null)).toBe(false)
  })

  it('deve retornar false para undefined', () => {
    expect(isValidLocale(undefined)).toBe(false)
  })

  it('deve retornar false para número', () => {
    expect(isValidLocale(42)).toBe(false)
  })

  it('deve retornar false para objeto', () => {
    expect(isValidLocale({})).toBe(false)
  })

  it('deve retornar false para "PT-BR" (case sensitivity)', () => {
    expect(isValidLocale('PT-BR')).toBe(false)
  })

  it('deve retornar false para "En" (case sensitivity)', () => {
    expect(isValidLocale('En')).toBe(false)
  })

  it('deve retornar false para "pt-br" (case sensitivity)', () => {
    expect(isValidLocale('pt-br')).toBe(false)
  })
})

describe('i18n - SUPPORTED_LOCALES', () => {
  it('deve conter exatamente pt-BR e en', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'pt-BR'])
  })

  it('deve ser um array readonly', () => {
    expect(Array.isArray(SUPPORTED_LOCALES)).toBe(true)
    expect(SUPPORTED_LOCALES).toHaveLength(2)
  })
})

describe('i18n - changeLanguage', () => {
  beforeEach(() => {
    initI18n('pt-BR')
  })

  it('deve trocar de pt-BR para en', async () => {
    expect(i18n.language).toBe('pt-BR')
    await i18n.changeLanguage('en')
    expect(i18n.language).toBe('en')
  })

  it('deve trocar de en para pt-BR', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.language).toBe('en')
    await i18n.changeLanguage('pt-BR')
    expect(i18n.language).toBe('pt-BR')
  })

  it('deve resolver keys no idioma correto após troca', async () => {
    expect(i18n.t('common:save')).toBe('Salvar')
    await i18n.changeLanguage('en')
    expect(i18n.t('common:save')).toBe('Save')
    await i18n.changeLanguage('pt-BR')
    expect(i18n.t('common:save')).toBe('Salvar')
  })
})
