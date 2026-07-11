import { SmartChatMessage, SmartChatSource, ChatConversation } from '../../shared/types'
import { EntryRepository } from '../database/repositories/entry-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { ChatHistoryRepository } from '../database/repositories/chat-history-repository'
import { AIService } from './ai-service'
import { t } from '../i18n'
import { v4 as uuid } from 'uuid'

/** Maximum number of recent messages to include in context */
const MAX_HISTORY_MESSAGES = 20
/** Approximate character limit for conversation history in prompt (to avoid token overflow) */
const HISTORY_CHAR_LIMIT = 6000
/** If history exceeds this many messages, summarize older ones */
const SUMMARIZE_THRESHOLD = 30

export class SmartChatService {
  constructor(
    private entryRepo: EntryRepository,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private settingsRepo: SettingsRepository,
    private aiService: AIService,
    private chatHistoryRepo: ChatHistoryRepository
  ) { }

  /**
   * Send a message within a conversation. If no conversationId is provided,
   * creates a new conversation. Persists both user and assistant messages.
   */
  async chat(userMessage: string, conversationId?: string): Promise<SmartChatMessage & { conversationId: string }> {
    const settings = this.settingsRepo.get()

    // Resolve or create conversation
    let conversation: ChatConversation
    if (conversationId) {
      const existing = this.chatHistoryRepo.getConversationById(conversationId)
      if (existing) {
        conversation = existing
      } else {
        conversation = this.chatHistoryRepo.createConversation(this.generateTitle(userMessage))
      }
    } else {
      conversation = this.chatHistoryRepo.createConversation(this.generateTitle(userMessage))
    }

    // Persist user message
    const userMsg: SmartChatMessage = {
      id: uuid(),
      conversationId: conversation.id,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    }
    this.chatHistoryRepo.addMessage(conversation.id, userMsg)

    // Build conversation history for context
    const historyContext = this.buildHistoryContext(conversation.id)

    // Search for relevant data context based on the user's question
    const dataContext = this.gatherContext(userMessage)

    // Build the full user message with history + data context
    const fullUserMessage = this.buildFullMessage(userMessage, historyContext, dataContext)

    const systemPrompt = t('prompts.smart_chat.system')

    const responseText = await this.aiService.invokeConverseForChat(
      systemPrompt,
      fullUserMessage,
      settings,
      'smart_chat'
    )

    // Extract sources from the context that was used
    const sources = this.extractSources(userMessage)

    // Persist assistant message
    const assistantMsg: SmartChatMessage = {
      id: uuid(),
      conversationId: conversation.id,
      role: 'assistant',
      content: responseText,
      sources,
      createdAt: new Date().toISOString(),
    }
    this.chatHistoryRepo.addMessage(conversation.id, assistantMsg)

    // Check if we should summarize old messages
    this.maybeSummarizeHistory(conversation.id)

    return { ...assistantMsg, conversationId: conversation.id }
  }

  /**
   * Get all conversations (for sidebar listing).
   */
  getConversations(): ChatConversation[] {
    return this.chatHistoryRepo.getConversations()
  }

  /**
   * Get all messages for a conversation.
   */
  getMessages(conversationId: string): SmartChatMessage[] {
    return this.chatHistoryRepo.getMessages(conversationId)
  }

  /**
   * Create a new empty conversation.
   */
  createConversation(title?: string): ChatConversation {
    return this.chatHistoryRepo.createConversation(title || t('prompts.smart_chat.new_conversation'))
  }

  /**
   * Rename a conversation.
   */
  renameConversation(id: string, title: string): void {
    this.chatHistoryRepo.updateConversationTitle(id, title)
  }

  /**
   * Delete a conversation and all its messages.
   */
  deleteConversation(id: string): void {
    this.chatHistoryRepo.deleteConversation(id)
  }

  /**
   * Clear all conversations.
   */
  clearAllConversations(): void {
    this.chatHistoryRepo.clearAllConversations()
  }

  // === Private methods ===

  /**
   * Builds conversation history string from recent messages.
   * Respects character limits to avoid exceeding token budgets.
   */
  private buildHistoryContext(conversationId: string): string {
    const messages = this.chatHistoryRepo.getRecentMessages(conversationId, MAX_HISTORY_MESSAGES)

    // Exclude the last message (which is the current user message we just saved)
    const historyMessages = messages.slice(0, -1)

    if (historyMessages.length === 0) return ''

    let historyText = ''
    // Build from most recent backwards, respecting char limit
    for (let i = historyMessages.length - 1; i >= 0; i--) {
      const msg = historyMessages[i]
      const line = `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}\n`

      if (historyText.length + line.length > HISTORY_CHAR_LIMIT) {
        break
      }
      historyText = line + historyText
    }

    return historyText.trim()
  }

