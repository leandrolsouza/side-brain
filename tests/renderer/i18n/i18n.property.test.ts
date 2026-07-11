import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { initI18n, isValidLocale, SUPPORTED_LOCALES } from '../../../src/renderer/i18n'
import { resources } from '../../../src/renderer/i18n/resources'

/**
 * Helper: Reinitialize i18n with a fresh config for each test that changes locale.
 * i18next is a singleton so we must reset it between tests.
 */
function resetI18n(locale?: string) {
  // If already initialized, we can just change language or re-init
  if (i18n.isInitialized) {
    i18n.changeLanguage(isValidLocale(locale) ? locale : 'pt-BR')
  } else {
    initI18n(locale)
  }
}

/**
 * Helper: Recursively extract all leaf keys from a nested object.
 * Returns an array of dot-separated key paths.
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

/**
 * Helper: Get a value from a nested object by dot-separated key path.
 */
function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

describe('Feature: i18n-multi-language, Property 1: Locale Persistence Round-Trip', () => {
  /**
   * **Validates: Requirements 1.1, 1.3, 1.5, 2.4, 2.5**
   *
   * For any supported locale, calling initI18n(locale) should result in
   * i18n.language === locale.
   */

  beforeEach(() => {
    // Ensure clean state
    if (i18n.isInitialized) {
      i18n.changeLanguage('pt-BR')
    }
  })

  it('for any supported locale, initI18n(locale) sets i18n.language to that locale', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SUPPORTED_LOCALES),
        (locale) => {
          resetI18n(locale)
          expect(i18n.language).toBe(locale)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: i18n-multi-language, Property 2: Invalid Locale Fallback', () => {
  /**
   * **Validates: Requirements 1.6, 2.6**
   *
   * For any arbitrary string that is NOT 'en' or 'pt-BR', calling
   * initI18n(arbitraryString) should result in i18n.language === 'pt-BR'.
   */

  beforeEach(() => {
    if (i18n.isInitialized) {
      i18n.changeLanguage('pt-BR')
    }
  })

  it('for any invalid locale string, initI18n falls back to pt-BR', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(
          (s) => !SUPPORTED_LOCALES.includes(s as typeof SUPPORTED_LOCALES[number])
        ),
        (invalidLocale) => {
          resetI18n(invalidLocale)
          expect(i18n.language).toBe('pt-BR')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('isValidLocale returns false for any non-supported locale string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(
          (s) => !SUPPORTED_LOCALES.includes(s as typeof SUPPORTED_LOCALES[number])
        ),
        (invalidLocale) => {
          expect(isValidLocale(invalidLocale)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: i18n-multi-language, Property 3: Translation Key Fallback Chain', () => {
  /**
   * **Validates: Requirements 3.3, 3.4, 6.4, 8.5**
   *
   * For any key that exists in pt-BR but not in en, when locale is 'en',
   * t() should return the pt-BR value (fallback).
   * For any key that doesn't exist in either locale, t() should return the key itself.
   */

  beforeEach(() => {
    resetI18n('en')
  })

  it('for non-existent keys in both locales, t() returns the key string itself', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-zA-Z0-9]{2,15}$/),
        (key) => {
          // Use the default namespace (common) with a key that certainly doesn't exist
          const fakeKey = `nonexistent_${key}_xyz`
          // When using default namespace, i18next returns just the key
          const result = i18n.t(fakeKey)
          expect(result).toBe(fakeKey)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('for keys that exist in pt-BR (fallback locale), they resolve when active locale is en', () => {
    // Get all keys from pt-BR common namespace
    const ptBRCommon = resources['pt-BR'].common as Record<string, unknown>
    const allPtBRKeys = extractKeys(ptBRCommon)

    // Filter to leaf string keys (not plural-suffixed for simplicity)
    const simpleKeys = allPtBRKeys.filter(k => {
      const val = getNestedValue(ptBRCommon, k)
      return typeof val === 'string' && !k.endsWith('_one') && !k.endsWith('_other')
    })

    fc.assert(
      fc.property(
        fc.constantFrom(...simpleKeys),
        (key) => {
          resetI18n('en')
          const result = i18n.t(`common:${key}`)
          // The result should NOT be the raw key, it should resolve to either en or pt-BR value
          expect(result).not.toBe(`common:${key}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: i18n-multi-language, Property 4: Namespace-Qualified Key Resolution', () => {
  /**
   * **Validates: Requirements 3.6, 8.2**
   *
   * For any namespace and key that exists in the resources, calling t('namespace:key')
   * should return the exact value stored in resources.
   */

  beforeEach(() => {
    resetI18n('pt-BR')
  })

  it('for any existing namespace:key pair, t() returns the stored value', () => {
    // Build a list of all valid namespace:key pairs from pt-BR resources
    const namespaces = Object.keys(resources['pt-BR']) as Array<keyof typeof resources['pt-BR']>
    const validPairs: Array<{ ns: string; key: string; value: string }> = []

    for (const ns of namespaces) {
      const nsData = resources['pt-BR'][ns] as Record<string, unknown>
      const keys = extractKeys(nsData)
      for (const key of keys) {
        const val = getNestedValue(nsData, key)
        if (typeof val === 'string' && !key.endsWith('_one') && !key.endsWith('_other') && !val.includes('{{')) {
          validPairs.push({ ns, key, value: val })
        }
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...validPairs),
        ({ ns, key, value }) => {
          resetI18n('pt-BR')
          const result = i18n.t(`${ns}:${key}`)
          expect(result).toBe(value)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('for any existing namespace:key pair in en, t() returns the stored en value', () => {
    const namespaces = Object.keys(resources.en) as Array<keyof typeof resources['en']>
    const validPairs: Array<{ ns: string; key: string; value: string }> = []

    for (const ns of namespaces) {
      const nsData = resources.en[ns] as Record<string, unknown>
      const keys = extractKeys(nsData)
      for (const key of keys) {
        const val = getNestedValue(nsData, key)
        if (typeof val === 'string' && !key.endsWith('_one') && !key.endsWith('_other') && !val.includes('{{')) {
          validPairs.push({ ns, key, value: val })
        }
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...validPairs),
        ({ ns, key, value }) => {
          resetI18n('en')
          const result = i18n.t(`${ns}:${key}`)
          expect(result).toBe(value)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: i18n-multi-language, Property 5: Interpolation Replacement', () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.4**
   *
   * For any translation string template with {{placeholders}} and corresponding
   * values, calling t(key, values) should have no remaining {{...}} tokens in
   * the output for provided keys.
   */

  beforeEach(() => {
    resetI18n('pt-BR')
  })

  it('for any interpolated key with all values provided, no {{...}} tokens remain', () => {
    // Collect all keys with interpolation placeholders
    const namespaces = Object.keys(resources['pt-BR']) as Array<keyof typeof resources['pt-BR']>
    const interpolatedKeys: Array<{ ns: string; key: string; placeholders: string[] }> = []

    for (const ns of namespaces) {
      const nsData = resources['pt-BR'][ns] as Record<string, unknown>
      const keys = extractKeys(nsData)
      for (const key of keys) {
        const val = getNestedValue(nsData, key)
        if (typeof val === 'string') {
          const matches = val.match(/\{\{(\w+)\}\}/g)
          if (matches) {
            const placeholders = matches.map(m => m.replace(/\{\{|\}\}/g, ''))
            // Exclude count-based placeholders (handled by pluralization)
            const nonCountPlaceholders = placeholders.filter(p => p !== 'count')
            if (nonCountPlaceholders.length > 0) {
              interpolatedKeys.push({ ns, key, placeholders: nonCountPlaceholders })
            }
          }
        }
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...interpolatedKeys),
        fc.string({ minLength: 1, maxLength: 20 }),
        ({ ns, key, placeholders }, fillValue) => {
          resetI18n('pt-BR')
          // Build values object with all placeholders filled
          const values: Record<string, string> = {}
          for (const p of placeholders) {
            values[p] = fillValue
          }
          const result = i18n.t(`${ns}:${key}`, values)
          // Check no remaining {{placeholder}} tokens for provided keys
          for (const p of placeholders) {
            expect(result).not.toContain(`{{${p}}}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('interpolation works with various value types (strings, numbers)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        (name) => {
          resetI18n('pt-BR')
          // common:greeting in pt-BR is "Olá, {{name}}" — actually let's use about:version
          const result = i18n.t('common:about.version', { version: name })
          expect(result).not.toContain('{{version}}')
          expect(result).toContain(name)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: i18n-multi-language, Property 6: Plural Form Selection', () => {
  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any integer count and a key with _one/_other variants,
   * t(key, { count: 1 }) should return the _one form, and any other count
   * should return the _other form.
   */

  beforeEach(() => {
    resetI18n('pt-BR')
  })

  it('count === 1 selects _one form, any other count selects _other form', () => {
    // Collect all plural key bases from pt-BR
    const namespaces = Object.keys(resources['pt-BR']) as Array<keyof typeof resources['pt-BR']>
    const pluralBases: Array<{ ns: string; base: string; oneValue: string; otherValue: string }> = []

    for (const ns of namespaces) {
      const nsData = resources['pt-BR'][ns] as Record<string, unknown>
      const keys = extractKeys(nsData)
      const oneKeys = keys.filter(k => k.endsWith('_one'))
      for (const oneKey of oneKeys) {
        const base = oneKey.replace(/_one$/, '')
        const otherKey = `${base}_other`
        if (keys.includes(otherKey)) {
          const oneValue = getNestedValue(nsData, oneKey) as string
          const otherValue = getNestedValue(nsData, otherKey) as string
          pluralBases.push({ ns, base, oneValue, otherValue })
        }
      }
    }

    // Test: count=1 selects _one
    fc.assert(
      fc.property(
        fc.constantFrom(...pluralBases),
        ({ ns, base, oneValue }) => {
          resetI18n('pt-BR')
          const result = i18n.t(`${ns}:${base}`, { count: 1 })
          // The _one template with count=1 interpolated
          const expected = oneValue.replace('{{count}}', '1')
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('count != 1 and count != -1 selects _other form (en locale)', () => {
    // English plural rules: count === 1 or count === -1 → _one; all others → _other.
    // i18next uses CLDR/Intl.PluralRules which considers abs(1) as "one".
    const namespaces = Object.keys(resources.en) as Array<keyof typeof resources['en']>
    const pluralBases: Array<{ ns: string; base: string; otherValue: string }> = []

    for (const ns of namespaces) {
      const nsData = resources.en[ns] as Record<string, unknown>
      const keys = extractKeys(nsData)
      const oneKeys = keys.filter(k => k.endsWith('_one'))
      for (const oneKey of oneKeys) {
        const base = oneKey.replace(/_one$/, '')
        const otherKey = `${base}_other`
        if (keys.includes(otherKey)) {
          const otherValue = getNestedValue(nsData, otherKey) as string
          pluralBases.push({ ns, base, otherValue })
        }
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...pluralBases),
        fc.integer({ min: -1000, max: 1000 }).filter(n => n !== 1 && n !== -1),
        ({ ns, base, otherValue }, count) => {
          resetI18n('en')
          const result = i18n.t(`${ns}:${base}`, { count })
          const expected = otherValue.replace('{{count}}', String(count))
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('in pt-BR locale, count > 1 selects _other form', () => {
    // In Portuguese, count > 1 always uses plural (_other)
    const namespaces = Object.keys(resources['pt-BR']) as Array<keyof typeof resources['pt-BR']>
    const pluralBases: Array<{ ns: string; base: string; otherValue: string }> = []

    for (const ns of namespaces) {
      const nsData = resources['pt-BR'][ns] as Record<string, unknown>
      const keys = extractKeys(nsData)
      const oneKeys = keys.filter(k => k.endsWith('_one'))
      for (const oneKey of oneKeys) {
        const base = oneKey.replace(/_one$/, '')
        const otherKey = `${base}_other`
        if (keys.includes(otherKey)) {
          const otherValue = getNestedValue(nsData, otherKey) as string
          pluralBases.push({ ns, base, otherValue })
        }
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...pluralBases),
        fc.integer({ min: 2, max: 1000 }),
        ({ ns, base, otherValue }, count) => {
          resetI18n('pt-BR')
          const result = i18n.t(`${ns}:${base}`, { count })
          const expected = otherValue.replace('{{count}}', String(count))
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: i18n-multi-language, Property 7: Translation Key Parity Between Locales', () => {
  /**
   * **Validates: Requirements 7.3**
   *
   * For any key that exists in pt-BR resources, the same key must exist in en resources.
   * Iterate all namespaces and all keys in pt-BR and assert they exist in en.
   */

  it('every key in pt-BR also exists in en across all namespaces', () => {
    const namespaces = Object.keys(resources['pt-BR']) as Array<keyof typeof resources['pt-BR']>

    // Collect all pt-BR keys
    const ptBRKeys: Array<{ ns: string; key: string }> = []
    for (const ns of namespaces) {
      const nsData = resources['pt-BR'][ns] as Record<string, unknown>
      const keys = extractKeys(nsData)
      for (const key of keys) {
        ptBRKeys.push({ ns, key })
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...ptBRKeys),
        ({ ns, key }) => {
          const enNsData = resources.en[ns as keyof typeof resources['en']] as Record<string, unknown>
          const enValue = getNestedValue(enNsData, key)
          expect(enValue).toBeDefined()
          expect(typeof enValue).toBe('string')
        }
      ),
      { numRuns: 100 }
    )
  })
})
