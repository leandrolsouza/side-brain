import { net } from 'electron'
import type { AIOperationType } from '../../../shared/types'
import type { AIUsageRepository } from '../../database/repositories/ai-usage-repository'
import type { SettingsRepository } from '../../database/repositories/settings-repository'
import { getErrorService } from '../error-service'
import { createScopedLogger } from '../logger'

const logger = createScopedLogger('ai')

export interface ProviderFetchResult {
  data: any
  latencyMs: number
}

/**
 * Shared HTTP helper for all provider adapters.
 * Performs the POST, measures latency, and throws `${errorLabel} API error (${status}): ${errorText}`
 * on non-OK responses. The optional onHttpError hook allows callers to log to the error service
 * before the error is thrown (used by simple invocations; tool invocations rely on the facade).
 */
export async function postProviderRequest(options: {
  url: string
  headers: Record<string, string>
  body: unknown
  errorLabel: string
  onHttpError?: (status: number, errorText: string, error: Error) => void
}): Promise<ProviderFetchResult> {
  const { url, headers, body, errorLabel, onHttpError } = options
  const startTime = Date.now()

  const response = await net.fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    const error = new Error(`${errorLabel} API error (${response.status}): ${errorText}`)
    onHttpError?.(response.status, errorText, error)
    throw error
  }

  const data = await response.json()
  return { data, latencyMs: Date.now() - startTime }
}

function httpErrorSeverity(status: number, treat429AsWarning: boolean): 'warning' | 'critical' | 'error' {
  if (treat429AsWarning && status === 429) return 'warning'
  return status >= 500 ? 'critical' : 'error'
}

/** Logs an HTTP-level provider error to the error service (simple invocations only). */
export function logProviderHttpError(options: {
  errorLabel: string
  status: number
  errorText: string
  error: Error
  operationType: AIOperationType
  context: Record<string, unknown>
  treat429AsWarning: boolean
}): void {
  getErrorService().logError({
    category: 'ai',
    severity: httpErrorSeverity(options.status, options.treat429AsWarning),
    message: `${options.errorLabel} API error (${options.status})`,
    stack: options.error.stack,
    context: {
      ...options.context,
      statusCode: options.status,
      operationType: options.operationType,
      responseBody: options.errorText.slice(0, 500),
    },
  })
}

/**
 * Builds (and logs) the error thrown when a provider returns a well-formed
 * HTTP response without usable content.
 */
export function invalidProviderResponseError(options: {
  errorLabel: string
  localizedMessage: string
  context: Record<string, unknown>
}): Error {
  const error = new Error(`${options.errorLabel} did not return a valid response`)
  getErrorService().logError({
    category: 'ai',
    severity: 'error',
    message: options.localizedMessage,
    stack: error.stack,
    context: options.context,
  })
  return error
}

/**
 * Shared usage tracking for all adapters: token counting, cost estimation
 * from pricing settings, and persistence to the AI usage repository.
 * Recording failures are logged and never propagate.
 */
export class UsageTracker {
  constructor(
    private aiUsageRepo: AIUsageRepository,
    private settingsRepo: SettingsRepository
  ) {}

  /**
   * Records usage from a raw provider usage payload (OpenAI or Bedrock shape).
   * Skips recording entirely when the payload is absent.
   */
  record(usage: any, model: string, operationType: AIOperationType, latencyMs: number): void {
    if (!usage) return

    const inputTokens = usage.prompt_tokens ?? usage.inputTokens ?? 0
    const outputTokens = usage.completion_tokens ?? usage.outputTokens ?? 0

    this.recordTokens(inputTokens, outputTokens, model, operationType, latencyMs)
  }

  /** Records token counts with cost estimated from the current pricing settings. */
  recordTokens(
    inputTokens: number,
    outputTokens: number,
    model: string,
    operationType: AIOperationType,
    latencyMs: number
  ): void {
    const currentSettings = this.settingsRepo.get()
    const priceInputPer1k = parseFloat(currentSettings.aiPriceInputPer1k) || 0.003
    const priceOutputPer1k = parseFloat(currentSettings.aiPriceOutputPer1k) || 0.015
    const estimatedCost = (inputTokens / 1000) * priceInputPer1k + (outputTokens / 1000) * priceOutputPer1k

    this.persist({ operationType, model, inputTokens, outputTokens, estimatedCost, latencyMs })
  }

  /** Records token counts with zero cost (local providers). */
  recordFree(
    inputTokens: number,
    outputTokens: number,
    model: string,
    operationType: AIOperationType,
    latencyMs: number
  ): void {
    this.persist({ operationType, model, inputTokens, outputTokens, estimatedCost: 0, latencyMs })
  }

  private persist(entry: {
    operationType: AIOperationType
    model: string
    inputTokens: number
    outputTokens: number
    estimatedCost: number
    latencyMs: number
  }): void {
    try {
      this.aiUsageRepo.record(entry)
    } catch (e) {
      logger.error('Failed to record AI usage:', e)
    }
  }
}