  /**
   * Combines history, data context, and user message into a single prompt.
   */
  private buildFullMessage(userMessage: string, historyContext: string, dataContext: string): string {
    const parts: string[] = []

    if (historyContext) {
      parts.push(`## Histórico da conversa:\n${historyContext}`)
    }

    if (dataContext) {
      parts.push(dataContext)
    }

    parts.push(`---\n${t('prompts.smart_chat.user_question_label', { defaultValue: 'Pergunta do usuário' })}: "${userMessage}"`)

    return parts.join('\n\n')
  }

  /**
   * Generates a short title from the first user message.
   */
  private generateTitle(message: string): string {
    // Take first 50 chars, trim at last space
    const maxLen = 50
    if (message.length <= maxLen) return message
    const truncated = message.slice(0, maxLen)
    const lastSpace = truncated.lastIndexOf(' ')
    return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + '...'
  }

  /**
   * If conversation has too many messages, summarize the older ones
   * by replacing them with a summary message. This keeps context manageable.
   */
  private maybeSummarizeHistory(conversationId: string): void {
    const count = this.chatHistoryRepo.getMessageCount(conversationId)
    if (count <= SUMMARIZE_THRESHOLD) return

    // For now, we rely on the character limit in buildHistoryContext
    // to naturally trim old messages. A future enhancement could
    // call the AI to generate a summary and store it as a special message.
    // This is a no-op placeholder for the summarization logic.
  }

  private gatherContext(query: string): string {
    const projects = this.projectRepo.getAll()
    const sections: string[] = []
    const noProject = t('prompts.smart_chat.no_project')

    // 1. Search entries matching the query
    const matchingEntries = this.entryRepo.search(query)
    if (matchingEntries.length > 0) {
      const entriesContext = matchingEntries.slice(0, 15).map((e) => {
        const projectName = projects.find((p) => p.id === e.projectId)?.name || noProject
        return `- [${e.type}][${projectName}][${e.createdAt.split('T')[0]}] ${e.improvedText}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_entries_found')}\n${entriesContext}`)
    }

    // 2. Search tasks matching the query
    const matchingTasks = this.taskRepo.search(query)
    if (matchingTasks.length > 0) {
      const tasksContext = matchingTasks.slice(0, 10).map((task) => {
        const projectName = projects.find((p) => p.id === task.projectId)?.name || noProject
        return `- [${task.status}][${projectName}] ${task.title}${task.description ? ` — ${task.description}` : ''}${task.dueDate ? ` (prazo: ${task.dueDate})` : ''}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_tasks_found')}\n${tasksContext}`)
    }

    // 3. Search projects matching the query
    const matchingProjects = this.projectRepo.search(query)
    if (matchingProjects.length > 0) {
      const projectsContext = matchingProjects.slice(0, 5).map((p) => {
        return `- ${p.name}${p.description ? `: ${p.description}` : ''}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_projects_found')}\n${projectsContext}`)
    }

    // 4. If direct search yielded little, add recent context
    if (matchingEntries.length < 3) {
      const recentEntries = this.entryRepo.getAll().slice(0, 10)
      const recentContext = recentEntries.map((e) => {
        const projectName = projects.find((p) => p.id === e.projectId)?.name || noProject
        return `- [${e.type}][${projectName}][${e.createdAt.split('T')[0]}] ${e.improvedText}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_recent_entries')}\n${recentContext}`)
    }

    // 5. Add active tasks overview
    const allTasks = this.taskRepo.getAll()
    const pendingTasks = allTasks.filter((task) => task.status !== 'done').slice(0, 10)
    if (pendingTasks.length > 0) {
      const tasksOverview = pendingTasks.map((task) => {
        const projectName = projects.find((p) => p.id === task.projectId)?.name || noProject
        return `- [${task.status}][${projectName}] ${task.title}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_pending_tasks')}\n${tasksOverview}`)
    }

    // 6. Add project list
    const projectList = projects.map((p) => `- ${p.name}`).join('\n')
    sections.push(`${t('prompts.smart_chat.context_active_projects')}\n${projectList}`)

    return sections.join('\n\n')
  }

  private extractSources(query: string): SmartChatSource[] {
    const sources: SmartChatSource[] = []
    const projects = this.projectRepo.getAll()

    const matchingEntries = this.entryRepo.search(query).slice(0, 3)
    for (const entry of matchingEntries) {
      const projectName = projects.find((p) => p.id === entry.projectId)?.name
      sources.push({
        type: 'entry',
        id: entry.id,
        label: entry.improvedText.slice(0, 60) + (entry.improvedText.length > 60 ? '...' : ''),
        projectName,
      })
    }

    const matchingTasks = this.taskRepo.search(query).slice(0, 2)
    for (const task of matchingTasks) {
      const projectName = projects.find((p) => p.id === task.projectId)?.name
      sources.push({
        type: 'task',
        id: task.id,
        label: task.title,
        projectName,
      })
    }

    return sources
  }
}
