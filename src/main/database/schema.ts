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

  // Update query planner statistics so indexes are used optimally
  db.exec('ANALYZE')

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
  {
    version: 7,
    name: 'encrypt_api_keys',
    up: (database) => {
      // Migrate existing plain-text API keys to encrypted format using Electron's safeStorage.
      // If safeStorage is not available, keys remain as plain-text and will be encrypted on next update.
      try {
        const { safeStorage } = require('electron')
        if (!safeStorage.isEncryptionAvailable()) return

        const sensitiveKeys = ['bedrockApiKey', 'openaiApiKey', 'geminiApiKey', 'grokApiKey', 'localApiKey']
        const rows = database.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
        const update = database.prepare('UPDATE settings SET value = ? WHERE key = ?')

        for (const row of rows) {
          if (sensitiveKeys.includes(row.key) && row.value && !row.value.startsWith('enc::')) {
            const encrypted = safeStorage.encryptString(row.value)
            const encodedValue = 'enc::' + encrypted.toString('base64')
            update.run(encodedValue, row.key)
          }
        }
      } catch {
        // safeStorage not available (e.g. running tests) — skip migration silently
      }
    },
  },
  {
    version: 8,
    name: 'add_performance_indexes',
    up: (database) => {
      database.exec(`
        -- Index on entries.created_at for date range queries (heatmap, timeline, filters)
        CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);

        -- Composite index for the most common query pattern: entries by project ordered by date
        CREATE INDEX IF NOT EXISTS idx_entries_project_created ON entries(project_id, created_at DESC);

        -- Index on tasks.created_at for date range queries
        CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

        -- Composite index for tasks by project ordered by date
        CREATE INDEX IF NOT EXISTS idx_tasks_project_created ON tasks(project_id, created_at DESC);

        -- Index on meetings.created_at for date range queries
        CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at);
      `)
    },
  },
  {
    version: 9,
    name: 'add_fts5_entries',
    up: (database) => {
      // Create FTS5 virtual table for full-text search on entries
      database.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
          raw_text,
          improved_text,
          content='entries',
          content_rowid='rowid',
          tokenize='unicode61'
        );

        -- Populate FTS index with existing data
        INSERT INTO entries_fts(rowid, raw_text, improved_text)
          SELECT rowid, raw_text, improved_text FROM entries;

        -- Triggers to keep FTS in sync with entries table
        CREATE TRIGGER IF NOT EXISTS entries_fts_insert AFTER INSERT ON entries BEGIN
          INSERT INTO entries_fts(rowid, raw_text, improved_text)
            VALUES (NEW.rowid, NEW.raw_text, NEW.improved_text);
        END;

        CREATE TRIGGER IF NOT EXISTS entries_fts_delete AFTER DELETE ON entries BEGIN
          INSERT INTO entries_fts(entries_fts, rowid, raw_text, improved_text)
            VALUES ('delete', OLD.rowid, OLD.raw_text, OLD.improved_text);
        END;

        CREATE TRIGGER IF NOT EXISTS entries_fts_update AFTER UPDATE ON entries BEGIN
          INSERT INTO entries_fts(entries_fts, rowid, raw_text, improved_text)
            VALUES ('delete', OLD.rowid, OLD.raw_text, OLD.improved_text);
          INSERT INTO entries_fts(rowid, raw_text, improved_text)
            VALUES (NEW.rowid, NEW.raw_text, NEW.improved_text);
        END;
      `)
    },
  },
  {
    version: 10,
    name: 'add_chat_history',
    up: (database) => {
      database.exec(`
        -- Conversations table: groups messages into conversations
        CREATE TABLE IF NOT EXISTS chat_conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Messages table: individual messages within a conversation
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          sources TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
        );

        -- Index for fast message retrieval by conversation
        CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at ASC);

        -- Index for listing conversations by most recent activity
        CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON chat_conversations(updated_at DESC);
      `)
    },
  },
  {
    version: 11,
    name: 'add_embeddings',
    up: (database) => {
      database.exec(`
        -- Embeddings table: stores vector representations of entries and tasks
        CREATE TABLE IF NOT EXISTS embeddings (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL CHECK(entity_type IN ('entry', 'task')),
          entity_id TEXT NOT NULL,
          embedding BLOB NOT NULL,
          model TEXT NOT NULL,
          dimensions INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(entity_type, entity_id)
        );

        -- Index for fast lookup by entity
        CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);

        -- Index for checking which entries need embeddings
        CREATE INDEX IF NOT EXISTS idx_embeddings_type ON embeddings(entity_type);
      `)
    },
  },
  {
    version: 12,
    name: 'add_categorization_feedback',
    up: (database) => {
      database.exec(`
        -- Stores user corrections to AI categorization for few-shot learning
        CREATE TABLE IF NOT EXISTS categorization_feedback (
          id TEXT PRIMARY KEY,
          raw_text TEXT NOT NULL,
          ai_type TEXT NOT NULL,
          ai_action TEXT NOT NULL,
          ai_project_id TEXT,
          corrected_type TEXT NOT NULL,
          corrected_action TEXT NOT NULL,
          corrected_project_id TEXT,
          corrected_project_name TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Index for recent feedback retrieval
        CREATE INDEX IF NOT EXISTS idx_feedback_created ON categorization_feedback(created_at DESC);
      `)
    },
  },
  {
    version: 13,
    name: 'add_agent_studio',
    up: (database) => {
      database.exec(`
        -- Agent definitions: user-created agents with persona, skills, and scope
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          persona TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT 'Bot',
          color TEXT NOT NULL DEFAULT 'blue',
          skills TEXT NOT NULL DEFAULT '[]',
          scope TEXT NOT NULL DEFAULT '{"projectIds":"all"}',
          triggers TEXT NOT NULL DEFAULT '[]',
          can_delegate TEXT NOT NULL DEFAULT '[]',
          max_steps INTEGER NOT NULL DEFAULT 5,
          is_active INTEGER NOT NULL DEFAULT 1,
          requires_approval INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active);

        -- Agent executions: each run of an agent
        CREATE TABLE IF NOT EXISTS agent_executions (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          trigger TEXT NOT NULL DEFAULT 'manual',
          input TEXT NOT NULL,
          delegated_by_agent_id TEXT,
          status TEXT NOT NULL DEFAULT 'running',
          result TEXT,
          error TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT,
          FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_agent_executions_agent ON agent_executions(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
        CREATE INDEX IF NOT EXISTS idx_agent_executions_created ON agent_executions(created_at DESC);

        -- Agent execution steps: individual tool calls within an execution
        CREATE TABLE IF NOT EXISTS agent_steps (
          id TEXT PRIMARY KEY,
          execution_id TEXT NOT NULL,
          step_number INTEGER NOT NULL,
          skill TEXT NOT NULL,
          input TEXT NOT NULL DEFAULT '{}',
          output TEXT,
          reasoning TEXT NOT NULL DEFAULT '',
          delegated_to_agent_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT,
          FOREIGN KEY (execution_id) REFERENCES agent_executions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_agent_steps_execution ON agent_steps(execution_id, step_number);
      `)
    },
  },
  {
    version: 14,
    name: 'add_agent_teams',
    up: (database) => {
      database.exec(`
        -- Agent teams: groups of agents that collaborate
        CREATE TABLE IF NOT EXISTS agent_teams (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          member_ids TEXT NOT NULL DEFAULT '[]',
          collaboration_mode TEXT NOT NULL DEFAULT 'sequential',
          generate_synthesis INTEGER NOT NULL DEFAULT 1,
          synthesis_prompt TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Team executions: a discussion run
        CREATE TABLE IF NOT EXISTS team_executions (
          id TEXT PRIMARY KEY,
          team_id TEXT NOT NULL,
          input TEXT NOT NULL,
          entries TEXT NOT NULL DEFAULT '[]',
          synthesis TEXT,
          status TEXT NOT NULL DEFAULT 'running',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT,
          FOREIGN KEY (team_id) REFERENCES agent_teams(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_team_executions_team ON team_executions(team_id);
        CREATE INDEX IF NOT EXISTS idx_team_executions_created ON team_executions(created_at DESC);
      `)
    },
  },
  {
    version: 15,
    name: 'add_structured_templates_and_snippets',
    up: (database) => {
      database.exec(`
        -- Structured templates: guided capture with typed fields
        CREATE TABLE IF NOT EXISTS structured_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          icon TEXT NOT NULL DEFAULT 'FileText',
          color TEXT NOT NULL DEFAULT 'neutral',
          category TEXT NOT NULL DEFAULT 'custom',
          fields TEXT NOT NULL DEFAULT '[]',
          output_format TEXT NOT NULL DEFAULT '',
          hint_type TEXT NOT NULL DEFAULT 'information',
          hint_action TEXT NOT NULL DEFAULT 'none',
          project_id TEXT,
          is_default INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_structured_templates_category ON structured_templates(category);
        CREATE INDEX IF NOT EXISTS idx_structured_templates_sort ON structured_templates(sort_order);

        -- Capture snippets: text shortcuts triggered by /<key>
        CREATE TABLE IF NOT EXISTS capture_snippets (
          id TEXT PRIMARY KEY,
          trigger_key TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general',
          usage_count INTEGER NOT NULL DEFAULT 0,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_snippets_trigger ON capture_snippets(trigger_key);
        CREATE INDEX IF NOT EXISTS idx_snippets_usage ON capture_snippets(usage_count DESC);
      `)

      // Seed default structured templates
      const { DEFAULT_STRUCTURED_TEMPLATES, DEFAULT_CAPTURE_SNIPPETS } = require('../../shared/types/custom-fields')

      const insertTemplate = database.prepare(
        `INSERT INTO structured_templates (id, name, description, icon, color, category, fields, output_format, hint_type, hint_action, is_default, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const tpl of DEFAULT_STRUCTURED_TEMPLATES) {
        insertTemplate.run(
          uuidv4(), tpl.name, tpl.description, tpl.icon, tpl.color, tpl.category,
          JSON.stringify(tpl.fields), tpl.outputFormat, tpl.hintType, tpl.hintAction,
          tpl.isDefault ? 1 : 0, tpl.sortOrder
        )
      }

      // Seed default snippets
      const insertSnippet = database.prepare(
        `INSERT INTO capture_snippets (id, trigger_key, label, content, category, usage_count, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      for (const snp of DEFAULT_CAPTURE_SNIPPETS) {
        insertSnippet.run(
          uuidv4(), snp.triggerKey, snp.label, snp.content, snp.category, 0, snp.isDefault ? 1 : 0
        )
      }
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
