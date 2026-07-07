import { app, BrowserWindow, globalShortcut } from 'electron'
import path from 'path'
import { registerIpcHandlers } from './ipc/handlers'
import { closeDatabase } from './database/schema'
import { NotificationService } from './services/notification-service'

let mainWindow: BrowserWindow | null = null
let notificationService: NotificationService | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 600,
    minHeight: 400,
    title: 'Work Organizer',
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
  closeDatabase()
})
