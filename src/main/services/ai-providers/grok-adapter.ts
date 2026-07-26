import type { AppSettings } from '../../../shared/types'
import { OpenAICompatibleAdapter, type OpenAICompatibleConfig } from './openai-compatible-adapter'

/** Calls the Grok (xAI) API — OpenAI-compatible chat completions. */
export class GrokAdapter extends OpenAICompatibleAdapter {
  protected getConfig(settings: AppSettings): OpenAICompatibleConfig {
    const model = settings.grokModelId || 'grok-4.3-latest'

    return {
      url: 'https://api.x.ai/v1/chat/completions',
      bodyModel: model,
      trackingModel: model,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.grokApiKey}`,
      },
      provider: 'grok',
      errorLabel: 'Grok',
      httpErrorContext: { provider: 'grok', model },
      invalidResponseMessage: 'Grok retornou resposta inválida',
      treat429AsWarning: true,
      zeroCostInvoke: false,
    }
  }
}
