import type {
  AgentDefinition,
  AgentExecution,
  AgentExecutionEvent,
  AgentSkill,
  AgentStep,
  AgentTriggerType,
  ToolCall,
  ToolDefinition,
} from '../../shared/types'
import type { AgentRepository } from '../database/repositories/agent-repository'
import type { SettingsRepository } from '../database/repositories/settings-repository'
import type { AIProvider } from './ai-provider'
import type { AgentToolRegistry } from './agent-tool-registry'
import type { MCPManager } from './mcp-manager'
import { BrowserWindow } from 'electron'
import { confirmAction } from './action-approval-service'

/** Maximum recursion depth for agent delegation chains */
const MAX_DELEGATION_DEPTH = 3

/**
 * Message format used internally for the conversation loop.
 */
interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: any[]
}

/**
 * Options for starting an execution.
 */
export interface ExecutionOptions {
  trigger?: AgentTriggerType
  delegatedBy?: string
  delegationDepth?: number
}

/**
 * Result returned after an execution completes.
 */
export interface ExecutionResult {
  executionId: string
  agentId: string
  status: 'completed' | 'failed'
  result?: string
  error?: string
  steps: AgentStep[]
}

/**
 * AgentRuntime is the core execution engine for agents.
 * It implements a ReAct-style loop:
 *   1. Send the goal + context + available tools to the LLM
 *   2. If the LLM returns tool calls, execute them
 *   3. Feed results back to the LLM
 *   4. Repeat until the LLM returns a final text response or max steps reached
 */
export class AgentRuntime {
  /** Track currently running executions to prevent double-runs */
  private runningExecutions: Set<string> = new Set()

  constructor(
    private aiProvider: AIProvider,
    private toolRegistry: AgentToolRegistry,
    private agentRepo: AgentRepository,
    private settingsRepo: SettingsRepository,
    private mcpManager?: MCPManager
  ) {}

