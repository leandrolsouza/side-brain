import React, { useState, useEffect } from 'react'
import { CheckCircle2, Download, Upload, Trash2, RotateCcw, HardDrive, AlertTriangle, FolderOpen, Database, Settings as SettingsIcon, Cpu, Cloud, Monitor, Type } from 'lucide-react'
import { ConfirmModal } from './ConfirmModal'
import { useToast } from './ToastContext'

interface SettingsProps {
}

type AIProvider = 'bedrock' | 'local'

interface AppSettings {
  aiProvider: AIProvider
  awsRegion: string
  bedrockApiKey: string
  modelId: string
  localEndpoint: string
  localModelId: string
  localApiKey: string
  fontFamily: string
  fontSize: string
  userName: string
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
  const [activeTab, setActiveTab] = useState<SettingsTab>('geral')
  const [settings, setSettings] = useState<AppSettings>({
    aiProvider: 'bedrock',
    awsRegion: 'us-east-1',
    bedrockApiKey: '',
    modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    localEndpoint: 'http://localhost:1234',
    localModelId: '',
    localApiKey: '',
    fontFamily: 'system-ui',
    fontSize: '14',
    userName: '',
  })
  const [isSaving, setIsSaving] = useState(false)
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
    variant: 'danger' | 'warning' | 'default'
    onConfirm: () => void
    onAlternative?: () => void
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

    setConfirmModal({
      title: 'Alterar local da database',
      message: 'O que deseja fazer com a database atual?\n\n• Mover dados = Transfere a database para o novo local\n• Criar nova = Começa uma database vazia (dados antigos permanecem no local atual)',
      confirmLabel: 'Mover dados',
      alternativeLabel: 'Criar nova',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        await executeDatabasePathChange(selectedPath, 'move')
      },
      onAlternative: async () => {
        setConfirmModal(null)
        await executeDatabasePathChange(selectedPath, 'new')
      },
    })
  }

  const executeDatabasePathChange = async (path: string, mode: 'move' | 'new') => {
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

    setConfirmModal({
      title: 'Restaurar local padrão',
      message: 'O que deseja fazer com a database atual?\n\n• Mover dados = Transfere de volta para o local padrão\n• Criar nova = Começa uma database vazia no local padrão',
      confirmLabel: 'Mover dados',
      alternativeLabel: 'Criar nova',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        await executeResetDatabasePath('move')
      },
      onAlternative: async () => {
        setConfirmModal(null)
        await executeResetDatabasePath('new')
      },
    })
  }

  const executeResetDatabasePath = async (mode: 'move' | 'new') => {
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
      addToast('Configurações salvas com sucesso', 'success')
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
            Escolha entre AWS Bedrock (nuvem) ou um LLM local (LM Studio, Ollama, etc).
          </div>
          <div className="provider-toggle" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className={`vscode-button ${settings.aiProvider === 'bedrock' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'bedrock' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Cloud size={14} />
              AWS Bedrock
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
            <input
              type="password"
              className="vscode-input"
              value={settings.localApiKey}
              onChange={(e) => setSettings({ ...settings, localApiKey: e.target.value })}
              placeholder="Deixe vazio se não necessário"
              style={{ maxWidth: 400 }}
            />
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
              padding: '16px',
              borderRadius: 4,
              background: 'var(--vscode-editor-background)',
              border: '1px solid var(--vscode-panel-border)',
              fontFamily: FONT_FAMILIES.find(f => f.id === settings.fontFamily)?.stack || 'system-ui',
              fontSize: `${settings.fontSize}px`,
              lineHeight: 1.6,
            }}
          >
            <p>Reunião com equipe de produto sobre roadmap Q3.</p>
            <p style={{ marginTop: 8, opacity: 0.7 }}>Decisão: priorizar integração com calendário antes do módulo de relatórios.</p>
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
        variant={confirmModal?.variant ?? 'default'}
        onConfirm={confirmModal?.onConfirm ?? (() => { })}
        onCancel={() => setConfirmModal(null)}
        onAlternative={confirmModal?.onAlternative}
      />
    </div>
  )
}
