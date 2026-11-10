import { describe, it, expect, beforeEach, vi } from 'vitest'
import { net } from 'electron'
import { BedrockAdapter } from '../../../../src/main/services/ai-providers/bedrock-adapter'
import type { UsageTracker } from '../../../../src/main/services/ai-providers/shared'
import type { ChatMessage } from '../../../../src/main/services/ai-providers/types'
import { DEFAULT_SETTINGS, type AppSettings, type ToolDefinition } from '../../../../src/shared/types'

const { logErrorMock } = vi.hoisted(() => ({ logErrorMock: vi.fn() }))

vi.mock('../../../../src/main/services/error-service', () => ({
  getErrorService: () => ({ logError: logErrorMock }),
}))

const fetchMock = vi.mocked(net.fetch)

function okResponse(data: unknown): Response {
  return { ok: true, json: async () => data } as unknown as Response
}

function errorResponse(status: number, text: string): Response {
  return { ok: false, status, text: async () => text } as unknown as Response
}

const settings: AppSettings = {
  ...DEFAULT_SETTINGS,
  awsRegion: 'us-west-2',
  modelId: 'anthropic.claude-test-v1',
  bedrockApiKey: 'bedrock-token-abc',
}

const sampleTools: ToolDefinition[] = [
  {
    name: 'read_tasks',
    description: 'Lê tarefas',
    parameters: {
      status: { type: 'string', description: 'Status', enum: ['todo', 'done'] },
    },
    requiredParams: ['status'],
  },
]

function makeUsage() {
  return {
    record: vi.fn(),
    recordTokens: vi.fn(),
    recordFree: vi.fn(),
  }
}

