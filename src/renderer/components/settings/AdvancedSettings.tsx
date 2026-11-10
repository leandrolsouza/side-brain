import {
  Trash2,
  AlertTriangle,
  FolderOpen,
  Settings as SettingsIcon,
  Keyboard,
  FileText,
  Sunrise,
  Search,
} from 'lucide-react'
import { EmbeddingsStatus } from '../EmbeddingsStatus'

import { type TaskCheckInterval } from './settings-options'
import type { SettingsController } from './useSettingsController'

export function AdvancedSettings({ state }: { state: SettingsController }) {
  const { t, settings, setSettings, isSaving, backupLoading, handleResetDatabase, handleSave } = state
  return (
    <div className="settings-tab-content">
      {/* Comportamento do App */}
      <div className="settings-group">
        <div className="settings-section-title">
          <SettingsIcon size={16} />
          <span>{t('avancado.behavior_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('avancado.tray_label')}</div>
          <div className="settings-item-description">{t('avancado.tray_description')}</div>
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
          <div className="settings-item-description">{t('avancado.notifications_description')}</div>
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
          <div className="settings-item-description">{t('avancado.task_check_description')}</div>
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
          <div className="settings-item-description">{t('avancado.digest_show_description')}</div>
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
            <div className="settings-item-description">{t('avancado.digest_sections_description')}</div>
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
          <div className="settings-item-description">{t('avancado.shortcuts_description')}</div>
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
                <kbd
                  style={{
                    padding: '2px 8px',
                    borderRadius: 3,
                    background: 'var(--vscode-badge-background)',
                    color: 'var(--vscode-badge-foreground)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortcut.keys}
                </kbd>
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
          <div className="settings-item-description">{t('avancado.logs_description')}</div>
          <div className="flex-row" style={{ gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="vscode-button secondary"
              onClick={() => window.electronAPI.openLogsFolder()}
            >
              <FolderOpen size={14} style={{ marginRight: 4 }} />
              {t('avancado.logs_open_folder')}
            </button>
            <button
              type="button"
              className="vscode-button secondary"
              onClick={() => window.electronAPI.openUserDataFolder()}
            >
              <FolderOpen size={14} style={{ marginRight: 4 }} />
              {t('avancado.logs_open_app_folder')}
            </button>
          </div>
        </div>
      </div>

      {/* Semantic Search (Embeddings) */}
      <div className="settings-group" style={{ marginTop: 24 }}>
        <div className="settings-section-title">
          <Search size={16} />
          <span>{t('avancado.embeddings_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-description">{t('avancado.embeddings_description')}</div>
          <EmbeddingsStatus />
        </div>
      </div>

      {/* Save */}
      <div className="flex-row" style={{ marginTop: 16 }}>
        <button type="button" className="vscode-button" onClick={handleSave} disabled={isSaving}>
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
          <div className="settings-item-description">{t('avancado.reset_db_description')}</div>
          <button
            type="button"
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
}
