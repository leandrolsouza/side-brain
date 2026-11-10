import type {
  Entry,
  EntryConfirmRequest,
  EntryPreviewResult,
  PaginatedResult,
  PaginationParams,
} from '../../shared/types'
import type { EntryRepository } from '../database/repositories/entry-repository'
import type { ProjectRepository } from '../database/repositories/project-repository'
import type { TaskRepository } from '../database/repositories/task-repository'
import type { SettingsRepository } from '../database/repositories/settings-repository'
import type { CategorizationFeedbackRepository } from '../database/repositories/categorization-feedback-repository'
import type { AIService } from './ai-service'
import type { EmbeddingsService } from './embeddings-service'
import { createScopedLogger } from './logger'

const logger = createScopedLogger('entry')

export class EntryService {
  constructor(
    private entryRepo: EntryRepository,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private settingsRepo: SettingsRepository,
    private aiService: AIService,
    private embeddingsService?: EmbeddingsService,
    private feedbackRepo?: CategorizationFeedbackRepository
  ) {}

  async createEntry(rawText: string): Promise<Entry & { autoSuggestedProject?: { id: string; name: string } }> {
    const settings = this.settingsRepo.get()
    const projects = this.projectRepo.getAll()

    // Call AI to categorize
    const result = await this.aiService.categorize(rawText, projects, settings)

    // Resolve project
    let projectId: string
    let autoSuggestedProject: { id: string; name: string } | undefined

    if (result.project.id) {
      // AI matched an existing project
      projectId = result.project.id
    } else if (result.project.suggestedName) {
      // AI suggests a new project
      const existing = this.projectRepo.findByName(result.project.suggestedName)
      if (existing) {
        projectId = existing.id
      } else {
        const newProject = this.projectRepo.create(
          result.project.suggestedName,
          undefined,
          true // isAutoSuggested
        )
        projectId = newProject.id
        autoSuggestedProject = { id: newProject.id, name: newProject.name }
      }
    } else {
      // Fallback: create "Sem Projeto"
      let uncategorized = this.projectRepo.findByName('Sem Projeto')
      if (!uncategorized) {
        uncategorized = this.projectRepo.create('Sem Projeto', 'Entradas não categorizadas')
      }
      projectId = uncategorized.id
    }

    // Create the entry
    const entry = this.entryRepo.create({
      rawText,
      improvedText: result.improvedText,
      projectId,
      type: result.type,
      action: result.action,
      reviewStatus: 'auto_approved',
    })

    // Create task from AI suggestion if present
    if (result.suggestedTask) {
      // Check for duplicate (same title in same project, not done)
      const existing = this.taskRepo.findSimilar(projectId, result.suggestedTask.title)
      if (!existing) {
        const taskStatus = result.action === 'waiting_response' ? 'waiting' : 'todo'
        const task = this.taskRepo.create({
          projectId,
          title: result.suggestedTask.title,
          description: result.suggestedTask.description,
          status: taskStatus,
          sourceEntryId: entry.id,
        })
        // Generate embedding for the new task in background
        this.indexInBackground('task', task.id)
      }
    }

    // Generate embedding for the new entry in background
    this.indexInBackground('entry', entry.id)

    return { ...entry, autoSuggestedProject }
  }

  async previewEntry(rawText: string, projectIdHint?: string): Promise<EntryPreviewResult> {
    const settings = this.settingsRepo.get()
    const projects = this.projectRepo.getAll()

    // Call AI to categorize (does NOT persist anything)
    const result = await this.aiService.categorize(rawText, projects, settings)

    // If user pre-selected a project, use that as the resolved project
    // unless AI has high confidence in a different one
    let resolvedProject = result.project
    if (projectIdHint) {
      const hintedProject = projects.find((p) => p.id === projectIdHint)
      if (hintedProject && (!result.project.id || result.project.confidence < 0.8)) {
        resolvedProject = { id: projectIdHint, suggestedName: null, confidence: 1.0 }
      }
    }

    return {
      rawText,
      improvedText: result.improvedText,
      project: resolvedProject,
      type: result.type,
      action: result.action,
      reasoning: result.reasoning,
      suggestedTask: result.suggestedTask,
    }
  }

  async confirmEntry(
    data: EntryConfirmRequest
  ): Promise<Entry & { autoSuggestedProject?: { id: string; name: string } }> {
    // Resolve project
    let projectId: string
    let autoSuggestedProject: { id: string; name: string } | undefined

    if (data.projectId) {
      // User confirmed an existing project
      projectId = data.projectId
    } else if (data.newProjectName) {
      // User wants to create a new project
      const existing = this.projectRepo.findByName(data.newProjectName)
      if (existing) {
        projectId = existing.id
      } else {
        const newProject = this.projectRepo.create(
          data.newProjectName,
          undefined,
          true // isAutoSuggested
        )
        projectId = newProject.id
        autoSuggestedProject = { id: newProject.id, name: newProject.name }
      }
    } else {
      // Fallback: create "Sem Projeto"
      let uncategorized = this.projectRepo.findByName('Sem Projeto')
      if (!uncategorized) {
        uncategorized = this.projectRepo.create('Sem Projeto', 'Entradas não categorizadas')
      }
      projectId = uncategorized.id
    }

    // Create the entry
    const entry = this.entryRepo.create({
      rawText: data.rawText,
      improvedText: data.improvedText,
      projectId,
      type: data.type,
      action: data.action,
      reviewStatus: 'auto_approved',
    })

    // Create task from suggestion if present
    if (data.suggestedTask) {
      const existing = this.taskRepo.findSimilar(projectId, data.suggestedTask.title)
      if (!existing) {
        const taskStatus = data.action === 'waiting_response' ? 'waiting' : 'todo'
        const task = this.taskRepo.create({
          projectId,
          title: data.suggestedTask.title,
          description: data.suggestedTask.description,
          status: taskStatus,
          sourceEntryId: entry.id,
        })
        // Generate embedding for the new task in background
        this.indexInBackground('task', task.id)
      }
    }

    // Generate embedding for the new entry in background
    this.indexInBackground('entry', entry.id)

    // Record feedback if user corrected the AI prediction
    this.recordFeedbackIfCorrected(data)

    return { ...entry, autoSuggestedProject }
  }

