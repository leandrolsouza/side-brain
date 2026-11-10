import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'

const state = vi.hoisted(() => ({ databasePath: '' }))
vi.mock('../../../src/main/services/config-service', () => ({
  getConfigService: () => ({ getDatabasePath: () => state.databasePath }),
}))

import { closeDatabase, getDatabase } from '../../../src/main/database/schema'

describe('chat action migration', () => {
  let dir = ''
  afterEach(() => {
    closeDatabase()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('adds the actions column to an existing database without losing messages', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidebrain-migration-'))
    state.databasePath = path.join(dir, 'test.db')
    const db = new Database(state.databasePath)
    db.exec(`
      CREATE TABLE schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO schema_version(version, name) VALUES (15, 'previous');
      CREATE TABLE chat_conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
      CREATE TABLE chat_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, sources TEXT, created_at TEXT DEFAULT '');
      INSERT INTO chat_conversations (id, title) VALUES ('c', 'Test');
      INSERT INTO chat_messages (id, conversation_id, role, content) VALUES ('m', 'c', 'assistant', 'old message');
    `)
    db.close()
    const upgraded = getDatabase()
    expect(upgraded.prepare('SELECT content, actions FROM chat_messages WHERE id = ?').get('m')).toEqual({
      content: 'old message',
      actions: null,
    })
    expect(upgraded.prepare('SELECT version FROM schema_version WHERE version = 16').get()).toEqual({ version: 16 })
  })
})
