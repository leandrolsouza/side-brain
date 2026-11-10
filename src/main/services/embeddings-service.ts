import { net } from 'electron'
import type { AppSettings, AIProvider as AIProviderType } from '../../shared/types'
import type { EmbeddingsRepository } from '../database/repositories/embeddings-repository'
import type { EntryRepository } from '../database/repositories/entry-repository'
import type { TaskRepository } from '../database/repositories/task-repository'
import type { SettingsRepository } from '../database/repositories/settings-repository'
import type { AIUsageRepository } from '../database/repositories/ai-usage-repository'
import { getErrorService } from './error-service'

export interface SimilarityResult {
  entityType: 'entry' | 'task'
  entityId: string
  score: number
}

export interface EmbeddingsStatus {
  totalEntries: number
  indexedEntries: number
  totalTasks: number
  indexedTasks: number
  isIndexing: boolean
}

/**
 * Service for generating, storing, and searching embeddings.
 * Supports multiple AI providers for embedding generation.
 */
export class EmbeddingsService {
  private isIndexing = false
  private indexingProgress = { current: 0, total: 0 }

  constructor(
    private embeddingsRepo: EmbeddingsRepository,
    private entryRepo: EntryRepository,
    private taskRepo: TaskRepository,
    private settingsRepo: SettingsRepository,
    private aiUsageRepo: AIUsageRepository
  ) {}

  /**
   * Check if the current provider supports embeddings.
   */
  supportsEmbeddings(provider?: AIProviderType): boolean {
    const p = provider || this.settingsRepo.get().aiProvider
    return p !== 'grok' // All except Grok support embeddings
  }

  /**
   * Get the current indexing status.
   */
  getStatus(): EmbeddingsStatus {
    const allEntries = this.entryRepo.getAll()
    const allTasks = this.taskRepo.getAll()

    return {
      totalEntries: allEntries.length,
      indexedEntries: this.embeddingsRepo.count('entry'),
      totalTasks: allTasks.length,
      indexedTasks: this.embeddingsRepo.count('task'),
      isIndexing: this.isIndexing,
    }
  }

  /**
   * Generate an embedding for a single text using the configured provider.
   */
  async generateEmbedding(text: string, settings?: AppSettings): Promise<Float32Array | null> {
    const s = settings || this.settingsRepo.get()

    if (!this.supportsEmbeddings(s.aiProvider)) {
      return null
    }

    try {
      switch (s.aiProvider) {
        case 'openai':
          return await this.generateOpenAIEmbedding(text, s)
        case 'bedrock':
          return await this.generateBedrockEmbedding(text, s)
        case 'gemini':
          return await this.generateGeminiEmbedding(text, s)
        case 'local':
          return await this.generateLocalEmbedding(text, s)
        default:
          return null
      }
    } catch (error: any) {
      getErrorService().logError({
        category: 'ai',
        severity: 'warning',
        message: 'Embedding generation failed',
        stack: error.stack,
        context: { provider: s.aiProvider, textLength: text.length },
      })
      return null
    }
  }

  /**
   * Generate and store embedding for a single entry.
   */
  async indexEntry(entryId: string): Promise<boolean> {
    const entry = this.entryRepo.getById(entryId)
    if (!entry) return false

    const settings = this.settingsRepo.get()
    const text = entry.improvedText || entry.rawText
    const embedding = await this.generateEmbedding(text, settings)

    if (!embedding) return false

    const model = this.getEmbeddingModelName(settings)
    this.embeddingsRepo.upsert('entry', entryId, embedding, model)
    return true
  }

  /**
   * Generate and store embedding for a single task.
   */
  async indexTask(taskId: string): Promise<boolean> {
    const task = this.taskRepo.getById(taskId)
    if (!task) return false

    const settings = this.settingsRepo.get()
    const text = `${task.title}${task.description ? ` — ${task.description}` : ''}`
    const embedding = await this.generateEmbedding(text, settings)

    if (!embedding) return false

    const model = this.getEmbeddingModelName(settings)
    this.embeddingsRepo.upsert('task', taskId, embedding, model)
    return true
  }

