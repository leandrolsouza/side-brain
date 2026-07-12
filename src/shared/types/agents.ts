// === Agent Studio Types ===

/**
 * Skills available to agents. Each skill maps to a tool with a specific capability.
 * Skills act as permissions — an agent can only use tools corresponding to its assigned skills.
 */
export type AgentSkill =
  | 'read_entries'
  | 'read_tasks'
  | 'read_projects'
  | 'read_meetings'
  | 'create_task'
  | 'update_task'
  | 'create_entry'
  | 'generate_summary'
  | 'generate_report'
  | 'search_semantic'
  | 'discover_connections'
  | 'send_notification'
  | 'delegate'
  | 'mcp_tools'

/**
 * Trigger types that define when an agent activates autonomously.
 */
export type AgentTriggerType = 'manual' | 'schedule' | 'event' | 'delegation'

export interface AgentScheduleConfig {
  /** Cron-like expression: 'daily:09:00', 'weekly:mon:09:00', 'hourly' */
  expression: string
}

export interface AgentEventConfig {
  /** Event name that triggers the agent */
  eventName: 'entry_created' | 'task_status_changed' | 'meeting_ended' | 'daily_digest'
  /** Optional filter (e.g., only for specific projects) */
  filter?: Record<string, string>
}

export interface AgentTrigger {
  type: AgentTriggerType
  scheduleConfig?: AgentScheduleConfig
  eventConfig?: AgentEventConfig
}

/**
 * Scope defines what data the agent can access.
 */
export interface AgentScope {
  /** Which project IDs the agent can access, or 'all' for unrestricted */
  projectIds: string[] | 'all'
  /** Optional date range filter for entries/tasks */
  dateRange?: { from: string; to: string }
  /** Optional filter by entry types */
  entryTypes?: string[]
}

/**
 * The definition of a custom agent created by the user.
 */
export interface AgentDefinition {
  id: string
  name: string
  description: string
  /** System prompt that defines personality, behavior, and constraints */
  persona: string
  /** Avatar icon name (from lucide-react) */
  icon: string
  /** Display color */
  color: string
  /** Skills/tools this agent can use */
  skills: AgentSkill[]
  /** Data access scope */
  scope: AgentScope
  /** When the agent triggers automatically */
  triggers: AgentTrigger[]
  /** IDs of other agents this agent can delegate to */
  canDelegate: string[]
  /** Maximum steps in a single execution loop (safety limit) */
  maxSteps: number
  /** Whether the agent is active */
  isActive: boolean
  /** Whether actions require user approval before execution */
  requiresApproval: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Status of an agent execution.
 */
export type AgentExecutionStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'awaiting_approval'
  | 'cancelled'

/**
 * Represents a single step in an agent execution (one tool call).
 */
export interface AgentStep {
  id: string
  executionId: string
  stepNumber: number
  /** The skill/tool that was invoked */
  skill: AgentSkill
  /** Input arguments passed to the tool */
  input: Record<string, any>
  /** Output/result from the tool */
  output: Record<string, any> | null
  /** The agent's reasoning for this step */
  reasoning: string
  /** If this step delegated to another agent */
  delegatedToAgentId?: string
  /** Status of this individual step */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'approved' | 'rejected'
  createdAt: string
  completedAt?: string
}

/**
 * A complete execution run of an agent.
 */
export interface AgentExecution {
  id: string
  agentId: string
  /** What triggered this execution */
  trigger: AgentTriggerType
  /** The user's input/goal that started the execution */
  input: string
  /** If this execution was delegated by another agent */
  delegatedByAgentId?: string
  /** The steps taken during this execution */
  steps: AgentStep[]
  /** Current status */
  status: AgentExecutionStatus
  /** Final output/response */
  result?: string
  /** Error message if failed */
  error?: string
  createdAt: string
  completedAt?: string
}

/**
 * Lightweight execution summary for listing.
 */
export interface AgentExecutionSummary {
  id: string
  agentId: string
  agentName: string
  trigger: AgentTriggerType
  input: string
  status: AgentExecutionStatus
  stepCount: number
  result?: string
  createdAt: string
  completedAt?: string
}

// === Tool Definition Types (used by ToolRegistry) ===

/**
 * JSON Schema-like definition for tool parameters.
 */
export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required?: boolean
  enum?: string[]
  items?: ToolParameterSchema
  properties?: Record<string, ToolParameterSchema>
}

/**
 * A tool definition that the AI can invoke via function calling.
 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, ToolParameterSchema>
  requiredParams: string[]
}

/**
 * A tool call made by the AI during agent execution.
 */
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

/**
 * Result of a tool call execution.
 */
export interface ToolCallResult {
  toolCallId: string
  success: boolean
  result: any
  error?: string
}

/**
 * Agent template for quick setup.
 */
export interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: string
  color: string
  persona: string
  skills: AgentSkill[]
  scope: AgentScope
  triggers: AgentTrigger[]
  maxSteps: number
  requiresApproval: boolean
}

// === IPC Event Types ===

export interface AgentExecutionEvent {
  executionId: string
  agentId: string
  type: 'step_started' | 'step_completed' | 'execution_completed' | 'execution_failed' | 'approval_needed'
  data?: any
}

// === Agent Team Types ===

/**
 * Collaboration mode for a team discussion.
 * - 'sequential': Each agent runs in order, seeing all previous responses
 * - 'parallel': All agents run independently, then a synthesis is generated
 */
export type TeamCollaborationMode = 'sequential' | 'parallel'

/**
 * A team is a group of agents that collaborate on a topic.
 */
export interface AgentTeam {
  id: string
  name: string
  description: string
  /** Ordered list of agent IDs in this team */
  memberIds: string[]
  /** How agents collaborate */
  collaborationMode: TeamCollaborationMode
  /** Whether to generate a synthesis at the end */
  generateSynthesis: boolean
  /** Custom synthesis instructions (optional) */
  synthesisPrompt?: string
  createdAt: string
  updatedAt: string
}

/**
 * Status of a team execution.
 */
export type TeamExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * One agent's contribution in a team discussion.
 */
export interface TeamDiscussionEntry {
  agentId: string
  agentName: string
  agentIcon: string
  agentColor: string
  /** The response from this agent */
  response: string
  /** How long it took (ms) */
  durationMs: number
  /** Whether this agent's run succeeded */
  status: 'completed' | 'failed'
  error?: string
}

/**
 * A complete team execution (discussion).
 */
export interface TeamExecution {
  id: string
  teamId: string
  /** The input/topic for the discussion */
  input: string
  /** Individual agent contributions */
  entries: TeamDiscussionEntry[]
  /** AI-generated synthesis of all contributions */
  synthesis?: string
  /** Overall status */
  status: TeamExecutionStatus
  createdAt: string
  completedAt?: string
}

/**
 * Lightweight summary for listing team executions.
 */
export interface TeamExecutionSummary {
  id: string
  teamId: string
  teamName: string
  input: string
  status: TeamExecutionStatus
  memberCount: number
  createdAt: string
  completedAt?: string
}
