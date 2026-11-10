import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updater } = vi.hoisted(() => ({
  updater: {
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    autoDownload: true,
    autoInstallOnAppQuit: false,
  },
}))

vi.mock('electron-updater', () => ({ autoUpdater: updater }))
vi.mock('../../../src/main/services/error-service', () => ({
  getErrorService: () => ({ logError: vi.fn() }),
}))

import { UpdaterService } from '../../../src/main/services/updater-service'

describe('UpdaterService', () => {
  beforeEach(() => {
    const events = new EventEmitter()
    updater.on.mockReset()
    updater.on.mockImplementation((event, handler) => events.on(event, handler))
    updater.checkForUpdates.mockReset()
  })

  it.each(['404 Not Found', 'net::ERR_INTERNET_DISCONNECTED', 'ENOTFOUND'])(
    'reports %s as an error',
    async (message) => {
      updater.checkForUpdates.mockRejectedValue(new Error(message))
      const service = new UpdaterService()
      await expect(service.checkForUpdates()).resolves.toEqual({ status: 'error', error: message })
    }
  )

  it('reports updater error events to the renderer', () => {
    const service = new UpdaterService()
    const send = vi.fn()
    service.setMainWindow({ isDestroyed: () => false, webContents: { send } } as never)
    const errorHandler = updater.on.mock.calls.find(([event]) => event === 'error')?.[1]
    errorHandler?.(new Error('404 Not Found'))
    expect(send).toHaveBeenCalledWith('updater:status-changed', { status: 'error', error: '404 Not Found' })
  })
})
