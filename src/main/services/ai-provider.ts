import type { AIOperationType, AppSettings } from '../../shared/types'
import { AIUsageRepository } from '../database/repositories/ai-usage-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { getErrorService } from './error-service'

/**
 * Handles low-level AI provider communication (Bedrock and Local LLM).
 * Responsible for HTTP calls, error handling, and usage tracking.
 */
export class AIProvider {
  constructor(
    private aiUsageRepo: AIUsageRepository,
    private settingsRepo: SettingsRepository
  ) {}

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
      if (settings.aiProvider === 'local') {
        return await this.invokeLocal(systemPrompt, userMessage, settings, operationType)
      }
      return await this.invokeBedrock(systemPrompt, userMessage, settings, operationType)
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