  /**
   * Index all entries and tasks that don't have embeddings yet.
   * Runs in batches to avoid overwhelming the API.
   */
  async indexAll(onProgress?: (current: number, total: number) => void): Promise<{ indexed: number; failed: number }> {
    if (this.isIndexing) {
      return { indexed: 0, failed: 0 }
    }

    this.isIndexing = true
    let indexed = 0
    let failed = 0

    try {
      const settings = this.settingsRepo.get()
      if (!this.supportsEmbeddings(settings.aiProvider)) {
        return { indexed: 0, failed: 0 }
      }

      const missingEntryIds = this.embeddingsRepo.getMissingEntryIds()
      const missingTaskIds = this.embeddingsRepo.getMissingTaskIds()
      const total = missingEntryIds.length + missingTaskIds.length
      this.indexingProgress = { current: 0, total }

      // Index entries
      for (const entryId of missingEntryIds) {
        const success = await this.indexEntry(entryId)
        if (success) indexed++
        else failed++

        this.indexingProgress.current++
        onProgress?.(this.indexingProgress.current, total)

        // Small delay to avoid rate limiting
        if (this.indexingProgress.current % 10 === 0) {
          await this.delay(200)
        }
      }

      // Index tasks
      for (const taskId of missingTaskIds) {
        const success = await this.indexTask(taskId)
        if (success) indexed++
        else failed++

        this.indexingProgress.current++
        onProgress?.(this.indexingProgress.current, total)

        if (this.indexingProgress.current % 10 === 0) {
          await this.delay(200)
        }
      }
    } finally {
      this.isIndexing = false
      this.indexingProgress = { current: 0, total: 0 }
    }

    return { indexed, failed }
  }

  /**
   * Re-index everything (delete all embeddings and regenerate).
   */
  async reindexAll(
    onProgress?: (current: number, total: number) => void
  ): Promise<{ indexed: number; failed: number }> {
    this.embeddingsRepo.deleteAll()
    return this.indexAll(onProgress)
  }

