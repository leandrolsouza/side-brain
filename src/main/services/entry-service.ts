import { Entry, EntryConfirmRequest, EntryPreviewResult } from '../../shared/types'
import { EntryRepository } from '../database/repositories/entry-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIService } from './ai-service'

export class EntryService {
  private entryRepo = new EntryRepository()
  private projectRepo = new ProjectRepository()
  private taskRepo = new TaskRepository()
  private settingsRepo = new SettingsRepository()
  private aiService = new AIService()

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
        this.taskRepo.create({
          projectId,
          title: result.suggestedTask.title,
          description: result.suggestedTask.description,
          status: taskStatus,
          sourceEntryId: entry.id,
        })
      }
    }

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

  async confirmEntry(data: EntryConfirmRequest): Promise<Entry & { autoSuggestedProject?: { id: string; name: string } }> {
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
        this.taskRepo.create({
          projectId,
          title: data.suggestedTask.title,
          description: data.suggestedTask.description,
          status: taskStatus,
          sourceEntryId: entry.id,
        })
      }
    }

    return { ...entry, autoSuggestedProject }
  }

  getEntries(projectId?: string): Entry[] {
    return this.entryRepo.getAll(projectId)
  }

  searchEntries(query: string, filters?: { type?: string; projectId?: string; dateFrom?: string; dateTo?: string }): Entry[] {
    return this.entryRepo.search(query, filters)
  }

  updateEntry(id: string, updates: Record<string, any>): Entry | null {
    return this.entryRepo.update(id, updates)
  }

  deleteEntry(id: string): void {
    this.entryRepo.delete(id)
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

    const projectsData = projects.map((project) => {
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
    }).filter((p) => p.entries.length > 0 || p.tasks.length > 0)

    return this.aiService.generateGlobalSummary(projectsData, settings)
  }
}
