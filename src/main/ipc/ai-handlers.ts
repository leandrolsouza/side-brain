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
  safeHandle('smart-chat:send', async (_event, message: string) => {
    return smartChatService.chat(message)
  })

  // Proactive Insights handlers
  safeHandle('insights:generate', async () => {
    return insightsService.generateInsights()
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
