import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import type { ConnectionType } from '../../shared/types'

export function registerConnectionHandlers(): void {
  const { connectionRepo, entryRepo, settingsRepo, aiService } = getContainer()

  safeHandle(
    'connection:create',
    async (
      _event,
      data: {
        sourceEntryId: string
        targetEntryId: string
        connectionType: ConnectionType
        description?: string
      }
    ) => {
      // Check if connection already exists in either direction
      if (connectionRepo.exists(data.sourceEntryId, data.targetEntryId)) {
        throw new Error('Conexão já existe entre essas entradas')
      }
      return connectionRepo.create(data)
    }
  )

  safeHandle('connection:getByEntry', async (_event, entryId: string) => {
    return connectionRepo.getByEntryId(entryId)
  })

  safeHandle('connection:delete', async (_event, connectionId: string) => {
    connectionRepo.delete(connectionId)
    return { success: true }
  })

  safeHandle('connection:searchEntries', async (_event, query: string, excludeEntryId: string) => {
    return connectionRepo.searchEntries(query, excludeEntryId)
  })

  safeHandle(
    'connection:getGraphData',
    async (
      _event,
      filters?: {
        projectId?: string
        dateFrom?: string
        minConnections?: number
        connectionType?: string
      }
    ) => {
      return connectionRepo.getAllForGraph(filters)
    }
  )

  safeHandle('connection:discover', async (_event, projectId?: string) => {
    const settings = settingsRepo.get()

    // Get recent entries (last 50, or filtered by project)
    const allEntries = entryRepo.getAll(projectId)
    const entries = allEntries.slice(0, 50)

    if (entries.length < 2) {
      return { created: 0, suggestions: [] }
    }

    // Ask AI to find connections
    const suggestions = await aiService.discoverConnections(
      entries.map((e) => ({
        id: e.id,
        improvedText: e.improvedText,
        type: e.type,
        projectId: e.projectId,
        createdAt: e.createdAt,
      })),
      settings
    )

    // Create connections that don't already exist
    let created = 0
    const createdConnections = []

    for (const suggestion of suggestions) {
      if (!connectionRepo.exists(suggestion.sourceId, suggestion.targetId)) {
        const conn = connectionRepo.create({
          sourceEntryId: suggestion.sourceId,
          targetEntryId: suggestion.targetId,
          connectionType: suggestion.connectionType as ConnectionType,
          description: suggestion.reason,
          isAiSuggested: true,
        })
        createdConnections.push(conn)
        created++
      }
    }

    return { created, suggestions: createdConnections }
  })
}
