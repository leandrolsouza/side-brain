import { describe, expect, it, vi } from 'vitest'
import { ipcMain } from 'electron'

const capture = vi.hoisted(() => ({ logError: vi.fn() }))
vi.mock('../../../src/main/services/error-service', () => ({ getErrorService: () => ({ logError: capture.logError }) }))
import { safeHandle } from '../../../src/main/ipc/safe-handle'

describe('IPC error privacy', () => {
  it('does not log arguments or the exception text', async () => {
    safeHandle('settings:update', async () => {
      throw new Error('private-secret and private-note')
    })
    const handler = vi.mocked(ipcMain.handle).mock.calls.at(-1)![1]
    await expect(
      handler({} as Electron.IpcMainInvokeEvent, { apiKey: 'private-secret', text: 'private-note' })
    ).rejects.toThrow()
    expect(JSON.stringify(capture.logError.mock.calls)).not.toContain('private-secret')
    expect(JSON.stringify(capture.logError.mock.calls)).not.toContain('private-note')
    expect(capture.logError).toHaveBeenCalledWith(expect.objectContaining({ context: { channel: 'settings:update' } }))
  })
})
