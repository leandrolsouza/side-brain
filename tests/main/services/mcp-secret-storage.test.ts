import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app, safeStorage } from 'electron'

const capture = vi.hoisted(() => ({ transport: null as any, connect: vi.fn(), close: vi.fn() }))
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {
    constructor(options: unknown) {
      capture.transport = options
    }
  },
}))
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    async connect() {
      capture.connect()
    }
    async listTools() {
      return { tools: [] }
    }
    async close() {
      capture.close()
    }
  },
}))
import { MCPManager } from '../../../src/main/services/mcp-manager'

describe('MCP secret storage', () => {
  let dir: string
  let manager: MCPManager
  beforeEach(() => {
    capture.connect.mockClear()
    capture.close.mockClear()
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidebrain-mcp-'))
    vi.mocked(app.getPath).mockReturnValue(dir)
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
    vi.mocked(safeStorage.encryptString).mockImplementation((value) => Buffer.from(`encrypted:${value}`))
    vi.mocked(safeStorage.decryptString).mockImplementation((value) => value.toString().slice('encrypted:'.length))
    manager = new MCPManager({} as any)
  })
  afterEach(() => {
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('keeps arguments and environment outside the config and passes them only to the subprocess', async () => {
    const server = manager.addServer({
      name: 'Test',
      command: 'program',
      args: ['--token=private-arg'],
      env: { API_KEY: 'private-secret' },
      enabled: true,
    })
    const text = fs.readFileSync(path.join(dir, 'mcp-servers.json'), 'utf-8')
    expect(text).not.toContain('private-secret')
    expect(text).not.toContain('private-arg')
    const secret = fs.readFileSync(path.join(dir, 'mcp-secrets', `${server.id}.secret`), 'utf-8')
    expect(secret).toMatch(/^enc::/)
    expect(manager.getConfigs()[0]).not.toHaveProperty('env')
    expect(manager.getConfigs()[0].args).toEqual([])
    await manager.connectServer(server.id)
    expect(capture.transport.args).toEqual(['--token=private-arg'])
    expect(capture.transport.env.API_KEY).toBe('private-secret')
  })

  it('preserva a conexão automática após reconexão e reinício, mas respeita a desconexão manual', async () => {
    const server = manager.addServer({
      name: 'Test',
      command: 'program',
      args: ['--configured'],
      env: { API_KEY: 'secret' },
      enabled: true,
    })

    await manager.connectServer(server.id)
    await manager.connectServer(server.id)

    expect(capture.connect).toHaveBeenCalledTimes(2)
    expect(capture.close).toHaveBeenCalledTimes(1)
    expect(manager.getConfigs()[0].enabled).toBe(true)
    expect(manager.getStatuses()[0].status).toBe('connected')

    await manager.disconnectAll()
    expect(manager.getConfigs()[0].enabled).toBe(true)
    const restarted = new MCPManager({} as any)
    await restarted.connectAll()

    expect(capture.connect).toHaveBeenCalledTimes(3)
    expect(restarted.getStatuses()[0].status).toBe('connected')
    expect(capture.transport.args).toEqual(['--configured'])
    expect(capture.transport.env.API_KEY).toBe('secret')

    await restarted.disconnectServer(server.id)
    expect(restarted.getConfigs()[0].enabled).toBe(false)
    const afterManualDisconnect = new MCPManager({} as any)
    await afterManualDisconnect.connectAll()
    expect(capture.connect).toHaveBeenCalledTimes(3)
    expect(afterManualDisconnect.getStatuses()[0].status).toBe('disconnected')
  })

  it('migrates legacy secrets before removing them from the existing config', async () => {
    const id = '12345678-1234-1234-1234-123456789abc'
    fs.writeFileSync(
      path.join(dir, 'mcp-servers.json'),
      JSON.stringify([
        { id, name: 'Legacy', command: 'program', args: ['arg-secret'], env: { TOKEN: 'old-secret' }, enabled: true },
      ])
    )
    expect(manager.getConfigs()[0].id).toBe(id)
    expect(fs.readFileSync(path.join(dir, 'mcp-servers.json'), 'utf-8')).not.toContain('old-secret')
    await manager.connectServer(id)
    expect(capture.transport.env.TOKEN).toBe('old-secret')
    expect(capture.transport.args).toEqual(['arg-secret'])
  })

  it('preserves legacy data and rejects writes while secure storage is unavailable', () => {
    const id = '12345678-1234-1234-1234-123456789abc'
    const original = JSON.stringify([
      { id, name: 'Legacy', command: 'program', args: [], env: { TOKEN: 'old-secret' }, enabled: true },
    ])
    fs.writeFileSync(path.join(dir, 'mcp-servers.json'), original)
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
    expect(manager.getConfigs()[0]).not.toHaveProperty('env')
    expect(() => manager.addServer({ name: 'Other', command: 'program', args: [], enabled: true })).toThrow()
    expect(fs.readFileSync(path.join(dir, 'mcp-servers.json'), 'utf-8')).toBe(original)
  })

  it('keeps the legacy config if encryption fails during migration', () => {
    const id = '12345678-1234-1234-1234-123456789abc'
    const original = JSON.stringify([
      { id, name: 'Legacy', command: 'program', args: ['old-arg'], env: { TOKEN: 'old-secret' }, enabled: true },
    ])
    fs.writeFileSync(path.join(dir, 'mcp-servers.json'), original)
    vi.mocked(safeStorage.encryptString).mockImplementation(() => {
      throw new Error('failure')
    })
    expect(manager.getConfigs()[0].args).toEqual([])
    expect(fs.readFileSync(path.join(dir, 'mcp-servers.json'), 'utf-8')).toBe(original)
    expect(() => manager.updateServer(id, { name: 'Changed' })).toThrow()
  })

  it('rejects new secrets instead of writing plaintext when encryption is unavailable', () => {
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
    expect(() =>
      manager.addServer({
        name: 'New',
        command: 'program',
        args: ['private-arg'],
        env: { TOKEN: 'private-secret' },
        enabled: true,
      })
    ).toThrow()
    expect(fs.existsSync(path.join(dir, 'mcp-servers.json'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'mcp-secrets'))).toBe(false)
  })
})
