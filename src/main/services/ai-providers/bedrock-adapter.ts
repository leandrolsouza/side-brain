import { v4 as uuid } from 'uuid'
import type { AIOperationType, AppSettings, ToolCall, ToolDefinition } from '../../../shared/types'
import { logProviderHttpError, postProviderRequest, type UsageTracker } from './shared'
import type { AIToolResponse, ChatMessage, ProviderAdapter } from './types'

/** Calls the Bedrock Converse API using the API Key (Bearer Token). */
export class BedrockAdapter implements ProviderAdapter {
  constructor(private usage: UsageTracker) {}

  async invoke(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<string> {
    const url = this.buildUrl(settings)

    const body = {
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: userMessage }] }],
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.3,
      },
    }

    const { data, latencyMs } = await postProviderRequest({
      url,
      headers: this.buildHeaders(settings),
      body,
      errorLabel: 'Bedrock',
      onHttpError: (status, errorText, error) =>
        logProviderHttpError({
          errorLabel: 'Bedrock',
          status,
          errorText,
          error,
          operationType,
          context: { provider: 'bedrock', model: settings.modelId, region: settings.awsRegion },
          treat429AsWarning: true,
        }),
    })

    const inputTokens = data.usage?.inputTokens ?? 0
    const outputTokens = data.usage?.outputTokens ?? 0
    this.usage.recordTokens(inputTokens, outputTokens, settings.modelId, operationType, latencyMs)

    return data.output.message.content[0].text
  }

  async invokeWithTools(
    systemPrompt: string,
    messages: ChatMessage[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<AIToolResponse> {
    const url = this.buildUrl(settings)

    const bedrockToolConfig = buildBedrockToolConfig(tools)

    const body: any = {
      system: [{ text: systemPrompt }],
      messages: buildBedrockMessages(messages),
      inferenceConfig: { maxTokens: 4096, temperature: 0.3 },
    }

    if (bedrockToolConfig.tools.length > 0) {
      body.toolConfig = bedrockToolConfig
    }

    const { data, latencyMs } = await postProviderRequest({
      url,
      headers: this.buildHeaders(settings),
      body,
      errorLabel: 'Bedrock',
    })

    const inputTokens = data.usage?.inputTokens ?? 0
    const outputTokens = data.usage?.outputTokens ?? 0
    this.usage.recordTokens(inputTokens, outputTokens, settings.modelId, operationType, latencyMs)

    return parseBedrockToolResponse(data)
  }

  private buildUrl(settings: AppSettings): string {
    const baseUrl = `https://bedrock-runtime.${settings.awsRegion}.amazonaws.com`
    return `${baseUrl}/model/${settings.modelId}/converse`
  }

  private buildHeaders(settings: AppSettings): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.bedrockApiKey}`,
    }
  }
}

// ─── Helpers: Bedrock Converse-format messages, tools, and parsing ─

function buildBedrockMessages(messages: ChatMessage[]): any[] {
  const result: any[] = []

  let i = 0
  while (i < messages.length) {
    const msg = messages[i]

    if (msg.role === 'user') {
      result.push({ role: 'user', content: [{ text: msg.content }] })
      i++
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const content: any[] = []
        if (msg.content) content.push({ text: msg.content })
        for (const tc of msg.toolCalls) {
          content.push({
            toolUse: {
              toolUseId: tc.id || tc.function?.name || uuid(),
              name: tc.function?.name || tc.name,
              input:
                typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.arguments || {},
            },
          })
        }
        result.push({ role: 'assistant', content })
      } else {
        result.push({ role: 'assistant', content: [{ text: msg.content || '' }] })
      }
      i++
    } else if (msg.role === 'tool') {
      // Bedrock requires ALL tool results for a given assistant turn to be in a SINGLE user message.
      // Collect consecutive tool messages into one user message with multiple toolResult blocks.
      const toolResultBlocks: any[] = []
      while (i < messages.length && messages[i].role === 'tool') {
        toolResultBlocks.push({
          toolResult: {
            toolUseId: messages[i].toolCallId || uuid(),
            content: [{ text: messages[i].content }],
          },
        })
        i++
      }
      result.push({ role: 'user', content: toolResultBlocks })
    } else {
      i++
    }
  }

  return result
}

function buildBedrockToolConfig(tools: ToolDefinition[]): { tools: any[] } {
  return {
    tools: tools.map((tool) => ({
      toolSpec: {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          json: {
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
      },
    })),
  }
}

function parseBedrockToolResponse(data: any): AIToolResponse {
  const content = data.output?.message?.content
  if (!content || !Array.isArray(content)) {
    return { text: null, toolCalls: [], isComplete: true }
  }

  const toolCalls: ToolCall[] = []
  let text = ''

  for (const block of content) {
    if (block.toolUse) {
      toolCalls.push({
        id: block.toolUse.toolUseId || uuid(),
        name: block.toolUse.name,
        arguments: block.toolUse.input || {},
      })
    } else if (block.text) {
      text += block.text
    }
  }

  if (toolCalls.length > 0) {
    return { text: text || null, toolCalls, isComplete: false }
  }

  return { text: text || '', toolCalls: [], isComplete: true }
}
