import { Download, Upload, Trash2, RotateCcw, HardDrive, FolderOpen, Database } from 'lucide-react'

import { type BackupFrequency } from './settings-options'
import type { SettingsController } from './useSettingsController'

export function DataSettings({ state }: { state: SettingsController }) {
  const {
    t,
    settings,
    setSettings,
    isSaving,
    backups,
    backupLoading,
    dbPathInfo,
    dbPathLoading,
    handleExportBackup,
    handleImportBackup,
    handleRestoreBackup,
    handleDeleteBackup,
    handleChangeDatabasePath,
    handleResetDatabasePath,
    formatFileSize,
    formatDate,
    handleSave,
  } = state
  return (
    <div className="settings-tab-content">
      {/* Backup & Restore */}
      <div className="settings-group">
        <div className="settings-section-title">
          <HardDrive size={16} />
          <span>{t('dados.backup_section_title')}</span>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">{t('dados.backup_frequency_label')}</div>
          <div className="settings-item-description">{t('dados.backup_frequency_description')}</div>
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
          <button type="button" className="vscode-button" onClick={handleExportBackup} disabled={backupLoading}>
            <Download size={14} style={{ marginRight: 4 }} />
            {t('dados.backup_export')}
          </button>
          <button
            type="button"
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
                      type="button"
                      className="icon-button"
                      title={t('dados.backup_restore_title')}
                      onClick={() => handleRestoreBackup(backup.filePath)}
                      disabled={backupLoading}
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      type="button"
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
          <div className="settings-item-description">{t('dados.db_description')}</div>
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
          <button type="button" className="vscode-button" onClick={handleChangeDatabasePath} disabled={dbPathLoading}>
            <FolderOpen size={14} style={{ marginRight: 4 }} />
            {t('dados.db_change_location')}
          </button>
          {dbPathInfo?.isCustom && (
            <button
              type="button"
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
        <button type="button" className="vscode-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? t('save_button_saving') : t('save_button')}
        </button>
      </div>
    </div>
  )
}
