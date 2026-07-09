// === Settings ===

export type AIProvider = 'bedrock' | 'local'

export interface AppSettings {
  aiProvider: AIProvider
  // Bedrock settings
  awsRegion: string
  bedrockApiKey: string
  modelId: string
  aiPriceInputPer1k: string
  aiPriceOutputPer1k: string
  // Local LLM settings (OpenAI-compatible, e.g. LM Studio)
  localEndpoint: string
  localModelId: string
  localApiKey: string
  // Appearance settings
  fontFamily: string
  fontSize: string
  // User identity
  userName: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'bedrock',
  awsRegion: 'us-east-1',
  bedrockApiKey: '',
  modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  aiPriceInputPer1k: '0.003',
  aiPriceOutputPer1k: '0.015',
  localEndpoint: 'http://localhost:1234',
  localModelId: '',
  localApiKey: '',
  fontFamily: 'system-ui',
  fontSize: '14',
  userName: '',
}
