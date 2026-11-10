import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentCreator } from '../../../src/renderer/components/agent-studio/AgentCreator'
import type { AgentDefinition } from '../../../src/shared/types'

describe('AgentCreator MCP permissions', () => {
  it('saves only selected tools while preserving the existing project scope', async () => {
    const agent: AgentDefinition = {
      id: 'a',
      name: 'Test',
      description: '',
      persona: 'Persona',
      icon: 'Bot',
      color: 'blue',
      skills: ['mcp_tools'],
      scope: { projectIds: ['project'], mcpTools: [] },
      triggers: [],
      canDelegate: [],
      maxSteps: 3,
      isActive: true,
      requiresApproval: false,
      createdAt: '',
      updatedAt: '',
    }
    window.electronAPI.mcpGetTools = vi
      .fn()
      .mockResolvedValue([
        { serverId: 'server', serverName: 'Example', name: 'send', description: '', inputSchema: {} },
      ])
    const save = vi.fn()
    render(<AgentCreator agents={[]} isLoading={false} onCreate={save} onBack={vi.fn()} editingAgent={agent} />)
    const user = userEvent.setup()
    await user.click(await screen.findByLabelText('Example — send'))
    await user.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { projectIds: ['project'], mcpTools: [{ serverId: 'server', name: 'send' }] } })
    )
  })
})
