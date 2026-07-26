import {
  app,
  BrowserWindow,
  globalShortcut,
  nativeTheme,
  Tray,
  Menu,
  nativeImage,
  session,
  dialog,
  shell,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { initializeLogger, createScopedLogger } from './services/logger'

// Initialize structured logging as early as possible
initializeLogger()
const logger = createScopedLogger('main')

// Catch any uncaught errors during module loading
const startupLogPath = path.join(app.getPath('userData'), 'startup-error.log')
process.on('uncaughtException', (error) => {
  const msg = `[${new Date().toISOString()}] Uncaught Exception:\n${error.stack || error.message}\n\n`
  try {
    fs.appendFileSync(startupLogPath, msg)
  } catch {
    /* ignore */
  }
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
import { getContainer } from './services/container'

let mainWindow: BrowserWindow | null = null
let notificationService: NotificationService | null = null
let lockRenewalInterval: ReturnType<typeof setInterval> | null = null
let tray: Tray | null = null
let trayEnabled = true

/**
 * Returns the correct path to an asset file, handling both dev and packaged (asar) builds.
 * In production with asarUnpack, files are at app.asar.unpacked/assets/
 */
function getAssetPath(filename: string): string {
  if (app.isPackaged) {
    // When packaged, asarUnpack extracts files to app.asar.unpacked/
    return path.join(`${app.getAppPath()}.unpacked`, 'assets', filename)
  }
  // In development, __dirname is dist/main/main/, go up 3 levels to project root
  return path.join(__dirname, '..', '..', '..', 'assets', filename)
}

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
    icon: getAssetPath('icon.ico'),
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
      sandbox: true,
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

  // Security: block unexpected navigation (prevents XSS-driven redirects)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow Vite HMR in development
    if (process.env.NODE_ENV === 'development' && url.startsWith('http://localhost:5173')) {
      return
    }
    event.preventDefault()
  })

  // Security: control new window creation (links with target="_blank", window.open, etc.)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in the system's default browser
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Minimize to tray instead of closing (only when tray is enabled)
  mainWindow.on('close', (event) => {
    if (mainWindow && !(app as any).isQuitting && trayEnabled && tray) {
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
  // Use the app icon file for the tray
  const iconPath = getAssetPath('icon.ico')
  let icon = nativeImage.createFromPath(iconPath)

  // Fallback to PNG if ICO fails to load
  if (icon.isEmpty()) {
    const pngPath = getAssetPath('icon.png')
    icon = nativeImage.createFromPath(pngPath)
  }

  icon = icon.resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('SideBrain')

  const version = app.getVersion()

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `SideBrain v${version}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Captura Rápida',
      accelerator: 'CommandOrControl+Shift+Space',
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) mainWindow.show()
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
          mainWindow.webContents.send('focus-capture-input')
        }
      },
    },
    {
      label: 'Abrir SideBrain',
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) mainWindow.show()
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        ;(app as any).isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // Double-click on tray icon restores the window
  tray.on('double-click', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

export function enableTray(): void {
  trayEnabled = true
  if (!tray) {
    createTray()
  }
}

export function disableTray(): void {
  trayEnabled = false
  if (tray) {
    tray.destroy()
    tray = null
  }
}

export function isTrayEnabled(): boolean {
  return trayEnabled
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
      logger.warn(`[Lock] Database pode estar em uso por: ${lockResult.owner}`)
    }

    // Renovar lock a cada 2 minutos
    lockRenewalInterval = setInterval(
      () => {
        configService.renewLock()
      },
      2 * 60 * 1000
    )

    registerIpcHandlers()

    // Auto-connect enabled MCP servers
    const { mcpManager } = getContainer()
    mcpManager.connectAll().catch((err) => {
      logger.error('MCP auto-connect failed:', err)
    })

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
      const csp =
        process.env.NODE_ENV === 'development'
          ? "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:5173 http://localhost:5173 https:; worker-src 'self' blob:; img-src 'self' data:"
          : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; img-src 'self' data:"
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp],
        },
      })
    })
    createWindow()

    // Read tray setting and conditionally create tray
    const { settingsRepo } = getContainer()
    const currentSettings = settingsRepo.get()
    trayEnabled = currentSettings.trayEnabled !== 'false'
    if (trayEnabled) {
      createTray()
    }

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
  ;(app as any).isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (notificationService) notificationService.stop()
  if (lockRenewalInterval) clearInterval(lockRenewalInterval)
  if (tray) {
    tray.destroy()
    tray = null
  }
  // Disconnect MCP servers
  try {
    getContainer().mcpManager.disconnectAll()
  } catch {
    /* ignore */
  }
  getConfigService().releaseLock()
  closeDatabase()
})
