import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { formatDate, formatNumber, formatStructuredDate } from '../../../src/renderer/utils/formatting'

describe('Feature: i18n-multi-language, Property 8: Locale-Aware Number Formatting', () => {
  /**
   * **Validates: Requirements 9.1, 9.2**
   *
   * For any finite number and supported locale, formatNumber should produce
   * strings with correct decimal and thousands separators.
   */

  it('should use correct decimal separator for en locale', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        (num) => {
          const result = formatNumber(num, 'en')
          // en uses . as decimal separator — only check if the formatted result has a decimal part
          if (result.includes('.')) {
            // Decimal separator is a dot, not a comma at the end
            expect(result).not.toMatch(/\d,\d{1,2}$/)
          }
          // Thousands separator is comma, never dot used as thousands
          if (Math.abs(num) >= 1000 && Number.isInteger(num)) {
            expect(result).toContain(',')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should use correct decimal separator for pt-BR locale', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        (num) => {
          const result = formatNumber(num, 'pt-BR')
          // pt-BR uses , as decimal separator — only check if the formatted result has a decimal part
          if (result.includes(',')) {
            // The comma is a decimal separator, digits after comma are fractional
            expect(result).toMatch(/,\d+$/)
          }
          // Thousands separator is dot, never comma used as thousands
          if (Math.abs(num) >= 1000 && Number.isInteger(num)) {
            expect(result).toContain('.')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should use correct thousands separator for en locale', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1e9 }),
        (num) => {
          const result = formatNumber(num, 'en')
          // en uses , as thousands separator
          expect(result).toContain(',')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should use correct thousands separator for pt-BR locale', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1e9 }),
        (num) => {
          const result = formatNumber(num, 'pt-BR')
          // pt-BR uses . as thousands separator
          expect(result).toContain('.')
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: i18n-multi-language, Property 9: Explicit Date Format Override', () => {
  /**
   * **Validates: Requirements 9.3**
   *
   * For any valid Date and format pattern, formatStructuredDate should
   * match the pattern regardless of locale.
   */

  const dateArb = fc.date({ min: new Date(1970, 0, 1), max: new Date(2099, 11, 31) }).filter(d => !isNaN(d.getTime()))
  const formatArb = fc.constantFrom('DD/MM/YYYY' as const, 'MM/DD/YYYY' as const, 'YYYY-MM-DD' as const)

  it('should produce strings matching the selected format pattern', () => {
    fc.assert(
      fc.property(dateArb, formatArb, (date, format) => {
        const result = formatStructuredDate(date, format)
        switch (format) {
          case 'DD/MM/YYYY':
            expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
            break
          case 'MM/DD/YYYY':
            expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
            break
          case 'YYYY-MM-DD':
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            break
        }
      }),
      { numRuns: 100 }
    )
  })

  it('should produce correct day/month/year values regardless of format', () => {
    fc.assert(
      fc.property(dateArb, formatArb, (date, format) => {
        const result = formatStructuredDate(date, format)
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = String(date.getFullYear())

        expect(result).toContain(day)
        expect(result).toContain(month)
        expect(result).toContain(year)
      }),
      { numRuns: 100 }
    )
  })
})

describe('Feature: i18n-multi-language, Property 10: Invalid Value Passthrough', () => {
  /**
   * **Validates: Requirements 9.5**
   *
   * For any non-date string, date formatting returns unchanged;
   * for non-numeric string, number formatting returns unchanged.
   */

  // Strings that cannot be parsed as valid dates
  const nonDateStringArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
    const d = new Date(s)
    return isNaN(d.getTime())
  })

  // Strings that cannot be parsed as valid numbers
  const nonNumericStringArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
    return isNaN(Number(s))
  })

  const localeArb = fc.constantFrom('en', 'pt-BR')

  it('formatDate returns original string for invalid dates', () => {
    fc.assert(
      fc.property(nonDateStringArb, localeArb, (str, locale) => {
        expect(formatDate(str, locale)).toBe(str)
      }),
      { numRuns: 100 }
    )
  })

  it('formatStructuredDate returns original string for invalid dates', () => {
    fc.assert(
      fc.property(
        nonDateStringArb,
        fc.constantFrom('DD/MM/YYYY' as const, 'MM/DD/YYYY' as const, 'YYYY-MM-DD' as const),
        (str, format) => {
          expect(formatStructuredDate(str, format)).toBe(str)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('formatNumber returns original string for non-numeric values', () => {
    fc.assert(
      fc.property(nonNumericStringArb, localeArb, (str, locale) => {
        expect(formatNumber(str, locale)).toBe(str)
      }),
      { numRuns: 100 }
    )
  })
})
