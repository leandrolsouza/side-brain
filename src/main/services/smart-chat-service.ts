import { SmartChatMessage, SmartChatSource, ChatConversation } from '../../shared/types'
import { EntryRepository } from '../database/repositories/entry-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { ChatHistoryRepository } from '../database/repositories/chat-history-repository'
import { AIService } from './ai-service'
import { EmbeddingsService, SimilarityResult } from './embeddings-service'
import { ChatActionExecutor } from './chat-action-executor'
import { t } from '../i18n'
import { v4 as uuid } from 'uuid'

/** Maximum number of recent messages to include in context */
const MAX_HISTORY_MESSAGES = 20
/** Approximate character limit for conversation history in prompt (to avoid token overflow) */
const HISTORY_CHAR_LIMIT = 6000
/** If history exceeds this many messages, summarize older ones */
const SUMMARIZE_THRESHOLD = 30

export class SmartChatService {
  private actionExecutor: ChatActionExecutor

  constructor(
    private entryRepo: EntryRepository,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private settingsRepo: SettingsRepository,
    private aiService: AIService,
    private chatHistoryRepo: ChatHistoryRepository,
    private embeddingsService?: EmbeddingsService
  ) {
    this.actionExecutor = new ChatActionExecutor(entryRepo, projectRepo, taskRepo)
  }

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
    const dataContext = await this.gatherContext(userMessage)

    // Build the full user message with history + data context
    const fullUserMessage = this.buildFullMessage(userMessage, historyContext, dataContext)

    const systemPrompt = t('prompts.smart_chat.system')

    // Add action instructions to the system prompt
    const actionsPrompt = this.getActionsSystemPrompt()
    const fullSystemPrompt = systemPrompt + '\n\n' + actionsPrompt

    const responseText = await this.aiService.invokeConverseForChat(
      fullSystemPrompt,
      fullUserMessage,
      settings,
      'smart_chat'
    )

    // Parse and execute any actions from the response
    const { cleanText, payloads } = this.actionExecutor.parseActions(responseText)
    let actions = undefined
    if (payloads.length > 0) {
      actions = await this.actionExecutor.executeActions(payloads)
    }

    // Extract sources from the context that was used
    const sources = await this.extractSources(userMessage)

