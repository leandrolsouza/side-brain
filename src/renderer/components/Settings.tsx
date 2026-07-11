import React, { useState, useEffect } from 'react'
import { CheckCircle2, Download, Upload, Trash2, RotateCcw, HardDrive, AlertTriangle, FolderOpen, Database, Settings as SettingsIcon, Cpu, Cloud, Monitor, Type, Bell, Clock, Keyboard, FileText, Sunrise, Eye, EyeOff } from 'lucide-react'
import { ConfirmModal } from './ConfirmModal'
import { useToast } from './ToastContext'
import { useApp } from './AppContext'

interface SettingsProps {
}

type AIProvider = 'bedrock' | 'openai' | 'gemini' | 'grok' | 'local'
type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
type UIDensity = 'compact' | 'comfortable'
type BackupFrequency = 'startup' | '4h' | '8h' | '12h' | 'disabled'
type TaskCheckInterval = '15' | '30' | '60' | 'disabled'

interface AppSettings {
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

const AVAILABLE_MODELS = [
  { id: 'us.anthropic.claude-sonnet-5', label: 'Claude Sonnet 5 (mais capaz, 1M ctx)', category: 'Claude' },
  { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (equilibrado)', category: 'Claude' },
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (rápido + barato)', category: 'Claude' },
  { id: 'us.amazon.nova-2-lite-v1:0', label: 'Nova 2 Lite (custo-eficiente, 1M ctx)', category: 'Nova' },
  { id: 'us.amazon.nova-pro-v1:0', label: 'Nova Pro (equilibrado)', category: 'Nova' },
  { id: 'us.amazon.nova-lite-v1:0', label: 'Nova Lite (baixo custo)', category: 'Nova' },
  { id: 'us.amazon.nova-micro-v1:0', label: 'Nova Micro (mais rápido, só texto)', category: 'Nova' },
]

const OPENAI_MODELS = [
  { id: 'gpt-4.1', label: 'GPT-4.1 (mais capaz, 1M ctx)' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (equilíbrio)' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (rápido + barato)' },
  { id: 'o3', label: 'o3 (raciocínio avançado)' },
  { id: 'o4-mini', label: 'o4-mini (raciocínio, barato)' },
  { id: 'gpt-4o', label: 'GPT-4o (multimodal)' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (legado, barato)' },
]

const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (mais capaz, agentic)' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (frontier, baixo custo)' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (avançado, preview)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (raciocínio complexo)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (preço/performance)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (mais rápido)' },
]

const GROK_MODELS = [
  { id: 'grok-4.3-latest', label: 'Grok 4.3 (mais capaz)' },
  { id: 'grok-420-reasoning', label: 'Grok 420 Reasoning (raciocínio, 256K ctx)' },
  { id: 'grok-3', label: 'Grok 3 (equilibrado)' },
  { id: 'grok-3-mini', label: 'Grok 3 Mini (rápido + barato)' },
]

const AWS_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-northeast-1',
  'ap-southeast-1',
  'sa-east-1',
]

const FONT_FAMILIES = [
  { id: 'system-ui', label: 'Sistema (padrão)', stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'inter', label: 'Inter', stack: '"Inter", system-ui, sans-serif' },
  { id: 'segoe-ui', label: 'Segoe UI', stack: '"Segoe UI", system-ui, sans-serif' },
  { id: 'roboto', label: 'Roboto', stack: '"Roboto", system-ui, sans-serif' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', stack: '"JetBrains Mono", "Fira Code", monospace' },
  { id: 'fira-code', label: 'Fira Code', stack: '"Fira Code", "JetBrains Mono", monospace' },
  { id: 'cascadia-code', label: 'Cascadia Code', stack: '"Cascadia Code", "Fira Code", monospace' },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
]

type SettingsTab = 'geral' | 'aparencia' | 'dados' | 'avancado'

export function Settings({ }: SettingsProps) {
  const { addToast } = useToast()
  const { dispatch } = useApp()
  const [activeTab, setActiveTab] = useState<SettingsTab>('geral')
  const [settings, setSettings] = useState<AppSettings>({
    aiProvider: 'bedrock',
    awsRegion: 'us-east-1',
    bedrockApiKey: '',
    modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
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
  })
  const [isSaving, setIsSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [backups, setBackups] = useState<{ filename: string; filePath: string; createdAt: string; sizeBytes: number }[]>([])
  const [backupLoading, setBackupLoading] = useState(false)
  const [dbPathInfo, setDbPathInfo] = useState<{ currentPath: string; defaultPath: string; isCustom: boolean } | null>(null)
  const [dbPathLoading, setDbPathLoading] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    confirmLabel: string
    cancelLabel?: string
    alternativeLabel?: string
    secondAlternativeLabel?: string
    variant: 'danger' | 'warning' | 'default'
    onConfirm: () => void
    onAlternative?: () => void
    onSecondAlternative?: () => void
  } | null>(null)

  useEffect(() => {
    loadSettings()
    loadBackups()
    loadDbPath()
  }, [])

  const loadSettings = async () => {
    const data = await window.electronAPI.getSettings()
    if (data) {
      setSettings(data as AppSettings)
    }
  }

  const loadBackups = async () => {
    const list = await window.electronAPI.listBackups()
    setBackups(list)
  }

  const loadDbPath = async () => {
    const info = await window.electronAPI.getDatabasePath()
    setDbPathInfo(info)
  }

  const showBackupMessage = (type: 'success' | 'error', text: string) => {
    addToast(text, type === 'success' ? 'success' : 'error')
  }

  const handleExportBackup = async () => {
    setBackupLoading(true)
    try {
      const result = await window.electronAPI.createManualBackup()
      if (result.success) {
        showBackupMessage('success', 'Backup exportado com sucesso!')
      }
    } catch {
      showBackupMessage('error', 'Erro ao exportar backup.')
    } finally {
      setBackupLoading(false)
    }
  }

  const handleImportBackup = async () => {
    setConfirmModal({
      title: 'Importar backup',
      message: 'Restaurar um backup substituirá todos os dados atuais. Deseja continuar?',
      confirmLabel: 'Importar',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        setBackupLoading(true)
        try {
          const result = await window.electronAPI.importBackup()
          if (result.success) {
            showBackupMessage('success', 'Backup restaurado! Recarregando...')
          } else if (result.error && result.error !== 'Operação cancelada.') {
            showBackupMessage('error', result.error)
          }
        } catch {
          showBackupMessage('error', 'Erro ao importar backup.')
        } finally {
          setBackupLoading(false)
        }
      },
    })
  }

  const handleRestoreBackup = async (filePath: string) => {
    setConfirmModal({
      title: 'Restaurar backup',
      message: 'Restaurar este backup substituirá todos os dados atuais. Deseja continuar?',
      confirmLabel: 'Restaurar',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        setBackupLoading(true)
        try {
          const result = await window.electronAPI.restoreBackup(filePath)
          if (result.success) {
            showBackupMessage('success', 'Backup restaurado! Recarregando...')
          } else if (result.error) {
            showBackupMessage('error', result.error)
          }
        } catch {
          showBackupMessage('error', 'Erro ao restaurar backup.')
        } finally {
          setBackupLoading(false)
        }
      },
    })
  }

