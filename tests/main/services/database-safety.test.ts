import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'

const state = vi.hoisted(() => ({ db: null as import('better-sqlite3').Database | null, dbPath: '' }))

vi.mock('../../../src/main/database/schema', () => ({
  getDatabase: () => {
    if (!state.db) state.db = new Database(state.dbPath)
    return state.db
  },
  getDatabasePath: () => state.dbPath,
  closeDatabase: () => {
    state.db?.close()
    state.db = null
  },
}))

import { BackupService } from '../../../src/main/services/backup-service'
import { ConfigService } from '../../../src/main/services/config-service'

describe('database safety', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidebrain-safety-'))
    vi.mocked(app.getPath).mockReturnValue(dir)
    state.dbPath = path.join(dir, 'work-organizer.db')
    state.db = new Database(state.dbPath)
    state.db.pragma('journal_mode = WAL')
    state.db.pragma('wal_autocheckpoint = 0')
    state.db.exec(
      "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE sample (value TEXT); INSERT INTO sample VALUES ('wal data')"
    )
  })
  afterEach(() => {
    state.db?.close()
    state.db = null
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('backups uncheckpointed WAL data and restores it with a safety copy', async () => {
    const service = new BackupService()
    await service.createAutoBackup()
    const [backup] = service.listBackups()
    expect(backup).toBeDefined()
    const snapshot = new Database(backup.filePath, { readonly: true })
    expect(snapshot.prepare('SELECT value FROM sample').get()).toEqual({ value: 'wal data' })
    snapshot.close()

    state.db!.prepare("UPDATE sample SET value = 'new data'").run()
    expect((await service.restoreFromAutoBackup(backup.filePath)).success).toBe(true)
    const restored = new Database(state.dbPath, { readonly: true })
    expect(restored.prepare('SELECT value FROM sample').get()).toEqual({ value: 'wal data' })
    restored.close()
    const safety = fs.readdirSync(path.join(dir, 'backups')).find((name) => name.startsWith('pre_restore_'))!
    const previous = new Database(path.join(dir, 'backups', safety), { readonly: true })
    expect(previous.prepare('SELECT value FROM sample').get()).toEqual({ value: 'new data' })
    previous.close()
  })

  it('creates a startup snapshot without migrating the original database first', async () => {
    const service = new BackupService()
    await service.createStartupBackup()
    const [backup] = service.listBackups()
    const snapshot = new Database(backup.filePath, { readonly: true })
    expect(snapshot.prepare('SELECT value FROM sample').get()).toEqual({ value: 'wal data' })
    snapshot.close()
  })

  it('keeps an existing owner locked out of other instances and preserves its lock', () => {
    const first = new ConfigService()
    const second = new ConfigService()
    expect(first.acquireLock().acquired).toBe(true)
    expect(second.acquireLock().acquired).toBe(false)
    second.renewLock()
    second.releaseLock()
    expect(fs.existsSync(path.join(dir, 'work-organizer.lock'))).toBe(true)
    first.releaseLock()
    expect(second.acquireLock().acquired).toBe(true)
    second.releaseLock()
  })

  it('keeps the original workspace locked when the destination is busy', async () => {
    const first = new ConfigService()
    const second = new ConfigService()
    expect(first.acquireLock().acquired).toBe(true)
    const workspace = first.createWorkspace({ name: 'Outro', emoji: '📁', databasePath: path.join(dir, 'other.db') })
    fs.writeFileSync(path.join(dir, 'other.lock'), 'occupied')
    expect((await first.switchWorkspace(workspace.id)).success).toBe(false)
    expect(second.acquireLock().acquired).toBe(false)
    expect(first.getActiveWorkspace().id).not.toBe(workspace.id)
    first.releaseLock()
  })
})
