import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerEmbeddingsHandlers(): void {
  const { embeddingsService } = getContainer()

  safeHandle('embeddings:getStatus', async () => {
    return embeddingsService.getStatus()
  })

  safeHandle('embeddings:indexAll', async () => {
    return embeddingsService.indexAll()
  })

  safeHandle('embeddings:reindexAll', async () => {
    return embeddingsService.reindexAll()
  })

  safeHandle('embeddings:supportsEmbeddings', async () => {
    return embeddingsService.supportsEmbeddings()
  })
}
