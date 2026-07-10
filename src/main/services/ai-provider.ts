import type { AIOperationType, AppSettings } from '../../shared/types'
import { AIUsageRepository } from '../database/repositories/ai-usage-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { getErrorService } from './error-service'

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

    const response = await fetch(url, {
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

    const response = await fetch(url, {
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

    const response = await fetch(url, {
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

    const response = await fetch(url, {
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

    const response = await fetch(url, {
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
