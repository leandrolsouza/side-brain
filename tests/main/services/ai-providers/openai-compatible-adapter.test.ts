import { describe, it, expect, beforeEach, vi } from 'vitest'
import { net } from 'electron'
import {
  OpenAICompatibleAdapter,
  type OpenAICompatibleConfig,
  buildOpenAIMessages,
  buildOpenAITools,
  parseOpenAIToolResponse,
} from '../../../../src/main/services/ai-providers/openai-compatible-adapter'
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

const settings: AppSettings = { ...DEFAULT_SETTINGS }

function makeConfig(overrides: Partial<OpenAICompatibleConfig> = {}): OpenAICompatibleConfig {
  return {
    url: 'https://api.example.com/v1/chat/completions',
    bodyModel: 'test-model',
    trackingModel: 'test-model',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-test' },
    provider: 'test',
    errorLabel: 'TestProvider',
    httpErrorContext: { provider: 'test', model: 'test-model' },
    invalidResponseMessage: 'TestProvider retornou resposta inválida',
    treat429AsWarning: true,
    zeroCostInvoke: false,
    ...overrides,
  }
}

class TestAdapter extends OpenAICompatibleAdapter {
  constructor(
    usage: UsageTracker,
    private config: OpenAICompatibleConfig
  ) {
    super(usage)
  }

  protected getConfig(): OpenAICompatibleConfig {
    return this.config
  }
}

function makeUsage() {
  return {
    record: vi.fn(),
    recordTokens: vi.fn(),
    recordFree: vi.fn(),
  }
}

const sampleTools: ToolDefinition[] = [
  {
    name: 'read_tasks',
    description: 'Lê tarefas',
    parameters: {
      status: { type: 'string', description: 'Status', enum: ['todo', 'done'] },
      limit: { type: 'number', description: 'Limite' },
    },
    requiredParams: ['status'],
  },
]