  /**
   * Search for similar entries/tasks using cosine similarity.
   * Returns ranked results above the threshold.
   */
  async searchSimilar(
    query: string,
    entityType: 'entry' | 'task' | 'all' = 'all',
    limit = 15,
    threshold = 0.3
  ): Promise<SimilarityResult[]> {
    const queryEmbedding = await this.generateEmbedding(query)
    if (!queryEmbedding) return []

    const results: SimilarityResult[] = []

    if (entityType === 'entry' || entityType === 'all') {
      const entryEmbeddings = this.embeddingsRepo.getAllByType('entry')
      for (const record of entryEmbeddings) {
        const score = this.cosineSimilarity(queryEmbedding, record.embedding)
        if (score >= threshold) {
          results.push({ entityType: 'entry', entityId: record.entityId, score })
        }
      }
    }

    if (entityType === 'task' || entityType === 'all') {
      const taskEmbeddings = this.embeddingsRepo.getAllByType('task')
      for (const record of taskEmbeddings) {
        const score = this.cosineSimilarity(queryEmbedding, record.embedding)
        if (score >= threshold) {
          results.push({ entityType: 'task', entityId: record.entityId, score })
        }
      }
    }

    // Sort by score descending and limit
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /**
   * Delete embedding when an entity is removed.
   */
  deleteEmbedding(entityType: 'entry' | 'task', entityId: string): void {
    this.embeddingsRepo.deleteByEntity(entityType, entityId)
  }

  // === Provider-specific embedding generation ===

  private async generateOpenAIEmbedding(text: string, settings: AppSettings): Promise<Float32Array> {
    const url = 'https://api.openai.com/v1/embeddings'
    const model = 'text-embedding-3-small'

    const body = {
      model,
      input: text.slice(0, 8000), // Limit to ~8k chars
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI Embeddings API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    // Track usage
    const inputTokens = data.usage?.total_tokens ?? 0
    try {
      this.aiUsageRepo.record({
        operationType: 'embeddings',
        model,
        inputTokens,
        outputTokens: 0,
        estimatedCost: (inputTokens / 1000) * 0.00002, // $0.02/1M tokens
        latencyMs,
      })
    } catch {
      /* non-fatal */
    }

    const embedding = data.data?.[0]?.embedding
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('OpenAI did not return a valid embedding')
    }

    return new Float32Array(embedding)
  }

  private async generateBedrockEmbedding(text: string, settings: AppSettings): Promise<Float32Array> {
    const baseUrl = `https://bedrock-runtime.${settings.awsRegion}.amazonaws.com`
    const modelId = 'amazon.titan-embed-text-v2:0'
    const url = `${baseUrl}/model/${modelId}/invoke`

    const body = {
      inputText: text.slice(0, 8000),
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.bedrockApiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Bedrock Embeddings API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const inputTokens = data.inputTextTokenCount ?? Math.ceil(text.length / 4)
    try {
      this.aiUsageRepo.record({
        operationType: 'embeddings',
        model: modelId,
        inputTokens,
        outputTokens: 0,
        estimatedCost: (inputTokens / 1000) * 0.0001,
        latencyMs,
      })
    } catch {
      /* non-fatal */
    }

    const embedding = data.embedding
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Bedrock Titan did not return a valid embedding')
    }

    return new Float32Array(embedding)
  }

  private async generateGeminiEmbedding(text: string, settings: AppSettings): Promise<Float32Array> {
    const model = 'text-embedding-004'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${settings.geminiApiKey}`

    const body = {
      model: `models/${model}`,
      content: {
        parts: [{ text: text.slice(0, 8000) }],
      },
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini Embeddings API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const inputTokens = Math.ceil(text.length / 4)
    try {
      this.aiUsageRepo.record({
        operationType: 'embeddings',
        model,
        inputTokens,
        outputTokens: 0,
        estimatedCost: 0, // Gemini embedding is free
        latencyMs,
      })
    } catch {
      /* non-fatal */
    }

    const embedding = data.embedding?.values
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Gemini did not return a valid embedding')
    }

    return new Float32Array(embedding)
  }

  private async generateLocalEmbedding(text: string, settings: AppSettings): Promise<Float32Array> {
    const baseUrl = settings.localEndpoint || 'http://localhost:1234'
    const url = `${baseUrl}/v1/embeddings`
    const model = settings.localModelId || 'default'

    const body = {
      model,
      input: text.slice(0, 8000),
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (settings.localApiKey) {
      headers.Authorization = `Bearer ${settings.localApiKey}`
    }

    const startTime = Date.now()

    const response = await net.fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Local Embeddings API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    try {
      this.aiUsageRepo.record({
        operationType: 'embeddings',
        model,
        inputTokens: Math.ceil(text.length / 4),
        outputTokens: 0,
        estimatedCost: 0,
        latencyMs,
      })
    } catch {
      /* non-fatal */
    }

    const embedding = data.data?.[0]?.embedding
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Local LLM did not return a valid embedding')
    }

    return new Float32Array(embedding)
  }

  // === Utility methods ===

  /**
   * Calculate cosine similarity between two vectors.
   * Handles different dimensions gracefully (uses the shorter length).
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    const len = Math.min(a.length, b.length)
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < len; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (denominator === 0) return 0

    return dotProduct / denominator
  }

  private getEmbeddingModelName(settings: AppSettings): string {
    switch (settings.aiProvider) {
      case 'openai':
        return 'text-embedding-3-small'
      case 'bedrock':
        return 'amazon.titan-embed-text-v2:0'
      case 'gemini':
        return 'text-embedding-004'
      case 'local':
        return settings.localModelId || 'local-embedding'
      default:
        return 'unknown'
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
