import { app, BrowserWindow, globalShortcut, nativeTheme, Tray, Menu, nativeImage, session, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

// Catch any uncaught errors during module loading
const startupLogPath = path.join(app.getPath('userData'), 'startup-error.log')
process.on('uncaughtException', (error) => {
  const msg = `[${new Date().toISOString()}] Uncaught Exception:\n${error.stack || error.message}\n\n`
  try { fs.appendFileSync(startupLogPath, msg) } catch { /* ignore */ }
  dialog.showErrorBox('SideBrain - Erro Fatal', error.stack || error.message || String(error))
  app.exit(1)
})

import { registerIpcHandlers } from './ipc/handlers'
import { closeDatabase } from './database/schema'
import { NotificationService } from './services/notification-service'
import { BackupService } from './services/backup-service'
import { getConfigService } from './services/config-service'
import { getErrorService } from './services/error-service'
import { getUpdaterService } from './services/updater-service'

let mainWindow: BrowserWindow | null = null
let notificationService: NotificationService | null = null
let lockRenewalInterval: ReturnType<typeof setInterval> | null = null
let tray: Tray | null = null

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 600,
    minHeight: 400,
    show: false,
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

  // Show maximized once ready
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  }, 10000)

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showTimeout)
    mainWindow!.maximize()
    mainWindow!.show()
  })

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '../../renderer/index.html')
    mainWindow.loadFile(indexPath).catch((err) => {
      const msg = `Failed to load: ${indexPath}\n${err.message}`
      fs.appendFileSync(startupLogPath, `[${new Date().toISOString()}] ${msg}\n`)
      dialog.showErrorBox('SideBrain - Erro ao carregar', msg)
    })
  }

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (mainWindow && !(app as any).isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerGlobalShortcut(): void {
  // Ctrl+Shift+Space to bring up quick capture
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      mainWindow.webContents.send('focus-capture-input')
    }
  })
}

function createTray(): void {
  // Create a simple 16x16 tray icon programmatically (brain emoji style - blue dot)
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
    'mElEQVQ4T2NkoBAwUqifgWoGMDIyNjAwMLxnYGD4T8gFjMgCYIPABjAx/GdgYPzP' +
    'wMDwn+E/E8P//0wMTP+ZGP7/Z2L8/5+R4T8jIwMDIyMjw38mJiYGRiYmBkYmZoZ/' +
    'TIwM/xgZGf8zMjH+Z2Ri/M/IxPifkYnxHyMT439GRkaG/4yMDP8ZGBj+MzAw/Gdg' +
    'YGCg2AAA0FkkEWuLLJEAAAAASUVORK5CYII='
  )

  tray = new Tray(icon)
  tray.setToolTip('SideBrain')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir SideBrain',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        (app as any).isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // Double-click on tray icon restores the window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  try {
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

    // Grant microphone permission for speech recognition
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowedPermissions = ['media', 'audioCapture', 'microphone']
      callback(allowedPermissions.includes(permission))
    })

    // Also handle permission checks (Chromium may check before requesting)
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      const allowedPermissions = ['media', 'audioCapture', 'microphone']
      return allowedPermissions.includes(permission)
    })

    // Set CSP via response headers (works correctly with file:// and asar)
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const csp = process.env.NODE_ENV === 'development'
        ? "default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:5173 https:; worker-src 'self' blob:; img-src 'self' data:"
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; img-src 'self' data:"
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp],
        },
      })
    })
    createWindow()
    createTray()
    registerGlobalShortcut()

    // Initialize auto-updater (only in production)
    if (process.env.NODE_ENV !== 'development') {
      const updaterService = getUpdaterService()
      updaterService.setMainWindow(mainWindow)
      // Check for updates after a short delay to not block startup
      setTimeout(() => {
        updaterService.checkForUpdates()
      }, 5000)
    }

    // Setup global error handlers for observability
    const errorService = getErrorService()
    errorService.setupGlobalHandlers()
    // Clean old resolved errors on startup
    errorService.cleanOldLogs()

    // Start notification service for deadline reminders
    notificationService = new NotificationService()
    notificationService.start()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  } catch (error: any) {
    const { dialog: dlg } = require('electron')
    dlg.showErrorBox('SideBrain - Erro ao iniciar', error?.stack || error?.message || String(error))
    app.quit()
  }
})

app.on('window-all-closed', () => {
  // On Windows/Linux, don't quit when windows are closed (app lives in tray)
  // Only quit explicitly via tray menu or when isQuitting is true
  if (process.platform === 'darwin') {
    // macOS: standard behavior
  }
})

app.on('before-quit', () => {
  (app as any).isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (notificationService) notificationService.stop()
  if (lockRenewalInterval) clearInterval(lockRenewalInterval)
  if (tray) {
    tray.destroy()
    tray = null
  }
  getConfigService().releaseLock()
  closeDatabase()
})
