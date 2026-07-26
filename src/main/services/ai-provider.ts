import type { AIOperationType, AppSettings, ToolDefinition } from '../../shared/types'
import type { AIUsageRepository } from '../database/repositories/ai-usage-repository'
import type { SettingsRepository } from '../database/repositories/settings-repository'
import { createProviderAdapters, type ProviderAdapterRegistry } from './ai-providers'
import type { AIToolResponse, ChatMessage, ProviderAdapter } from './ai-providers'
import { getErrorService } from './error-service'

export type { AIToolResponse }

/**
 * Handles low-level AI provider communication.
 * Supports: Bedrock, OpenAI, Gemini, Grok, and Local LLM.
 * Facade that routes each call to the provider adapter selected in settings;
 * adapters (src/main/services/ai-providers/) own HTTP calls, parsing, and usage tracking.
 */
export class AIProvider {
  private adapters: ProviderAdapterRegistry

  constructor(aiUsageRepo: AIUsageRepository, settingsRepo: SettingsRepository) {
    this.adapters = createProviderAdapters(aiUsageRepo, settingsRepo)
  }

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
      return await this.resolveAdapter(settings).invoke(systemPrompt, userMessage, settings, operationType)
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
    messages: ChatMessage[],
    tools: ToolDefinition[],
    settings: AppSettings,
    operationType: AIOperationType = 'smart_chat'
  ): Promise<AIToolResponse> {
    try {
      return await this.resolveAdapter(settings).invokeWithTools(systemPrompt, messages, tools, settings, operationType)
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

  /** Selects the adapter for the configured provider (Bedrock is the fallback). */
  private resolveAdapter(settings: AppSettings): ProviderAdapter {
    switch (settings.aiProvider) {
      case 'openai':
        return this.adapters.openai
      case 'gemini':
        return this.adapters.gemini
      case 'grok':
        return this.adapters.grok
      case 'local':
        return this.adapters.local
      default:
        return this.adapters.bedrock
    }
  }
}
