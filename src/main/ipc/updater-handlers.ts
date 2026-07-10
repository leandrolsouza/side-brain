import { safeHandle } from './safe-handle'
import { getUpdaterService } from '../services/updater-service'

export function registerUpdaterHandlers(): void {
  safeHandle('updater:checkForUpdates', async () => {
    return getUpdaterService().checkForUpdates()
  })

  safeHandle('updater:downloadUpdate', async () => {
    await getUpdaterService().downloadUpdate()
  })

  safeHandle('updater:quitAndInstall', async () => {
    getUpdaterService().quitAndInstall()
  })

  safeHandle('updater:getStatus', async () => {
    return getUpdaterService().getStatus()
  })
}