    // Persist assistant message (with clean text, without action markers)
    const assistantMsg: SmartChatMessage = {
      id: uuid(),
      conversationId: conversation.id,
      role: 'assistant',
      content: cleanText || responseText,
      sources,
      actions: actions && actions.length > 0 ? actions : undefined,
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
   * Returns the action instructions appended to the system prompt.
   * Teaches the AI how to emit action markers when the user requests an action.
   */
  private getActionsSystemPrompt(): string {
    const projects = this.projectRepo.getAll()
    const projectNames = projects.slice(0, 10).map((p) => p.name).join(', ')

    return `## Ações disponíveis

Quando o usuário pedir para EXECUTAR algo (criar task, mover task, registrar entrada), você pode incluir um bloco de ação na sua resposta.

Formato: [ACTION]{"action":"tipo_acao", ...parâmetros}[/ACTION]

Ações disponíveis:
1. create_task — Criar uma tarefa
   Params: {"action":"create_task", "title":"...", "description":"...", "projectName":"...", "dueDate":"YYYY-MM-DD"}

2. update_task_status — Mudar status de uma tarefa
   Params: {"action":"update_task_status", "taskTitle":"...", "status":"todo|in_progress|waiting|done", "projectName":"..."}

3. create_entry — Criar uma entrada/registro
   Params: {"action":"create_entry", "text":"...", "projectName":"...", "type":"information|decision|demand|idea|blocker|update"}

4. list_tasks — Listar tarefas
   Params: {"action":"list_tasks", "projectName":"...", "status":"todo|in_progress|waiting|done"}

Regras para ações:
- Só emita ação quando o usuário EXPLICITAMENTE pedir para fazer algo (criar, mover, registrar, listar)
- Perguntas informativas (o que decidimos, qual status, etc.) NÃO devem gerar ações
- Sempre inclua uma resposta textual explicando o que fez
- Projetos disponíveis: ${projectNames || '(nenhum)'}
- Se o usuário não especificar projeto, use o mais relevante do contexto`
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

  private async gatherContext(query: string): Promise<string> {
    const projects = this.projectRepo.getAll()
    const sections: string[] = []
    const noProject = t('prompts.smart_chat.no_project')

    // Track which entry/task IDs we've already included (to avoid duplicates)
    const includedEntryIds = new Set<string>()
    const includedTaskIds = new Set<string>()

    // 1. Semantic search (if embeddings available)
    let semanticResults: SimilarityResult[] = []
    if (this.embeddingsService?.supportsEmbeddings()) {
      try {
        semanticResults = await this.embeddingsService.searchSimilar(query, 'all', 20, 0.35)
      } catch {
        // Fallback to textual only
      }
    }

    if (semanticResults.length > 0) {
      // Add semantically matched entries
      const semanticEntryIds = semanticResults
        .filter((r) => r.entityType === 'entry')
        .map((r) => r.entityId)

      if (semanticEntryIds.length > 0) {
        const semanticEntries = semanticEntryIds
          .map((id) => this.entryRepo.getById(id))
          .filter((e) => e !== null)
          .slice(0, 12)

        if (semanticEntries.length > 0) {
          const entriesContext = semanticEntries.map((e) => {
            includedEntryIds.add(e!.id)
            const projectName = projects.find((p) => p.id === e!.projectId)?.name || noProject
            return `- [${e!.type}][${projectName}][${e!.createdAt.split('T')[0]}] ${e!.improvedText}`
          }).join('\n')
          sections.push(`${t('prompts.smart_chat.context_entries_found')}\n${entriesContext}`)
        }
      }

      // Add semantically matched tasks
      const semanticTaskIds = semanticResults
        .filter((r) => r.entityType === 'task')
        .map((r) => r.entityId)

      if (semanticTaskIds.length > 0) {
        const semanticTasks = semanticTaskIds
          .map((id) => this.taskRepo.getById(id))
          .filter((t) => t !== null)
          .slice(0, 8)

        if (semanticTasks.length > 0) {
          const tasksContext = semanticTasks.map((task) => {
            includedTaskIds.add(task!.id)
            const projectName = projects.find((p) => p.id === task!.projectId)?.name || noProject
            return `- [${task!.status}][${projectName}] ${task!.title}${task!.description ? ` — ${task!.description}` : ''}${task!.dueDate ? ` (prazo: ${task!.dueDate})` : ''}`
          }).join('\n')
          sections.push(`${t('prompts.smart_chat.context_tasks_found')}\n${tasksContext}`)
        }
      }
    }

    // 2. Augment with textual search (adds entries not already found semantically)
    const matchingEntries = this.entryRepo.search(query)
    const newTextEntries = matchingEntries.filter((e) => !includedEntryIds.has(e.id))
    if (newTextEntries.length > 0 && includedEntryIds.size < 15) {
      const extra = newTextEntries.slice(0, 15 - includedEntryIds.size)
      const entriesContext = extra.map((e) => {
        includedEntryIds.add(e.id)
        const projectName = projects.find((p) => p.id === e.projectId)?.name || noProject
        return `- [${e.type}][${projectName}][${e.createdAt.split('T')[0]}] ${e.improvedText}`
      }).join('\n')

      if (semanticResults.length === 0) {
        // No semantic results, use textual as primary
        sections.push(`${t('prompts.smart_chat.context_entries_found')}\n${entriesContext}`)
      } else if (extra.length > 0) {
        sections.push(`## Resultados adicionais (busca textual):\n${entriesContext}`)
      }
    }

    // 3. Textual task search (augment)
    const matchingTasks = this.taskRepo.search(query)
    const newTextTasks = matchingTasks.filter((task) => !includedTaskIds.has(task.id))
    if (newTextTasks.length > 0 && includedTaskIds.size < 10) {
      const extra = newTextTasks.slice(0, 10 - includedTaskIds.size)
      const tasksContext = extra.map((task) => {
        includedTaskIds.add(task.id)
        const projectName = projects.find((p) => p.id === task.projectId)?.name || noProject
        return `- [${task.status}][${projectName}] ${task.title}${task.description ? ` — ${task.description}` : ''}${task.dueDate ? ` (prazo: ${task.dueDate})` : ''}`
      }).join('\n')

      if (semanticResults.length === 0 && sections.filter((s) => s.includes('Tarefas')).length === 0) {
        sections.push(`${t('prompts.smart_chat.context_tasks_found')}\n${tasksContext}`)
      } else if (extra.length > 0 && includedTaskIds.size > 0) {
        // Only add if not redundant
      }
    }

    // 4. Search projects matching the query
    const matchingProjects = this.projectRepo.search(query)
    if (matchingProjects.length > 0) {
      const projectsContext = matchingProjects.slice(0, 5).map((p) => {
        return `- ${p.name}${p.description ? `: ${p.description}` : ''}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_projects_found')}\n${projectsContext}`)
    }

    // 5. If little context found, add recent entries
    if (includedEntryIds.size < 3 && semanticResults.length === 0) {
      const recentEntries = this.entryRepo.getAll().slice(0, 10)
      const recentContext = recentEntries.map((e) => {
        const projectName = projects.find((p) => p.id === e.projectId)?.name || noProject
        return `- [${e.type}][${projectName}][${e.createdAt.split('T')[0]}] ${e.improvedText}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_recent_entries')}\n${recentContext}`)
    }

    // 6. Add active tasks overview
    const allTasks = this.taskRepo.getAll()
    const pendingTasks = allTasks.filter((task) => task.status !== 'done').slice(0, 10)
    if (pendingTasks.length > 0) {
      const tasksOverview = pendingTasks.map((task) => {
        const projectName = projects.find((p) => p.id === task.projectId)?.name || noProject
        return `- [${task.status}][${projectName}] ${task.title}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_pending_tasks')}\n${tasksOverview}`)
    }

    // 7. Add project list
    const projectList = projects.map((p) => `- ${p.name}`).join('\n')
    sections.push(`${t('prompts.smart_chat.context_active_projects')}\n${projectList}`)

    return sections.join('\n\n')
  }

  private async extractSources(query: string): Promise<SmartChatSource[]> {
    const sources: SmartChatSource[] = []
    const projects = this.projectRepo.getAll()
    const seenIds = new Set<string>()

    // Try semantic search first for more relevant sources
    if (this.embeddingsService?.supportsEmbeddings()) {
      try {
        const results = await this.embeddingsService.searchSimilar(query, 'all', 5, 0.4)
        for (const result of results) {
          if (result.entityType === 'entry' && !seenIds.has(result.entityId)) {
            const entry = this.entryRepo.getById(result.entityId)
            if (entry) {
              seenIds.add(entry.id)
              const projectName = projects.find((p) => p.id === entry.projectId)?.name
              sources.push({
                type: 'entry',
                id: entry.id,
                label: entry.improvedText.slice(0, 60) + (entry.improvedText.length > 60 ? '...' : ''),
                projectName,
              })
            }
          } else if (result.entityType === 'task' && !seenIds.has(result.entityId)) {
            const task = this.taskRepo.getById(result.entityId)
            if (task) {
              seenIds.add(task.id)
              const projectName = projects.find((p) => p.id === task.projectId)?.name
              sources.push({
                type: 'task',
                id: task.id,
                label: task.title,
                projectName,
              })
            }
          }
        }
      } catch { /* fallback to textual */ }
    }

    // Augment with textual search
    if (sources.length < 3) {
      const matchingEntries = this.entryRepo.search(query).slice(0, 3)
      for (const entry of matchingEntries) {
        if (seenIds.has(entry.id)) continue
        seenIds.add(entry.id)
        const projectName = projects.find((p) => p.id === entry.projectId)?.name
        sources.push({
          type: 'entry',
          id: entry.id,
          label: entry.improvedText.slice(0, 60) + (entry.improvedText.length > 60 ? '...' : ''),
          projectName,
        })
      }
    }

    if (sources.filter((s) => s.type === 'task').length < 2) {
      const matchingTasks = this.taskRepo.search(query).slice(0, 2)
      for (const task of matchingTasks) {
        if (seenIds.has(task.id)) continue
        seenIds.add(task.id)
        const projectName = projects.find((p) => p.id === task.projectId)?.name
        sources.push({
          type: 'task',
          id: task.id,
          label: task.title,
          projectName,
        })
      }
    }

    return sources.slice(0, 5)
  }
}
