/**
 * Main process i18n — lightweight translation system for prompts, notifications, and export strings.
 * Mirrors the renderer's language setting (settings.language) and loads from JSON locale files.
 */

import ptBRPrompts from './locales/pt-BR/prompts.json'
import ptBRNotifications from './locales/pt-BR/notifications.json'
import ptBRExport from './locales/pt-BR/export.json'

import enPrompts from './locales/en/prompts.json'
import enNotifications from './locales/en/notifications.json'
import enExport from './locales/en/export.json'

export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

type TranslationResources = {
  prompts: Record<string, any>
  notifications: Record<string, any>
  export: Record<string, any>
}

const resources: Record<SupportedLocale, TranslationResources> = {
  'pt-BR': {
    prompts: ptBRPrompts,
    notifications: ptBRNotifications,
    export: ptBRExport,
  },
  en: {
    prompts: enPrompts,
    notifications: enNotifications,
    export: enExport,
  },
}

let currentLocale: SupportedLocale = 'pt-BR'

/**
 * Set the active locale for the main process.
 * Called once on startup from settings, and whenever the user changes language.
 */
export function setLocale(locale: string): void {
  currentLocale = isValidLocale(locale) ? locale : 'pt-BR'
}

export function getLocale(): SupportedLocale {
  return currentLocale
}

export function isValidLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

/**
 * Resolve a dot-notation key from a nested object.
 * e.g. resolve(obj, "categorization.system") → obj.categorization.system
 */
function resolve(obj: Record<string, any>, path: string): string | undefined {
  const parts = path.split('.')
  let current: any = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

/**
 * Get a translated string from the main process locale files.
 *
 * @param key - Namespace-qualified key: "prompts.categorization.system" or "notifications.digest_ready.title"
 * @param params - Optional interpolation params: { count: 5, name: "Leandro" }
 * @returns The translated string with interpolations applied, or the key itself if not found.
 *
 * Usage:
 *   t('prompts.categorization.system')
 *   t('notifications.task_overdue.body_one', { title: 'My task' })
 *   t('notifications.task_overdue.body_other', { count: 3 })
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const [namespace, ...rest] = key.split('.')
  const subKey = rest.join('.')

  if (!namespace || !subKey) return key

  const nsResources = resources[currentLocale]?.[namespace as keyof TranslationResources]
  let value = nsResources ? resolve(nsResources, subKey) : undefined

  // Fallback to pt-BR
  if (value === undefined && currentLocale !== 'pt-BR') {
    const fallbackNs = resources['pt-BR']?.[namespace as keyof TranslationResources]
    value = fallbackNs ? resolve(fallbackNs, subKey) : undefined
  }

  // Key not found anywhere
  if (value === undefined) return key

  // Apply interpolation
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramValue))
    }
  }

  return value
}

/**
 * Pluralization helper. Selects _one or _other variant based on count.
 *
 * Usage:
 *   tp('notifications.task_overdue.body', { count: 1, title: 'X' })
 *   → looks up "notifications.task_overdue.body_one" if count === 1
 *   → looks up "notifications.task_overdue.body_other" otherwise
 */
export function tp(key: string, params: Record<string, string | number> & { count: number }): string {
  const suffix = params.count === 1 ? '_one' : '_other'
  return t(`${key}${suffix}`, params)
}
