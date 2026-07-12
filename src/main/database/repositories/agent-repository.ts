import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import {
  AgentDefinition,
  AgentExecution,
  AgentExecutionStatus,
  AgentExecutionSummary,
  AgentScope,
  AgentSkill,
  AgentStep,
  AgentTrigger,
  AgentTriggerType,
} from '../../../shared/types'

// === Row types (DB shape) ===

interface AgentRow {
  id: string
  name: string
  description: string
  persona: string
  icon: string
  color: string
  skills: string        // JSON array
  scope: string         // JSON object
  triggers: string      // JSON array
  can_delegate: string  // JSON array
  max_steps: number
  is_active: number
  requires_approval: number
  created_at: string
  updated_at: string
}

interface ExecutionRow {
  id: string
  agent_id: string
  trigger: string
  input: string
  delegated_by_agent_id: string | null
  status: string
  result: string | null
  error: string | null
  created_at: string
  completed_at: string | null
}

interface StepRow {
  id: string
  execution_id: string
  step_number: number
  skill: string
  input: string         // JSON
  output: string | null // JSON
  reasoning: string
  delegated_to_agent_id: string | null
  status: string
  created_at: string
  completed_at: string | null
}

// === Repository ===

export class AgentRepository {
  // ─── Agent CRUD ───────────────────────────────────────────────

  getAll(): AgentDefinition[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as AgentRow[]
    return rows.map(this.mapAgentRow)
  }

  getActive(): AgentDefinition[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM agents WHERE is_active = 1 ORDER BY name').all() as AgentRow[]
    return rows.map(this.mapAgentRow)
  }

