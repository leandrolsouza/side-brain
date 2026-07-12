import type { AIOperationType, AppSettings, ToolDefinition, ToolCall } from '../../shared/types'
import { net } from 'electron'
import { AIUsageRepository } from '../database/repositories/ai-usage-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { getErrorService } from './error-service'
import { v4 as uuid } from 'uuid'

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

/**
 * Handles low-level AI provider communication.
 * Supports: Bedrock, OpenAI, Gemini, Grok, and Local LLM.
 * Responsible for HTTP calls, error handling, and usage tracking.
 */
export class AIProvider {
  constructor(
    private aiUsageRepo: AIUsageRepository,
    private settingsRepo: SettingsRepository
  ) { }

  /**
   * Routes to the appropriate provider based on settings and invokes the AI.
   */
  async invoke(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType = 'categorization'
  ): Promise<string> {
    try {
      switch (settings.aiProvider) {
        case 'openai':
          return await this.invokeOpenAI(systemPrompt, userMessage, settings, operationType)
        case 'gemini':
          return await this.invokeGemini(systemPrompt, userMessage, settings, operationType)
        case 'grok':
          return await this.invokeGrok(systemPrompt, userMessage, settings, operationType)
        case 'local':
          return await this.invokeLocal(systemPrompt, userMessage, settings, operationType)
        case 'bedrock':
        default:
          return await this.invokeBedrock(systemPrompt, userMessage, settings, operationType)
      }
    } catch (error: any) {
      // Log network-level errors (fetch failures, DNS, timeout) that aren't already logged
      if (error?.message && !error.message.includes('API error')) {
        getErrorService().logError({
          category: 'ai',
          severity: 'error',
          message: error.message,
          stack: error.stack,
          context: { provider: settings.aiProvider, operationType, type: 'network_or_parse' },
        })
      }
      throw error
    }
  }

