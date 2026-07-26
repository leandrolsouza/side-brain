import type { AgentTeam, TeamDiscussionEntry, TeamExecution, TeamExecutionSummary } from '../../shared/types'
import type { TeamRepository } from '../database/repositories/team-repository'
import type { AgentRepository } from '../database/repositories/agent-repository'
import type { AgentRuntime } from './agent-runtime'
import type { AIProvider } from './ai-provider'
import type { SettingsRepository } from '../database/repositories/settings-repository'
import { BrowserWindow } from 'electron'

/**
 * Orchestrates team discussions — runs agents sequentially with accumulated context,
 * then generates a synthesis of all contributions.
 */
export class TeamExecutionService {
  constructor(
    private teamRepo: TeamRepository,
    private agentRepo: AgentRepository,
    private agentRuntime: AgentRuntime,
    private aiProvider: AIProvider,
    private settingsRepo: SettingsRepository
  ) {}

  // ─── Team CRUD (delegated to repo) ───────────────────────────

  getAllTeams(): AgentTeam[] {
    return this.teamRepo.getAll()
  }

  getTeamById(id: string): AgentTeam | null {
    return this.teamRepo.getById(id)
  }

  createTeam(data: {
    name: string
    description: string
    memberIds: string[]
    collaborationMode?: 'sequential' | 'parallel'
    generateSynthesis?: boolean
    synthesisPrompt?: string
  }): AgentTeam {
    return this.teamRepo.create({
      name: data.name,
      description: data.description,
      memberIds: data.memberIds,
      collaborationMode: data.collaborationMode || 'sequential',
      generateSynthesis: data.generateSynthesis !== false,
      synthesisPrompt: data.synthesisPrompt,
    })
  }

  updateTeam(
    id: string,
    data: Partial<{
      name: string
      description: string
      memberIds: string[]
      collaborationMode: 'sequential' | 'parallel'
      generateSynthesis: boolean
      synthesisPrompt: string
    }>
  ): AgentTeam | null {
    return this.teamRepo.update(id, data)
  }

  deleteTeam(id: string): boolean {
    return this.teamRepo.delete(id)
  }

  // ─── Execution ────────────────────────────────────────────────

  /**
   * Start a team discussion. Each agent runs in sequence, seeing all previous responses.
   * At the end, a synthesis is generated from all contributions.
   */
  async runDiscussion(teamId: string, input: string): Promise<TeamExecution> {
    const team = this.teamRepo.getById(teamId)
    if (!team) throw new Error(`Team "${teamId}" not found`)

    if (team.memberIds.length === 0) throw new Error('Team has no members')

    // Create execution record
    const execution = this.teamRepo.createExecution(teamId, input)

    this.emitEvent(execution.id, teamId, 'discussion_started', { input })

    try {
      const entries: TeamDiscussionEntry[] = []

      if (team.collaborationMode === 'sequential') {
        await this.runSequential(team, input, entries, execution.id)
      } else {
        await this.runParallel(team, input, entries, execution.id)
      }

      // Save entries
      this.teamRepo.updateExecution(execution.id, { entries })

      // Generate synthesis
      let synthesis: string | undefined
      if (team.generateSynthesis && entries.filter((e) => e.status === 'completed').length > 0) {
        synthesis = await this.generateSynthesis(team, input, entries)
        this.teamRepo.updateExecution(execution.id, { synthesis, status: 'completed' })
      } else {
        this.teamRepo.updateExecution(execution.id, { status: 'completed' })
      }

      this.emitEvent(execution.id, teamId, 'discussion_completed', { synthesis })

      return this.teamRepo.getExecution(execution.id)!
    } catch (error: any) {
      this.teamRepo.updateExecution(execution.id, { status: 'failed' })
      this.emitEvent(execution.id, teamId, 'discussion_failed', { error: error.message })
      throw error
    }
  }

  /**
   * Sequential mode: each agent sees all previous responses as context.
   */
  private async runSequential(
    team: AgentTeam,
    input: string,
    entries: TeamDiscussionEntry[],
    executionId: string
  ): Promise<void> {
    for (const agentId of team.memberIds) {
      const agent = this.agentRepo.getById(agentId)
      if (!agent?.isActive) {
        entries.push({
          agentId,
          agentName: agent?.name || 'Desconhecido',
          agentIcon: agent?.icon || 'Bot',
          agentColor: agent?.color || 'blue',
          response: '',
          durationMs: 0,
          status: 'failed',
          error: 'Agente inativo ou não encontrado',
        })
        continue
      }

      this.emitEvent(executionId, team.id, 'member_started', { agentId, agentName: agent.name })

      // Build context with previous responses
      const contextualInput = this.buildSequentialInput(input, entries, agent.name)

      const startTime = Date.now()
      try {
        const result = await this.agentRuntime.execute(agentId, contextualInput, { trigger: 'delegation' })

        entries.push({
          agentId,
          agentName: agent.name,
          agentIcon: agent.icon,
          agentColor: agent.color,
          response: result.result || '',
          durationMs: Date.now() - startTime,
          status: 'completed',
        })
      } catch (error: any) {
        entries.push({
          agentId,
          agentName: agent.name,
          agentIcon: agent.icon,
          agentColor: agent.color,
          response: '',
          durationMs: Date.now() - startTime,
          status: 'failed',
          error: error.message,
        })
      }

      this.emitEvent(executionId, team.id, 'member_completed', {
        agentId,
        agentName: agent.name,
        entryIndex: entries.length - 1,
      })

      // Save intermediate progress
      this.teamRepo.updateExecution(executionId, { entries })
    }
  }

