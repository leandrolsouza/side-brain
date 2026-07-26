import type { AppSettings } from '../../../shared/types'
import { OpenAICompatibleAdapter, type OpenAICompatibleConfig } from './openai-compatible-adapter'

/** Calls the OpenAI Chat Completions API. */
export class OpenAIAdapter extends OpenAICompatibleAdapter {
  protected getConfig(settings: AppSettings): OpenAICompatibleConfig {
    const model = settings.openaiModelId || 'gpt-4.1'

    return {
      url: 'https://api.openai.com/v1/chat/completions',
      bodyModel: model,
      trackingModel: model,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.openaiApiKey}`,
      },
      provider: 'openai',
      errorLabel: 'OpenAI',
      httpErrorContext: { provider: 'openai', model },
      invalidResponseMessage: 'OpenAI retornou resposta inválida',
      treat429AsWarning: true,
      zeroCostInvoke: false,
    }
  }
}
