import { v4 as uuid } from 'uuid'
import type { AIOperationType, AppSettings, ToolCall, ToolDefinition } from '../../../shared/types'
import { invalidProviderResponseError, logProviderHttpError, postProviderRequest, type UsageTracker } from './shared'
import type { AIToolResponse, ChatMessage, ProviderAdapter } from './types'

/** Per-request configuration resolved from settings by each concrete adapter. */
export interface OpenAICompatibleConfig {
  /** Chat completions endpoint URL */
  url: string
  /** Model sent in the request body (undefined lets local servers pick their loaded model) */
  bodyModel: string | undefined
  /** Model name used for usage tracking and error context */
  trackingModel: string
  /** Request headers (Content-Type + auth when applicable) */
  headers: Record<string, string>
  /** Provider identifier used in error-service context, e.g. 'openai' */
  provider: string
  /** Label used in error messages, e.g. 'OpenAI API error (...)' */
  errorLabel: string
  /** Context attached to HTTP error-service entries (provider + model or endpoint) */
  httpErrorContext: Record<string, unknown>
  /** Localized message logged when the provider returns no usable content */
  invalidResponseMessage: string
  /** Whether HTTP 429 should be logged as a warning instead of an error */
  treat429AsWarning: boolean
  /** Whether simple invocations record zero cost (local providers) */
  zeroCostInvoke: boolean
}

/**
 * Base adapter for providers exposing an OpenAI-compatible Chat Completions API
 * (OpenAI, Grok/xAI, and local servers such as LM Studio, Ollama, LocalAI).
 * Concrete adapters only supply configuration via getConfig().
 */
export abstract class OpenAICompatibleAdapter implements ProviderAdapter {
  constructor(protected usage: UsageTracker) {}

  protected abstract getConfig(settings: AppSettings): OpenAICompatibleConfig

  async invoke(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<string> {
    const config = this.getConfig(settings)

    const body = {
      model: config.bodyModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }

    const { data, latencyMs } = await postProviderRequest({
      url: config.url,
      headers: config.headers,
      body,
      errorLabel: config.errorLabel,
      onHttpError: (status, errorText, error) =>
        logProviderHttpError({
          errorLabel: config.errorLabel,
          status,
          errorText,
          error,
          operationType,
          context: config.httpErrorContext,
          treat429AsWarning: config.treat429AsWarning,
        }),
    })

    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0

    if (config.zeroCostInvoke) {
      this.usage.recordFree(inputTokens, outputTokens, config.trackingModel, operationType, latencyMs)
    } else {
      this.usage.recordTokens(inputTokens, outputTokens, config.trackingModel, operationType, latencyMs)
    }

    const choice = data.choices?.[0]
    if (!choice?.message?.content) {
      throw invalidProviderResponseError({
        errorLabel: config.errorLabel,
        localizedMessage: config.invalidResponseMessage,
        context: { provider: config.provider, operationType, model: config.trackingModel },
      })
    }

    return choice.message.content
  }

  async invokeWithTools(
    systemPrompt: string,
    messages: ChatMessage[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<AIToolResponse> {
    const config = this.getConfig(settings)

    const body: any = {
      model: config.bodyModel,
      messages: buildOpenAIMessages(systemPrompt, messages),
      temperature: 0.3,
      max_tokens: 4096,
    }

    const openAITools = buildOpenAITools(tools)
    if (openAITools.length > 0) {
      body.tools = openAITools
      body.tool_choice = 'auto'
    }

    const { data, latencyMs } = await postProviderRequest({
      url: config.url,
      headers: config.headers,
      body,
      errorLabel: config.errorLabel,
    })

    this.usage.record(data.usage, config.trackingModel, operationType, latencyMs)

    return parseOpenAIToolResponse(data)
  }
}

// ─── Helpers: OpenAI-format messages, tools, and parsing ─────────

export function buildOpenAIMessages(systemPrompt: string, messages: ChatMessage[]): any[] {
  const result: any[] = [{ role: 'system', content: systemPrompt }]

  for (const msg of messages) {
    if (msg.role === 'tool') {
      result.push({ role: 'tool', content: msg.content, tool_call_id: msg.toolCallId })
    } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      result.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls,
      })
    } else {
      result.push({ role: msg.role, content: msg.content })
    }
  }

  return result
}

export function buildOpenAITools(tools: ToolDefinition[]): any[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
            },
          ])
        ),
        required: tool.requiredParams,
      },
    },
  }))
}

export function parseOpenAIToolResponse(data: any): AIToolResponse {
  const choice = data.choices?.[0]
  if (!choice) {
    return { text: null, toolCalls: [], isComplete: true }
  }

  const message = choice.message
  const toolCalls: ToolCall[] = (message.tool_calls || []).map((tc: any) => ({
    id: tc.id || uuid(),
    name: tc.function.name,
    arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments,
  }))

  if (toolCalls.length > 0) {
    return { text: message.content || null, toolCalls, isComplete: false }
  }

  return { text: message.content || '', toolCalls: [], isComplete: true }
}
