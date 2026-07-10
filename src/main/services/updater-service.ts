import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'
import { getErrorService } from './error-service'

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  info?: UpdateInfo
  progress?: ProgressInfo
  error?: string
}

export class UpdaterService {
  private mainWindow: BrowserWindow | null = null
  private currentStatus: UpdateStatus = { status: 'not-available' }

  constructor() {
    // Disable auto download - let user decide
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    this.setupListeners()
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  private setupListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({ status: 'checking' })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateStatus({ status: 'available', info })
    })

    autoUpdater.on('update-not-available', (_info: UpdateInfo) => {
      this.updateStatus({ status: 'not-available' })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.updateStatus({ status: 'downloading', progress })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.updateStatus({ status: 'downloaded', info })
    })

    autoUpdater.on('error', (err: Error) => {
      const errorMessage = err.message || 'Erro desconhecido ao atualizar'

      // 404 is expected when no release is published yet - silently ignore
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        this.updateStatus({ status: 'not-available' })
        return
      }

      // Network errors during startup check are also non-critical
      if (errorMessage.includes('net::ERR_') || errorMessage.includes('ENOTFOUND')) {
        this.updateStatus({ status: 'not-available' })
        return
      }

      this.updateStatus({ status: 'error', error: errorMessage })

      // Log to error service but don't crash
      try {
        const errorService = getErrorService()
        errorService.logError({
          message: `Auto-update error: ${errorMessage}`,
          category: 'system',
          severity: 'warning',
          context: { stack: err.stack },
        })
      } catch {
        // Error service might not be ready
      }
    })
  }

  private updateStatus(status: UpdateStatus): void {
    this.currentStatus = status
    this.sendToRenderer('updater:status-changed', status)
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err: any) {
      this.updateStatus({ status: 'error', error: err.message })
    }
    return this.currentStatus
  }

  async downloadUpdate(): Promise<void> {
    await autoUpdater.downloadUpdate()
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true)
  }

  getStatus(): UpdateStatus {
    return this.currentStatus
  }
}

let updaterService: UpdaterService | null = null

export function getUpdaterService(): UpdaterService {
  if (!updaterService) {
    updaterService = new UpdaterService()
  }
  return updaterService
}
