import React, { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface AppSettings {
  awsRegion: string
  bedrockApiKey: string
  reviewEnabled: boolean
  modelId: string
}

const AVAILABLE_MODELS = [
  // Claude (Anthropic)
  { id: 'us.anthropic.claude-sonnet-5', label: 'Claude Sonnet 5 (mais capaz, 1M ctx)', category: 'Claude' },
  { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (equilibrado)', category: 'Claude' },
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (rápido + barato)', category: 'Claude' },
  // Amazon Nova
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

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    awsRegion: 'us-east-1',
    bedrockApiKey: '',
    reviewEnabled: true,
    modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const data = await window.electronAPI.getSettings()
    if (data) {
      setSettings(data as AppSettings)
    }
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

  return (
    <div className="flex-col">
      <div className="panel-header">
        <span className="panel-title">Configurações</span>
      </div>

      {/* AWS Region */}
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

        {/* API Key */}
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

        {/* Model */}
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

        {/* Review toggle */}
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
      <div className="flex-row">
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
}
