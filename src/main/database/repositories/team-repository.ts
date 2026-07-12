import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import {
  AgentTeam,
  TeamCollaborationMode,
  TeamDiscussionEntry,
  TeamExecution,
  TeamExecutionStatus,
  TeamExecutionSummary,
} from '../../../shared/types'

// === Row types ===

interface TeamRow {
  id: string
  name: string
  description: string
  member_ids: string
  collaboration_mode: string
  generate_synthesis: number
  synthesis_prompt: string | null
  created_at: string
  updated_at: string
}

interface TeamExecutionRow {
  id: string
  team_id: string
  input: string
  entries: string
  synthesis: string | null
  status: string
  created_at: string
  completed_at: string | null
}

// === Repository ===

export class TeamRepository {
  // ─── Team CRUD ────────────────────────────────────────────────

  getAll(): AgentTeam[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM agent_teams ORDER BY created_at DESC').all() as TeamRow[]
    return rows.map(this.mapTeamRow)
  }

  getById(id: string): AgentTeam | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM agent_teams WHERE id = ?').get(id) as TeamRow | undefined
    return row ? this.mapTeamRow(row) : null
  }

  create(data: { name: string; description: string; memberIds: string[]; collaborationMode: TeamCollaborationMode; generateSynthesis: boolean; synthesisPrompt?: string }): AgentTeam {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO agent_teams (id, name, description, member_ids, collaboration_mode, generate_synthesis, synthesis_prompt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description,
      JSON.stringify(data.memberIds),
      data.collaborationMode,
      data.generateSynthesis ? 1 : 0,
      data.synthesisPrompt || null,
      now,
      now
    )

    return this.getById(id)!
  }

  update(id: string, data: Partial<{ name: string; description: string; memberIds: string[]; collaborationMode: TeamCollaborationMode; generateSynthesis: boolean; synthesisPrompt?: string }>): AgentTeam | null {
    const existing = this.getById(id)
    if (!existing) return null

    const db = getDatabase()
    const now = new Date().toISOString()
    const updated = {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      memberIds: data.memberIds ?? existing.memberIds,
      collaborationMode: data.collaborationMode ?? existing.collaborationMode,
      generateSynthesis: data.generateSynthesis ?? existing.generateSynthesis,
      synthesisPrompt: data.synthesisPrompt !== undefined ? data.synthesisPrompt : existing.synthesisPrompt,
    }

    db.prepare(`
      UPDATE agent_teams SET name = ?, description = ?, member_ids = ?, collaboration_mode = ?, generate_synthesis = ?, synthesis_prompt = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.name,
      updated.description,
      JSON.stringify(updated.memberIds),
      updated.collaborationMode,
      updated.generateSynthesis ? 1 : 0,
      updated.synthesisPrompt || null,
      now,
      id
    )

    return this.getById(id)
  }

  delete(id: string): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM agent_teams WHERE id = ?').run(id)
    return result.changes > 0
  }

  // ─── Execution CRUD ───────────────────────────────────────────

  createExecution(teamId: string, input: string): TeamExecution {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO team_executions (id, team_id, input, entries, status, created_at)
      VALUES (?, ?, ?, '[]', 'running', ?)
    `).run(id, teamId, input, now)

    return {
      id,
      teamId,
      input,
      entries: [],
      status: 'running',
      createdAt: now,
    }
  }

  getExecution(id: string): TeamExecution | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM team_executions WHERE id = ?').get(id) as TeamExecutionRow | undefined
    return row ? this.mapExecutionRow(row) : null
  }

  getExecutionsForTeam(teamId: string, limit = 20): TeamExecutionSummary[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT te.*, t.name as team_name, json_array_length(te.entries) as member_count
      FROM team_executions te
      JOIN agent_teams t ON t.id = te.team_id
      WHERE te.team_id = ?
      ORDER BY te.created_at DESC
      LIMIT ?
    `).all(teamId, limit) as (TeamExecutionRow & { team_name: string; member_count: number })[]

    return rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      input: row.input,
      status: row.status as TeamExecutionStatus,
      memberCount: row.member_count,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    }))
  }

  getRecentExecutions(limit = 30): TeamExecutionSummary[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT te.*, t.name as team_name, json_array_length(te.entries) as member_count
      FROM team_executions te
      JOIN agent_teams t ON t.id = te.team_id
      ORDER BY te.created_at DESC
      LIMIT ?
    `).all(limit) as (TeamExecutionRow & { team_name: string; member_count: number })[]

    return rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      input: row.input,
      status: row.status as TeamExecutionStatus,
      memberCount: row.member_count,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    }))
  }

  updateExecution(id: string, data: { entries?: TeamDiscussionEntry[]; synthesis?: string; status?: TeamExecutionStatus }): void {
    const db = getDatabase()
    const existing = this.getExecution(id)
    if (!existing) return

    const entries = data.entries !== undefined ? JSON.stringify(data.entries) : JSON.stringify(existing.entries)
    const synthesis = data.synthesis !== undefined ? data.synthesis : existing.synthesis || null
    const status = data.status || existing.status
    const completedAt = (status === 'completed' || status === 'failed' || status === 'cancelled')
      ? new Date().toISOString()
      : null

    db.prepare(`
      UPDATE team_executions SET entries = ?, synthesis = ?, status = ?, completed_at = ?
      WHERE id = ?
    `).run(entries, synthesis, status, completedAt, id)
  }

  // ─── Mappers ──────────────────────────────────────────────────

  private mapTeamRow(row: TeamRow): AgentTeam {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      memberIds: JSON.parse(row.member_ids) as string[],
      collaborationMode: row.collaboration_mode as TeamCollaborationMode,
      generateSynthesis: row.generate_synthesis === 1,
      synthesisPrompt: row.synthesis_prompt || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private mapExecutionRow(row: TeamExecutionRow): TeamExecution {
    return {
      id: row.id,
      teamId: row.team_id,
      input: row.input,
      entries: JSON.parse(row.entries) as TeamDiscussionEntry[],
      synthesis: row.synthesis || undefined,
      status: row.status as TeamExecutionStatus,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    }
  }
}
