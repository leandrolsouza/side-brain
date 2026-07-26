import type { DateFormat } from '../../shared/types'

/**
 * Retorna o formato de data configurado pelo usuário (lido do DOM attribute).
 */
function getDateFormat(): DateFormat {
  const attr = document.documentElement.getAttribute('data-date-format')
  if (attr === 'MM/DD/YYYY' || attr === 'YYYY-MM-DD' || attr === 'DD/MM/YYYY') {
    return attr
  }
  return 'DD/MM/YYYY'
}

/**
 * Formata uma data ISO string de acordo com o formato configurado nas settings.
 * Inclui hora/minuto opcionalmente.
 */
export function formatDate(isoDate: string, options?: { includeTime?: boolean }): string {
  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return isoDate

  const format = getDateFormat()
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()

  let result: string
  switch (format) {
    case 'MM/DD/YYYY':
      result = `${m}/${d}/${y}`
      break
    case 'YYYY-MM-DD':
      result = `${y}-${m}-${d}`
      break
    default:
      result = `${d}/${m}/${y}`
      break
  }

  if (options?.includeTime) {
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    result += ` ${h}:${min}`
  }

  return result
}

/**
 * Formata data e hora (atalho para formatDate com includeTime: true).
 */
export function formatDateTime(isoDate: string): string {
  return formatDate(isoDate, { includeTime: true })
}