  /**
   * Invokes the AI with function/tool calling support.
   * Used by the Agent Runtime for multi-step tool use loops.
   *
   * @param systemPrompt - System instructions for the AI
   * @param messages - Conversation history (user/assistant/tool messages)
   * @param tools - Available tool definitions
   * @param settings - App settings with provider config
   * @param operationType - For usage tracking
   * @returns AIToolResponse with either text (final) or tool calls (needs execution)
   */
  async invokeWithTools(
    systemPrompt: string,
    messages: { role: 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string; toolCalls?: any[] }[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType = 'smart_chat'
  ): Promise<AIToolResponse> {
    try {
      switch (settings.aiProvider) {
        case 'openai':
          return await this.invokeOpenAIWithTools(systemPrompt, messages, tools, settings, operationType)
        case 'gemini':
          return await this.invokeGeminiWithTools(systemPrompt, messages, tools, settings, operationType)
        case 'grok':
          return await this.invokeGrokWithTools(systemPrompt, messages, tools, settings, operationType)
        case 'local':
          return await this.invokeLocalWithTools(systemPrompt, messages, tools, settings, operationType)
        case 'bedrock':
        default:
          return await this.invokeBedrockWithTools(systemPrompt, messages, tools, settings, operationType)
      }
    } catch (error: any) {
      if (error?.message && !error.message.includes('API error')) {
        getErrorService().logError({
          category: 'ai',
          severity: 'error',
          message: error.message,
          stack: error.stack,
          context: { provider: settings.aiProvider, operationType, type: 'tool_calling_error' },
        })
      }
      throw error
    }
  }

  // ─── Tool Calling: OpenAI-compatible format ───────────────────

  private async invokeOpenAIWithTools(
    systemPrompt: string,
    messages: { role: string; content: string; toolCallId?: string; toolCalls?: any[] }[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<AIToolResponse> {
    const url = 'https://api.openai.com/v1/chat/completions'
    const model = settings.openaiModelId || 'gpt-4.1'

    const openAIMessages = this.buildOpenAIMessages(systemPrompt, messages)
    const openAITools = this.buildOpenAITools(tools)

    const body: any = {
      model,
      messages: openAIMessages,
      temperature: 0.3,
      max_tokens: 4096,
    }

    if (openAITools.length > 0) {
      body.tools = openAITools
      body.tool_choice = 'auto'
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    this.recordUsage(data.usage, model, operationType, Date.now() - startTime)

    return this.parseOpenAIToolResponse(data)
  }

  private async invokeGrokWithTools(
    systemPrompt: string,
    messages: { role: string; content: string; toolCallId?: string; toolCalls?: any[] }[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<AIToolResponse> {
    const url = 'https://api.x.ai/v1/chat/completions'
    const model = settings.grokModelId || 'grok-4.3-latest'

    const openAIMessages = this.buildOpenAIMessages(systemPrompt, messages)
    const openAITools = this.buildOpenAITools(tools)

    const body: any = {
      model,
      messages: openAIMessages,
      temperature: 0.3,
      max_tokens: 4096,
    }

    if (openAITools.length > 0) {
      body.tools = openAITools
      body.tool_choice = 'auto'
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.grokApiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Grok API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    this.recordUsage(data.usage, model, operationType, Date.now() - startTime)

    return this.parseOpenAIToolResponse(data)
  }

  private async invokeLocalWithTools(
    systemPrompt: string,
    messages: { role: string; content: string; toolCallId?: string; toolCalls?: any[] }[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<AIToolResponse> {
    const baseUrl = (settings.localEndpoint || 'http://localhost:1234').replace(/\/+$/, '')
    const url = `${baseUrl}/v1/chat/completions`
    const model = settings.localModelId || 'local'

    const openAIMessages = this.buildOpenAIMessages(systemPrompt, messages)
    const openAITools = this.buildOpenAITools(tools)

    const body: any = {
      model: settings.localModelId || undefined,
      messages: openAIMessages,
      temperature: 0.3,
      max_tokens: 4096,
    }

    // Only include tools if the local provider likely supports them
    if (openAITools.length > 0) {
      body.tools = openAITools
      body.tool_choice = 'auto'
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (settings.localApiKey) {
      headers['Authorization'] = `Bearer ${settings.localApiKey}`
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Local LLM API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    this.recordUsage(data.usage, model, operationType, Date.now() - startTime)

    return this.parseOpenAIToolResponse(data)
  }

  // ─── Tool Calling: Gemini format ─────────────────────────────

  private async invokeGeminiWithTools(
    systemPrompt: string,
    messages: { role: string; content: string; toolCallId?: string; toolCalls?: any[] }[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<AIToolResponse> {
    const model = settings.geminiModelId || 'gemini-3.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`

    const geminiContents = this.buildGeminiContents(messages)
    const geminiTools = this.buildGeminiTools(tools)

    const body: any = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }

    if (geminiTools.length > 0) {
      body.tools = [{ functionDeclarations: geminiTools }]
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0
    this.recordUsage({ prompt_tokens: inputTokens, completion_tokens: outputTokens }, model, operationType, latencyMs)

    return this.parseGeminiToolResponse(data)
  }

  // ─── Tool Calling: Bedrock Converse format ────────────────────

  private async invokeBedrockWithTools(
    systemPrompt: string,
    messages: { role: string; content: string; toolCallId?: string; toolCalls?: any[] }[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<AIToolResponse> {
    const baseUrl = `https://bedrock-runtime.${settings.awsRegion}.amazonaws.com`
    const url = `${baseUrl}/model/${settings.modelId}/converse`

    const bedrockMessages = this.buildBedrockMessages(messages)
    const bedrockToolConfig = this.buildBedrockToolConfig(tools)

    const body: any = {
      system: [{ text: systemPrompt }],
      messages: bedrockMessages,
      inferenceConfig: { maxTokens: 4096, temperature: 0.3 },
    }

    if (bedrockToolConfig.tools.length > 0) {
      body.toolConfig = bedrockToolConfig
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.bedrockApiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Bedrock API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const inputTokens = data.usage?.inputTokens ?? 0
    const outputTokens = data.usage?.outputTokens ?? 0
    this.recordUsage({ prompt_tokens: inputTokens, completion_tokens: outputTokens }, settings.modelId, operationType, latencyMs)

    return this.parseBedrockToolResponse(data)
  }

  // ─── Helper: Build OpenAI-format messages ─────────────────────

  private buildOpenAIMessages(systemPrompt: string, messages: { role: string; content: string; toolCallId?: string; toolCalls?: any[] }[]): any[] {
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

  private buildOpenAITools(tools: ToolDefinition[]): any[] {
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

  private parseOpenAIToolResponse(data: any): AIToolResponse {
    const choice = data.choices?.[0]
    if (!choice) {
      return { text: null, toolCalls: [], isComplete: true }
    }

    const message = choice.message
    const toolCalls: ToolCall[] = (message.tool_calls || []).map((tc: any) => ({
      id: tc.id || uuid(),
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments,
    }))

    if (toolCalls.length > 0) {
      return { text: message.content || null, toolCalls, isComplete: false }
    }

    return { text: message.content || '', toolCalls: [], isComplete: true }
  }

  // ─── Helper: Build Gemini-format contents ─────────────────────

  private buildGeminiContents(messages: { role: string; content: string; toolCallId?: string; toolCalls?: any[] }[]): any[] {
    const contents: any[] = []

    for (const msg of messages) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] })
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const parts: any[] = msg.toolCalls.map((tc: any) => ({
            functionCall: { name: tc.function?.name || tc.name, args: typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.arguments || {} },
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

  private buildGeminiTools(tools: ToolDefinition[]): any[] {
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

  private parseGeminiToolResponse(data: any): AIToolResponse {
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

  // ─── Helper: Build Bedrock Converse-format messages ───────────

  private buildBedrockMessages(messages: { role: string; content: string; toolCallId?: string; toolCalls?: any[] }[]): any[] {
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
                input: typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.arguments || {},
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

  private buildBedrockToolConfig(tools: ToolDefinition[]): { tools: any[] } {
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

  private parseBedrockToolResponse(data: any): AIToolResponse {
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

  // ─── Shared Usage Recording ───────────────────────────────────

  private recordUsage(usage: any, model: string, operationType: AIOperationType, latencyMs: number): void {
    if (!usage) return

    const inputTokens = usage.prompt_tokens ?? usage.inputTokens ?? 0
    const outputTokens = usage.completion_tokens ?? usage.outputTokens ?? 0

    const currentSettings = this.settingsRepo.get()
    const priceInputPer1k = parseFloat(currentSettings.aiPriceInputPer1k) || 0.003
    const priceOutputPer1k = parseFloat(currentSettings.aiPriceOutputPer1k) || 0.015
    const estimatedCost = (inputTokens / 1000) * priceInputPer1k + (outputTokens / 1000) * priceOutputPer1k

    try {
      this.aiUsageRepo.record({
        operationType,
        model,
        inputTokens,
        outputTokens,
        estimatedCost,
        latencyMs,
      })
    } catch (e) {
      console.error('Failed to record AI usage:', e)
    }
  }

  /**
   * Calls the OpenAI Chat Completions API.
   */
  private async invokeOpenAI(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<string> {
    const url = 'https://api.openai.com/v1/chat/completions'
    const model = settings.openaiModelId || 'gpt-4.1'

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`OpenAI API error (${response.status}): ${errorText}`)
      getErrorService().logError({
        category: 'ai',
        severity: response.status === 429 ? 'warning' : response.status >= 500 ? 'critical' : 'error',
        message: `OpenAI API error (${response.status})`,
        stack: error.stack,
        context: { provider: 'openai', model, statusCode: response.status, operationType, responseBody: errorText.slice(0, 500) },
      })
      throw error
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0

    const currentSettings = this.settingsRepo.get()
    const priceInputPer1k = parseFloat(currentSettings.aiPriceInputPer1k) || 0.003
    const priceOutputPer1k = parseFloat(currentSettings.aiPriceOutputPer1k) || 0.015
    const estimatedCost = (inputTokens / 1000) * priceInputPer1k + (outputTokens / 1000) * priceOutputPer1k

    try {
      this.aiUsageRepo.record({
        operationType,
        model,
        inputTokens,
        outputTokens,
        estimatedCost,
        latencyMs,
      })
    } catch (e) {
      console.error('Failed to record AI usage:', e)
    }

    const choice = data.choices?.[0]
    if (!choice?.message?.content) {
      const error = new Error('OpenAI did not return a valid response')
      getErrorService().logError({
        category: 'ai',
        severity: 'error',
        message: 'OpenAI retornou resposta inválida',
        stack: error.stack,
        context: { provider: 'openai', operationType, model },
      })
      throw error
    }

    return choice.message.content
  }

  /**
   * Calls the Google Gemini API (generateContent endpoint).
   */
  private async invokeGemini(
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
      contents: [
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`Gemini API error (${response.status}): ${errorText}`)
      getErrorService().logError({
        category: 'ai',
        severity: response.status === 429 ? 'warning' : response.status >= 500 ? 'critical' : 'error',
        message: `Gemini API error (${response.status})`,
        stack: error.stack,
        context: { provider: 'gemini', model, statusCode: response.status, operationType, responseBody: errorText.slice(0, 500) },
      })
      throw error
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0

    const currentSettings = this.settingsRepo.get()
    const priceInputPer1k = parseFloat(currentSettings.aiPriceInputPer1k) || 0.003
    const priceOutputPer1k = parseFloat(currentSettings.aiPriceOutputPer1k) || 0.015
    const estimatedCost = (inputTokens / 1000) * priceInputPer1k + (outputTokens / 1000) * priceOutputPer1k

    try {
      this.aiUsageRepo.record({
        operationType,
        model,
        inputTokens,
        outputTokens,
        estimatedCost,
        latencyMs,
      })
    } catch (e) {
      console.error('Failed to record AI usage:', e)
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      const error = new Error('Gemini did not return a valid response')
      getErrorService().logError({
        category: 'ai',
        severity: 'error',
        message: 'Gemini retornou resposta inválida',
        stack: error.stack,
        context: { provider: 'gemini', operationType, model },
      })
      throw error
    }

    return content
  }

  /**
   * Calls the Grok (xAI) API — OpenAI-compatible chat completions.
   */
  private async invokeGrok(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<string> {
    const url = 'https://api.x.ai/v1/chat/completions'
    const model = settings.grokModelId || 'grok-4.3-latest'

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.grokApiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`Grok API error (${response.status}): ${errorText}`)
      getErrorService().logError({
        category: 'ai',
        severity: response.status === 429 ? 'warning' : response.status >= 500 ? 'critical' : 'error',
        message: `Grok API error (${response.status})`,
        stack: error.stack,
        context: { provider: 'grok', model, statusCode: response.status, operationType, responseBody: errorText.slice(0, 500) },
      })
      throw error
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0

    const currentSettings = this.settingsRepo.get()
    const priceInputPer1k = parseFloat(currentSettings.aiPriceInputPer1k) || 0.003
    const priceOutputPer1k = parseFloat(currentSettings.aiPriceOutputPer1k) || 0.015
    const estimatedCost = (inputTokens / 1000) * priceInputPer1k + (outputTokens / 1000) * priceOutputPer1k

    try {
      this.aiUsageRepo.record({
        operationType,
        model,
        inputTokens,
        outputTokens,
        estimatedCost,
        latencyMs,
      })
    } catch (e) {
      console.error('Failed to record AI usage:', e)
    }

    const choice = data.choices?.[0]
    if (!choice?.message?.content) {
      const error = new Error('Grok did not return a valid response')
      getErrorService().logError({
        category: 'ai',
        severity: 'error',
        message: 'Grok retornou resposta inválida',
        stack: error.stack,
        context: { provider: 'grok', operationType, model },
      })
      throw error
    }

    return choice.message.content
  }

  /**
   * Calls a local OpenAI-compatible API (e.g. LM Studio, Ollama, LocalAI).
   * Endpoint default: http://localhost:1234/v1/chat/completions
   */
  private async invokeLocal(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<string> {
    const baseUrl = (settings.localEndpoint || 'http://localhost:1234').replace(/\/+$/, '')
    const url = `${baseUrl}/v1/chat/completions`

    const body = {
      model: settings.localModelId || undefined,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (settings.localApiKey) {
      headers['Authorization'] = `Bearer ${settings.localApiKey}`
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`Local LLM API error (${response.status}): ${errorText}`)
      getErrorService().logError({
        category: 'ai',
        severity: response.status >= 500 ? 'critical' : 'error',
        message: `Local LLM API error (${response.status})`,
        stack: error.stack,
        context: { provider: 'local', endpoint: url, statusCode: response.status, operationType, responseBody: errorText.slice(0, 500) },
      })
      throw error
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0

    try {
      this.aiUsageRepo.record({
        operationType,
        model: settings.localModelId || 'local',
        inputTokens,
        outputTokens,
        estimatedCost: 0,
        latencyMs,
      })
    } catch (e) {
      console.error('Failed to record AI usage:', e)
    }

    const choice = data.choices?.[0]
    if (!choice?.message?.content) {
      const error = new Error('Local LLM did not return a valid response')
      getErrorService().logError({
        category: 'ai',
        severity: 'error',
        message: 'Local LLM retornou resposta inválida',
        stack: error.stack,
        context: { provider: 'local', operationType, model: settings.localModelId || 'local' },
      })
      throw error
    }

    return choice.message.content
  }

  /**
   * Calls the Bedrock Converse API using the API Key (Bearer Token).
   */
  private async invokeBedrock(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<string> {
    const baseUrl = `https://bedrock-runtime.${settings.awsRegion}.amazonaws.com`
    const url = `${baseUrl}/model/${settings.modelId}/converse`

    const body = {
      system: [{ text: systemPrompt }],
      messages: [
        { role: 'user', content: [{ text: userMessage }] },
      ],
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.3,
      },
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.bedrockApiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`Bedrock API error (${response.status}): ${errorText}`)
      getErrorService().logError({
        category: 'ai',
        severity: response.status === 429 ? 'warning' : response.status >= 500 ? 'critical' : 'error',
        message: `Bedrock API error (${response.status})`,
        stack: error.stack,
        context: { provider: 'bedrock', model: settings.modelId, region: settings.awsRegion, statusCode: response.status, operationType, responseBody: errorText.slice(0, 500) },
      })
      throw error
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const inputTokens = data.usage?.inputTokens ?? 0
    const outputTokens = data.usage?.outputTokens ?? 0

    // Calculate estimated cost
    const currentSettings = this.settingsRepo.get()
    const priceInputPer1k = parseFloat(currentSettings.aiPriceInputPer1k) || 0.003
    const priceOutputPer1k = parseFloat(currentSettings.aiPriceOutputPer1k) || 0.015
    const estimatedCost = (inputTokens / 1000) * priceInputPer1k + (outputTokens / 1000) * priceOutputPer1k

    try {
      this.aiUsageRepo.record({
        operationType,
        model: settings.modelId,
        inputTokens,
        outputTokens,
        estimatedCost,
        latencyMs,
      })
    } catch (e) {
      console.error('Failed to record AI usage:', e)
    }

    return data.output.message.content[0].text
  }
}
