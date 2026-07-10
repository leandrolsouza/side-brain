import { safeHandle } from './safe-handle'
import { getUpdaterService } from '../services/updater-service'

// Read version directly from package.json to avoid Electron returning its own version in dev mode
// eslint-disable-next-line @typescript-eslint/no-require-imports
const APP_VERSION: string = require('../../../../package.json').version

export function registerUpdaterHandlers(): void {
  safeHandle('app:getVersion', async () => {
    return APP_VERSION
  })

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
