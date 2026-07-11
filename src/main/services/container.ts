/**
 * Composition root — single place where all repositories and services are instantiated.
 * Each IPC handler module calls getContainer() to get pre-built service instances.
 */
import { EntryRepository } from '../database/repositories/entry-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIUsageRepository } from '../database/repositories/ai-usage-repository'
import { MeetingRepository } from '../database/repositories/meeting-repository'
import { NotificationRepository } from '../database/repositories/notification-repository'
import { CustomFieldsRepository } from '../database/repositories/custom-fields-repository'
import { ConnectionRepository } from '../database/repositories/connection-repository'
import { ChatHistoryRepository } from '../database/repositories/chat-history-repository'
import { EmbeddingsRepository } from '../database/repositories/embeddings-repository'

import { AIProvider } from './ai-provider'
import { AIService } from './ai-service'
import { EntryService } from './entry-service'
import { DigestService } from './digest-service'
import { SmartChatService } from './smart-chat-service'
import { InsightsService } from './insights-service'
import { MeetingService } from './meeting-service'
import { ReportsService } from './reports-service'
import { ExportService } from './export-service'
import { BackupService } from './backup-service'
import { EmbeddingsService } from './embeddings-service'
import { setLocale } from '../i18n'

export interface AppContainer {
  // Repositories
  entryRepo: EntryRepository
  projectRepo: ProjectRepository
  taskRepo: TaskRepository
  settingsRepo: SettingsRepository
  aiUsageRepo: AIUsageRepository
  meetingRepo: MeetingRepository
  notificationRepo: NotificationRepository
  customFieldsRepo: CustomFieldsRepository
  connectionRepo: ConnectionRepository
  chatHistoryRepo: ChatHistoryRepository
  embeddingsRepo: EmbeddingsRepository

  // Services
  aiProvider: AIProvider
  aiService: AIService
  entryService: EntryService
  digestService: DigestService
  smartChatService: SmartChatService
  insightsService: InsightsService
  meetingService: MeetingService
  reportsService: ReportsService
  exportService: ExportService
  backupService: BackupService
  embeddingsService: EmbeddingsService
}

let container: AppContainer | null = null

export function getContainer(): AppContainer {
  if (container) return container

  // Repositories (stateless, can be shared)
  const entryRepo = new EntryRepository()
  const projectRepo = new ProjectRepository()
  const taskRepo = new TaskRepository()
  const settingsRepo = new SettingsRepository()
  const aiUsageRepo = new AIUsageRepository()
  const meetingRepo = new MeetingRepository()
  const notificationRepo = new NotificationRepository()
  const customFieldsRepo = new CustomFieldsRepository()
  const connectionRepo = new ConnectionRepository()
  const chatHistoryRepo = new ChatHistoryRepository()
  const embeddingsRepo = new EmbeddingsRepository()

  // Initialize main process i18n from persisted settings
  const settings = settingsRepo.get()
  setLocale(settings.language)

  // AI layer
  const aiProvider = new AIProvider(aiUsageRepo, settingsRepo)
  const aiService = new AIService(aiProvider, customFieldsRepo)
  const embeddingsService = new EmbeddingsService(embeddingsRepo, entryRepo, taskRepo, settingsRepo, aiUsageRepo)

  // Services (receive dependencies via constructor)
  const entryService = new EntryService(entryRepo, projectRepo, taskRepo, settingsRepo, aiService, embeddingsService)
  const digestService = new DigestService(entryRepo, taskRepo, projectRepo, settingsRepo, aiService)
  const smartChatService = new SmartChatService(entryRepo, projectRepo, taskRepo, settingsRepo, aiService, chatHistoryRepo, embeddingsService)
  const insightsService = new InsightsService(entryRepo, projectRepo, taskRepo, settingsRepo, aiService)
  const meetingService = new MeetingService(meetingRepo, entryRepo, projectRepo, taskRepo, settingsRepo, notificationRepo, aiService)
  const reportsService = new ReportsService()
  const exportService = new ExportService()
  const backupService = new BackupService()

  container = {
    entryRepo,
    projectRepo,
    taskRepo,
    settingsRepo,
    aiUsageRepo,
    meetingRepo,
    notificationRepo,
    customFieldsRepo,
    connectionRepo,
    chatHistoryRepo,
    embeddingsRepo,
    aiProvider,
    aiService,
    entryService,
    digestService,
    smartChatService,
    insightsService,
    meetingService,
    reportsService,
    exportService,
    backupService,
    embeddingsService,
  }

  return container
}