  const handleDeleteBackup = async (filePath: string) => {
    setConfirmModal({
      title: 'Excluir backup',
      message: 'Excluir este backup permanentemente?',
      confirmLabel: 'Excluir',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null)
        await window.electronAPI.deleteBackup(filePath)
        loadBackups()
      },
    })
  }

  const handleResetDatabase = async () => {
    setConfirmModal({
      title: 'Resetar Database',
      message: 'ATENÇÃO: Isso apagará TODOS os dados (projetos, entradas, tarefas, reuniões) e criará uma database nova.\n\nA database atual será arquivada na pasta de backups.',
      confirmLabel: 'Resetar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null)
        setBackupLoading(true)
        try {
          const result = await window.electronAPI.resetDatabase()
          if (result.success) {
            showBackupMessage('success', 'Database resetada! Recarregando...')
          } else if (result.error) {
            showBackupMessage('error', result.error)
          }
        } catch {
          showBackupMessage('error', 'Erro ao resetar database.')
        } finally {
          setBackupLoading(false)
        }
      },
    })
  }

  const handleChangeDatabasePath = async () => {
    const selectedPath = await window.electronAPI.selectDatabaseFolder()
    if (!selectedPath) return

    const existsAtDestination = await window.electronAPI.checkDatabaseExists(selectedPath)

    const message = existsAtDestination
      ? 'O que deseja fazer com a database atual?\n\n• Mover dados = Transfere a database para o novo local (substituirá a existente)\n• Criar nova = Começa uma database vazia (dados antigos permanecem no local atual)\n• Usar existente = Usa a database que já existe no destino'
      : 'O que deseja fazer com a database atual?\n\n• Mover dados = Transfere a database para o novo local\n• Criar nova = Começa uma database vazia (dados antigos permanecem no local atual)'

    setConfirmModal({
      title: 'Alterar local da database',
      message,
      confirmLabel: 'Mover dados',
      alternativeLabel: 'Criar nova',
      secondAlternativeLabel: existsAtDestination ? 'Usar existente' : undefined,
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        await executeDatabasePathChange(selectedPath, 'move')
      },
      onAlternative: async () => {
        setConfirmModal(null)
        await executeDatabasePathChange(selectedPath, 'new')
      },
      onSecondAlternative: existsAtDestination
        ? async () => {
          setConfirmModal(null)
          await executeDatabasePathChange(selectedPath, 'existing')
        }
        : undefined,
    })
  }

  const executeDatabasePathChange = async (path: string, mode: 'move' | 'new' | 'existing') => {
    setDbPathLoading(true)
    try {
      const result = await window.electronAPI.setDatabasePath(path, mode)
      if (result.success) {
        showBackupMessage('success', 'Caminho alterado! Recarregando...')
      } else if (result.error) {
        showBackupMessage('error', result.error)
      }
    } catch {
      showBackupMessage('error', 'Erro ao alterar caminho da database.')
    } finally {
      setDbPathLoading(false)
    }
  }

  const handleResetDatabasePath = async () => {
    if (!dbPathInfo?.isCustom) return

    const defaultPath = dbPathInfo.defaultPath
    const existsAtDefault = await window.electronAPI.checkDatabaseExists(defaultPath)

    const message = existsAtDefault
      ? 'O que deseja fazer com a database atual?\n\n• Mover dados = Transfere de volta para o local padrão (substituirá a existente)\n• Criar nova = Começa uma database vazia no local padrão\n• Usar existente = Usa a database que já existe no local padrão'
      : 'O que deseja fazer com a database atual?\n\n• Mover dados = Transfere de volta para o local padrão\n• Criar nova = Começa uma database vazia no local padrão'

    setConfirmModal({
      title: 'Restaurar local padrão',
      message,
      confirmLabel: 'Mover dados',
      alternativeLabel: 'Criar nova',
      secondAlternativeLabel: existsAtDefault ? 'Usar existente' : undefined,
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        await executeResetDatabasePath('move')
      },
      onAlternative: async () => {
        setConfirmModal(null)
        await executeResetDatabasePath('new')
      },
      onSecondAlternative: existsAtDefault
        ? async () => {
          setConfirmModal(null)
          await executeResetDatabasePath('existing')
        }
        : undefined,
    })
  }

  const executeResetDatabasePath = async (mode: 'move' | 'new' | 'existing') => {
    setDbPathLoading(true)
    try {
      const result = await window.electronAPI.resetDatabasePath(mode)
      if (result.success) {
        showBackupMessage('success', 'Caminho restaurado ao padrão! Recarregando...')
      } else if (result.error) {
        showBackupMessage('error', result.error)
      }
    } catch {
      showBackupMessage('error', 'Erro ao restaurar caminho padrão.')
    } finally {
      setDbPathLoading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await window.electronAPI.updateSettings(settings)
      await window.electronAPI.toggleTray(settings.trayEnabled === 'true')
      addToast('Configurações salvas com sucesso', 'success')

      // Update status bar model label
      const providerLabels: Record<string, string> = {
        bedrock: 'Bedrock',
        openai: 'OpenAI',
        gemini: 'Gemini',
        grok: 'Grok',
        local: 'Local',
      }
      const provider = providerLabels[settings.aiProvider] || 'Bedrock'
      let modelName = ''
      if (settings.aiProvider === 'local') {
        modelName = settings.localModelId || 'LLM Local'
      } else if (settings.aiProvider === 'openai') {
        modelName = settings.openaiModelId || 'gpt-4.1'
      } else if (settings.aiProvider === 'gemini') {
        modelName = settings.geminiModelId || 'gemini-3.5-flash'
      } else if (settings.aiProvider === 'grok') {
        modelName = settings.grokModelId || 'grok-4.3-latest'
      } else {
        const bedrockModel = AVAILABLE_MODELS.find(m => m.id === settings.modelId)
        modelName = bedrockModel ? bedrockModel.label.split(' (')[0] : settings.modelId
      }
      dispatch({ type: 'SET_MODEL_LABEL', label: `${provider} · ${modelName}` })
    } finally {
      setIsSaving(false)
    }
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'geral', label: 'Geral', icon: <SettingsIcon size={14} /> },
    { id: 'aparencia', label: 'Aparência', icon: <Type size={14} /> },
    { id: 'dados', label: 'Dados', icon: <HardDrive size={14} /> },
    { id: 'avancado', label: 'Avançado', icon: <Cpu size={14} /> },
  ]

  const renderGeralTab = () => (
    <div className="settings-tab-content">
      {/* User Identity */}
      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-label">Meu nome</div>
          <div className="settings-item-description">
            Seu primeiro nome. Usado pela IA para identificar suas tasks em reuniões e separar "minhas tasks" das de outros participantes.
          </div>
          <input
            type="text"
            className="vscode-input"
            value={settings.userName}
            onChange={(e) => setSettings({ ...settings, userName: e.target.value })}
            placeholder="Ex: Leandro"
            style={{ maxWidth: 260, marginTop: 6 }}
          />
        </div>
      </div>

      {/* Provider Selection */}
      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-label">Provedor de IA</div>
          <div className="settings-item-description">
            Escolha o provedor de IA para categorização e resumos.
          </div>
          <div className="provider-toggle" style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              className={`vscode-button ${settings.aiProvider === 'bedrock' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'bedrock' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Cloud size={14} />
              AWS Bedrock
            </button>
            <button
              className={`vscode-button ${settings.aiProvider === 'openai' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'openai' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Cpu size={14} />
              OpenAI
            </button>
            <button
              className={`vscode-button ${settings.aiProvider === 'gemini' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'gemini' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Cpu size={14} />
              Gemini
            </button>
            <button
              className={`vscode-button ${settings.aiProvider === 'grok' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'grok' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Cpu size={14} />
              Grok
            </button>
            <button
              className={`vscode-button ${settings.aiProvider === 'local' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'local' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Monitor size={14} />
              LLM Local
            </button>
          </div>
        </div>
      </div>

      {/* Bedrock Settings */}
      {settings.aiProvider === 'bedrock' && (
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item-label">Região AWS</div>
            <div className="settings-item-description">
              Região do AWS Bedrock para chamadas de IA.
            </div>
            <select
              className="vscode-select"
              value={settings.awsRegion}
              onChange={(e) => setSettings({ ...settings, awsRegion: e.target.value })}
            >
              {AWS_REGIONS.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">API Key (Bedrock)</div>
            <div className="settings-item-description">
              Gere em: Console AWS → Bedrock → API Keys. Usada como Bearer Token.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 400 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="vscode-input"
                value={settings.bedrockApiKey}
                onChange={(e) => setSettings({ ...settings, bedrockApiKey: e.target.value })}
                placeholder="Cole aqui sua API Key..."
                style={{ flex: 1 }}
              />
              <button
                className="icon-button"
                type="button"
                title={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">Modelo</div>
            <div className="settings-item-description">
              Modelo de IA para categorização e resumos.
            </div>
            <select
              className="vscode-select"
              value={settings.modelId}
              onChange={(e) => setSettings({ ...settings, modelId: e.target.value })}
            >
              <optgroup label="Claude (Anthropic)">
                {AVAILABLE_MODELS.filter(m => m.category === 'Claude').map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </optgroup>
              <optgroup label="Amazon Nova">
                {AVAILABLE_MODELS.filter(m => m.category === 'Nova').map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      )}

      {/* OpenAI Settings */}
      {settings.aiProvider === 'openai' && (
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item-label">API Key (OpenAI)</div>
            <div className="settings-item-description">
              Gere em: <code>platform.openai.com/api-keys</code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 400 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="vscode-input"
                value={settings.openaiApiKey}
                onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                placeholder="sk-..."
                style={{ flex: 1 }}
              />
              <button
                className="icon-button"
                type="button"
                title={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">Modelo</div>
            <div className="settings-item-description">
              Modelo OpenAI para categorização e resumos.
            </div>
            <select
              className="vscode-select"
              value={settings.openaiModelId}
              onChange={(e) => setSettings({ ...settings, openaiModelId: e.target.value })}
            >
              {OPENAI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Gemini Settings */}
      {settings.aiProvider === 'gemini' && (
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item-label">API Key (Gemini)</div>
            <div className="settings-item-description">
              Gere em: <code>aistudio.google.com/apikey</code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 400 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="vscode-input"
                value={settings.geminiApiKey}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                placeholder="Cole aqui sua API Key..."
                style={{ flex: 1 }}
              />
              <button
                className="icon-button"
                type="button"
                title={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">Modelo</div>
            <div className="settings-item-description">
              Modelo Gemini para categorização e resumos.
            </div>
            <select
              className="vscode-select"
              value={settings.geminiModelId}
              onChange={(e) => setSettings({ ...settings, geminiModelId: e.target.value })}
            >
              {GEMINI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Grok Settings */}
      {settings.aiProvider === 'grok' && (
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item-label">API Key (Grok)</div>
            <div className="settings-item-description">
              Gere em: <code>console.x.ai</code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 400 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="vscode-input"
                value={settings.grokApiKey}
                onChange={(e) => setSettings({ ...settings, grokApiKey: e.target.value })}
                placeholder="xai-..."
                style={{ flex: 1 }}
              />
              <button
                className="icon-button"
                type="button"
                title={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">Modelo</div>
            <div className="settings-item-description">
              Modelo Grok para categorização e resumos.
            </div>
            <select
              className="vscode-select"
              value={settings.grokModelId}
              onChange={(e) => setSettings({ ...settings, grokModelId: e.target.value })}
            >
              {GROK_MODELS.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Local LLM Settings */}
      {settings.aiProvider === 'local' && (
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item-label">Endpoint</div>
            <div className="settings-item-description">
              URL base do servidor local. LM Studio usa <code>http://localhost:1234</code> por padrão.
            </div>
            <input
              type="text"
              className="vscode-input"
              value={settings.localEndpoint}
              onChange={(e) => setSettings({ ...settings, localEndpoint: e.target.value })}
              placeholder="http://localhost:1234"
              style={{ maxWidth: 400 }}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-label">Modelo (opcional)</div>
            <div className="settings-item-description">
              Nome do modelo carregado no servidor. No LM Studio, deixe vazio para usar o modelo ativo.
            </div>
            <input
              type="text"
              className="vscode-input"
              value={settings.localModelId}
              onChange={(e) => setSettings({ ...settings, localModelId: e.target.value })}
              placeholder="Ex: qwen2.5-7b-instruct"
              style={{ maxWidth: 400 }}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-label">API Key (opcional)</div>
            <div className="settings-item-description">
              Apenas se o servidor local exigir autenticação. A maioria não precisa.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 400 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="vscode-input"
                value={settings.localApiKey}
                onChange={(e) => setSettings({ ...settings, localApiKey: e.target.value })}
                placeholder="Deixe vazio se não necessário"
                style={{ flex: 1 }}
              />
              <button
                className="icon-button"
                type="button"
                title={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item" style={{ padding: '12px', borderRadius: 4, background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)' }}>
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
              <strong>Dica:</strong> Para melhores resultados, use modelos com pelo menos 7B parâmetros e
              que suportem instruções em português. Recomendados: Qwen 2.5, Llama 3, Mistral.
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex-row" style={{ marginTop: 16 }}>
        <button
          className="vscode-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  )

  const renderAparenciaTab = () => (
    <div className="settings-tab-content">
      <div className="settings-group">
        <div className="settings-section-title">
          <Type size={16} />
          <span>Fonte do Conteúdo</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Família da Fonte</div>
          <div className="settings-item-description">
            Fonte usada na área de conteúdo (entradas, tarefas, captura). A interface do app não é afetada.
          </div>
          <select
            className="vscode-select"
            value={settings.fontFamily}
            onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
          >
            <optgroup label="Sans-serif">
              {FONT_FAMILIES.filter(f => !f.stack.includes('monospace') && !f.stack.includes('serif,')).map((font) => (
                <option key={font.id} value={font.id}>{font.label}</option>
              ))}
            </optgroup>
            <optgroup label="Monospace">
              {FONT_FAMILIES.filter(f => f.stack.includes('monospace')).map((font) => (
                <option key={font.id} value={font.id}>{font.label}</option>
              ))}
            </optgroup>
            <optgroup label="Serif">
              {FONT_FAMILIES.filter(f => f.stack.includes('serif,') && !f.stack.includes('sans-serif')).map((font) => (
                <option key={font.id} value={font.id}>{font.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Tamanho da Fonte</div>
          <div className="settings-item-description">
            Tamanho em pixels para a área de conteúdo ({settings.fontSize}px).
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>12</span>
            <input
              type="range"
              min="12"
              max="20"
              step="1"
              value={settings.fontSize}
              onChange={(e) => setSettings({ ...settings, fontSize: e.target.value })}
              style={{ flex: 1, maxWidth: 200 }}
            />
            <span style={{ fontSize: 11, opacity: 0.7 }}>20</span>
            <input
              type="number"
              className="vscode-input"
              min="12"
              max="20"
              value={settings.fontSize}
              onChange={(e) => {
                const val = Math.min(20, Math.max(12, Number(e.target.value)))
                setSettings({ ...settings, fontSize: String(val) })
              }}
              style={{ width: 56 }}
            />
          </div>
        </div>

        {/* Live Preview */}
        <div className="settings-item">
          <div className="settings-item-label">Pré-visualização</div>
          <div
            style={{
              marginTop: 8,
              padding: settings.uiDensity === 'compact' ? '10px' : '16px',
              borderRadius: 4,
              background: 'var(--vscode-editor-background)',
              border: '1px solid var(--vscode-panel-border)',
              fontFamily: FONT_FAMILIES.find(f => f.id === settings.fontFamily)?.stack || 'system-ui',
              fontSize: `${settings.fontSize}px`,
              lineHeight: 1.6,
            }}
          >
            <p>Reunião com equipe de produto sobre roadmap Q3.</p>
            <p style={{ marginTop: settings.uiDensity === 'compact' ? 4 : 8, opacity: 0.7 }}>Decisão: priorizar integração com calendário antes do módulo de relatórios.</p>
          </div>
        </div>
      </div>

      {/* Date Format & UI Density */}
      <div className="settings-group">
        <div className="settings-section-title">
          <Monitor size={16} />
          <span>Exibição</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Formato de Data</div>
          <div className="settings-item-description">
            Como as datas são exibidas na interface e nos exports.
          </div>
          <select
            className="vscode-select"
            value={settings.dateFormat}
            onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value as DateFormat })}
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY (brasileiro)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (americano)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </select>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Exemplo: {(() => {
              const now = new Date()
              const d = String(now.getDate()).padStart(2, '0')
              const m = String(now.getMonth() + 1).padStart(2, '0')
              const y = now.getFullYear()
              if (settings.dateFormat === 'DD/MM/YYYY') return `${d}/${m}/${y}`
              if (settings.dateFormat === 'MM/DD/YYYY') return `${m}/${d}/${y}`
              return `${y}-${m}-${d}`
            })()}
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Densidade da Interface</div>
          <div className="settings-item-description">
            Controla o espaçamento entre elementos. Compacta mostra mais informação por tela.
          </div>
          <div className="provider-toggle" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className={`vscode-button ${settings.uiDensity === 'comfortable' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, uiDensity: 'comfortable' })}
            >
              Confortável
            </button>
            <button
              className={`vscode-button ${settings.uiDensity === 'compact' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, uiDensity: 'compact' })}
            >
              Compacta
            </button>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex-row" style={{ marginTop: 16 }}>
        <button
          className="vscode-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  )

  const renderDadosTab = () => (
    <div className="settings-tab-content">
      {/* Backup & Restore */}
      <div className="settings-group">
        <div className="settings-section-title">
          <HardDrive size={16} />
          <span>Backup & Restauração</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Frequência de Backup</div>
          <div className="settings-item-description">
            Com que frequência backups automáticos são criados.
          </div>
          <select
            className="vscode-select"
            value={settings.backupFrequency}
            onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value as BackupFrequency })}
            style={{ marginTop: 6 }}
          >
            <option value="startup">A cada inicialização</option>
            <option value="4h">A cada 4 horas</option>
            <option value="8h">A cada 8 horas</option>
            <option value="12h">A cada 12 horas</option>
            <option value="disabled">Desativado</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Limite de Backups</div>
          <div className="settings-item-description">
            Máximo de backups automáticos mantidos. Os mais antigos são removidos ({settings.backupLimit} atualmente).
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>3</span>
            <input
              type="range"
              min="3"
              max="30"
              step="1"
              value={settings.backupLimit}
              onChange={(e) => setSettings({ ...settings, backupLimit: e.target.value })}
              style={{ flex: 1, maxWidth: 200 }}
            />
            <span style={{ fontSize: 11, opacity: 0.7 }}>30</span>
            <input
              type="number"
              className="vscode-input"
              min="3"
              max="30"
              value={settings.backupLimit}
              onChange={(e) => {
                const val = Math.min(30, Math.max(3, Number(e.target.value)))
                setSettings({ ...settings, backupLimit: String(val) })
              }}
              style={{ width: 56 }}
            />
          </div>
        </div>

        <div className="flex-row" style={{ gap: 8, marginBottom: 16 }}>
          <button
            className="vscode-button"
            onClick={handleExportBackup}
            disabled={backupLoading}
          >
            <Download size={14} style={{ marginRight: 4 }} />
            Exportar Backup
          </button>
          <button
            className="vscode-button secondary"
            onClick={handleImportBackup}
            disabled={backupLoading}
          >
            <Upload size={14} style={{ marginRight: 4 }} />
            Importar Backup
          </button>
        </div>

        {backups.length > 0 && (
          <div className="settings-item">
            <div className="settings-item-label">Backups Automáticos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 4,
                    background: 'var(--vscode-editor-background)',
                    border: '1px solid var(--vscode-panel-border)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13 }}>{formatDate(backup.createdAt)}</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{formatFileSize(backup.sizeBytes)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="icon-button"
                      title="Restaurar este backup"
                      onClick={() => handleRestoreBackup(backup.filePath)}
                      disabled={backupLoading}
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      className="icon-button"
                      title="Excluir backup"
                      onClick={() => handleDeleteBackup(backup.filePath)}
                      disabled={backupLoading}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {backups.length === 0 && (
          <div className="settings-item">
            <div className="settings-item-description" style={{ fontStyle: 'italic' }}>
              Nenhum backup automático encontrado. Um será criado na próxima inicialização.
            </div>
          </div>
        )}
      </div>

      {/* Database Path */}
      <div className="settings-group" style={{ marginTop: 24 }}>
        <div className="settings-section-title">
          <Database size={16} />
          <span>Local da Database</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-description">
            Configure onde a database é armazenada. Use uma pasta de nuvem (OneDrive, Dropbox, Google Drive)
            para sincronizar entre máquinas.
          </div>
        </div>

        {dbPathInfo && (
          <div className="settings-item">
            <div className="settings-item-label">Caminho atual</div>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                background: 'var(--vscode-editor-background)',
                border: '1px solid var(--vscode-panel-border)',
                fontSize: 12,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                marginTop: 4,
              }}
            >
              {dbPathInfo.currentPath}
            </div>
            {dbPathInfo.isCustom && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                Padrão: {dbPathInfo.defaultPath}
              </div>
            )}
          </div>
        )}

        <div className="flex-row" style={{ gap: 8, marginTop: 8 }}>
          <button
            className="vscode-button"
            onClick={handleChangeDatabasePath}
            disabled={dbPathLoading}
          >
            <FolderOpen size={14} style={{ marginRight: 4 }} />
            Alterar Local
          </button>
          {dbPathInfo?.isCustom && (
            <button
              className="vscode-button secondary"
              onClick={handleResetDatabasePath}
              disabled={dbPathLoading}
            >
              <RotateCcw size={14} style={{ marginRight: 4 }} />
              Restaurar Padrão
            </button>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="flex-row" style={{ marginTop: 16 }}>
        <button
          className="vscode-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  )

  const renderAvancadoTab = () => (
    <div className="settings-tab-content">
      {/* Comportamento do App */}
      <div className="settings-group">
        <div className="settings-section-title">
          <SettingsIcon size={16} />
          <span>Comportamento</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Ícone na Bandeja do Sistema (Tray)</div>
          <div className="settings-item-description">
            Mantém o app rodando em segundo plano ao fechar a janela. Quando desativado, fechar a janela encerra o app.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.trayEnabled === 'true'}
              onChange={(e) => setSettings({ ...settings, trayEnabled: e.target.checked ? 'true' : 'false' })}
            />
            <span style={{ fontSize: 13 }}>Ativar ícone na bandeja do sistema</span>
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Notificações Nativas do Sistema</div>
          <div className="settings-item-description">
            Exibe notificações do sistema operacional para tarefas vencidas, reuniões e lembretes.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.nativeNotifications === 'true'}
              onChange={(e) => setSettings({ ...settings, nativeNotifications: e.target.checked ? 'true' : 'false' })}
            />
            <span style={{ fontSize: 13 }}>Ativar notificações nativas</span>
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Intervalo de Verificação de Tarefas</div>
          <div className="settings-item-description">
            Com que frequência o app verifica tarefas vencidas e próximas do vencimento.
          </div>
          <select
            className="vscode-select"
            value={settings.taskCheckInterval}
            onChange={(e) => setSettings({ ...settings, taskCheckInterval: e.target.value as TaskCheckInterval })}
            style={{ marginTop: 6 }}
          >
            <option value="15">A cada 15 minutos</option>
            <option value="30">A cada 30 minutos</option>
            <option value="60">A cada 1 hora</option>
            <option value="disabled">Desativado</option>
          </select>
        </div>
      </div>

      {/* Daily Digest */}
      <div className="settings-group" style={{ marginTop: 24 }}>
        <div className="settings-section-title">
          <Sunrise size={16} />
          <span>Daily Digest</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Exibir ao iniciar o app</div>
          <div className="settings-item-description">
            Mostra um resumo do dia com tasks pendentes, atividade de ontem e sugestão de foco da IA.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.dailyDigestEnabled === 'true'}
              onChange={(e) => setSettings({ ...settings, dailyDigestEnabled: e.target.checked ? 'true' : 'false' })}
            />
            <span style={{ fontSize: 13 }}>Ativar Daily Digest no startup</span>
          </label>
        </div>

        {settings.dailyDigestEnabled === 'true' && (
          <div className="settings-item">
            <div className="settings-item-label">Seções visíveis</div>
            <div className="settings-item-description">
              Escolha quais seções aparecem no digest.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {[
                { key: 'aiSuggestion', label: '💡 Sugestão de foco (IA)' },
                { key: 'pendingTasks', label: '📋 Tasks pendentes' },
                { key: 'yesterdayActivity', label: '📅 Atividade de ontem' },
              ].map((section) => {
                const sections = settings.dailyDigestSections.split(',').filter(Boolean)
                const isChecked = sections.includes(section.key)
                return (
                  <label key={section.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        let updated: string[]
                        if (e.target.checked) {
                          updated = [...sections, section.key]
                        } else {
                          updated = sections.filter((s) => s !== section.key)
                        }
                        setSettings({ ...settings, dailyDigestSections: updated.join(',') })
                      }}
                    />
                    <span style={{ fontSize: 13 }}>{section.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts */}
      <div className="settings-group" style={{ marginTop: 24 }}>
        <div className="settings-section-title">
          <Keyboard size={16} />
          <span>Atalhos de Teclado</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-description">
            Atalhos disponíveis no app. Não são configuráveis no momento.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {[
              { keys: 'Ctrl+K', description: 'Busca global (projetos, entradas, tarefas)' },
              { keys: 'Ctrl+N', description: 'Nova captura rápida' },
              { keys: 'Ctrl+Shift+N', description: 'Nova captura (janela em foco)' },
              { keys: 'Esc', description: 'Fechar modais / cancelar ação' },
            ].map((shortcut) => (
              <div
                key={shortcut.keys}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 4,
                  background: 'var(--vscode-editor-background)',
                  border: '1px solid var(--vscode-panel-border)',
                }}
              >
                <span style={{ fontSize: 13 }}>{shortcut.description}</span>
                <kbd style={{
                  padding: '2px 8px',
                  borderRadius: 3,
                  background: 'var(--vscode-badge-background)',
                  color: 'var(--vscode-badge-foreground)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                }}>{shortcut.keys}</kbd>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logs & Diagnostics */}
      <div className="settings-group" style={{ marginTop: 24 }}>
        <div className="settings-section-title">
          <FileText size={16} />
          <span>Logs & Diagnóstico</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-description">
            Acesse os logs do app e a pasta de dados para diagnóstico de problemas.
          </div>
          <div className="flex-row" style={{ gap: 8, marginTop: 8 }}>
            <button
              className="vscode-button secondary"
              onClick={() => window.electronAPI.openLogsFolder()}
            >
              <FolderOpen size={14} style={{ marginRight: 4 }} />
              Abrir Pasta de Logs
            </button>
            <button
              className="vscode-button secondary"
              onClick={() => window.electronAPI.openUserDataFolder()}
            >
              <FolderOpen size={14} style={{ marginRight: 4 }} />
              Abrir Pasta do App
            </button>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex-row" style={{ marginTop: 16 }}>
        <button
          className="vscode-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="settings-group" style={{ marginTop: 24 }}>
        <div className="settings-section-title danger">
          <AlertTriangle size={16} />
          <span>Zona de Perigo</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">Resetar Database</div>
          <div className="settings-item-description">
            Remove todos os dados e começa do zero. A database atual será arquivada automaticamente
            na pasta de backups e poderá ser restaurada depois.
          </div>
          <button
            className="vscode-button"
            style={{
              marginTop: 8,
              background: 'var(--vscode-errorForeground)',
              color: 'white',
            }}
            onClick={handleResetDatabase}
            disabled={backupLoading}
          >
            <Trash2 size={14} style={{ marginRight: 4 }} />
            Resetar Database
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="settings-container">
      {/* Tab bar */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="settings-panel">
        {activeTab === 'geral' && renderGeralTab()}
        {activeTab === 'aparencia' && renderAparenciaTab()}
        {activeTab === 'dados' && renderDadosTab()}
        {activeTab === 'avancado' && renderAvancadoTab()}
      </div>

      <ConfirmModal
        isOpen={confirmModal !== null}
        title={confirmModal?.title ?? ''}
        message={confirmModal?.message ?? ''}
        confirmLabel={confirmModal?.confirmLabel ?? 'Confirmar'}
        cancelLabel={confirmModal?.cancelLabel ?? 'Cancelar'}
        alternativeLabel={confirmModal?.alternativeLabel}
        secondAlternativeLabel={confirmModal?.secondAlternativeLabel}
        variant={confirmModal?.variant ?? 'default'}
        onConfirm={confirmModal?.onConfirm ?? (() => { })}
        onCancel={() => setConfirmModal(null)}
        onAlternative={confirmModal?.onAlternative}
        onSecondAlternative={confirmModal?.onSecondAlternative}
      />
    </div>
  )
}
