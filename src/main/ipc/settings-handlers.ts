import { ipcMain, nativeTheme } from 'electron'
import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerSettingsHandlers(): void {
  const { settingsRepo } = getContainer()

  safeHandle('settings:get', async () => {
    return settingsRepo.get()
  })

  safeHandle('settings:update', async (_event, settings: Record<string, any>) => {
    return settingsRepo.update(settings)
  })

  // Theme handler — sincroniza controles nativos (select dropdown) com o tema do app
  ipcMain.handle('theme:set', async (_event, theme: 'dark' | 'light') => {
    nativeTheme.themeSource = theme
  })
}
