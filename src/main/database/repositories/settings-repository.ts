import { getDatabase } from '../schema'
import { AppSettings, DEFAULT_SETTINGS } from '../../../shared/types'
import { encryptValue, decryptValue, isSensitiveKey } from '../../services/safe-storage-service'

export class SettingsRepository {
  get(): AppSettings {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]

    const settings = { ...DEFAULT_SETTINGS }

    for (const row of rows) {
      if (row.key in settings) {
        const key = row.key as keyof AppSettings
        // Decrypt sensitive keys (API keys) that are stored encrypted
        const value = isSensitiveKey(key) ? decryptValue(row.value) : row.value
          ; (settings as any)[key] = value
      }
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
