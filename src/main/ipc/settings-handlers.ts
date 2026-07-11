import { ipcMain, nativeTheme, shell, app } from 'electron'
import path from 'path'
import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import { enableTray, disableTray } from '../index'
import { setLocale } from '../i18n'

export function registerSettingsHandlers(): void {
  const { settingsRepo } = getContainer()

  safeHandle('settings:get', async () => {
    return settingsRepo.get()
  })

  safeHandle('settings:update', async (_event, settings: Record<string, any>) => {
    // Sync main process locale if language changed
    if (settings.language) {
      setLocale(settings.language as string)
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
  ipcMain.handle('theme:set', async (_event, theme: 'dark' | 'light') => {
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