  /**
   * Parallel mode: all agents run independently with the same input.
   */
  private async runParallel(
    team: AgentTeam,
    input: string,
    entries: TeamDiscussionEntry[],
    executionId: string
  ): Promise<void> {
    const promises = team.memberIds.map(async (agentId) => {
      const agent = this.agentRepo.getById(agentId)
      if (!agent?.isActive) {
        return {
          agentId,
          agentName: agent?.name || 'Desconhecido',
          agentIcon: agent?.icon || 'Bot',
          agentColor: agent?.color || 'blue',
          response: '',
          durationMs: 0,
          status: 'failed' as const,
          error: 'Agente inativo ou não encontrado',
        }
      }

      this.emitEvent(executionId, team.id, 'member_started', { agentId, agentName: agent.name })

      const startTime = Date.now()
      try {
        const result = await this.agentRuntime.execute(agentId, input, { trigger: 'delegation' })
        return {
          agentId,
          agentName: agent.name,
          agentIcon: agent.icon,
          agentColor: agent.color,
          response: result.result || '',
          durationMs: Date.now() - startTime,
          status: 'completed' as const,
        }
      } catch (error: any) {
        return {
          agentId,
          agentName: agent.name,
          agentIcon: agent.icon,
          agentColor: agent.color,
          response: '',
          durationMs: Date.now() - startTime,
          status: 'failed' as const,
          error: error.message,
        }
      }
    })

    const results = await Promise.all(promises)
    entries.push(...results)
  }

  /**
   * Build the input for an agent in sequential mode,
   * including all previous agents' responses as context.
   */
  private buildSequentialInput(
    originalInput: string,
    previousEntries: TeamDiscussionEntry[],
    currentAgentName: string
  ): string {
    if (previousEntries.length === 0) {
      return originalInput
    }

    const previousResponses = previousEntries
      .filter((e) => e.status === 'completed')
      .map((e) => `### ${e.agentName}:\n${e.response}`)
      .join('\n\n')

    return `## Tópico da discussão:\n${originalInput}\n\n## Respostas anteriores dos outros membros da equipe:\n${previousResponses}\n\n---\nAgora é sua vez, ${currentAgentName}. Analise o tópico considerando as opiniões acima. Concorde, discorde, ou complemente com sua perspectiva única. Seja direto.`
  }

  /**
   * Generate a synthesis from all team contributions.
   */
  private async generateSynthesis(team: AgentTeam, input: string, entries: TeamDiscussionEntry[]): Promise<string> {
    const settings = this.settingsRepo.get()

    const completedEntries = entries.filter((e) => e.status === 'completed')
    if (completedEntries.length === 0) return ''

    const contributions = completedEntries.map((e) => `### ${e.agentName}:\n${e.response}`).join('\n\n')

    const defaultSynthesisPrompt = `Você é um facilitador que sintetiza uma discussão entre especialistas. Gere uma síntese que:
1. Identifique os pontos de CONSENSO entre os participantes
2. Destaque as DIVERGÊNCIAS com as posições de cada um
3. Liste as RECOMENDAÇÕES mais fortes (que tiveram mais apoio)
4. Sugira PRÓXIMOS PASSOS concretos

Seja conciso e objetivo. Use bullet points. Responda em português brasileiro.`

    const systemPrompt = team.synthesisPrompt || defaultSynthesisPrompt

    const userMessage = `## Tópico discutido:\n${input}\n\n## Contribuições da equipe "${team.name}":\n${contributions}\n\n---\nGere a síntese da discussão acima.`

    return this.aiProvider.invoke(systemPrompt, userMessage, settings, 'agent_execution')
  }

  // ─── Execution History ────────────────────────────────────────

  getExecutionsForTeam(teamId: string, limit = 20): TeamExecutionSummary[] {
    return this.teamRepo.getExecutionsForTeam(teamId, limit)
  }

  getRecentExecutions(limit = 30): TeamExecutionSummary[] {
    return this.teamRepo.getRecentExecutions(limit)
  }

  getExecutionDetails(executionId: string): TeamExecution | null {
    return this.teamRepo.getExecution(executionId)
  }

  // ─── Events ───────────────────────────────────────────────────

  private emitEvent(executionId: string, teamId: string, type: string, data?: unknown): void {
    try {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('team:execution-event', { executionId, teamId, type, data })
        }
      }
    } catch {
      // Non-fatal
    }
  }
}
