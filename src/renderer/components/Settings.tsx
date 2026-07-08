import React, { useState, useEffect } from 'react'
import { CheckCircle2, Download, Upload, Trash2, RotateCcw, HardDrive, AlertTriangle, FolderOpen, Database, Settings as SettingsIcon, Cpu } from 'lucide-react'

interface SettingsProps {
}

interface AppSettings {
  awsRegion: string
  bedrockApiKey: string
  reviewEnabled: boolean
  modelId: string
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

const AWS_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-northeast-1',
  'ap-southeast-1',
  'sa-east-1',
]

type SettingsTab = 'geral' | 'dados' | 'avancado'

export function Settings({ }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('geral')
  const [settings, setSettings] = useState<AppSettings>({
    awsRegion: 'us-east-1',
    bedrockApiKey: '',
    reviewEnabled: true,
    modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [backups, setBackups] = useState<{ filename: string; filePath: string; createdAt: string; sizeBytes: number }[]>([])
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [dbPathInfo, setDbPathInfo] = useState<{ currentPath: string; defaultPath: string; isCustom: boolean } | null>(null)
  const [dbPathLoading, setDbPathLoading] = useState(false)

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
    setBackupMessage({ type, text })
    setTimeout(() => setBackupMessage(null), 3000)
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
    if (!confirm('Restaurar um backup substituirá todos os dados atuais. Deseja continuar?')) return
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
  }

  const handleRestoreBackup = async (filePath: string) => {
    if (!confirm('Restaurar este backup substituirá todos os dados atuais. Deseja continuar?')) return
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
  }

  const handleDeleteBackup = async (filePath: string) => {
    if (!confirm('Excluir este backup permanentemente?')) return
    await window.electronAPI.deleteBackup(filePath)
    loadBackups()
  }

  const handleResetDatabase = async () => {
    const confirmed = confirm(
      'ATENÇÃO: Isso apagará TODOS os dados (projetos, entradas, tarefas, reuniões) e criará uma database nova.\n\n' +
      'A database atual será arquivada na pasta de backups.\n\n' +
      'Deseja continuar?'
    )
    if (!confirmed) return

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
  }

  const handleChangeDatabasePath = async () => {
    const selectedPath = await window.electronAPI.selectDatabaseFolder()
    if (!selectedPath) return

    const mode = confirm(
      'Deseja MOVER a database atual para o novo local?\n\n' +
      '• OK = Mover dados existentes\n' +
      '• Cancelar = Começar nova database no local'
    ) ? 'move' as const : 'new' as const

    if (mode === 'new') {
      if (!confirm('Isso criará uma database vazia no novo local. Os dados antigos ficarão no local anterior. Continuar?')) {
        return
      }
    }

    setDbPathLoading(true)
    try {
      const result = await window.electronAPI.setDatabasePath(selectedPath, mode)
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

    const mode = confirm(
      'Deseja MOVER a database de volta para o local padrão?\n\n' +
      '• OK = Mover dados de volta\n' +
      '• Cancelar = Começar nova database no local padrão'
    ) ? 'move' as const : 'new' as const

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
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'geral', label: 'Geral', icon: <SettingsIcon size={14} /> },
    { id: 'dados', label: 'Dados', icon: <HardDrive size={14} /> },
    { id: 'avancado', label: 'Avançado', icon: <Cpu size={14} /> },
  ]

  const renderGeralTab = () => (
    <div className="settings-tab-content">
      {/* AI Settings */}
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
          <input
            type="password"
            className="vscode-input"
            value={settings.bedrockApiKey}
            onChange={(e) => setSettings({ ...settings, bedrockApiKey: e.target.value })}
            placeholder="Cole aqui sua API Key..."
            style={{ maxWidth: 400 }}
          />
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

        <div className="settings-item">
          <label className="vscode-checkbox">
            <input
              type="checkbox"
              checked={settings.reviewEnabled}
              onChange={(e) => setSettings({ ...settings, reviewEnabled: e.target.checked })}
            />
            Habilitar revisão manual
          </label>
          <div className="settings-item-description" style={{ marginTop: 4, marginLeft: 24 }}>
            Aprovar categorização da IA antes de salvar definitivamente.
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
        {saved && (
          <div className="toast">
            <CheckCircle2 size={14} />
            Salvo com sucesso
          </div>
        )}
      </div>
    </div>
  )

  const renderDadosTab = () => (
    <div className="settings-tab-content">
      {backupMessage && (
        <div className={`toast ${backupMessage.type === 'error' ? 'toast-error' : ''}`} style={{ marginBottom: 12 }}>
          <CheckCircle2 size={14} />
          {backupMessage.text}
        </div>
      )}

      {/* Backup & Restore */}
      <div className="settings-group">
        <div className="settings-section-title">
          <HardDrive size={16} />
          <span>Backup & Restauração</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-description">
            Backups automáticos são criados a cada inicialização do app (máximo 7 mantidos).
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
    </div>
  )

  const renderAvancadoTab = () => (
    <div className="settings-tab-content">
      {backupMessage && (
        <div className={`toast ${backupMessage.type === 'error' ? 'toast-error' : ''}`} style={{ marginBottom: 12 }}>
          <CheckCircle2 size={14} />
          {backupMessage.text}
        </div>
      )}

      {/* Danger Zone */}
      <div className="settings-group">
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
        {activeTab === 'dados' && renderDadosTab()}
        {activeTab === 'avancado' && renderAvancadoTab()}
      </div>
    </div>
  )
}
