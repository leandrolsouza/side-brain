import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { safeHandle } from './safe-handle'
import { getUpdaterService } from '../services/updater-service'

/**
 * Reads the app version from package.json.
 * In dev mode, app.getVersion() returns the Electron version because
 * Electron is launched pointing directly to the compiled JS entry file
 * rather than a directory containing package.json.
 * We walk up from __dirname until we find a package.json with name "sidebrain".
 */
function getAppVersion(): string {
  // First try app.getAppPath() (works in packaged/asar builds)
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    if (pkg.name === 'sidebrain' && pkg.version) return pkg.version
  } catch {
    // ignore
  }

  // In dev, walk up from this file's compiled location to find root package.json
  let dir = __dirname
  for (let i = 0; i < 6; i++) {
    try {
      const candidate = path.join(dir, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf-8'))
      if (pkg.name === 'sidebrain' && pkg.version) return pkg.version
    } catch {
      // ignore
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return app.getVersion()
}

export function registerUpdaterHandlers(): void {
  safeHandle('app:getVersion', async () => {
    return getAppVersion()
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
