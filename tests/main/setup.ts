import Database from 'better-sqlite3'
import { vi } from 'vitest'

// Mock Electron APIs globally for all main process tests.
// In Node.js (test environment), the `electron` package exports only the binary path
// and may throw if the binary isn't downloaded (e.g. CI with --ignore-scripts).
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
    getVersion: vi.fn(() => '0.0.0-test'),
    getName: vi.fn(() => 'sidebrain-test'),
    quit: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    requestSingleInstanceLock: vi.fn(() => true),
    on: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  Notification: {
    isSupported: vi.fn(() => false),
    removeGroup: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((str: string) => Buffer.from(str)),
    decryptString: vi.fn((buf: Buffer) => buf.toString()),
  },
  net: {
    fetch: vi.fn(),
  },
  nativeTheme: {
    themeSource: 'dark',
    shouldUseDarkColors: true,
  },
  shell: {
    openPath: vi.fn(),
    openExternal: vi.fn(),
  },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
    showErrorBox: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  session: {
    defaultSession: {
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      webRequest: { onHeadersReceived: vi.fn() },
    },
  },
  globalShortcut: {
    register: vi.fn(),
    unregisterAll: vi.fn(),
    setSuspended: vi.fn(),
  },
}))

let testDb: Database.Database | null = null

/**
 * Creates a fresh in-memory SQLite database with the full schema applied.
 * Use this in tests instead of the real getDatabase().
 */
export function createTestDatabase(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Initialize schema (same as schema.ts initializeSchema)
  db.exec(`
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
      assignee TEXT,
      due_date TEXT,
      source_entry_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (source_entry_id) REFERENCES entries(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      participants TEXT NOT NULL DEFAULT '[]',
      meeting_date TEXT,
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

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      sources TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON chat_conversations(updated_at DESC);

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

    CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_type ON embeddings(entity_type);

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

    CREATE INDEX IF NOT EXISTS idx_feedback_created ON categorization_feedback(created_at DESC);

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

  testDb = db
  return db
}

/**
 * Returns the current test database instance.
 * Throws if no test database has been created.
 */
export function getTestDatabase(): Database.Database {
  if (!testDb) {
    throw new Error('Test database not initialized. Call createTestDatabase() first.')
  }
  return testDb
}

/**
 * Closes the test database and resets the reference.
 */
export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close()
    testDb = null
  }
}