  getById(id: string): AgentDefinition | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined
    return row ? this.mapAgentRow(row) : null
  }

  create(data: Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'>): AgentDefinition {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO agents (id, name, description, persona, icon, color, skills, scope, triggers, can_delegate, max_steps, is_active, requires_approval, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description,
      data.persona,
      data.icon,
      data.color,
      JSON.stringify(data.skills),
      JSON.stringify(data.scope),
      JSON.stringify(data.triggers),
      JSON.stringify(data.canDelegate),
      data.maxSteps,
      data.isActive ? 1 : 0,
      data.requiresApproval ? 1 : 0,
      now,
      now
    )

    return this.getById(id)!
  }

  update(id: string, data: Partial<Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'>>): AgentDefinition | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const updated = { ...existing, ...data }
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE agents SET
        name = ?, description = ?, persona = ?, icon = ?, color = ?,
        skills = ?, scope = ?, triggers = ?, can_delegate = ?,
        max_steps = ?, is_active = ?, requires_approval = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.name,
      updated.description,
      updated.persona,
      updated.icon,
      updated.color,
      JSON.stringify(updated.skills),
      JSON.stringify(updated.scope),
      JSON.stringify(updated.triggers),
      JSON.stringify(updated.canDelegate),
      updated.maxSteps,
      updated.isActive ? 1 : 0,
      updated.requiresApproval ? 1 : 0,
      now,
      id
    )

    return this.getById(id)
  }

  delete(id: string): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM agents WHERE id = ?').run(id)
    return result.changes > 0
  }

  // ─── Execution CRUD ───────────────────────────────────────────

  createExecution(agentId: string, input: string, trigger: AgentTriggerType = 'manual', delegatedBy?: string): AgentExecution {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO agent_executions (id, agent_id, trigger, input, delegated_by_agent_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'running', ?)
    `).run(id, agentId, trigger, input, delegatedBy || null, now)

    return {
      id,
      agentId,
      trigger,
      input,
      delegatedByAgentId: delegatedBy,
      steps: [],
      status: 'running',
      createdAt: now,
    }
  }

  getExecution(id: string): AgentExecution | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM agent_executions WHERE id = ?').get(id) as ExecutionRow | undefined
    if (!row) return null

    const steps = this.getStepsForExecution(id)
    return this.mapExecutionRow(row, steps)
  }

  getExecutionsForAgent(agentId: string, limit = 20): AgentExecutionSummary[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT ae.*, a.name as agent_name,
             (SELECT COUNT(*) FROM agent_steps WHERE execution_id = ae.id) as step_count
      FROM agent_executions ae
      JOIN agents a ON a.id = ae.agent_id
      WHERE ae.agent_id = ?
      ORDER BY ae.created_at DESC
      LIMIT ?
    `).all(agentId, limit) as (ExecutionRow & { agent_name: string; step_count: number })[]

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      trigger: row.trigger as AgentTriggerType,
      input: row.input,
      status: row.status as AgentExecutionStatus,
      stepCount: row.step_count,
      result: row.result || undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    }))
  }

  getRecentExecutions(limit = 50): AgentExecutionSummary[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT ae.*, a.name as agent_name,
             (SELECT COUNT(*) FROM agent_steps WHERE execution_id = ae.id) as step_count
      FROM agent_executions ae
      JOIN agents a ON a.id = ae.agent_id
      ORDER BY ae.created_at DESC
      LIMIT ?
    `).all(limit) as (ExecutionRow & { agent_name: string; step_count: number })[]

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      trigger: row.trigger as AgentTriggerType,
      input: row.input,
      status: row.status as AgentExecutionStatus,
      stepCount: row.step_count,
      result: row.result || undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    }))
  }

  updateExecutionStatus(id: string, status: AgentExecutionStatus, result?: string, error?: string): void {
    const db = getDatabase()
    const completedAt = (status === 'completed' || status === 'failed' || status === 'cancelled')
      ? new Date().toISOString()
      : null

    db.prepare(`
      UPDATE agent_executions SET status = ?, result = ?, error = ?, completed_at = ?
      WHERE id = ?
    `).run(status, result || null, error || null, completedAt, id)
  }

  // ─── Steps CRUD ───────────────────────────────────────────────

  addStep(executionId: string, data: {
    skill: AgentSkill
    input: Record<string, any>
    reasoning: string
    delegatedToAgentId?: string
  }): AgentStep {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()

    // Get next step number
    const last = db.prepare(
      'SELECT MAX(step_number) as max FROM agent_steps WHERE execution_id = ?'
    ).get(executionId) as { max: number | null }
    const stepNumber = (last.max ?? 0) + 1

    db.prepare(`
      INSERT INTO agent_steps (id, execution_id, step_number, skill, input, reasoning, delegated_to_agent_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)
    `).run(id, executionId, stepNumber, data.skill, JSON.stringify(data.input), data.reasoning, data.delegatedToAgentId || null, now)

    return {
      id,
      executionId,
      stepNumber,
      skill: data.skill,
      input: data.input,
      output: null,
      reasoning: data.reasoning,
      delegatedToAgentId: data.delegatedToAgentId,
      status: 'running',
      createdAt: now,
    }
  }

  completeStep(stepId: string, output: Record<string, any>, status: 'completed' | 'failed' = 'completed'): void {
    const db = getDatabase()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE agent_steps SET output = ?, status = ?, completed_at = ?
      WHERE id = ?
    `).run(JSON.stringify(output), status, now, stepId)
  }

  updateStepStatus(stepId: string, status: AgentStep['status']): void {
    const db = getDatabase()
    db.prepare('UPDATE agent_steps SET status = ? WHERE id = ?').run(status, stepId)
  }

  getStepsForExecution(executionId: string): AgentStep[] {
    const db = getDatabase()
    const rows = db.prepare(
      'SELECT * FROM agent_steps WHERE execution_id = ? ORDER BY step_number ASC'
    ).all(executionId) as StepRow[]

    return rows.map(this.mapStepRow)
  }

  // ─── Cleanup ──────────────────────────────────────────────────

  deleteExecutionsForAgent(agentId: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM agent_executions WHERE agent_id = ?').run(agentId)
  }

  deleteOldExecutions(olderThanDays = 30): number {
    const db = getDatabase()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)

    const result = db.prepare(
      'DELETE FROM agent_executions WHERE created_at < ? AND status IN (?, ?, ?)'
    ).run(cutoff.toISOString(), 'completed', 'failed', 'cancelled')

    return result.changes
  }

  // ─── Mappers ──────────────────────────────────────────────────

  private mapAgentRow(row: AgentRow): AgentDefinition {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      persona: row.persona,
      icon: row.icon,
      color: row.color,
      skills: JSON.parse(row.skills) as AgentSkill[],
      scope: JSON.parse(row.scope) as AgentScope,
      triggers: JSON.parse(row.triggers) as AgentTrigger[],
      canDelegate: JSON.parse(row.can_delegate) as string[],
      maxSteps: row.max_steps,
      isActive: row.is_active === 1,
      requiresApproval: row.requires_approval === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private mapExecutionRow(row: ExecutionRow, steps: AgentStep[]): AgentExecution {
    return {
      id: row.id,
      agentId: row.agent_id,
      trigger: row.trigger as AgentTriggerType,
      input: row.input,
      delegatedByAgentId: row.delegated_by_agent_id || undefined,
      steps,
      status: row.status as AgentExecutionStatus,
      result: row.result || undefined,
      error: row.error || undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    }
  }

  private mapStepRow(row: StepRow): AgentStep {
    return {
      id: row.id,
      executionId: row.execution_id,
      stepNumber: row.step_number,
      skill: row.skill as AgentSkill,
      input: JSON.parse(row.input),
      output: row.output ? JSON.parse(row.output) : null,
      reasoning: row.reasoning,
      delegatedToAgentId: row.delegated_to_agent_id || undefined,
      status: row.status as AgentStep['status'],
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    }
  }
}
