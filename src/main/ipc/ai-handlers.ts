import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerAIHandlers(): void {
  const { entryService, digestService, smartChatService, insightsService, aiUsageRepo } = getContainer()

  // AI summary handlers
  safeHandle('ai:generateSummary', async (_event, projectId: string) => {
    return entryService.generateSummary(projectId)
  })

  safeHandle('ai:generateGlobalSummary', async () => {
    return entryService.generateGlobalSummary()
  })

  // Daily Digest handler
  safeHandle('digest:generate', async () => {
    return digestService.generateDailyDigest()
  })

  // Smart Chat handlers
  safeHandle('smart-chat:send', async (_event, message: string, conversationId?: string) => {
    return smartChatService.chat(message, conversationId)
  })

  safeHandle('smart-chat:getConversations', async () => {
    return smartChatService.getConversations()
  })

  safeHandle('smart-chat:getMessages', async (_event, conversationId: string) => {
    return smartChatService.getMessages(conversationId)
  })

  safeHandle('smart-chat:createConversation', async (_event, title?: string) => {
    return smartChatService.createConversation(title)
  })

  safeHandle('smart-chat:renameConversation', async (_event, id: string, title: string) => {
    return smartChatService.renameConversation(id, title)
  })

  safeHandle('smart-chat:deleteConversation', async (_event, id: string) => {
    return smartChatService.deleteConversation(id)
  })

  safeHandle('smart-chat:clearAll', async () => {
    return smartChatService.clearAllConversations()
  })

  // Proactive Insights handlers
  safeHandle('insights:generate', async (_event, forceRefresh?: boolean) => {
    return insightsService.generateInsights(forceRefresh ?? false)
  })

  safeHandle('insights:getLastGeneratedAt', async () => {
    return insightsService.getLastGeneratedAt()
  })

  // AI Usage handlers
  safeHandle('ai-usage:getSummary', async (_event, dateFrom?: string, dateTo?: string) => {
    return aiUsageRepo.getSummary(dateFrom, dateTo)
  })

  safeHandle('ai-usage:getDailyUsage', async (_event, dateFrom?: string, dateTo?: string) => {
    return aiUsageRepo.getDailyUsage(dateFrom, dateTo)
  })

  safeHandle('ai-usage:getHistory', async (_event, limit?: number, offset?: number) => {
    return aiUsageRepo.getHistory(limit, offset)
  })
}