  /**
   * Execute an agent with a given input/goal.
   * This is the main entry point for running an agent.
   */
  async execute(agentId: string, input: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    const agent = this.agentRepo.getById(agentId)
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found`)
    }

    if (!agent.isActive) {
      throw new Error(`Agent "${agent.name}" is inactive`)
    }

    const trigger = options.trigger || 'manual'
    const delegationDepth = options.delegationDepth || 0

    if (delegationDepth > MAX_DELEGATION_DEPTH) {
      throw new Error(`Maximum delegation depth (${MAX_DELEGATION_DEPTH}) exceeded. Circular delegation detected.`)
    }

    // Create execution record
    const execution = this.agentRepo.createExecution(agentId, input, trigger, options.delegatedBy)
    this.runningExecutions.add(execution.id)

    try {
      const result = await this.runLoop(agent, execution, input, delegationDepth)
      this.runningExecutions.delete(execution.id)
      return result
    } catch (error: any) {
      this.runningExecutions.delete(execution.id)
      this.agentRepo.updateExecutionStatus(execution.id, 'failed', undefined, error.message)
      this.emitEvent({
        executionId: execution.id,
        agentId,
        type: 'execution_failed',
        data: { error: error.message },
      })
      return {
        executionId: execution.id,
        agentId,
        status: 'failed',
        error: error.message,
        steps: this.agentRepo.getStepsForExecution(execution.id),
      }
    }
  }

  /**
   * Check if an execution is currently running.
   */
  isRunning(executionId: string): boolean {
    return this.runningExecutions.has(executionId)
  }

  /**
   * Cancel a running execution.
   */
  cancel(executionId: string): void {
    if (this.runningExecutions.has(executionId)) {
      this.runningExecutions.delete(executionId)
      this.agentRepo.updateExecutionStatus(executionId, 'cancelled')
    }
  }

  // ─── Core Execution Loop ──────────────────────────────────────

  private async runLoop(
    agent: AgentDefinition,
    execution: AgentExecution,
    input: string,
    delegationDepth: number
  ): Promise<ExecutionResult> {
    const settings = this.settingsRepo.get()
    const tools = this.toolRegistry.getToolsForAgent(agent)

    // Add delegate tool if agent has delegation permission
    let allTools = agent.skills.includes('delegate') ? [...tools, this.getDelegateToolDefinition(agent)] : [...tools]

    // Add MCP tools if agent has mcp_tools skill
    if (agent.skills.includes('mcp_tools') && this.mcpManager) {
      const allowed = agent.scope.mcpTools || []
      const permittedNames = new Set(
        this.mcpManager
          .getAllTools()
          .filter((tool) => allowed.some((item) => item.serverId === tool.serverId && item.name === tool.name))
          .map((tool) => `mcp_${tool.serverId.slice(0, 8)}_${tool.name}`)
      )
      const mcpTools = this.mcpManager.getToolDefinitions().filter((tool) => permittedNames.has(tool.name))
      allTools = [...allTools, ...mcpTools]
    }

    // Build the system prompt with agent persona
    const systemPrompt = this.buildSystemPrompt(agent)

    // Conversation messages for the loop
    const messages: ConversationMessage[] = [{ role: 'user', content: input }]

    let stepCount = 0

    while (stepCount < agent.maxSteps) {
      // Check if execution was cancelled
      if (!this.runningExecutions.has(execution.id)) {
        return {
          executionId: execution.id,
          agentId: agent.id,
          status: 'failed',
          error: 'Execution was cancelled',
          steps: this.agentRepo.getStepsForExecution(execution.id),
        }
      }

      // Call the LLM with tools
      const response = await this.aiProvider.invokeWithTools(
        systemPrompt,
        messages,
        allTools,
        settings,
        'agent_execution'
      )

      // If the response is complete (no tool calls), we're done
      if (response.isComplete) {
        const finalResult = response.text || ''
        this.agentRepo.updateExecutionStatus(execution.id, 'completed', finalResult)
        this.emitEvent({
          executionId: execution.id,
          agentId: agent.id,
          type: 'execution_completed',
          data: { result: finalResult },
        })

        return {
          executionId: execution.id,
          agentId: agent.id,
          status: 'completed',
          result: finalResult,
          steps: this.agentRepo.getStepsForExecution(execution.id),
        }
      }

      // Process tool calls
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: response.text || '',
        toolCalls: response.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      }
      messages.push(assistantMessage)

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        if (stepCount >= agent.maxSteps) break
        stepCount++

        // Record the step
        const step = this.agentRepo.addStep(execution.id, {
          skill: toolCall.name as AgentSkill,
          input: toolCall.arguments,
          reasoning: response.text || '',
          delegatedToAgentId: toolCall.name === 'delegate' ? toolCall.arguments.agentId : undefined,
        })

        this.emitEvent({
          executionId: execution.id,
          agentId: agent.id,
          type: 'step_started',
          data: { stepId: step.id, skill: toolCall.name, input: toolCall.arguments },
        })

        let toolResult: string

        try {
          const liveAgent = this.agentRepo.getById(agent.id)
          if (
            !liveAgent?.isActive ||
            JSON.stringify(liveAgent.skills) !== JSON.stringify(agent.skills) ||
            JSON.stringify(liveAgent.scope) !== JSON.stringify(agent.scope) ||
            JSON.stringify(liveAgent.canDelegate) !== JSON.stringify(agent.canDelegate) ||
            liveAgent.requiresApproval !== agent.requiresApproval
          ) {
            throw new Error('As permissões do agente mudaram. Execute novamente.')
          }
          if (!allTools.some((definition) => definition.name === toolCall.name)) {
            throw new Error('Ferramenta não autorizada para este agente.')
          }
          let prepared = toolCall
          if (toolCall.name === 'delegate') {
            this.toolRegistry.validateArguments(this.getDelegateToolDefinition(agent), toolCall.arguments)
            if (!agent.skills.includes('delegate') || !agent.canDelegate.includes(toolCall.arguments.agentId)) {
              throw new Error('Delegação não autorizada.')
            }
          } else if (toolCall.name.startsWith('mcp_')) {
            this.validateMCPToolCall(toolCall, liveAgent)
          } else {
            prepared = this.toolRegistry.prepareCall(toolCall, agent)
          }
          const requiresConfirmation =
            agent.requiresApproval ||
            ['create_task', 'update_task', 'create_entry', 'send_notification'].includes(toolCall.name) ||
            toolCall.name.startsWith('mcp_')
          const details =
            toolCall.name.startsWith('mcp_') || toolCall.name === 'delegate'
              ? { arguments: prepared.arguments }
              : this.toolRegistry.getApprovalDetails(prepared)
          if (requiresConfirmation) {
            const mcpTool = toolCall.name.startsWith('mcp_') ? this.validateMCPToolCall(toolCall, liveAgent) : null
            const origin = mcpTool ? `${agent.name} — ${mcpTool.serverName} (${mcpTool.serverId})` : agent.name
            if (!(await confirmAction(origin, mcpTool?.name || toolCall.name, details)))
              throw new Error('Ação recusada pelo usuário.')
            const currentAgent = this.agentRepo.getById(agent.id)
            if (
              !currentAgent?.isActive ||
              JSON.stringify(currentAgent.skills) !== JSON.stringify(agent.skills) ||
              JSON.stringify(currentAgent.scope) !== JSON.stringify(agent.scope) ||
              JSON.stringify(currentAgent.canDelegate) !== JSON.stringify(agent.canDelegate) ||
              currentAgent.requiresApproval !== agent.requiresApproval
            ) {
              throw new Error('As permissões do agente mudaram. Execute novamente.')
            }
            if (toolCall.name.startsWith('mcp_')) this.validateMCPToolCall(prepared, currentAgent)
            else if (toolCall.name !== 'delegate') {
              const refreshed = this.toolRegistry.prepareCall(prepared, currentAgent)
              if (JSON.stringify(this.toolRegistry.getApprovalDetails(refreshed)) !== JSON.stringify(details)) {
                throw new Error('Os dados mudaram após a confirmação. Execute novamente.')
              }
              prepared = refreshed
            }
          }
          if (!this.runningExecutions.has(execution.id)) throw new Error('Execução cancelada.')
          if (toolCall.name === 'delegate') {
            // Handle delegation to another agent
            toolResult = await this.handleDelegation(prepared, agent, delegationDepth)
          } else if (toolCall.name.startsWith('mcp_') && this.mcpManager) {
            // Handle MCP tool call — parse serverId and toolName from the namespaced name
            toolResult = await this.handleMCPToolCall(prepared, agent)
          } else {
            // Execute via tool registry
            const result = await this.toolRegistry.executeTool(prepared, agent)
            if (!result.success) throw new Error(result.error || 'Falha ao executar ferramenta.')
            toolResult = JSON.stringify(result.success ? result.result : { error: result.error })
          }

          this.agentRepo.completeStep(step.id, JSON.parse(toolResult || '{}'), 'completed')
        } catch (error: any) {
          toolResult = JSON.stringify({ error: error.message })
          this.agentRepo.completeStep(step.id, { error: error.message }, 'failed')
        }

        this.emitEvent({
          executionId: execution.id,
          agentId: agent.id,
          type: 'step_completed',
          data: { stepId: step.id, result: toolResult },
        })

        // Add tool result to conversation
        messages.push({
          role: 'tool',
          content: toolResult,
          toolCallId: toolCall.id,
        })
      }
    }

    // Max steps reached
    const maxStepsMessage = `Limite de ${agent.maxSteps} passos atingido. Execução encerrada.`
    this.agentRepo.updateExecutionStatus(execution.id, 'completed', maxStepsMessage)

    return {
      executionId: execution.id,
      agentId: agent.id,
      status: 'completed',
      result: maxStepsMessage,
      steps: this.agentRepo.getStepsForExecution(execution.id),
    }
  }

  // ─── Delegation ───────────────────────────────────────────────

  private async handleDelegation(
    toolCall: ToolCall,
    delegatingAgent: AgentDefinition,
    currentDepth: number
  ): Promise<string> {
    const { agentId, message } = toolCall.arguments

    if (!agentId || !message) {
      return JSON.stringify({ error: 'Delegação requer agentId e message.' })
    }

    // Check permission
    if (!delegatingAgent.canDelegate.includes(agentId)) {
      return JSON.stringify({
        error: `Agente "${delegatingAgent.name}" não tem permissão para delegar a "${agentId}".`,
      })
    }

    // Execute the target agent
    const result = await this.execute(agentId, message, {
      trigger: 'delegation',
      delegatedBy: delegatingAgent.id,
      delegationDepth: currentDepth + 1,
    })

    return JSON.stringify({
      success: result.status === 'completed',
      result: result.result,
      error: result.error,
      steps: result.steps.length,
    })
  }

  /**
   * Handle a tool call routed to an MCP server.
   * Tool names are formatted as: mcp_{serverId8chars}_{originalToolName}
   */
  private validateMCPToolCall(
    toolCall: ToolCall,
    agent: AgentDefinition
  ): { serverId: string; serverName: string; name: string } {
    if (!this.mcpManager) {
      throw new Error('MCP não disponível.')
    }
    const match = toolCall.name.match(/^mcp_([a-f0-9]{8})_(.+)$/)
    if (!match || !agent.skills.includes('mcp_tools')) throw new Error('Ferramenta MCP não autorizada.')
    const matches = this.mcpManager
      .getAllTools()
      .filter((item) => item.serverId.startsWith(match[1]) && item.name === match[2])
    if (matches.length !== 1) throw new Error('Ferramenta MCP não encontrada ou ambígua.')
    const mcpTool = matches[0]
    if (
      !(agent.scope.mcpTools || []).some((item) => item.serverId === mcpTool.serverId && item.name === mcpTool.name)
    ) {
      throw new Error('Ferramenta MCP não autorizada.')
    }
    this.mcpManager.validateToolArguments(mcpTool.serverId, mcpTool.name, toolCall.arguments)
    return mcpTool
  }

  private async handleMCPToolCall(toolCall: ToolCall, agent: AgentDefinition): Promise<string> {
    const mcpTool = this.validateMCPToolCall(toolCall, agent)
    const result = await this.mcpManager!.callTool(mcpTool.serverId, mcpTool.name, toolCall.arguments)
    if (!result.success) throw new Error(result.error || 'Falha ao executar ferramenta MCP.')
    return JSON.stringify(result.result)
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private buildSystemPrompt(agent: AgentDefinition): string {
    const baseInstructions = `Você é "${agent.name}", um agente de IA com as seguintes características:

${agent.persona}

## Instruções de comportamento:
- Use as ferramentas (tools) disponíveis para cumprir a tarefa do usuário.
- Analise os dados retornados pelas ferramentas antes de responder.
- Seja objetivo e direto nas respostas.
- Se precisar de mais informações, use as ferramentas de leitura primeiro.
- Quando terminar a tarefa, responda com o resultado final em texto.
- Responda sempre em português brasileiro.
- Não invente dados. Use apenas informações obtidas via ferramentas.`

    if (agent.skills.includes('delegate') && agent.canDelegate.length > 0) {
      const delegateList = agent.canDelegate
        .map((id) => {
          const target = this.agentRepo.getById(id)
          if (target) return `- "${target.name}" (id: ${id}): ${target.description}`
          return `- id: ${id}`
        })
        .join('\n')

      return (
        baseInstructions +
        `\n\n## Delegação:\nVocê pode delegar tarefas para outros agentes usando a tool "delegate". Passe o ID e uma instrução clara.\n\nEquipe disponível:\n${delegateList}`
      )
    }

    return baseInstructions
  }

  private getDelegateToolDefinition(agent: AgentDefinition): ToolDefinition {
    // Build a descriptive list of delegatable agents with their names
    const agentDescriptions = agent.canDelegate
      .map((id) => {
        const target = this.agentRepo.getById(id)
        return target ? `"${target.name}" (id: ${id})` : id
      })
      .join(', ')

    return {
      name: 'delegate',
      description: `Delega uma tarefa para outro agente da equipe. Agentes disponíveis: ${agentDescriptions}`,
      parameters: {
        agentId: { type: 'string', description: 'ID do agente para delegar a tarefa', required: true },
        message: {
          type: 'string',
          description:
            'Instrução/tarefa para o agente delegado. Seja específico sobre o que você quer que ele analise.',
          required: true,
        },
      },
      requiredParams: ['agentId', 'message'],
    }
  }

  /**
   * Emit an event to the renderer for real-time UI updates.
   */
  private emitEvent(event: AgentExecutionEvent): void {
    try {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('agent:execution-event', event)
        }
      }
    } catch {
      // Non-fatal: UI notification failed
    }
  }
}
