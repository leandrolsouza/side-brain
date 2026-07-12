import {
  AgentDefinition,
  AgentExecution,
  AgentExecutionEvent,
  AgentSkill,
  AgentStep,
  AgentTriggerType,
  ToolCall,
  ToolDefinition,
} from '../../shared/types'
import { AgentRepository } from '../database/repositories/agent-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIProvider, AIToolResponse } from './ai-provider'
import { AgentToolRegistry } from './agent-tool-registry'
import { MCPManager } from './mcp-manager'
import { BrowserWindow } from 'electron'

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
  ) { }

  /**
   * Execute an agent with a given input/goal.
   * This is the main entry point for running an agent.
   */
  async execute(
    agentId: string,
    input: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
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
    let allTools = agent.skills.includes('delegate')
      ? [...tools, this.getDelegateToolDefinition(agent)]
      : [...tools]

    // Add MCP tools if agent has mcp_tools skill
    if (agent.skills.includes('mcp_tools') && this.mcpManager) {
      const mcpTools = this.mcpManager.getToolDefinitions()
      allTools = [...allTools, ...mcpTools]
    }

    // Build the system prompt with agent persona
    const systemPrompt = this.buildSystemPrompt(agent)

    // Conversation messages for the loop
    const messages: ConversationMessage[] = [
      { role: 'user', content: input },
    ]

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
          if (toolCall.name === 'delegate') {
            // Handle delegation to another agent
            toolResult = await this.handleDelegation(toolCall, agent, delegationDepth)
          } else if (toolCall.name.startsWith('mcp_') && this.mcpManager) {
            // Handle MCP tool call — parse serverId and toolName from the namespaced name
            toolResult = await this.handleMCPToolCall(toolCall)
          } else {
            // Execute via tool registry
            const result = await this.toolRegistry.executeTool(toolCall, agent)
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
      return JSON.stringify({ error: `Agente "${delegatingAgent.name}" não tem permissão para delegar a "${agentId}".` })
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
  private async handleMCPToolCall(toolCall: ToolCall): Promise<string> {
    if (!this.mcpManager) {
      return JSON.stringify({ error: 'MCP not available' })
    }

    // Parse the namespaced tool name: mcp_{serverId8}_{toolName}
    const match = toolCall.name.match(/^mcp_([a-f0-9]{8})_(.+)$/)
    if (!match) {
      return JSON.stringify({ error: `Invalid MCP tool name format: ${toolCall.name}` })
    }

    const serverIdPrefix = match[1]
    const toolName = match[2]

    // Find the server by prefix
    const allTools = this.mcpManager.getAllTools()
    const mcpTool = allTools.find((t) => t.serverId.startsWith(serverIdPrefix) && t.name === toolName)

    if (!mcpTool) {
      return JSON.stringify({ error: `MCP tool "${toolName}" not found` })
    }

    const result = await this.mcpManager.callTool(mcpTool.serverId, toolName, toolCall.arguments)
    return JSON.stringify(result.success ? result.result : { error: result.error })
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
      const delegateList = agent.canDelegate.map((id) => {
        const target = this.agentRepo.getById(id)
        if (target) return `- "${target.name}" (id: ${id}): ${target.description}`
        return `- id: ${id}`
      }).join('\n')

      return baseInstructions + `\n\n## Delegação:\nVocê pode delegar tarefas para outros agentes usando a tool "delegate". Passe o ID e uma instrução clara.\n\nEquipe disponível:\n${delegateList}`
    }

    return baseInstructions
  }

  private getDelegateToolDefinition(agent: AgentDefinition): ToolDefinition {
    // Build a descriptive list of delegatable agents with their names
    const agentDescriptions = agent.canDelegate.map((id) => {
      const target = this.agentRepo.getById(id)
      return target ? `"${target.name}" (id: ${id})` : id
    }).join(', ')

    return {
      name: 'delegate',
      description: `Delega uma tarefa para outro agente da equipe. Agentes disponíveis: ${agentDescriptions}`,
      parameters: {
        agentId: { type: 'string', description: 'ID do agente para delegar a tarefa', required: true },
        message: { type: 'string', description: 'Instrução/tarefa para o agente delegado. Seja específico sobre o que você quer que ele analise.', required: true },
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
