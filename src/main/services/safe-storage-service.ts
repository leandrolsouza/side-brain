import { safeStorage } from 'electron'
import { createScopedLogger } from './logger'

const logger = createScopedLogger('safe-storage')

/**
 * Service that uses Electron's safeStorage to encrypt/decrypt sensitive strings.
 * safeStorage uses the OS keychain (DPAPI on Windows, Keychain on macOS, libsecret on Linux).
 *
 * Encrypted values are stored as base64-encoded strings with a prefix to distinguish
 * them from plain-text values (for backward compatibility during migration).
 */

const ENCRYPTED_PREFIX = 'enc::'

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
 * The stored value must be retained so it can be recovered later.
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
export function isSafeStorageAvailable(): boolean {
  try {
    if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function' || !safeStorage.isEncryptionAvailable())
      return false
    return (
      process.platform !== 'linux' ||
      typeof safeStorage.getSelectedStorageBackend !== 'function' ||
      safeStorage.getSelectedStorageBackend() !== 'basic_text'
    )
  } catch {
    return false
  }
}

/**
 * Encrypts a plain-text value using the OS keychain via Electron's safeStorage.
 * Rejects nonempty values when OS-backed encryption is unavailable.
 */
export function encryptValue(plainText: string): string {
  if (!plainText) return plainText
  if (!isSafeStorageAvailable()) throw new Error('Secure storage is unavailable; credentials were not saved.')

  const encrypted = safeStorage.encryptString(plainText)
  return ENCRYPTED_PREFIX + encrypted.toString('base64')
}

/**
 * Decrypts a value that was previously encrypted with encryptValue().
 * If the value doesn't have the encrypted prefix, it's treated as plain-text
 * for backward compatibility with older installations.
 *
 * If decryption fails (e.g. OS keychain changed, corrupted data), throws
 * DecryptionError so the caller can retain the value and report the failure.
 */
export function decryptValue(storedValue: string, key?: string): string {
  if (!storedValue) return storedValue
  if (!storedValue.startsWith(ENCRYPTED_PREFIX)) return storedValue

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
