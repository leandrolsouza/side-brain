import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'

export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export function isValidLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

export function initI18n(locale?: string) {
  const lng: SupportedLocale = isValidLocale(locale) ? locale : 'pt-BR'

  i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'pt-BR',
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: ['common', 'dashboard', 'settings', 'capture', 'projects', 'meetings', 'reports', 'chat'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    returnNull: false,
    returnEmptyString: false,
  })

  return i18n
}
