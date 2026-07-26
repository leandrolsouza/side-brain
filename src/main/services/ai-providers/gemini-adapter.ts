import { v4 as uuid } from 'uuid'
import type { AIOperationType, AppSettings, ToolCall, ToolDefinition } from '../../../shared/types'
import { invalidProviderResponseError, logProviderHttpError, postProviderRequest, type UsageTracker } from './shared'
import type { AIToolResponse, ChatMessage, ProviderAdapter } from './types'

/** Calls the Google Gemini API (generateContent endpoint). */
export class GeminiAdapter implements ProviderAdapter {
  constructor(private usage: UsageTracker) {}

  async invoke(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<string> {
    const model = settings.geminiModelId || 'gemini-3.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`

    const body = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }

    const { data, latencyMs } = await postProviderRequest({
      url,
      headers: { 'Content-Type': 'application/json' },
      body,
      errorLabel: 'Gemini',
      onHttpError: (status, errorText, error) =>
        logProviderHttpError({
          errorLabel: 'Gemini',
          status,
          errorText,
          error,
          operationType,
          context: { provider: 'gemini', model },
          treat429AsWarning: true,
        }),
    })

    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0
    this.usage.recordTokens(inputTokens, outputTokens, model, operationType, latencyMs)

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      throw invalidProviderResponseError({
        errorLabel: 'Gemini',
        localizedMessage: 'Gemini retornou resposta inválida',
        context: { provider: 'gemini', operationType, model },
      })
    }

    return content
  }

  async invokeWithTools(
    systemPrompt: string,
    messages: ChatMessage[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<AIToolResponse> {
    const model = settings.geminiModelId || 'gemini-3.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`

    const geminiTools = buildGeminiTools(tools)

    const body: any = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: buildGeminiContents(messages),
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }

    if (geminiTools.length > 0) {
      body.tools = [{ functionDeclarations: geminiTools }]
    }

    const { data, latencyMs } = await postProviderRequest({
      url,
      headers: { 'Content-Type': 'application/json' },
      body,
      errorLabel: 'Gemini',
    })

    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0
    this.usage.recordTokens(inputTokens, outputTokens, model, operationType, latencyMs)

    return parseGeminiToolResponse(data)
  }
}

// ─── Helpers: Gemini-format contents, tools, and parsing ─────────

function buildGeminiContents(messages: ChatMessage[]): any[] {
  const contents: any[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] })
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const parts: any[] = msg.toolCalls.map((tc: any) => ({
          functionCall: {
            name: tc.function?.name || tc.name,
            args: typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.arguments || {},
          },
        }))
        if (msg.content) parts.unshift({ text: msg.content })
        contents.push({ role: 'model', parts })
      } else {
        contents.push({ role: 'model', parts: [{ text: msg.content }] })
      }
    } else if (msg.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: msg.toolCallId || 'tool', response: { result: msg.content } } }],
      })
    }
  }

  return contents
}

function buildGeminiTools(tools: ToolDefinition[]): any[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, param]) => [
          key,
          {
            type: param.type.toUpperCase(),
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
          },
        ])
      ),
      required: tool.requiredParams,
    },
  }))
}

function parseGeminiToolResponse(data: any): AIToolResponse {
  const candidate = data.candidates?.[0]
  if (!candidate?.content?.parts) {
    return { text: null, toolCalls: [], isComplete: true }
  }

  const parts = candidate.content.parts
  const toolCalls: ToolCall[] = []
  let text = ''

  for (const part of parts) {
    if (part.functionCall) {
      toolCalls.push({
        id: uuid(),
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      })
    } else if (part.text) {
      text += part.text
    }
  }

  if (toolCalls.length > 0) {
    return { text: text || null, toolCalls, isComplete: false }
  }

  return { text: text || '', toolCalls: [], isComplete: true }
}
