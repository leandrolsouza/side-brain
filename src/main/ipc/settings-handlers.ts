import { nativeTheme, shell, app } from 'electron'
import path from 'node:path'
import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import { enableTray, disableTray } from '../index'
import { setLocale } from '../i18n'
import type { AppSettings } from '../../shared/types'

export function registerSettingsHandlers(): void {
  const { settingsRepo } = getContainer()

  safeHandle('settings:get', async () => {
    return settingsRepo.get()
  })

  safeHandle('settings:update', async (_event, settings: Partial<AppSettings>) => {
    // Sync main process locale if language changed
    if (settings.language) {
      setLocale(settings.language)
    }
    return settingsRepo.update(settings)
  })

  // Tray toggle — cria ou destrói o tray icon
  safeHandle('tray:toggle', async (_event, enabled: boolean) => {
    if (enabled) {
      enableTray()
    } else {
      disableTray()
    }
  })

  // Theme handler — sincroniza controles nativos (select dropdown) com o tema do app
  safeHandle('theme:set', async (_event, theme: 'dark' | 'light') => {
    nativeTheme.themeSource = theme
  })

  // System: open folders
  safeHandle('system:openLogsFolder', async () => {
    const logsPath = path.join(app.getPath('userData'), 'logs')
    await shell.openPath(logsPath)
  })

  safeHandle('system:openUserDataFolder', async () => {
    await shell.openPath(app.getPath('userData'))
  })
}
