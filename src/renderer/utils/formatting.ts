/**
 * Locale-aware formatting utilities for dates and numbers.
 * Uses the Intl API for locale-sensitive formatting.
 */

/**
 * Format a date using the active locale's conventions via Intl.DateTimeFormat.
 * If the date is invalid/unparseable, returns the original string unchanged.
 */
export function formatDate(
  date: Date | string,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  if (isNaN(dateObj.getTime())) {
    return String(date)
  }
  return new Intl.DateTimeFormat(locale, options).format(dateObj)
}

/**
 * Format a number using the active locale's decimal and thousands separators.
 * If the value is non-numeric, returns the original value unchanged.
 */
export function formatNumber(
  value: number | string,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  const num = typeof value === 'number' ? value : Number(value)
  if (typeof value === 'string' && isNaN(num)) {
    return value
  }
  if (typeof value === 'number' && !isFinite(value)) {
    return String(value)
  }
  return new Intl.NumberFormat(locale, options).format(num)
}

/**
 * Format a date using an explicit format pattern (DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD).
 * This ignores locale — the user's explicit date format setting takes precedence.
 * If the date is invalid, returns the original string unchanged.
 */
export function formatStructuredDate(
  date: Date | string,
  format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  if (isNaN(dateObj.getTime())) {
    return String(date)
  }

  const day = String(dateObj.getDate()).padStart(2, '0')
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const year = String(dateObj.getFullYear())

  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    default:
      return `${day}/${month}/${year}`
  }
}
