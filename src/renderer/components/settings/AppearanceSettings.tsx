import { Monitor, Type, Globe } from 'lucide-react'
import type { SupportedLocale } from '../../i18n'

import { FONT_FAMILIES, LANGUAGE_OPTIONS, type DateFormat } from './settings-options'
import type { SettingsController } from './useSettingsController'

export function AppearanceSettings({ state }: { state: SettingsController }) {
  const { t, i18n, settings, setSettings, isSaving, handleLanguageChange, handleSave } = state
  return (
    <div className="settings-tab-content">
      {/* Language */}
      <div className="settings-group">
        <div className="settings-section-title">
          <Globe size={16} />
          <span>{t('aparencia.language_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('aparencia.language_label')}</div>
          <div className="settings-item-description">{t('aparencia.language_description')}</div>
          <select
            className="vscode-select"
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLocale)}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeName}
              </option>
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
          <div className="settings-item-description">{t('aparencia.font_family_description')}</div>
          <select
            className="vscode-select"
            value={settings.fontFamily}
            onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
          >
            <optgroup label={t('aparencia.font_group_sans')}>
              {FONT_FAMILIES.filter((f) => !f.stack.includes('monospace') && !f.stack.includes('serif,')).map(
                (font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                )
              )}
            </optgroup>
            <optgroup label={t('aparencia.font_group_mono')}>
              {FONT_FAMILIES.filter((f) => f.stack.includes('monospace')).map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('aparencia.font_group_serif')}>
              {FONT_FAMILIES.filter((f) => f.stack.includes('serif,') && !f.stack.includes('sans-serif')).map(
                (font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                )
              )}
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
              fontFamily: FONT_FAMILIES.find((f) => f.id === settings.fontFamily)?.stack || 'system-ui',
              fontSize: `${settings.fontSize}px`,
              lineHeight: 1.6,
            }}
          >
            <p>{t('aparencia.font_preview_text_1')}</p>
            <p style={{ marginTop: settings.uiDensity === 'compact' ? 4 : 8, opacity: 0.7 }}>
              {t('aparencia.font_preview_text_2')}
            </p>
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
          <div className="settings-item-description">{t('aparencia.date_format_description')}</div>
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
              })(),
            })}
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('aparencia.density_label')}</div>
          <div className="settings-item-description">{t('aparencia.density_description')}</div>
          <div className="provider-toggle" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className={`vscode-button ${settings.uiDensity === 'comfortable' ? '' : 'secondary'}`}
              onClick={() => setSettings({ ...settings, uiDensity: 'comfortable' })}
            >
              {t('aparencia.density_comfortable')}
            </button>
            <button
              type="button"
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
        <button type="button" className="vscode-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? t('save_button_saving') : t('save_button')}
        </button>
      </div>
    </div>
  )
}
