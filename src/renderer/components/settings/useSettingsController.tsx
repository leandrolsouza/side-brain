import type React from 'react'
import { useState, useEffect, useRef } from 'react'
import { HardDrive, Settings as SettingsIcon, Cpu, Type } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../ToastContext'
import { useApp } from '../AppContext'
import { useDatabaseSettings } from './useDatabaseSettings'
import type { SupportedLocale } from '../../i18n'

import { AVAILABLE_MODELS, type AIProvider, type AppSettings, type SettingsTab } from './settings-options'

export function useSettingsController() {
  const { addToast } = useToast()
  const { dispatch } = useApp()
  const {
    backups,
    backupLoading,
    dbPathInfo,
    dbPathLoading,
    confirmModal,
    setConfirmModal,
    handleExportBackup,
    handleImportBackup,
    handleRestoreBackup,
    handleDeleteBackup,
    handleResetDatabase,
    handleChangeDatabasePath,
    handleResetDatabasePath,
    formatFileSize,
    formatDate,
  } = useDatabaseSettings()
  const { t, i18n } = useTranslation('settings')
  const loadedCredentials = useRef<Partial<AppSettings>>({})
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
  const [secureStorageAvailable, setSecureStorageAvailable] = useState<boolean | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    loadSettings()
    window.electronAPI
      .secureStorageAvailable()
      .then(setSecureStorageAvailable)
      .catch(() => setSecureStorageAvailable(false))
  }, [])

  const loadSettings = async () => {
    const data = await window.electronAPI.getSettings()
    if (data) {
      setSettings(data as AppSettings)
      loadedCredentials.current = { ...data } as AppSettings
    }
  }

  const handleLanguageChange = async (locale: SupportedLocale) => {
    await i18n.changeLanguage(locale)
    await window.electronAPI.updateSettings({ language: locale })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updates: Partial<AppSettings> = { ...settings }
      for (const key of ['bedrockApiKey', 'openaiApiKey', 'geminiApiKey', 'grokApiKey', 'localApiKey'] as const) {
        if (updates[key] === loadedCredentials.current[key]) delete updates[key]
      }
      await window.electronAPI.updateSettings(updates)
      loadedCredentials.current = { ...settings }
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
        const bedrockModel = AVAILABLE_MODELS.find((m) => m.id === settings.modelId)
        modelName = bedrockModel ? bedrockModel.label.split(' (')[0] : settings.modelId
      }
      dispatch({ type: 'SET_MODEL_LABEL', label: `${provider} · ${modelName}` })
    } catch {
      addToast(t('save_error'), 'error')
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

  const getEmbeddingModelLabel = (provider: AIProvider): string => {
    switch (provider) {
      case 'openai':
        return 'text-embedding-3-small'
      case 'bedrock':
        return 'amazon.titan-embed-text-v2'
      case 'gemini':
        return 'text-embedding-004'
      case 'local':
        return settings.localModelId || 'local embedding'
      case 'grok':
        return t('geral.embedding_not_supported')
      default:
        return '—'
    }
  }

  return {
    t,
    i18n,
    activeTab,
    setActiveTab,
    settings,
    setSettings,
    isSaving,
    secureStorageAvailable,
    showApiKey,
    setShowApiKey,
    backups,
    backupLoading,
    dbPathInfo,
    dbPathLoading,
    confirmModal,
    setConfirmModal,
    handleLanguageChange,
    handleExportBackup,
    handleImportBackup,
    handleRestoreBackup,
    handleDeleteBackup,
    handleResetDatabase,
    handleChangeDatabasePath,
    handleResetDatabasePath,
    formatFileSize,
    formatDate,
    handleSave,
    tabs,
    getEmbeddingModelLabel,
  }
}

export type SettingsController = ReturnType<typeof useSettingsController>
