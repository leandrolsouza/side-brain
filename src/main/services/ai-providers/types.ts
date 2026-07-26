import type { AIOperationType, AppSettings, ToolCall, ToolDefinition } from '../../../shared/types'

/**
 * Response from an AI invocation with tool support.
 * Either contains a text response (final answer) or tool calls (needs further processing).
 */
export interface AIToolResponse {
  /** Final text response (if no tool calls) */
  text: string | null
  /** Tool calls requested by the AI */
  toolCalls: ToolCall[]
  /** Whether this response terminates the conversation (text with no tool calls) */
  isComplete: boolean
}

/** Conversation message exchanged with the AI (user/assistant/tool roles). */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: any[]
}

/**
 * Common contract implemented by every AI provider adapter.
 * Adapters own request building, HTTP calls, response parsing, and usage tracking.
 */
export interface ProviderAdapter {
  /** Simple system + user prompt invocation returning plain text. */
  invoke(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<string>

  /** Invocation with function/tool calling support for multi-step agent loops. */
  invokeWithTools(
    systemPrompt: string,
    messages: ChatMessage[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<AIToolResponse>
}
