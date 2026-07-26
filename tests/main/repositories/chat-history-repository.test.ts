import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { ChatHistoryRepository } from '../../../src/main/database/repositories/chat-history-repository'
import type { SmartChatSource } from '../../../src/shared/types'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('ChatHistoryRepository', () => {
  let repo: ChatHistoryRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new ChatHistoryRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('createConversation', () => {
    it('deve criar uma conversa com título', () => {
      const conversation = repo.createConversation('Dúvidas sobre o projeto')

      expect(conversation.id).toBeDefined()
      expect(conversation.title).toBe('Dúvidas sobre o projeto')
      expect(conversation.createdAt).toBeDefined()
      expect(conversation.updatedAt).toBe(conversation.createdAt)
    })
  })

  describe('getConversations', () => {
    it('deve retornar lista vazia quando não há conversas', () => {
      expect(repo.getConversations()).toEqual([])
    })

    it('deve retornar conversas ordenadas por updated_at desc', () => {
      const db = getTestDatabase()
      const antiga = repo.createConversation('Antiga')
      const recente = repo.createConversation('Recente')
      db.prepare('UPDATE chat_conversations SET updated_at = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z', antiga.id)
      db.prepare('UPDATE chat_conversations SET updated_at = ? WHERE id = ?').run(
        '2026-02-01T00:00:00.000Z',
        recente.id
      )

      const conversations = repo.getConversations()
      expect(conversations.map((c) => c.title)).toEqual(['Recente', 'Antiga'])
    })
  })

  describe('getConversationById', () => {
    it('deve retornar a conversa pelo ID', () => {
      const created = repo.createConversation('Minha Conversa')
      const found = repo.getConversationById(created.id)
      expect(found).not.toBeNull()
      expect(found!.title).toBe('Minha Conversa')
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.getConversationById('nao-existe')).toBeNull()
    })
  })

  describe('updateConversationTitle', () => {
    it('deve atualizar o título da conversa', () => {
      const conversation = repo.createConversation('Título Original')

      repo.updateConversationTitle(conversation.id, 'Título Novo')

      const found = repo.getConversationById(conversation.id)
      expect(found!.title).toBe('Título Novo')
    })

    it('deve atualizar o updated_at ao renomear', () => {
      const conversation = repo.createConversation('Conversa')

      repo.updateConversationTitle(conversation.id, 'Renomeada')

      const found = repo.getConversationById(conversation.id)
      expect(found!.updatedAt).not.toBe(conversation.updatedAt)
    })
  })

  describe('touchConversation', () => {
    it('deve atualizar o updated_at da conversa', () => {
      const conversation = repo.createConversation('Conversa')

      repo.touchConversation(conversation.id)

      const found = repo.getConversationById(conversation.id)
      // touchConversation usa datetime('now') do SQLite (formato diferente do ISO)
      expect(found!.updatedAt).not.toBe(conversation.updatedAt)
    })
  })

  describe('deleteConversation', () => {
    it('deve excluir a conversa', () => {
      const conversation = repo.createConversation('Para Excluir')

      repo.deleteConversation(conversation.id)

      expect(repo.getConversationById(conversation.id)).toBeNull()
    })

    it('deve excluir as mensagens em cascata', () => {
      const conversation = repo.createConversation('Com Mensagens')
      repo.addMessage(conversation.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Olá',
        createdAt: '2026-01-01T10:00:00.000Z',
      })

      repo.deleteConversation(conversation.id)

      expect(repo.getMessageCount(conversation.id)).toBe(0)
    })
  })

  describe('clearAllConversations', () => {
    it('deve excluir todas as conversas e mensagens', () => {
      const c1 = repo.createConversation('C1')
      const c2 = repo.createConversation('C2')
      repo.addMessage(c1.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Oi',
        createdAt: '2026-01-01T10:00:00.000Z',
      })

      repo.clearAllConversations()

      expect(repo.getConversations()).toEqual([])
      expect(repo.getMessageCount(c1.id)).toBe(0)
      expect(repo.getMessageCount(c2.id)).toBe(0)
    })
  })

  describe('addMessage', () => {
    it('deve adicionar mensagem preservando id e createdAt informados', () => {
      const conversation = repo.createConversation('Conversa')

      const message = repo.addMessage(conversation.id, {
        id: 'msg-fixo',
        role: 'user',
        content: 'Qual o status?',
        createdAt: '2026-01-01T10:00:00.000Z',
      })

      expect(message.id).toBe('msg-fixo')
      expect(message.conversationId).toBe(conversation.id)
      expect(message.role).toBe('user')
      expect(message.content).toBe('Qual o status?')
      expect(message.createdAt).toBe('2026-01-01T10:00:00.000Z')
    })

    it('deve gerar id e createdAt quando não informados', () => {
      const conversation = repo.createConversation('Conversa')

      const message = repo.addMessage(conversation.id, {
        id: '',
        role: 'assistant',
        content: 'Resposta',
        createdAt: '',
      })

      expect(message.id).toBeTruthy()
      expect(message.createdAt).toBeTruthy()
    })

    it('deve serializar sources como JSON e desserializar na leitura', () => {
      const conversation = repo.createConversation('Conversa')
      const sources: SmartChatSource[] = [
        { type: 'entry', id: 'entry-1', label: 'Entrada X', projectName: 'Projeto Y' },
        { type: 'task', id: 'task-1', label: 'Tarefa Z' },
      ]

      repo.addMessage(conversation.id, {
        id: 'msg-1',
        role: 'assistant',
        content: 'Com fontes',
        sources,
        createdAt: '2026-01-01T10:00:00.000Z',
      })

      const messages = repo.getMessages(conversation.id)
      expect(messages[0].sources).toEqual(sources)
    })

    it('deve retornar sources undefined quando não há fontes', () => {
      const conversation = repo.createConversation('Conversa')
      repo.addMessage(conversation.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Sem fontes',
        createdAt: '2026-01-01T10:00:00.000Z',
      })

      const messages = repo.getMessages(conversation.id)
      expect(messages[0].sources).toBeUndefined()
    })
  })

  describe('getMessages', () => {
    it('deve retornar mensagens em ordem cronológica asc', () => {
      const conversation = repo.createConversation('Conversa')
      repo.addMessage(conversation.id, {
        id: 'msg-2',
        role: 'assistant',
        content: 'Segunda',
        createdAt: '2026-01-01T10:01:00.000Z',
      })
      repo.addMessage(conversation.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Primeira',
        createdAt: '2026-01-01T10:00:00.000Z',
      })

      const messages = repo.getMessages(conversation.id)
      expect(messages.map((m) => m.content)).toEqual(['Primeira', 'Segunda'])
    })

    it('deve retornar apenas mensagens da conversa informada', () => {
      const c1 = repo.createConversation('C1')
      const c2 = repo.createConversation('C2')
      repo.addMessage(c1.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Na C1',
        createdAt: '2026-01-01T10:00:00.000Z',
      })
      repo.addMessage(c2.id, {
        id: 'msg-2',
        role: 'user',
        content: 'Na C2',
        createdAt: '2026-01-01T10:00:00.000Z',
      })

      const messages = repo.getMessages(c1.id)
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('Na C1')
    })

    it('deve retornar lista vazia para conversa sem mensagens', () => {
      const conversation = repo.createConversation('Vazia')
      expect(repo.getMessages(conversation.id)).toEqual([])
    })
  })

  describe('getRecentMessages', () => {
    it('deve retornar as últimas N mensagens em ordem cronológica', () => {
      const conversation = repo.createConversation('Conversa')
      for (let i = 1; i <= 4; i++) {
        repo.addMessage(conversation.id, {
          id: `msg-${i}`,
          role: i % 2 === 1 ? 'user' : 'assistant',
          content: `Mensagem ${i}`,
          createdAt: `2026-01-01T10:0${i}:00.000Z`,
        })
      }

      const recent = repo.getRecentMessages(conversation.id, 2)
      expect(recent.map((m) => m.content)).toEqual(['Mensagem 3', 'Mensagem 4'])
    })

    it('deve retornar todas quando o limite é maior que o total', () => {
      const conversation = repo.createConversation('Conversa')
      repo.addMessage(conversation.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Única',
        createdAt: '2026-01-01T10:00:00.000Z',
      })

      const recent = repo.getRecentMessages(conversation.id, 10)
      expect(recent).toHaveLength(1)
    })

    it('deve desserializar sources nas mensagens recentes', () => {
      const conversation = repo.createConversation('Conversa')
      const sources: SmartChatSource[] = [{ type: 'project', id: 'proj-1', label: 'Projeto' }]
      repo.addMessage(conversation.id, {
        id: 'msg-1',
        role: 'assistant',
        content: 'Com fonte',
        sources,
        createdAt: '2026-01-01T10:00:00.000Z',
      })

      const recent = repo.getRecentMessages(conversation.id, 5)
      expect(recent[0].sources).toEqual(sources)
    })
  })

  describe('getMessageCount', () => {
    it('deve contar as mensagens da conversa', () => {
      const conversation = repo.createConversation('Conversa')
      repo.addMessage(conversation.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Um',
        createdAt: '2026-01-01T10:00:00.000Z',
      })
      repo.addMessage(conversation.id, {
        id: 'msg-2',
        role: 'assistant',
        content: 'Dois',
        createdAt: '2026-01-01T10:01:00.000Z',
      })

      expect(repo.getMessageCount(conversation.id)).toBe(2)
    })

    it('deve retornar 0 para conversa sem mensagens', () => {
      const conversation = repo.createConversation('Vazia')
      expect(repo.getMessageCount(conversation.id)).toBe(0)
    })
  })

  describe('deleteMessage', () => {
    it('deve excluir uma mensagem específica', () => {
      const conversation = repo.createConversation('Conversa')
      repo.addMessage(conversation.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Fica',
        createdAt: '2026-01-01T10:00:00.000Z',
      })
      repo.addMessage(conversation.id, {
        id: 'msg-2',
        role: 'user',
        content: 'Sai',
        createdAt: '2026-01-01T10:01:00.000Z',
      })

      repo.deleteMessage('msg-2')

      const messages = repo.getMessages(conversation.id)
      expect(messages).toHaveLength(1)
      expect(messages[0].id).toBe('msg-1')
    })
  })
})
