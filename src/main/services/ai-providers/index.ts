import type { AIUsageRepository } from '../../database/repositories/ai-usage-repository'
import type { SettingsRepository } from '../../database/repositories/settings-repository'
import { BedrockAdapter } from './bedrock-adapter'
import { GeminiAdapter } from './gemini-adapter'
import { GrokAdapter } from './grok-adapter'
import { LocalAdapter } from './local-adapter'
import { OpenAIAdapter } from './openai-adapter'
import { UsageTracker } from './shared'
import type { ProviderAdapter } from './types'

export type { AIToolResponse, ChatMessage, ProviderAdapter } from './types'

export interface ProviderAdapterRegistry {
  openai: ProviderAdapter
  gemini: ProviderAdapter
  grok: ProviderAdapter
  local: ProviderAdapter
  bedrock: ProviderAdapter
}

/** Builds one adapter per supported provider, sharing a single usage tracker. */
export function createProviderAdapters(
  aiUsageRepo: AIUsageRepository,
  settingsRepo: SettingsRepository
): ProviderAdapterRegistry {
  const usage = new UsageTracker(aiUsageRepo, settingsRepo)

  return {
    openai: new OpenAIAdapter(usage),
    gemini: new GeminiAdapter(usage),
    grok: new GrokAdapter(usage),
    local: new LocalAdapter(usage),
    bedrock: new BedrockAdapter(usage),
  }
}