describe('OpenAICompatibleAdapter', () => {
  let usage: ReturnType<typeof makeUsage>

  beforeEach(() => {
    vi.clearAllMocks()
    usage = makeUsage()
  })

  describe('invoke', () => {
    it('deve montar request no formato OpenAI Chat Completions', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig())
      fetchMock.mockResolvedValue(
        okResponse({
          choices: [{ message: { content: 'resposta' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        })
      )

      await adapter.invoke('system prompt', 'mensagem do usuário', settings, 'categorization')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.example.com/v1/chat/completions')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer sk-test' })

      const body = JSON.parse(init!.body as string)
      expect(body.model).toBe('test-model')
      expect(body.messages).toEqual([
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'mensagem do usuário' },
      ])
      expect(body.temperature).toBe(0.3)
      expect(body.max_tokens).toBe(2048)
    })

    it('deve retornar o conteúdo da resposta e registrar tokens', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig())
      fetchMock.mockResolvedValue(
        okResponse({
          choices: [{ message: { content: 'resposta ok' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        })
      )

      const result = await adapter.invoke('sys', 'user', settings, 'chat')

      expect(result).toBe('resposta ok')
      expect(usage.recordTokens).toHaveBeenCalledWith(10, 5, 'test-model', 'chat', expect.any(Number))
      expect(usage.recordFree).not.toHaveBeenCalled()
    })

    it('deve registrar custo zero quando zeroCostInvoke é true (providers locais)', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig({ zeroCostInvoke: true }))
      fetchMock.mockResolvedValue(
        okResponse({ choices: [{ message: { content: 'local' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } })
      )

      await adapter.invoke('sys', 'user', settings, 'chat')

      expect(usage.recordFree).toHaveBeenCalledWith(3, 2, 'test-model', 'chat', expect.any(Number))
      expect(usage.recordTokens).not.toHaveBeenCalled()
    })

    it('deve lançar erro e logar quando resposta não tem conteúdo', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig())
      fetchMock.mockResolvedValue(okResponse({ choices: [] }))

      await expect(adapter.invoke('sys', 'user', settings, 'chat')).rejects.toThrow(
        'TestProvider did not return a valid response'
      )
      expect(logErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'ai', message: 'TestProvider retornou resposta inválida' })
      )
    })

    it('deve lançar erro com status em falha HTTP e logar como critical para 5xx', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig())
      fetchMock.mockResolvedValue(errorResponse(500, 'internal error'))

      await expect(adapter.invoke('sys', 'user', settings, 'chat')).rejects.toThrow(
        'TestProvider API error (500): internal error'
      )
      expect(logErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'critical', message: 'TestProvider API error (500)' })
      )
    })

    it('deve logar 429 como warning quando treat429AsWarning é true', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig({ treat429AsWarning: true }))
      fetchMock.mockResolvedValue(errorResponse(429, 'rate limited'))

      await expect(adapter.invoke('sys', 'user', settings, 'chat')).rejects.toThrow('(429)')
      expect(logErrorMock).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warning' }))
    })
  })

  describe('invokeWithTools', () => {
    it('deve incluir tools e tool_choice quando há tools', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig())
      fetchMock.mockResolvedValue(okResponse({ choices: [{ message: { content: 'ok' } }] }))

      await adapter.invokeWithTools('sys', [{ role: 'user', content: 'oi' }], sampleTools, settings, 'agent_execution')

      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
      expect(body.tool_choice).toBe('auto')
      expect(body.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'read_tasks',
            description: 'Lê tarefas',
            parameters: {
              type: 'object',
              properties: {
                status: { type: 'string', description: 'Status', enum: ['todo', 'done'] },
                limit: { type: 'number', description: 'Limite' },
              },
              required: ['status'],
            },
          },
        },
      ])
      expect(body.max_tokens).toBe(4096)
    })

    it('deve omitir tools quando lista está vazia', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig())
      fetchMock.mockResolvedValue(okResponse({ choices: [{ message: { content: 'ok' } }] }))

      await adapter.invokeWithTools('sys', [{ role: 'user', content: 'oi' }], [], settings, 'agent_execution')

      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
      expect(body.tools).toBeUndefined()
      expect(body.tool_choice).toBeUndefined()
    })

    it('deve parsear tool_calls com argumentos em string JSON', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig())
      fetchMock.mockResolvedValue(
        okResponse({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [{ id: 'call-1', function: { name: 'read_tasks', arguments: '{"status":"todo"}' } }],
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
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
      expect(result.text).toBeNull()
      expect(result.toolCalls).toEqual([{ id: 'call-1', name: 'read_tasks', arguments: { status: 'todo' } }])
      expect(usage.record).toHaveBeenCalledWith(
        { prompt_tokens: 1, completion_tokens: 1 },
        'test-model',
        'agent_execution',
        expect.any(Number)
      )
    })

    it('deve retornar resposta final quando não há tool_calls', async () => {
      const adapter = new TestAdapter(usage as unknown as UsageTracker, makeConfig())
      fetchMock.mockResolvedValue(okResponse({ choices: [{ message: { content: 'resposta final' } }] }))

      const result = await adapter.invokeWithTools(
        'sys',
        [{ role: 'user', content: 'oi' }],
        [],
        settings,
        'agent_execution'
      )

      expect(result).toEqual({ text: 'resposta final', toolCalls: [], isComplete: true })
    })
  })

  describe('buildOpenAIMessages', () => {
    it('deve converter mensagens de tool e assistant com toolCalls', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'pergunta' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'c1', type: 'function', function: { name: 'read_tasks', arguments: '{}' } }],
        },
        { role: 'tool', content: '{"tasks":[]}', toolCallId: 'c1' },
        { role: 'assistant', content: 'resposta' },
      ]

      const result = buildOpenAIMessages('sys', messages)

      expect(result[0]).toEqual({ role: 'system', content: 'sys' })
      expect(result[1]).toEqual({ role: 'user', content: 'pergunta' })
      expect(result[2]).toEqual({
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_tasks', arguments: '{}' } }],
      })
      expect(result[3]).toEqual({ role: 'tool', content: '{"tasks":[]}', tool_call_id: 'c1' })
      expect(result[4]).toEqual({ role: 'assistant', content: 'resposta' })
    })
  })

  describe('buildOpenAITools', () => {
    it('deve omitir enum quando não definido', () => {
      const tools = buildOpenAITools([
        {
          name: 't',
          description: 'd',
          parameters: { q: { type: 'string', description: 'query' } },
          requiredParams: [],
        },
      ])

      expect(tools[0].function.parameters.properties.q).toEqual({ type: 'string', description: 'query' })
      expect('enum' in tools[0].function.parameters.properties.q).toBe(false)
    })
  })

  describe('parseOpenAIToolResponse', () => {
    it('deve retornar resposta vazia completa quando não há choices', () => {
      expect(parseOpenAIToolResponse({})).toEqual({ text: null, toolCalls: [], isComplete: true })
    })

    it('deve gerar id para tool_call sem id', () => {
      const result = parseOpenAIToolResponse({
        choices: [{ message: { tool_calls: [{ function: { name: 'x', arguments: {} } }] } }],
      })

      expect(result.toolCalls[0].id).toBeTruthy()
      expect(result.toolCalls[0].name).toBe('x')
    })
  })
})
