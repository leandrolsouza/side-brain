import { describe, it, expect, beforeEach, vi } from 'vitest'
import { net } from 'electron'
import { GeminiAdapter } from '../../../../src/main/services/ai-providers/gemini-adapter'
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
  geminiApiKey: 'gemini-key-123',
  geminiModelId: 'gemini-test-model',
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

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter
  let usage: ReturnType<typeof makeUsage>

  beforeEach(() => {
    vi.clearAllMocks()
    usage = makeUsage()
    adapter = new GeminiAdapter(usage as unknown as UsageTracker)
  })

  describe('invoke', () => {
    it('deve montar URL com modelo e API key e body no formato Gemini', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          candidates: [{ content: { parts: [{ text: 'resposta' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 },
        })
      )

      await adapter.invoke('system prompt', 'mensagem', settings, 'categorization')

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent?key=gemini-key-123'
      )
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json' })

      const body = JSON.parse(init!.body as string)
      expect(body.systemInstruction).toEqual({ parts: [{ text: 'system prompt' }] })
      expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'mensagem' }] }])
      expect(body.generationConfig).toEqual({ temperature: 0.3, maxOutputTokens: 2048 })
    })

    it('deve retornar texto do candidate e registrar tokens do usageMetadata', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          candidates: [{ content: { parts: [{ text: 'texto gerado' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 },
        })
      )

      const result = await adapter.invoke('sys', 'user', settings, 'chat')

      expect(result).toBe('texto gerado')
      expect(usage.recordTokens).toHaveBeenCalledWith(10, 4, 'gemini-test-model', 'chat', expect.any(Number))
    })

    it('deve usar modelo padrão quando geminiModelId está vazio', async () => {
      fetchMock.mockResolvedValue(okResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }))

      await adapter.invoke('sys', 'user', { ...settings, geminiModelId: '' }, 'chat')

      expect(String(fetchMock.mock.calls[0][0])).toContain('/models/gemini-3.5-flash:')
    })

    it('deve lançar erro e logar quando resposta não tem conteúdo', async () => {
      fetchMock.mockResolvedValue(okResponse({ candidates: [] }))

      await expect(adapter.invoke('sys', 'user', settings, 'chat')).rejects.toThrow(
        'Gemini did not return a valid response'
      )
      expect(logErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'ai', message: 'Gemini retornou resposta inválida' })
      )
    })

    it('deve lançar erro em falha HTTP e logar 429 como warning', async () => {
      fetchMock.mockResolvedValue(errorResponse(429, 'quota exceeded'))

      await expect(adapter.invoke('sys', 'user', settings, 'chat')).rejects.toThrow(
        'Gemini API error (429): quota exceeded'
      )
      expect(logErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warning', message: 'Gemini API error (429)' })
      )
    })
  })

  describe('invokeWithTools', () => {
    it('deve montar functionDeclarations com tipos em maiúsculas', async () => {
      fetchMock.mockResolvedValue(okResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }))

      await adapter.invokeWithTools('sys', [{ role: 'user', content: 'oi' }], sampleTools, settings, 'agent_execution')

      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
      expect(body.tools).toEqual([
        {
          functionDeclarations: [
            {
              name: 'read_tasks',
              description: 'Lê tarefas',
              parameters: {
                type: 'object',
                properties: {
                  status: { type: 'STRING', description: 'Status', enum: ['todo', 'done'] },
                },
                required: ['status'],
              },
            },
          ],
        },
      ])
      expect(body.generationConfig.maxOutputTokens).toBe(4096)
    })

    it('deve omitir tools quando lista está vazia', async () => {
      fetchMock.mockResolvedValue(okResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }))

      await adapter.invokeWithTools('sys', [{ role: 'user', content: 'oi' }], [], settings, 'agent_execution')

      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
      expect(body.tools).toBeUndefined()
    })

    it('deve converter histórico para o formato de contents do Gemini', async () => {
      fetchMock.mockResolvedValue(okResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }))

      const messages: ChatMessage[] = [
        { role: 'user', content: 'pergunta' },
        {
          role: 'assistant',
          content: 'vou consultar',
          toolCalls: [{ id: 'c1', function: { name: 'read_tasks', arguments: '{"status":"todo"}' } }],
        },
        { role: 'tool', content: '{"tasks":[]}', toolCallId: 'read_tasks' },
        { role: 'assistant', content: 'resposta simples' },
      ]

      await adapter.invokeWithTools('sys', messages, [], settings, 'agent_execution')

      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'pergunta' }] },
        {
          role: 'model',
          parts: [{ text: 'vou consultar' }, { functionCall: { name: 'read_tasks', args: { status: 'todo' } } }],
        },
        {
          role: 'user',
          parts: [{ functionResponse: { name: 'read_tasks', response: { result: '{"tasks":[]}' } } }],
        },
        { role: 'model', parts: [{ text: 'resposta simples' }] },
      ])
    })

    it('deve parsear functionCall como toolCall incompleto', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          candidates: [
            {
              content: {
                parts: [{ text: 'analisando' }, { functionCall: { name: 'read_tasks', args: { status: 'todo' } } }],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
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
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0].name).toBe('read_tasks')
      expect(result.toolCalls[0].arguments).toEqual({ status: 'todo' })
      expect(result.toolCalls[0].id).toBeTruthy()
      expect(usage.recordTokens).toHaveBeenCalledWith(5, 3, 'gemini-test-model', 'agent_execution', expect.any(Number))
    })

    it('deve retornar texto final quando não há functionCall', async () => {
      fetchMock.mockResolvedValue(okResponse({ candidates: [{ content: { parts: [{ text: 'resposta final' }] } }] }))

      const result = await adapter.invokeWithTools(
        'sys',
        [{ role: 'user', content: 'oi' }],
        [],
        settings,
        'agent_execution'
      )

      expect(result).toEqual({ text: 'resposta final', toolCalls: [], isComplete: true })
    })

    it('deve retornar resposta vazia completa quando não há candidates', async () => {
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
