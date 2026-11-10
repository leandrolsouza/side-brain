import { Cpu, Cloud, Monitor, Eye, EyeOff } from 'lucide-react'

import { AVAILABLE_MODELS, OPENAI_MODELS, GEMINI_MODELS, GROK_MODELS, AWS_REGIONS } from './settings-options'
import type { SettingsController } from './useSettingsController'

export function GeneralSettings({ state }: { state: SettingsController }) {
  const {
    t,
    settings,
    setSettings,
    isSaving,
    secureStorageAvailable,
    showApiKey,
    setShowApiKey,
    handleSave,
    getEmbeddingModelLabel,
  } = state
  return (
    <div className="settings-tab-content">
      {secureStorageAvailable === false && <p role="alert">{t('secure_storage_unavailable')}</p>}
      {/* User Identity */}
      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-label">{t('geral.my_name_label')}</div>
          <div className="settings-item-description">{t('geral.my_name_description')}</div>
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
          <div className="settings-item-description">{t('geral.ai_provider_description')}</div>
          <div className="provider-toggle" style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`vscode-button ${settings.aiProvider === 'bedrock' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'bedrock' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Cloud size={14} />
              AWS Bedrock
            </button>
            <button
              type="button"
              className={`vscode-button ${settings.aiProvider === 'openai' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'openai' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Cpu size={14} />
              OpenAI
            </button>
            <button
              type="button"
              className={`vscode-button ${settings.aiProvider === 'gemini' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'gemini' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Cpu size={14} />
              Gemini
            </button>
            <button
              type="button"
              className={`vscode-button ${settings.aiProvider === 'grok' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'grok' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Cpu size={14} />
              Grok
            </button>
            <button
              type="button"
              className={`vscode-button ${settings.aiProvider === 'local' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, aiProvider: 'local' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Monitor size={14} />
              {t('geral.provider_local')}
            </button>
          </div>
          <div className="settings-embedding-model-hint">
            {t('geral.embedding_model_hint')}: <strong>{getEmbeddingModelLabel(settings.aiProvider)}</strong>
          </div>
        </div>
      </div>

      {/* Bedrock Settings */}
      {settings.aiProvider === 'bedrock' && (
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item-label">{t('geral.aws_region_label')}</div>
            <div className="settings-item-description">{t('geral.aws_region_description')}</div>
            <select
              className="vscode-select"
              value={settings.awsRegion}
              onChange={(e) => setSettings({ ...settings, awsRegion: e.target.value })}
            >
              {AWS_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">{t('geral.api_key_bedrock_label')}</div>
            <div className="settings-item-description">{t('geral.api_key_bedrock_description')}</div>
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
            <div className="settings-item-description">{t('geral.model_description')}</div>
            <select
              className="vscode-select"
              value={settings.modelId}
              onChange={(e) => setSettings({ ...settings, modelId: e.target.value })}
            >
              <optgroup label="Claude (Anthropic)">
                {AVAILABLE_MODELS.filter((m) => m.category === 'Claude').map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Amazon Nova">
                {AVAILABLE_MODELS.filter((m) => m.category === 'Nova').map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
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
            <div className="settings-item-description">{t('geral.api_key_openai_description')}</div>
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
            <div className="settings-item-description">{t('geral.model_openai_description')}</div>
            <select
              className="vscode-select"
              value={settings.openaiModelId}
              onChange={(e) => setSettings({ ...settings, openaiModelId: e.target.value })}
            >
              {OPENAI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
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
            <div className="settings-item-description">{t('geral.api_key_gemini_description')}</div>
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
            <div className="settings-item-description">{t('geral.model_gemini_description')}</div>
            <select
              className="vscode-select"
              value={settings.geminiModelId}
              onChange={(e) => setSettings({ ...settings, geminiModelId: e.target.value })}
            >
              {GEMINI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
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
            <div className="settings-item-description">{t('geral.api_key_grok_description')}</div>
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
            <div className="settings-item-description">{t('geral.model_grok_description')}</div>
            <select
              className="vscode-select"
              value={settings.grokModelId}
              onChange={(e) => setSettings({ ...settings, grokModelId: e.target.value })}
            >
              {GROK_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
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
            <div className="settings-item-description">{t('geral.local_endpoint_description')}</div>
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
            <div className="settings-item-description">{t('geral.local_model_description')}</div>
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
            <div className="settings-item-description">{t('geral.local_api_key_description')}</div>
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

          <div
            className="settings-item"
            style={{
              padding: '12px',
              borderRadius: 4,
              background: 'var(--vscode-editor-background)',
              border: '1px solid var(--vscode-panel-border)',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
              <strong>{t('geral.local_tip_prefix')}</strong> {t('geral.local_tip')}
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex-row" style={{ marginTop: 16 }}>
        <button type="button" className="vscode-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? t('save_button_saving') : t('save_button')}
        </button>
      </div>
    </div>
  )
}
