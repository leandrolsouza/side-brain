import { getDatabase } from '../schema'
import { AppSettings, DEFAULT_SETTINGS } from '../../../shared/types'
import { encryptValue, decryptValue, isSensitiveKey, DecryptionError, tryMigrateEncryptedValue } from '../../services/safe-storage-service'

export class SettingsRepository {
  get(): AppSettings {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]

    const settings = { ...DEFAULT_SETTINGS }
    const corruptedKeys: string[] = []
    const migratedEntries: [string, string][] = []

    for (const row of rows) {
      if (row.key in settings) {
        const key = row.key as keyof AppSettings
        if (isSensitiveKey(key)) {
          try {
            const value = decryptValue(row.value, key)
              ; (settings as any)[key] = value
          } catch (error) {
            if (error instanceof DecryptionError) {
              // In dev mode, attempt to migrate: try raw safeStorage decryption
              // before giving up (might work if DPAPI is still valid this session)
              const migrated = tryMigrateEncryptedValue(row.value)
              if (migrated !== null) {
                // Successfully decrypted — re-store as plain-text for dev mode
                migratedEntries.push([key, migrated])
                  ; (settings as any)[key] = migrated
              } else {
                // Truly unrecoverable
                corruptedKeys.push(key)
                  ; (settings as any)[key] = ''
              }
            } else {
              throw error
            }
          }
        } else {
          ; (settings as any)[key] = row.value
        }
      }
    }

    // Re-store migrated values as plain-text (dev mode only)
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
      console.info(`[SettingsRepository] Migrated ${migratedEntries.length} credential(s) from encrypted to plain-text (dev mode): ${migratedEntries.map(e => e[0]).join(', ')}`)
    }

    // Remove corrupted encrypted values from DB so user can re-enter
    if (corruptedKeys.length > 0) {
      const deleteStmt = db.prepare('DELETE FROM settings WHERE key = ?')
      const deleteMany = db.transaction((keys: string[]) => {
        for (const key of keys) {
          deleteStmt.run(key)
        }
      })
      deleteMany(corruptedKeys)
      console.warn(`[SettingsRepository] Cleared ${corruptedKeys.length} corrupted credential(s) from DB: ${corruptedKeys.join(', ')}. User needs to re-enter them.`)
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

    const entries: [string, string][] = Object.entries(updates).map(([key, value]) => {
      const strValue = String(value)
      // Encrypt sensitive keys before storing
      const finalValue = isSensitiveKey(key) ? encryptValue(strValue) : strValue
      return [key, finalValue]
    })

    updateMany(entries)
  }
}
