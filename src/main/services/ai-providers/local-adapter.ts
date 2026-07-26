import type { AppSettings } from '../../../shared/types'
import { OpenAICompatibleAdapter, type OpenAICompatibleConfig } from './openai-compatible-adapter'

/**
 * Calls a local OpenAI-compatible API (e.g. LM Studio, Ollama, LocalAI).
 * Endpoint default: http://localhost:1234/v1/chat/completions
 */
export class LocalAdapter extends OpenAICompatibleAdapter {
  protected getConfig(settings: AppSettings): OpenAICompatibleConfig {
    const baseUrl = (settings.localEndpoint || 'http://localhost:1234').replace(/\/+$/, '')
    const url = `${baseUrl}/v1/chat/completions`

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (settings.localApiKey) {
      headers.Authorization = `Bearer ${settings.localApiKey}`
    }

    return {
      url,
      bodyModel: settings.localModelId || undefined,
      trackingModel: settings.localModelId || 'local',
      headers,
      provider: 'local',
      errorLabel: 'Local LLM',
      httpErrorContext: { provider: 'local', endpoint: url },
      invalidResponseMessage: 'Local LLM retornou resposta inválida',
      treat429AsWarning: false,
      zeroCostInvoke: true,
    }
  }
}
