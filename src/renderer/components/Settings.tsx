import React, { useState, useEffect } from 'react'
import { CheckCircle2, Download, Upload, Trash2, RotateCcw, HardDrive, AlertTriangle, FolderOpen, Database, Settings as SettingsIcon, Cpu, Cloud, Monitor, Type, Bell, Clock, Keyboard, FileText, Sunrise, Eye, EyeOff, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from './ConfirmModal'
import { useToast } from './ToastContext'
import { useApp } from './AppContext'
import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n'

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

const LANGUAGE_OPTIONS = [
  { code: 'pt-BR' as const, nativeName: 'Português (Brasil)' },
  { code: 'en' as const, nativeName: 'English' },
]

type SettingsTab = 'geral' | 'aparencia' | 'dados' | 'avancado'

export function Settings({ }: SettingsProps) {
  const { addToast } = useToast()
  const { dispatch } = useApp()
  const { t, i18n } = useTranslation('settings')
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

  const handleLanguageChange = async (locale: SupportedLocale) => {
    await i18n.changeLanguage(locale)
    await window.electronAPI.updateSettings({ language: locale })
  }

  const showBackupMessage = (type: 'success' | 'error', text: string) => {
    addToast(text, type === 'success' ? 'success' : 'error')
  }

  const handleExportBackup = async () => {
    setBackupLoading(true)
    try {
      const result = await window.electronAPI.createManualBackup()
      if (result.success) {
        showBackupMessage('success', t('dados.backup_export_success'))
      }
    } catch {
      showBackupMessage('error', t('dados.backup_export_error'))
    } finally {
      setBackupLoading(false)
    }
  }

  const handleImportBackup = async () => {
    setConfirmModal({
      title: t('modals.import_title'),
      message: t('modals.import_message'),
      confirmLabel: t('modals.import_confirm'),
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        setBackupLoading(true)
        try {
          const result = await window.electronAPI.importBackup()
          if (result.success) {
            showBackupMessage('success', t('dados.backup_import_success'))
          } else if (result.error && result.error !== 'Operação cancelada.') {
            showBackupMessage('error', result.error)
          }
        } catch {
          showBackupMessage('error', t('dados.backup_import_error'))
        } finally {
          setBackupLoading(false)
        }
      },
    })
  }

  const handleRestoreBackup = async (filePath: string) => {
    setConfirmModal({
      title: t('modals.restore_title'),
      message: t('modals.restore_message'),
      confirmLabel: t('modals.restore_confirm'),
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        setBackupLoading(true)
        try {
          const result = await window.electronAPI.restoreBackup(filePath)
          if (result.success) {
            showBackupMessage('success', t('dados.backup_restore_success'))
          } else if (result.error) {
            showBackupMessage('error', result.error)
          }
        } catch {
          showBackupMessage('error', t('dados.backup_restore_error'))
        } finally {
          setBackupLoading(false)
        }
      },
    })
  }

  const handleDeleteBackup = async (filePath: string) => {
    setConfirmModal({
      title: t('modals.delete_title'),
      message: t('modals.delete_message'),
      confirmLabel: t('modals.delete_confirm'),
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
      title: t('modals.reset_db_title'),
      message: t('modals.reset_db_message'),
      confirmLabel: t('modals.reset_db_confirm'),
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null)
        setBackupLoading(true)
        try {
          const result = await window.electronAPI.resetDatabase()
          if (result.success) {
            showBackupMessage('success', t('avancado.reset_db_success'))
          } else if (result.error) {
            showBackupMessage('error', result.error)
          }
        } catch {
          showBackupMessage('error', t('avancado.reset_db_error'))
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
      ? t('modals.change_db_message_exists')
      : t('modals.change_db_message')

    setConfirmModal({
      title: t('modals.change_db_title'),
      message,
      confirmLabel: t('modals.change_db_move'),
      alternativeLabel: t('modals.change_db_new'),
      secondAlternativeLabel: existsAtDestination ? t('modals.change_db_existing') : undefined,
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
        showBackupMessage('success', t('dados.db_change_success'))
      } else if (result.error) {
        showBackupMessage('error', result.error)
      }
    } catch {
      showBackupMessage('error', t('dados.db_change_error'))
    } finally {
      setDbPathLoading(false)
    }
  }

  const handleResetDatabasePath = async () => {
    if (!dbPathInfo?.isCustom) return

    const defaultPath = dbPathInfo.defaultPath
    const existsAtDefault = await window.electronAPI.checkDatabaseExists(defaultPath)

    const message = existsAtDefault
      ? t('modals.restore_default_message_exists')
      : t('modals.restore_default_message')

    setConfirmModal({
      title: t('modals.restore_default_title'),
      message,
      confirmLabel: t('modals.change_db_move'),
      alternativeLabel: t('modals.change_db_new'),
      secondAlternativeLabel: existsAtDefault ? t('modals.change_db_existing') : undefined,
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
        showBackupMessage('success', t('dados.db_restore_default_success'))
      } else if (result.error) {
        showBackupMessage('error', result.error)
      }
    } catch {
      showBackupMessage('error', t('dados.db_restore_default_error'))
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
      addToast(t('save_success'), 'success')

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
    { id: 'geral', label: t('tabs.geral'), icon: <SettingsIcon size={14} /> },
    { id: 'aparencia', label: t('tabs.aparencia'), icon: <Type size={14} /> },
    { id: 'dados', label: t('tabs.dados'), icon: <HardDrive size={14} /> },
    { id: 'avancado', label: t('tabs.avancado'), icon: <Cpu size={14} /> },
  ]

  const renderGeralTab = () => (
    <div className="settings-tab-content">
      {/* User Identity */}
      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-label">{t('geral.my_name_label')}</div>
          <div className="settings-item-description">
            {t('geral.my_name_description')}
          </div>
          <input
            type="text"
            className="vscode-input"
            value={settings.userName}
            onChange={(e) => setSettings({ ...settings, userName: e.target.value })}
            placeholder={t('geral.my_name_placeholder')}
            style={{ maxWidth: 260, marginTop: 6 }}
          />
        </div>
      </div>

      {/* Provider Selection */}
      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-label">{t('geral.ai_provider_label')}</div>
          <div className="settings-item-description">
            {t('geral.ai_provider_description')}
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
              {t('geral.provider_local')}
            </button>
          </div>
        </div>
      </div>

      {/* Bedrock Settings */}
      {settings.aiProvider === 'bedrock' && (
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item-label">{t('geral.aws_region_label')}</div>
            <div className="settings-item-description">
              {t('geral.aws_region_description')}
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
            <div className="settings-item-label">{t('geral.api_key_bedrock_label')}</div>
            <div className="settings-item-description">
              {t('geral.api_key_bedrock_description')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 400 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="vscode-input"
                value={settings.bedrockApiKey}
                onChange={(e) => setSettings({ ...settings, bedrockApiKey: e.target.value })}
                placeholder={t('geral.api_key_placeholder')}
                style={{ flex: 1 }}
              />
              <button
                className="icon-button"
                type="button"
                title={showApiKey ? t('geral.api_key_hide') : t('geral.api_key_show')}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">{t('geral.model_label')}</div>
            <div className="settings-item-description">
              {t('geral.model_description')}
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
            <div className="settings-item-label">{t('geral.api_key_openai_label')}</div>
            <div className="settings-item-description">
              {t('geral.api_key_openai_description')}
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
                title={showApiKey ? t('geral.api_key_hide') : t('geral.api_key_show')}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">{t('geral.model_label')}</div>
            <div className="settings-item-description">
              {t('geral.model_openai_description')}
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
            <div className="settings-item-label">{t('geral.api_key_gemini_label')}</div>
            <div className="settings-item-description">
              {t('geral.api_key_gemini_description')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 400 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="vscode-input"
                value={settings.geminiApiKey}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                placeholder={t('geral.api_key_placeholder')}
                style={{ flex: 1 }}
              />
              <button
                className="icon-button"
                type="button"
                title={showApiKey ? t('geral.api_key_hide') : t('geral.api_key_show')}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">{t('geral.model_label')}</div>
            <div className="settings-item-description">
              {t('geral.model_gemini_description')}
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
            <div className="settings-item-label">{t('geral.api_key_grok_label')}</div>
            <div className="settings-item-description">
              {t('geral.api_key_grok_description')}
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
                title={showApiKey ? t('geral.api_key_hide') : t('geral.api_key_show')}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">{t('geral.model_label')}</div>
            <div className="settings-item-description">
              {t('geral.model_grok_description')}
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
            <div className="settings-item-label">{t('geral.local_endpoint_label')}</div>
            <div className="settings-item-description">
              {t('geral.local_endpoint_description')}
            </div>
            <input
              type="text"
              className="vscode-input"
              value={settings.localEndpoint}
              onChange={(e) => setSettings({ ...settings, localEndpoint: e.target.value })}
              placeholder={t('geral.local_endpoint_placeholder')}
              style={{ maxWidth: 400 }}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-label">{t('geral.local_model_label')}</div>
            <div className="settings-item-description">
              {t('geral.local_model_description')}
            </div>
            <input
              type="text"
              className="vscode-input"
              value={settings.localModelId}
              onChange={(e) => setSettings({ ...settings, localModelId: e.target.value })}
              placeholder={t('geral.local_model_placeholder')}
              style={{ maxWidth: 400 }}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-label">{t('geral.local_api_key_label')}</div>
            <div className="settings-item-description">
              {t('geral.local_api_key_description')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 400 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="vscode-input"
                value={settings.localApiKey}
                onChange={(e) => setSettings({ ...settings, localApiKey: e.target.value })}
                placeholder={t('geral.local_api_key_placeholder')}
                style={{ flex: 1 }}
              />
              <button
                className="icon-button"
                type="button"
                title={showApiKey ? t('geral.api_key_hide') : t('geral.api_key_show')}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ flexShrink: 0 }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-item" style={{ padding: '12px', borderRadius: 4, background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)' }}>
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
              <strong>{t('geral.local_tip_prefix')}</strong> {t('geral.local_tip')}
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
          {isSaving ? t('save_button_saving') : t('save_button')}
        </button>
      </div>
    </div>
  )

  const renderAparenciaTab = () => (
    <div className="settings-tab-content">
      {/* Language */}
      <div className="settings-group">
        <div className="settings-section-title">
          <Globe size={16} />
          <span>{t('aparencia.language_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('aparencia.language_label')}</div>
          <div className="settings-item-description">
            {t('aparencia.language_description')}
          </div>
          <select
            className="vscode-select"
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLocale)}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>{option.nativeName}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-section-title">
          <Type size={16} />
          <span>{t('aparencia.font_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('aparencia.font_family_label')}</div>
          <div className="settings-item-description">
            {t('aparencia.font_family_description')}
          </div>
          <select
            className="vscode-select"
            value={settings.fontFamily}
            onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
          >
            <optgroup label={t('aparencia.font_group_sans')}>
              {FONT_FAMILIES.filter(f => !f.stack.includes('monospace') && !f.stack.includes('serif,')).map((font) => (
                <option key={font.id} value={font.id}>{font.label}</option>
              ))}
            </optgroup>
            <optgroup label={t('aparencia.font_group_mono')}>
              {FONT_FAMILIES.filter(f => f.stack.includes('monospace')).map((font) => (
                <option key={font.id} value={font.id}>{font.label}</option>
              ))}
            </optgroup>
            <optgroup label={t('aparencia.font_group_serif')}>
              {FONT_FAMILIES.filter(f => f.stack.includes('serif,') && !f.stack.includes('sans-serif')).map((font) => (
                <option key={font.id} value={font.id}>{font.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('aparencia.font_size_label')}</div>
          <div className="settings-item-description">
            {t('aparencia.font_size_description', { size: settings.fontSize })}
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
          <div className="settings-item-label">{t('aparencia.font_preview_label')}</div>
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
            <p>{t('aparencia.font_preview_text_1')}</p>
            <p style={{ marginTop: settings.uiDensity === 'compact' ? 4 : 8, opacity: 0.7 }}>{t('aparencia.font_preview_text_2')}</p>
          </div>
        </div>
      </div>

      {/* Date Format & UI Density */}
      <div className="settings-group">
        <div className="settings-section-title">
          <Monitor size={16} />
          <span>{t('aparencia.display_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('aparencia.date_format_label')}</div>
          <div className="settings-item-description">
            {t('aparencia.date_format_description')}
          </div>
          <select
            className="vscode-select"
            value={settings.dateFormat}
            onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value as DateFormat })}
          >
            <option value="DD/MM/YYYY">{t('aparencia.date_format_br')}</option>
            <option value="MM/DD/YYYY">{t('aparencia.date_format_us')}</option>
            <option value="YYYY-MM-DD">{t('aparencia.date_format_iso')}</option>
          </select>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            {t('aparencia.date_format_example', {
              example: (() => {
                const now = new Date()
                const d = String(now.getDate()).padStart(2, '0')
                const m = String(now.getMonth() + 1).padStart(2, '0')
                const y = now.getFullYear()
                if (settings.dateFormat === 'DD/MM/YYYY') return `${d}/${m}/${y}`
                if (settings.dateFormat === 'MM/DD/YYYY') return `${m}/${d}/${y}`
                return `${y}-${m}-${d}`
              })()
            })}
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('aparencia.density_label')}</div>
          <div className="settings-item-description">
            {t('aparencia.density_description')}
          </div>
          <div className="provider-toggle" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className={`vscode-button ${settings.uiDensity === 'comfortable' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, uiDensity: 'comfortable' })}
            >
              {t('aparencia.density_comfortable')}
            </button>
            <button
              className={`vscode-button ${settings.uiDensity === 'compact' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, uiDensity: 'compact' })}
            >
              {t('aparencia.density_compact')}
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
          {isSaving ? t('save_button_saving') : t('save_button')}
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
          <span>{t('dados.backup_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('dados.backup_frequency_label')}</div>
          <div className="settings-item-description">
            {t('dados.backup_frequency_description')}
          </div>
          <select
            className="vscode-select"
            value={settings.backupFrequency}
            onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value as BackupFrequency })}
            style={{ marginTop: 6 }}
          >
            <option value="startup">{t('dados.backup_frequency_startup')}</option>
            <option value="4h">{t('dados.backup_frequency_4h')}</option>
            <option value="8h">{t('dados.backup_frequency_8h')}</option>
            <option value="12h">{t('dados.backup_frequency_12h')}</option>
            <option value="disabled">{t('dados.backup_frequency_disabled')}</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('dados.backup_limit_label')}</div>
          <div className="settings-item-description">
            {t('dados.backup_limit_description', { count: settings.backupLimit })}
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
            {t('dados.backup_export')}
          </button>
          <button
            className="vscode-button secondary"
            onClick={handleImportBackup}
            disabled={backupLoading}
          >
            <Upload size={14} style={{ marginRight: 4 }} />
            {t('dados.backup_import')}
          </button>
        </div>

        {backups.length > 0 && (
          <div className="settings-item">
            <div className="settings-item-label">{t('dados.backup_auto_label')}</div>
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
                      title={t('dados.backup_restore_title')}
                      onClick={() => handleRestoreBackup(backup.filePath)}
                      disabled={backupLoading}
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      className="icon-button"
                      title={t('dados.backup_delete_title')}
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
              {t('dados.backup_none')}
            </div>
          </div>
        )}
      </div>

      {/* Database Path */}
      <div className="settings-group" style={{ marginTop: 24 }}>
        <div className="settings-section-title">
          <Database size={16} />
          <span>{t('dados.db_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-description">
            {t('dados.db_description')}
          </div>
        </div>

        {dbPathInfo && (
          <div className="settings-item">
            <div className="settings-item-label">{t('dados.db_current_path')}</div>
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
                {t('dados.db_default_label', { path: dbPathInfo.defaultPath })}
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
            {t('dados.db_change_location')}
          </button>
          {dbPathInfo?.isCustom && (
            <button
              className="vscode-button secondary"
              onClick={handleResetDatabasePath}
              disabled={dbPathLoading}
            >
              <RotateCcw size={14} style={{ marginRight: 4 }} />
              {t('dados.db_restore_default')}
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
          {isSaving ? t('save_button_saving') : t('save_button')}
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
          <span>{t('avancado.behavior_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('avancado.tray_label')}</div>
          <div className="settings-item-description">
            {t('avancado.tray_description')}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.trayEnabled === 'true'}
              onChange={(e) => setSettings({ ...settings, trayEnabled: e.target.checked ? 'true' : 'false' })}
            />
            <span style={{ fontSize: 13 }}>{t('avancado.tray_enable')}</span>
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('avancado.notifications_label')}</div>
          <div className="settings-item-description">
            {t('avancado.notifications_description')}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.nativeNotifications === 'true'}
              onChange={(e) => setSettings({ ...settings, nativeNotifications: e.target.checked ? 'true' : 'false' })}
            />
            <span style={{ fontSize: 13 }}>{t('avancado.notifications_enable')}</span>
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('avancado.task_check_label')}</div>
          <div className="settings-item-description">
            {t('avancado.task_check_description')}
          </div>
          <select
            className="vscode-select"
            value={settings.taskCheckInterval}
            onChange={(e) => setSettings({ ...settings, taskCheckInterval: e.target.value as TaskCheckInterval })}
            style={{ marginTop: 6 }}
          >
            <option value="15">{t('avancado.task_check_15')}</option>
            <option value="30">{t('avancado.task_check_30')}</option>
            <option value="60">{t('avancado.task_check_60')}</option>
            <option value="disabled">{t('avancado.task_check_disabled')}</option>
          </select>
        </div>
      </div>

      {/* Daily Digest */}
      <div className="settings-group" style={{ marginTop: 24 }}>
        <div className="settings-section-title">
          <Sunrise size={16} />
          <span>{t('avancado.digest_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('avancado.digest_show_label')}</div>
          <div className="settings-item-description">
            {t('avancado.digest_show_description')}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.dailyDigestEnabled === 'true'}
              onChange={(e) => setSettings({ ...settings, dailyDigestEnabled: e.target.checked ? 'true' : 'false' })}
            />
            <span style={{ fontSize: 13 }}>{t('avancado.digest_enable')}</span>
          </label>
        </div>

        {settings.dailyDigestEnabled === 'true' && (
          <div className="settings-item">
            <div className="settings-item-label">{t('avancado.digest_sections_label')}</div>
            <div className="settings-item-description">
              {t('avancado.digest_sections_description')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {[
                { key: 'aiSuggestion', label: t('avancado.digest_section_ai') },
                { key: 'pendingTasks', label: t('avancado.digest_section_tasks') },
                { key: 'yesterdayActivity', label: t('avancado.digest_section_yesterday') },
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
          <span>{t('avancado.shortcuts_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-description">
            {t('avancado.shortcuts_description')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {[
              { keys: 'Ctrl+K', description: t('avancado.shortcut_global_search') },
              { keys: 'Ctrl+N', description: t('avancado.shortcut_new_capture') },
              { keys: 'Ctrl+Shift+N', description: t('avancado.shortcut_new_capture_focus') },
              { keys: 'Esc', description: t('avancado.shortcut_close_modal') },
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
          <span>{t('avancado.logs_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-description">
            {t('avancado.logs_description')}
          </div>
          <div className="flex-row" style={{ gap: 8, marginTop: 8 }}>
            <button
              className="vscode-button secondary"
              onClick={() => window.electronAPI.openLogsFolder()}
            >
              <FolderOpen size={14} style={{ marginRight: 4 }} />
              {t('avancado.logs_open_folder')}
            </button>
            <button
              className="vscode-button secondary"
              onClick={() => window.electronAPI.openUserDataFolder()}
            >
              <FolderOpen size={14} style={{ marginRight: 4 }} />
              {t('avancado.logs_open_app_folder')}
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
          {isSaving ? t('save_button_saving') : t('save_button')}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="settings-group" style={{ marginTop: 24 }}>
        <div className="settings-section-title danger">
          <AlertTriangle size={16} />
          <span>{t('avancado.danger_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('avancado.reset_db_label')}</div>
          <div className="settings-item-description">
            {t('avancado.reset_db_description')}
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
            {t('avancado.reset_db_button')}
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
        confirmLabel={confirmModal?.confirmLabel ?? t('common:confirm')}
        cancelLabel={confirmModal?.cancelLabel ?? t('common:cancel')}
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
