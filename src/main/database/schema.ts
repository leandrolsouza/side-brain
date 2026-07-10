import Database from 'better-sqlite3'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getConfigService } from '../services/config-service'
import { DEFAULT_ENTRY_TYPES, DEFAULT_ACTION_STATUSES, DEFAULT_CAPTURE_TEMPLATES } from '../../shared/types'

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

// === Migration System ===

interface Migration {
  version: number
  name: string
  up: (database: Database.Database) => void
}

/**
 * All migrations in order. Each migration runs exactly once.
 * New migrations should be appended to the end of this array.
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: 'add_due_date_to_tasks',
    up: (database) => {
      const columns = database.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]
      if (!columns.some((col) => col.name === 'due_date')) {
        database.exec(`ALTER TABLE tasks ADD COLUMN due_date TEXT`)
      }
      database.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`)
    },
  },
  {
    version: 2,
    name: 'add_meeting_date_to_meetings',
    up: (database) => {
      const columns = database.prepare("PRAGMA table_info(meetings)").all() as { name: string }[]
      if (!columns.some((col) => col.name === 'meeting_date')) {
        database.exec(`ALTER TABLE meetings ADD COLUMN meeting_date TEXT`)
        database.exec(`UPDATE meetings SET meeting_date = substr(started_at, 1, 10) WHERE meeting_date IS NULL`)
      }
    },
  },
  {
    version: 3,
    name: 'add_active_to_projects',
    up: (database) => {
      const columns = database.prepare("PRAGMA table_info(projects)").all() as { name: string }[]
      if (!columns.some((col) => col.name === 'active')) {
        database.exec(`ALTER TABLE projects ADD COLUMN active INTEGER DEFAULT 1`)
      }
      database.exec(`UPDATE projects SET active = 1 WHERE active IS NULL OR active NOT IN (0, 1)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(active)`)
    },
  },
  {
    version: 4,
    name: 'add_assignee_to_tasks',
    up: (database) => {
      const columns = database.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]
      if (!columns.some((col) => col.name === 'assignee')) {
        database.exec(`ALTER TABLE tasks ADD COLUMN assignee TEXT`)
      }
    },
  },
  {
    version: 5,
    name: 'seed_custom_fields',
    up: (database) => {
      // Seed custom_entry_types if empty
      const entryTypeCount = database.prepare('SELECT COUNT(*) as count FROM custom_entry_types').get() as { count: number }
      if (entryTypeCount.count === 0) {
        const insertEntryType = database.prepare(
          `INSERT INTO custom_entry_types (id, key, label, icon, color, is_default, sort_order, allows_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        for (const et of DEFAULT_ENTRY_TYPES) {
          insertEntryType.run(uuidv4(), et.key, et.label, et.icon, et.color, et.isDefault ? 1 : 0, et.sortOrder, et.allowsAction ? 1 : 0)
        }
      }

      // Seed custom_action_statuses if empty
      const actionStatusCount = database.prepare('SELECT COUNT(*) as count FROM custom_action_statuses').get() as { count: number }
      if (actionStatusCount.count === 0) {
        const insertActionStatus = database.prepare(
          `INSERT INTO custom_action_statuses (id, key, label, icon, color, is_default, is_final, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        for (const as_ of DEFAULT_ACTION_STATUSES) {
          insertActionStatus.run(uuidv4(), as_.key, as_.label, as_.icon, as_.color, as_.isDefault ? 1 : 0, as_.isFinal ? 1 : 0, as_.sortOrder)
        }
      }

      // Seed custom_capture_templates if empty
      const templateCount = database.prepare('SELECT COUNT(*) as count FROM custom_capture_templates').get() as { count: number }
      if (templateCount.count === 0) {
        const insertTemplate = database.prepare(
          `INSERT INTO custom_capture_templates (id, label, prefix, placeholder, icon, hint_type, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        for (const tpl of DEFAULT_CAPTURE_TEMPLATES) {
          insertTemplate.run(uuidv4(), tpl.label, tpl.prefix, tpl.placeholder, tpl.icon, tpl.hintType, tpl.isDefault ? 1 : 0, tpl.sortOrder)
        }
      }
    },
  },
  {
    version: 6,
    name: 'add_entry_connections',
    up: (database) => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS entry_connections (
          id TEXT PRIMARY KEY,
          source_entry_id TEXT NOT NULL,
          target_entry_id TEXT NOT NULL,
          connection_type TEXT NOT NULL DEFAULT 'related',
          description TEXT,
          is_ai_suggested INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (source_entry_id) REFERENCES entries(id) ON DELETE CASCADE,
          FOREIGN KEY (target_entry_id) REFERENCES entries(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_connections_source ON entry_connections(source_entry_id);
        CREATE INDEX IF NOT EXISTS idx_connections_target ON entry_connections(target_entry_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_pair ON entry_connections(source_entry_id, target_entry_id);
      `)
    },
  },
]

function runMigrations(database: Database.Database): void {
  // Ensure schema_version table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Get current version
  const currentVersion = (
    database.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number | null }
  ).version ?? 0

  // Run pending migrations inside a transaction
  const pendingMigrations = migrations.filter((m) => m.version > currentVersion)

  if (pendingMigrations.length === 0) return

  const applyMigrations = database.transaction(() => {
    for (const migration of pendingMigrations) {
      migration.up(database)
      database.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(migration.version, migration.name)
    }
  })

  applyMigrations()
}

// === Schema Initialization ===

function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_auto_suggested INTEGER NOT NULL DEFAULT 0,
      active INTEGER DEFAULT 1
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

    CREATE TABLE IF NOT EXISTS ai_usage (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ai_usage_operation_type ON ai_usage(operation_type);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);

    CREATE TABLE IF NOT EXISTS error_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      category TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'error',
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      occurrences INTEGER NOT NULL DEFAULT 1,
      last_occurrence TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
    CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
    CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      dismissed INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(dismissed);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

    CREATE TABLE IF NOT EXISTS custom_entry_types (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Circle',
      color TEXT NOT NULL DEFAULT 'neutral',
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      allows_action INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS custom_action_statuses (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Circle',
      color TEXT NOT NULL DEFAULT 'neutral',
      is_default INTEGER NOT NULL DEFAULT 0,
      is_final INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS custom_capture_templates (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      prefix TEXT NOT NULL DEFAULT '',
      placeholder TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'PenLine',
      hint_type TEXT NOT NULL DEFAULT 'information',
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
