import { describe, expect, it, vi } from 'vitest'
import { redactLogText } from '../../../src/main/services/log-privacy'
import { createScopedLogger } from '../../../src/main/services/logger'

describe('log privacy', () => {
  it('redacts common tokens, emails and credential fields', () => {
    const input = '{"apiKey":"secret value"} Bearer abcdefghi token=12345 user@example.com'
    const result = redactLogText(input)
    expect(result).not.toContain('secret value')
    expect(result).not.toContain('abcdefghi')
    expect(result).not.toContain('12345')
    expect(result).not.toContain('user@example.com')
  })

  it('does not write structured payloads or raw exception messages', () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      createScopedLogger('test').error('Request failed', { prompt: 'private note' }, new Error('private token'))
      expect(JSON.stringify(output.mock.calls)).not.toContain('private note')
      expect(JSON.stringify(output.mock.calls)).not.toContain('private token')
    } finally {
      output.mockRestore()
    }
  })
})
