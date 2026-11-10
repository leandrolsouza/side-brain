import { describe, expect, it, vi } from 'vitest'
import { MCPManager } from '../../../src/main/services/mcp-manager'

describe('MCP input validation', () => {
  it('enforces nested JSON Schema requirements before a tool runs', () => {
    const manager = new MCPManager({} as any)
    vi.spyOn(manager, 'getAllTools').mockReturnValue([
      {
        serverId: 'server',
        serverName: 'Server',
        name: 'send',
        description: '',
        inputSchema: {
          type: 'object',
          required: ['recipient'],
          additionalProperties: false,
          properties: {
            recipient: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 3 } } },
          },
        },
      },
    ])
    expect(() => manager.validateToolArguments('server', 'send', { recipient: { id: 'ab' } })).toThrow()
    expect(() => manager.validateToolArguments('server', 'send', { recipient: { id: 'abc' }, extra: true })).toThrow()
    expect(() => manager.validateToolArguments('server', 'send', { recipient: { id: 'abc' } })).not.toThrow()
  })
})
