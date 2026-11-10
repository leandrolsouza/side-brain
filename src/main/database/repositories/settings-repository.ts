import { getDatabase } from '../schema'
import { type AppSettings, DEFAULT_SETTINGS } from '../../../shared/types'
import { encryptValue, decryptValue, isSensitiveKey, isSafeStorageAvailable } from '../../services/safe-storage-service'
import { createScopedLogger } from '../../services/logger'

const logger = createScopedLogger('settings')

export class SettingsRepository {
  get(): AppSettings {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]

    const settings = { ...DEFAULT_SETTINGS }
    const migratedEntries: [string, string][] = []

    for (const row of rows) {
      if (row.key in settings) {
        const key = row.key as keyof AppSettings
        if (isSensitiveKey(key)) {
          try {
            const value = decryptValue(row.value, key)
            ;(settings as any)[key] = value
            if (row.value && !row.value.startsWith('enc::') && isSafeStorageAvailable()) {
              migratedEntries.push([key, encryptValue(row.value)])
            }
          } catch (error) {
            // Keep the stored value intact if the keychain is temporarily unavailable
            // or decryption fails; the user may recover access later.
            logger.warn('[SettingsRepository] Unable to read an encrypted credential.')
            ;(settings as any)[key] = ''
          }
        } else {
          ;(settings as any)[key] = row.value
        }
      }
    }

    // Upgrade legacy plaintext only after encryption succeeds.
    if (migratedEntries.length > 0) {
      const upsert = db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      const upsertMany = db.transaction((entries: [string, string][]) => {
        for (const [key, value] of entries) {
          upsert.run(key, value)
        }
      })
      upsertMany(migratedEntries)
      logger.info(`[SettingsRepository] Protected ${migratedEntries.length} legacy credential(s).`)
    }

    return settings
  }

  update(updates: Partial<AppSettings>): void {
    const db = getDatabase()
    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)

    const updateMany = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) {
        upsert.run(key, value)
      }
    })

    const stored = new Map(
      (db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]).map((row) => [
        row.key,
        row.value,
      ])
    )
    const entries: [string, string][] = Object.entries(updates).flatMap(([key, value]): [string, string][] => {
      const strValue = String(value)
      const current = stored.get(key)
      if (isSensitiveKey(key) && current?.startsWith('enc::')) {
        if (!isSafeStorageAvailable()) {
          if (!strValue) return []
          throw new Error('Secure storage is unavailable; credentials were not saved.')
        }
        try {
          if (decryptValue(current, key) === strValue) return []
        } catch {
          if (!strValue) return []
        }
      }
      if (isSensitiveKey(key) && !isSafeStorageAvailable() && current === strValue) return []
      // Encrypt sensitive keys before storing
      const finalValue = isSensitiveKey(key) ? encryptValue(strValue) : strValue
      return [[key, finalValue]]
    })

    updateMany(entries)
  }
}
