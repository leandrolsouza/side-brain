import { app, BrowserWindow, globalShortcut, nativeTheme } from 'electron'
import path from 'path'
import { registerIpcHandlers } from './ipc/handlers'
import { closeDatabase } from './database/schema'
import { NotificationService } from './services/notification-service'
import { BackupService } from './services/backup-service'
import { getConfigService } from './services/config-service'

let mainWindow: BrowserWindow | null = null
let notificationService: NotificationService | null = null
let lockRenewalInterval: ReturnType<typeof setInterval> | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 600,
    minHeight: 400,
    title: 'SideBrain',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#cccccc',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerGlobalShortcut(): void {
  // Ctrl+Shift+Space to bring up quick capture
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      mainWindow.webContents.send('focus-capture-input')
    }
  })
}

app.whenReady().then(() => {
  // Forçar tema escuro nos controles nativos (select dropdown, scrollbar, etc)
  nativeTheme.themeSource = 'dark'

  // Auto backup antes de abrir a database
  const backupService = new BackupService()
  backupService.createAutoBackup()

  // Adquirir lock file da database
  const configService = getConfigService()
  const lockResult = configService.acquireLock()
  if (!lockResult.acquired) {
    console.warn(`[Lock] Database pode estar em uso por: ${lockResult.owner}`)
  }

  // Renovar lock a cada 2 minutos
  lockRenewalInterval = setInterval(() => {
    configService.renewLock()
  }, 2 * 60 * 1000)

  registerIpcHandlers()
  createWindow()
  registerGlobalShortcut()

  // Start notification service for deadline reminders
  notificationService = new NotificationService()
  notificationService.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (notificationService) notificationService.stop()
  if (lockRenewalInterval) clearInterval(lockRenewalInterval)
  getConfigService().releaseLock()
  closeDatabase()
})
