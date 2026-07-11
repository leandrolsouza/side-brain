// === Settings ===

export type AIProvider = 'bedrock' | 'openai' | 'gemini' | 'grok' | 'local'
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
export type UIDensity = 'compact' | 'comfortable'
export type BackupFrequency = 'startup' | '4h' | '8h' | '12h' | 'disabled'
export type TaskCheckInterval = '15' | '30' | '60' | 'disabled'

export interface AppSettings {
  aiProvider: AIProvider
  // Bedrock settings
  awsRegion: string
  bedrockApiKey: string
  modelId: string
  aiPriceInputPer1k: string
  aiPriceOutputPer1k: string
  // OpenAI settings
  openaiApiKey: string
  openaiModelId: string
  // Gemini settings
  geminiApiKey: string
  geminiModelId: string
  // Grok settings
  grokApiKey: string
  grokModelId: string
  // Local LLM settings (OpenAI-compatible, e.g. LM Studio)
  localEndpoint: string
  localModelId: string
  localApiKey: string
  // Appearance settings
  fontFamily: string
  fontSize: string
  dateFormat: DateFormat
  uiDensity: UIDensity
  // Backup settings
  backupFrequency: BackupFrequency
  backupLimit: string
  // Notification settings
  nativeNotifications: string
  taskCheckInterval: TaskCheckInterval
  // Daily Digest settings
  dailyDigestEnabled: string
  dailyDigestSections: string // comma-separated: aiSuggestion,pendingTasks,yesterdayActivity
  // User identity
  userName: string
  // System Tray
  trayEnabled: string
  // Onboarding
  onboardingCompleted: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'bedrock',
  awsRegion: 'us-east-1',
  bedrockApiKey: '',
  modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  aiPriceInputPer1k: '0.003',
  aiPriceOutputPer1k: '0.015',
  openaiApiKey: '',
  openaiModelId: 'gpt-4.1',
  geminiApiKey: '',
  geminiModelId: 'gemini-3.5-flash',
  grokApiKey: '',
  grokModelId: 'grok-4.3-latest',
  localEndpoint: 'http://localhost:1234',
  localModelId: '',
  localApiKey: '',
  fontFamily: 'system-ui',
  fontSize: '14',
  dateFormat: 'DD/MM/YYYY',
  uiDensity: 'comfortable',
  backupFrequency: 'startup',
  backupLimit: '7',
  nativeNotifications: 'true',
  taskCheckInterval: '30',
  dailyDigestEnabled: 'true',
  dailyDigestSections: 'aiSuggestion,pendingTasks,yesterdayActivity',
  userName: '',
  trayEnabled: 'true',
  onboardingCompleted: 'false',
}
