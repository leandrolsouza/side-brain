import { safeStorage } from 'electron'

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
 * Returns the original value if safeStorage is unavailable or the value is empty.
 */
export function encryptValue(plainText: string): string {
  if (!plainText) return plainText
  if (!isSafeStorageAvailable()) return plainText

  const encrypted = safeStorage.encryptString(plainText)
  return ENCRYPTED_PREFIX + encrypted.toString('base64')
}

/**
 * Decrypts a value that was previously encrypted with encryptValue().
 * If the value doesn't have the encrypted prefix, it's treated as plain-text
 * (backward compatibility for existing unencrypted settings).
 *
 * If decryption fails (e.g. OS keychain changed, corrupted data), returns empty
 * string so the user can re-enter the credential without crashing the app.
 */
export function decryptValue(storedValue: string): string {
  if (!storedValue) return storedValue
  if (!storedValue.startsWith(ENCRYPTED_PREFIX)) return storedValue
  if (!isSafeStorageAvailable()) return ''

  try {
    const base64 = storedValue.slice(ENCRYPTED_PREFIX.length)
    const buffer = Buffer.from(base64, 'base64')
    return safeStorage.decryptString(buffer)
  } catch (error) {
    console.warn('[SafeStorage] Failed to decrypt value — credential may need to be re-entered:', error)
    return ''
  }
}

/**
 * Checks if a settings key is sensitive and should be encrypted.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key)
}
