import { safeStorage } from 'electron'
import { createScopedLogger } from './logger'

const logger = createScopedLogger('safe-storage')

/**
 * Service that uses Electron's safeStorage to encrypt/decrypt sensitive strings.
 * safeStorage uses the OS keychain (DPAPI on Windows, Keychain on macOS, libsecret on Linux).
 *
 * In DEVELOPMENT mode, encryption is skipped entirely to avoid DPAPI key
 * invalidation when Electron is rebuilt. Values are stored as plain-text.
 * This is safe because the DB is local to the developer machine.
 *
 * In PRODUCTION mode, safeStorage is used normally — the packaged app has a
 * stable executable identity so DPAPI keys persist reliably.
 *
 * Encrypted values are stored as base64-encoded strings with a prefix to distinguish
 * them from plain-text values (for backward compatibility during migration).
 */

const ENCRYPTED_PREFIX = 'enc::'

/** Whether the app is running in development mode */
const isDev = process.env.NODE_ENV === 'development'

/** Keys in AppSettings that contain sensitive credentials */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'bedrockApiKey',
  'openaiApiKey',
  'geminiApiKey',
  'grokApiKey',
  'localApiKey',
])

/**
 * Custom error thrown when decryption fails due to DPAPI/keychain mismatch.
 * This signals that the stored value is corrupted and should be cleared from DB.
 */
export class DecryptionError extends Error {
  constructor(public readonly key: string) {
    super(`Failed to decrypt value for key "${key}" — credential needs to be re-entered`)
    this.name = 'DecryptionError'
  }
}

/**
 * Checks whether safeStorage is available (not in test/CLI environments).
 */
function isSafeStorageAvailable(): boolean {
  try {
    return safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * Encrypts a plain-text value using the OS keychain via Electron's safeStorage.
 * In dev mode, returns the value as-is (no encryption).
 * Returns the original value if safeStorage is unavailable or the value is empty.
 */
export function encryptValue(plainText: string): string {
  if (!plainText) return plainText
  if (isDev) return plainText
  if (!isSafeStorageAvailable()) return plainText

  const encrypted = safeStorage.encryptString(plainText)
  return ENCRYPTED_PREFIX + encrypted.toString('base64')
}

/**
 * Decrypts a value that was previously encrypted with encryptValue().
 * If the value doesn't have the encrypted prefix, it's treated as plain-text
 * (backward compatibility and dev mode where values are never encrypted).
 *
 * If decryption fails (e.g. OS keychain changed, corrupted data), throws
 * DecryptionError so the caller can clear the corrupted value from DB.
 */
export function decryptValue(storedValue: string, key?: string): string {
  if (!storedValue) return storedValue
  if (!storedValue.startsWith(ENCRYPTED_PREFIX)) return storedValue

  // In dev mode, encrypted values from a previous production run or
  // a now-invalid DPAPI session should be cleared — signal corruption.
  if (isDev) {
    logger.warn(`[SafeStorage] Dev mode: found encrypted value for "${key}" that cannot be used. Clearing.`)
    throw new DecryptionError(key || 'unknown')
  }

  if (!isSafeStorageAvailable()) return ''

  try {
    const base64 = storedValue.slice(ENCRYPTED_PREFIX.length)
    const buffer = Buffer.from(base64, 'base64')
    return safeStorage.decryptString(buffer)
  } catch (error) {
    logger.warn('[SafeStorage] Failed to decrypt value — credential may need to be re-entered:', key || '(unknown key)')
    throw new DecryptionError(key || 'unknown')
  }
}

/**
 * Checks if a settings key is sensitive and should be encrypted.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key)
}

/**
 * Attempts to decrypt an encrypted value using safeStorage directly,
 * bypassing the dev-mode guard. Used for one-time migration from
 * encrypted → plain-text when switching to dev mode.
 *
 * Returns the decrypted plain-text if successful, or null if decryption fails.
 */
export function tryMigrateEncryptedValue(storedValue: string): string | null {
  if (!storedValue?.startsWith(ENCRYPTED_PREFIX)) return null
  if (!isSafeStorageAvailable()) return null

  try {
    const base64 = storedValue.slice(ENCRYPTED_PREFIX.length)
    const buffer = Buffer.from(base64, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    return null
  }
}
