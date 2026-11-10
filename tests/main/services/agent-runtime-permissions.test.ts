import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dialog } from 'electron'
import type { AgentDefinition } from '../../../src/shared/types'
import { AgentRuntime } from '../../../src/main/services/agent-runtime'

describe('AgentRuntime permissions', () => {
  const serverId = '12345678-aaaa-bbbb-cccc-123456789abc'
  const agent: AgentDefinition = {
    id: 'agent',
    name: 'Agent',
    description: '',
    persona: '',
    icon: 'Bot',
    color: 'blue',
    skills: ['mcp_tools'],
    scope: { projectIds: 'all', mcpTools: [] },
    triggers: [],
    canDelegate: [],
    maxSteps: 3,
    isActive: true,
    requiresApproval: false,
    createdAt: '',
    updatedAt: '',
  }
  const call = { id: 'call', name: 'mcp_12345678_send', arguments: { message: 'hello' } }
  let runtime: AgentRuntime
  let provider: any
  let repo: any
  let mcp: any

  beforeEach(() => {
    agent.skills = ['mcp_tools']
    agent.scope = { projectIds: 'all', mcpTools: [] }
    agent.canDelegate = []
    provider = {
      invokeWithTools: vi
        .fn()
        .mockResolvedValueOnce({ isComplete: false, toolCalls: [call] })
        .mockResolvedValueOnce({ isComplete: true, text: 'done', toolCalls: [] }),
    }
    repo = {
      getById: vi.fn(() => agent),
      createExecution: vi.fn(() => ({ id: 'execution' })),
      addStep: vi.fn(() => ({ id: 'step' })),
      completeStep: vi.fn(),
      updateExecutionStatus: vi.fn(),
      getStepsForExecution: vi.fn(() => []),
    }
    mcp = {
      getAllTools: vi.fn(() => [{ serverId, name: 'send', serverName: 'Server' }]),
      getToolDefinitions: vi.fn(() => [{ name: call.name, parameters: {}, requiredParams: [] }]),
      validateToolArguments: vi.fn(),
      callTool: vi.fn().mockResolvedValue({ success: true, result: 'ok' }),
    }
    const registry = { getToolsForAgent: vi.fn(() => []), validateArguments: vi.fn() }
    runtime = new AgentRuntime(provider, registry as any, repo, { get: () => ({}) } as any, mcp)
    vi.mocked(dialog.showMessageBox).mockReset()
  })

  it('rejects a model call that is not explicitly allowed', async () => {
    await runtime.execute(agent.id, 'run')
    expect(mcp.callTool).not.toHaveBeenCalled()
    expect(repo.completeStep).toHaveBeenCalledWith(
      'step',
      expect.objectContaining({ error: expect.any(String) }),
      'failed'
    )
  })

  it('requires confirmation even when the MCP tool is allowed', async () => {
    agent.scope.mcpTools = [{ serverId, name: 'send' }]
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false })
    await runtime.execute(agent.id, 'run')
    expect(mcp.callTool).not.toHaveBeenCalled()
    expect(repo.completeStep).toHaveBeenCalledWith(
      'step',
      expect.objectContaining({ error: expect.any(String) }),
      'failed'
    )
  })

  it('validates and executes only after approval', async () => {
    agent.scope.mcpTools = [{ serverId, name: 'send' }]
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false })
    await runtime.execute(agent.id, 'run')
    expect(mcp.validateToolArguments).toHaveBeenCalledWith(serverId, 'send', call.arguments)
    expect(mcp.callTool).toHaveBeenCalledWith(serverId, 'send', call.arguments)
  })

  it('rejects forged delegation without the delegate skill', async () => {
    provider.invokeWithTools
      .mockReset()
      .mockResolvedValueOnce({
        isComplete: false,
        toolCalls: [{ id: 'x', name: 'delegate', arguments: { agentId: 'other', message: 'run' } }],
      })
      .mockResolvedValueOnce({ isComplete: true, text: 'done', toolCalls: [] })
    agent.canDelegate = ['other']
    await runtime.execute(agent.id, 'run')
    expect(repo.createExecution).toHaveBeenCalledTimes(1)
    expect(repo.completeStep).toHaveBeenCalledWith(
      'step',
      expect.objectContaining({ error: expect.any(String) }),
      'failed'
    )
  })
  it('requires approval for a scheduled write even when the agent setting is disabled', async () => {
    agent.skills = ['create_task']
    const write = { id: 'write', name: 'create_task', arguments: { title: 'Task', projectName: 'Project' } }
    provider.invokeWithTools
      .mockReset()
      .mockResolvedValueOnce({ isComplete: false, toolCalls: [write] })
      .mockResolvedValueOnce({ isComplete: true, text: 'done', toolCalls: [] })
    const executeTool = vi.fn()
    const registry = {
      getToolsForAgent: vi.fn(() => [{ name: 'create_task', parameters: {}, requiredParams: [] }]),
      prepareCall: vi.fn((value) => value),
      getApprovalDetails: vi.fn(() => ({ arguments: write.arguments, project: null })),
      executeTool,
    }
    runtime = new AgentRuntime(provider, registry as any, repo, { get: () => ({}) } as any, mcp)
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false })
    await runtime.execute(agent.id, 'run', { trigger: 'schedule' })
    expect(dialog.showMessageBox).toHaveBeenCalled()
    expect(executeTool).not.toHaveBeenCalled()
  })
})