describe('BedrockAdapter', () => {
  let adapter: BedrockAdapter
  let usage: ReturnType<typeof makeUsage>

  beforeEach(() => {
    vi.clearAllMocks()
    usage = makeUsage()
    adapter = new BedrockAdapter(usage as unknown as UsageTracker)
  })

  describe('invoke', () => {
    it('deve montar URL do Converse API com região e modelo e header Bearer', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          output: { message: { content: [{ text: 'resposta' }] } },
          usage: { inputTokens: 12, outputTokens: 6 },
        })
      )

      await adapter.invoke('system prompt', 'mensagem', settings, 'categorization')

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://bedrock-runtime.us-west-2.amazonaws.com/model/anthropic.claude-test-v1/converse')
      expect(init!.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer bedrock-token-abc',
      })

      const body = JSON.parse(init!.body as string)
      expect(body.system).toEqual([{ text: 'system prompt' }])
      expect(body.messages).toEqual([{ role: 'user', content: [{ text: 'mensagem' }] }])
      expect(body.inferenceConfig).toEqual({ maxTokens: 2048, temperature: 0.3 })
    })

    it('deve retornar texto da resposta e registrar tokens', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          output: { message: { content: [{ text: 'texto bedrock' }] } },
          usage: { inputTokens: 12, outputTokens: 6 },
        })
      )

      const result = await adapter.invoke('sys', 'user', settings, 'chat')

      expect(result).toBe('texto bedrock')
      expect(usage.recordTokens).toHaveBeenCalledWith(12, 6, 'anthropic.claude-test-v1', 'chat', expect.any(Number))
    })

    it('deve lançar erro em falha HTTP e logar como critical para 5xx', async () => {
      fetchMock.mockResolvedValue(errorResponse(503, 'service unavailable'))

      await expect(adapter.invoke('sys', 'user', settings, 'chat')).rejects.toThrow('Bedrock API error (503)')
      expect(logErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'critical', message: 'Bedrock API error (503)' })
      )
    })
  })

  describe('invokeWithTools', () => {
    it('deve incluir toolConfig com toolSpec/inputSchema quando há tools', async () => {
      fetchMock.mockResolvedValue(okResponse({ output: { message: { content: [{ text: 'ok' }] } } }))

      await adapter.invokeWithTools('sys', [{ role: 'user', content: 'oi' }], sampleTools, settings, 'agent_execution')

      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
      expect(body.toolConfig).toEqual({
        tools: [
          {
            toolSpec: {
              name: 'read_tasks',
              description: 'Lê tarefas',
              inputSchema: {
                json: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', description: 'Status', enum: ['todo', 'done'] },
                  },
                  required: ['status'],
                },
              },
            },
          },
        ],
      })
      expect(body.inferenceConfig).toEqual({ maxTokens: 4096, temperature: 0.3 })
    })

    it('deve omitir toolConfig quando não há tools', async () => {
      fetchMock.mockResolvedValue(okResponse({ output: { message: { content: [{ text: 'ok' }] } } }))

      await adapter.invokeWithTools('sys', [{ role: 'user', content: 'oi' }], [], settings, 'agent_execution')

      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
      expect(body.toolConfig).toBeUndefined()
    })

    it('deve agrupar mensagens de tool consecutivas em uma única mensagem user', async () => {
      fetchMock.mockResolvedValue(okResponse({ output: { message: { content: [{ text: 'ok' }] } } }))

      const messages: ChatMessage[] = [
        { role: 'user', content: 'pergunta' },
        {
          role: 'assistant',
          content: 'vou consultar',
          toolCalls: [
            { id: 'c1', name: 'read_tasks', arguments: { status: 'todo' } },
            { id: 'c2', name: 'read_projects', arguments: {} },
          ],
        },
        { role: 'tool', content: 'resultado 1', toolCallId: 'c1' },
        { role: 'tool', content: 'resultado 2', toolCallId: 'c2' },
      ]

      await adapter.invokeWithTools('sys', messages, [], settings, 'agent_execution')

      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
      expect(body.messages).toHaveLength(3)
      expect(body.messages[0]).toEqual({ role: 'user', content: [{ text: 'pergunta' }] })
      expect(body.messages[1]).toEqual({
        role: 'assistant',
        content: [
          { text: 'vou consultar' },
          { toolUse: { toolUseId: 'c1', name: 'read_tasks', input: { status: 'todo' } } },
          { toolUse: { toolUseId: 'c2', name: 'read_projects', input: {} } },
        ],
      })
      expect(body.messages[2]).toEqual({
        role: 'user',
        content: [
          { toolResult: { toolUseId: 'c1', content: [{ text: 'resultado 1' }] } },
          { toolResult: { toolUseId: 'c2', content: [{ text: 'resultado 2' }] } },
        ],
      })
    })

    it('deve parsear blocos toolUse como toolCalls incompletos', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          output: {
            message: {
              content: [
                { text: 'analisando' },
                { toolUse: { toolUseId: 'tu-1', name: 'read_tasks', input: { status: 'todo' } } },
              ],
            },
          },
          usage: { inputTokens: 8, outputTokens: 4 },
        })
      )

      const result = await adapter.invokeWithTools(
        'sys',
        [{ role: 'user', content: 'oi' }],
        sampleTools,
        settings,
        'agent_execution'
      )

      expect(result.isComplete).toBe(false)
      expect(result.text).toBe('analisando')
      expect(result.toolCalls).toEqual([{ id: 'tu-1', name: 'read_tasks', arguments: { status: 'todo' } }])
      expect(usage.recordTokens).toHaveBeenCalledWith(
        8,
        4,
        'anthropic.claude-test-v1',
        'agent_execution',
        expect.any(Number)
      )
    })

    it('deve retornar texto final quando não há toolUse', async () => {
      fetchMock.mockResolvedValue(okResponse({ output: { message: { content: [{ text: 'resposta final' }] } } }))

      const result = await adapter.invokeWithTools(
        'sys',
        [{ role: 'user', content: 'oi' }],
        [],
        settings,
        'agent_execution'
      )

      expect(result).toEqual({ text: 'resposta final', toolCalls: [], isComplete: true })
    })

    it('deve retornar resposta vazia completa quando output é inválido', async () => {
      fetchMock.mockResolvedValue(okResponse({}))

      const result = await adapter.invokeWithTools(
        'sys',
        [{ role: 'user', content: 'oi' }],
        [],
        settings,
        'agent_execution'
      )

      expect(result).toEqual({ text: null, toolCalls: [], isComplete: true })
    })
  })
})
