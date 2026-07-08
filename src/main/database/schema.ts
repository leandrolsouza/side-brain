import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { getConfigService } from '../services/config-service'

let db: Database.Database | null = null

export function getDatabasePath(): string {
  return getConfigService().getDatabasePath()
}

export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDatabasePath()

  // Garante que o diretório existe
  const dir = path.dirname(dbPath)
  const fs = require('fs')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')

  initializeSchema(db)
  runMigrations(db)
  return db
}

function runMigrations(database: Database.Database): void {
  // Add due_date column to tasks if it doesn't exist
  const columns = database.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]
  const hasDueDate = columns.some((col) => col.name === 'due_date')
  if (!hasDueDate) {
    database.exec(`ALTER TABLE tasks ADD COLUMN due_date TEXT`)
  }
  // Always ensure the index exists (safe for both new and migrated DBs)
  database.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`)
}

function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_auto_suggested INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      improved_text TEXT NOT NULL,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'information',
      action TEXT NOT NULL DEFAULT 'none',
      review_status TEXT NOT NULL DEFAULT 'auto_approved',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entries_project_id ON entries(project_id);
    CREATE INDEX IF NOT EXISTS idx_entries_review_status ON entries(review_status);
    CREATE INDEX IF NOT EXISTS idx_entries_action ON entries(action);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      due_date TEXT,
      source_entry_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (source_entry_id) REFERENCES entries(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      participants TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      raw_notes TEXT NOT NULL DEFAULT '[]',
      pasted_transcription TEXT,
      generated_minutes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
  `)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
