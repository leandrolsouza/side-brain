export type AIProvider = 'bedrock' | 'openai' | 'gemini' | 'grok' | 'local'
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
export type UIDensity = 'compact' | 'comfortable'
export type BackupFrequency = 'startup' | '4h' | '8h' | '12h' | 'disabled'
export type TaskCheckInterval = '15' | '30' | '60' | 'disabled'

export interface AppSettings {
  aiProvider: AIProvider
  awsRegion: string
  bedrockApiKey: string
  modelId: string
  openaiApiKey: string
  openaiModelId: string
  geminiApiKey: string
  geminiModelId: string
  grokApiKey: string
  grokModelId: string
  localEndpoint: string
  localModelId: string
  localApiKey: string
  fontFamily: string
  fontSize: string
  dateFormat: DateFormat
  uiDensity: UIDensity
  backupFrequency: BackupFrequency
  backupLimit: string
  nativeNotifications: string
  taskCheckInterval: TaskCheckInterval
  dailyDigestEnabled: string
  dailyDigestSections: string
  userName: string
  trayEnabled: string
}

export const AVAILABLE_MODELS = [
  { id: 'us.anthropic.claude-sonnet-5', label: 'Claude Sonnet 5 (mais capaz, 1M ctx)', category: 'Claude' },
  { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (equilibrado)', category: 'Claude' },
  {
    id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    label: 'Claude Haiku 4.5 (rápido + barato)',
    category: 'Claude',
  },
  { id: 'us.amazon.nova-2-lite-v1:0', label: 'Nova 2 Lite (custo-eficiente, 1M ctx)', category: 'Nova' },
  { id: 'us.amazon.nova-pro-v1:0', label: 'Nova Pro (equilibrado)', category: 'Nova' },
  { id: 'us.amazon.nova-lite-v1:0', label: 'Nova Lite (baixo custo)', category: 'Nova' },
  { id: 'us.amazon.nova-micro-v1:0', label: 'Nova Micro (mais rápido, só texto)', category: 'Nova' },
]

export const OPENAI_MODELS = [
  { id: 'gpt-4.1', label: 'GPT-4.1 (mais capaz, 1M ctx)' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (equilíbrio)' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (rápido + barato)' },
  { id: 'o3', label: 'o3 (raciocínio avançado)' },
  { id: 'o4-mini', label: 'o4-mini (raciocínio, barato)' },
  { id: 'gpt-4o', label: 'GPT-4o (multimodal)' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (legado, barato)' },
]

export const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (mais capaz, agentic)' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (frontier, baixo custo)' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (avançado, preview)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (raciocínio complexo)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (preço/performance)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (mais rápido)' },
]

export const GROK_MODELS = [
  { id: 'grok-4.3-latest', label: 'Grok 4.3 (mais capaz)' },
  { id: 'grok-420-reasoning', label: 'Grok 420 Reasoning (raciocínio, 256K ctx)' },
  { id: 'grok-3', label: 'Grok 3 (equilibrado)' },
  { id: 'grok-3-mini', label: 'Grok 3 Mini (rápido + barato)' },
]

export const AWS_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-northeast-1',
  'ap-southeast-1',
  'sa-east-1',
]

export const FONT_FAMILIES = [
  {
    id: 'system-ui',
    label: 'Sistema (padrão)',
    stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  { id: 'inter', label: 'Inter', stack: '"Inter", system-ui, sans-serif' },
  { id: 'segoe-ui', label: 'Segoe UI', stack: '"Segoe UI", system-ui, sans-serif' },
  { id: 'roboto', label: 'Roboto', stack: '"Roboto", system-ui, sans-serif' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', stack: '"JetBrains Mono", "Fira Code", monospace' },
  { id: 'fira-code', label: 'Fira Code', stack: '"Fira Code", "JetBrains Mono", monospace' },
  { id: 'cascadia-code', label: 'Cascadia Code', stack: '"Cascadia Code", "Fira Code", monospace' },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
]

export const LANGUAGE_OPTIONS = [
  { code: 'pt-BR' as const, nativeName: 'Português (Brasil)' },
  { code: 'en' as const, nativeName: 'English' },
]

export type SettingsTab = 'geral' | 'aparencia' | 'dados' | 'avancado'