  getEntries(projectId?: string): Entry[] {
    return this.entryRepo.getAll(projectId)
  }

  /**
   * Preview multiple entries at once (batch mode).
   * Text is split by paragraphs and each is categorized.
   */
  async previewBatch(rawText: string): Promise<EntryPreviewResult[]> {
    const settings = this.settingsRepo.get()
    const projects = this.projectRepo.getAll()

    const results = await this.aiService.categorizeBatch(rawText, projects, settings)

    // Split paragraphs to match with results
    const paragraphs = rawText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    return results.map((result, i) => ({
      rawText: paragraphs[i] || rawText,
      improvedText: result.improvedText,
      project: result.project,
      type: result.type,
      action: result.action,
      reasoning: result.reasoning,
      suggestedTask: result.suggestedTask,
    }))
  }

  getEntriesPaginated(params: PaginationParams & { projectId?: string }): PaginatedResult<Entry> {
    return this.entryRepo.getPaginated(params)
  }

  searchEntries(
    query: string,
    filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }
  ): Entry[] {
    return this.entryRepo.search(query, filters)
  }

  updateEntry(id: string, updates: Record<string, any>): Entry | null {
    return this.entryRepo.update(id, updates)
  }

  deleteEntry(id: string): void {
    this.entryRepo.delete(id)
    // Remove embedding when entry is deleted
    this.embeddingsService?.deleteEmbedding('entry', id)
  }

  async generateSummary(projectId: string): Promise<string> {
    const settings = this.settingsRepo.get()
    const project = this.projectRepo.getById(projectId)
    if (!project) throw new Error('Project not found')

    const entries = this.entryRepo.getAll(projectId)
    const recentEntries = entries.slice(0, 30).map((e) => ({
      improvedText: e.improvedText,
      type: e.type,
      action: e.action,
      createdAt: e.createdAt,
    }))

    const tasks = this.taskRepo.getByProject(projectId).map((t) => ({
      title: t.title,
      status: t.status,
      description: t.description,
    }))

    return this.aiService.generateSummary(project.name, recentEntries, tasks, settings)
  }

  async generateGlobalSummary(): Promise<string> {
    const settings = this.settingsRepo.get()
    const projects = this.projectRepo.getAll()

    const projectsData = projects
      .map((project) => {
        const entries = this.entryRepo.getAll(project.id)
        const recentEntries = entries.slice(0, 10).map((e) => ({
          improvedText: e.improvedText,
          type: e.type,
          action: e.action,
          createdAt: e.createdAt,
        }))
        const tasks = this.taskRepo.getByProject(project.id).map((t) => ({
          title: t.title,
          status: t.status,
        }))
        return { name: project.name, entries: recentEntries, tasks }
      })
      .filter((p) => p.entries.length > 0 || p.tasks.length > 0)

    return this.aiService.generateGlobalSummary(projectsData, settings)
  }

  /**
   * Fire-and-forget embedding generation for a newly created entity.
   * Does not block the main flow if it fails.
   */
  private indexInBackground(entityType: 'entry' | 'task', entityId: string): void {
    if (!this.embeddingsService) return

    if (entityType === 'entry') {
      this.embeddingsService.indexEntry(entityId).catch((err) => {
        logger.error('Background embedding failed for entry', err)
      })
    } else {
      this.embeddingsService.indexTask(entityId).catch((err) => {
        logger.error('Background embedding failed for task', err)
      })
    }
  }

  /**
   * Detects if the user corrected the AI's categorization and records feedback.
   * Feedback is used as few-shot examples in future categorization calls.
   */
  private recordFeedbackIfCorrected(data: EntryConfirmRequest): void {
    if (!this.feedbackRepo) return

    // Only record if we have original AI predictions to compare against
    if (!data.aiOriginalType && !data.aiOriginalAction && data.aiOriginalProjectId === undefined) {
      return
    }

    const typeChanged = data.aiOriginalType && data.aiOriginalType !== data.type
    const actionChanged = data.aiOriginalAction && data.aiOriginalAction !== data.action
    const projectChanged = data.aiOriginalProjectId !== undefined && data.aiOriginalProjectId !== data.projectId

    // Only record if something was actually corrected
    if (!typeChanged && !actionChanged && !projectChanged) return

    try {
      this.feedbackRepo.add({
        rawText: data.rawText,
        aiType: data.aiOriginalType || data.type,
        aiAction: data.aiOriginalAction || data.action,
        aiProjectId: data.aiOriginalProjectId ?? null,
        correctedType: data.type,
        correctedAction: data.action,
        correctedProjectId: data.projectId,
        correctedProjectName: data.newProjectName,
      })
    } catch (err) {
      logger.error('Failed to record categorization feedback:', err)
    }
  }
}
