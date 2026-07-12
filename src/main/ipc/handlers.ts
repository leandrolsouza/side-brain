import { registerEntryHandlers } from './entry-handlers'
import { registerProjectHandlers } from './project-handlers'
import { registerTaskHandlers } from './task-handlers'
import { registerMeetingHandlers } from './meeting-handlers'
import { registerAIHandlers } from './ai-handlers'
import { registerWorkspaceHandlers } from './workspace-handlers'
import { registerSettingsHandlers } from './settings-handlers'
import { registerSearchHandlers } from './search-handlers'
import { registerExportHandlers } from './export-handlers'
import { registerNotificationHandlers } from './notification-handlers'
import { registerReportsHandlers } from './reports-handlers'
import { registerCustomFieldsHandlers } from './custom-fields-handlers'
import { registerErrorHandlers } from './error-handlers'
import { registerConnectionHandlers } from './connection-handlers'
import { registerUpdaterHandlers } from './updater-handlers'
import { registerEmbeddingsHandlers } from './embeddings-handlers'
import { registerAgentHandlers } from './agent-handlers'
import { registerTeamHandlers } from './team-handlers'
import { registerMCPHandlers } from './mcp-handlers'

export function registerIpcHandlers(): void {
  registerEntryHandlers()
  registerProjectHandlers()
  registerTaskHandlers()
  registerMeetingHandlers()
  registerAIHandlers()
  registerWorkspaceHandlers()
  registerSettingsHandlers()
  registerSearchHandlers()
  registerExportHandlers()
  registerNotificationHandlers()
  registerReportsHandlers()
  registerCustomFieldsHandlers()
  registerErrorHandlers()
  registerConnectionHandlers()
  registerUpdaterHandlers()
  registerEmbeddingsHandlers()
  registerAgentHandlers()
  registerTeamHandlers()
  registerMCPHandlers()
}
