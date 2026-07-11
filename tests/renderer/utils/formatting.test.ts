import { describe, it, expect } from 'vitest'
import { formatDate, formatNumber, formatStructuredDate } from '../../../src/renderer/utils/formatting'

describe('formatDate', () => {
  it('formats a Date object with en locale', () => {
    const date = new Date(2025, 0, 15) // Jan 15, 2025
    const result = formatDate(date, 'en')
    expect(result).toContain('2025')
    expect(result).toContain('15')
  })

  it('formats a Date object with pt-BR locale', () => {
    const date = new Date(2025, 0, 15) // Jan 15, 2025
    const result = formatDate(date, 'pt-BR')
    expect(result).toContain('2025')
    expect(result).toContain('15')
  })

  it('formats a valid ISO string', () => {
    const result = formatDate('2025-06-20', 'en')
    expect(result).toContain('2025')
  })

  it('passes through invalid date strings', () => {
    expect(formatDate('not-a-date', 'en')).toBe('not-a-date')
    expect(formatDate('invalid', 'pt-BR')).toBe('invalid')
  })

  it('passes through empty string', () => {
    expect(formatDate('', 'en')).toBe('')
  })

  it('accepts Intl.DateTimeFormatOptions', () => {
    const date = new Date(2025, 0, 15)
    const result = formatDate(date, 'en', { year: 'numeric', month: 'long', day: 'numeric' })
    expect(result).toContain('January')
    expect(result).toContain('15')
    expect(result).toContain('2025')
  })
})

describe('formatNumber', () => {
  it('formats integers with en locale', () => {
    const result = formatNumber(1234, 'en')
    expect(result).toBe('1,234')
  })

  it('formats integers with pt-BR locale', () => {
    const result = formatNumber(1234, 'pt-BR')
    expect(result).toBe('1.234')
  })

  it('formats decimals with en locale', () => {
    const result = formatNumber(1234.56, 'en')
    expect(result).toBe('1,234.56')
  })

  it('formats decimals with pt-BR locale', () => {
    const result = formatNumber(1234.56, 'pt-BR')
    expect(result).toBe('1.234,56')
  })

  it('formats numeric strings correctly', () => {
    expect(formatNumber('1234', 'en')).toBe('1,234')
    expect(formatNumber('1234.56', 'pt-BR')).toBe('1.234,56')
  })

  it('passes through non-numeric strings', () => {
    expect(formatNumber('abc', 'en')).toBe('abc')
    expect(formatNumber('not-a-number', 'pt-BR')).toBe('not-a-number')
  })

  it('handles Infinity and NaN for number type', () => {
    expect(formatNumber(Infinity, 'en')).toBe('Infinity')
    expect(formatNumber(-Infinity, 'en')).toBe('-Infinity')
  })

  it('formats zero correctly', () => {
    expect(formatNumber(0, 'en')).toBe('0')
    expect(formatNumber(0, 'pt-BR')).toBe('0')
  })

  it('accepts Intl.NumberFormatOptions', () => {
    const result = formatNumber(0.75, 'en', { style: 'percent' })
    expect(result).toBe('75%')
  })
})

describe('formatStructuredDate', () => {
  it('formats date as DD/MM/YYYY', () => {
    const date = new Date(2025, 5, 20) // June 20, 2025
    expect(formatStructuredDate(date, 'DD/MM/YYYY')).toBe('20/06/2025')
  })

  it('formats date as MM/DD/YYYY', () => {
    const date = new Date(2025, 5, 20)
    expect(formatStructuredDate(date, 'MM/DD/YYYY')).toBe('06/20/2025')
  })

  it('formats date as YYYY-MM-DD', () => {
    const date = new Date(2025, 5, 20)
    expect(formatStructuredDate(date, 'YYYY-MM-DD')).toBe('2025-06-20')
  })

  it('handles string date input', () => {
    // Use full ISO string to avoid UTC vs local timezone parsing differences
    expect(formatStructuredDate('2025-01-15T12:00:00', 'DD/MM/YYYY')).toBe('15/01/2025')
  })

  it('pads single-digit day and month', () => {
    const date = new Date(2025, 0, 5) // Jan 5, 2025
    expect(formatStructuredDate(date, 'DD/MM/YYYY')).toBe('05/01/2025')
    expect(formatStructuredDate(date, 'MM/DD/YYYY')).toBe('01/05/2025')
    expect(formatStructuredDate(date, 'YYYY-MM-DD')).toBe('2025-01-05')
  })

  it('passes through invalid date strings', () => {
    expect(formatStructuredDate('not-a-date', 'DD/MM/YYYY')).toBe('not-a-date')
    expect(formatStructuredDate('invalid', 'YYYY-MM-DD')).toBe('invalid')
  })
})
