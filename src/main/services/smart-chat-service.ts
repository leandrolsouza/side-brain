import { SmartChatMessage, SmartChatSource } from '../../shared/types'
import { EntryRepository } from '../database/repositories/entry-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIService } from './ai-service'
import { t } from '../i18n'
import { v4 as uuid } from 'uuid'

export class SmartChatService {
  constructor(
    private entryRepo: EntryRepository,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private settingsRepo: SettingsRepository,
    private aiService: AIService
  ) { }

  async chat(userMessage: string): Promise<SmartChatMessage> {
    const settings = this.settingsRepo.get()

    // Search for relevant context based on the user's question
    const context = this.gatherContext(userMessage)

    const fullUserMessage = t('prompts.smart_chat.user_wrapper', { context, userMessage })

    const systemPrompt = t('prompts.smart_chat.system')

    const responseText = await this.aiService.invokeConverseForChat(
      systemPrompt,
      fullUserMessage,
      settings,
      'smart_chat'
    )

    // Extract sources from the context that was used
    const sources = this.extractSources(userMessage)

    return {
      id: uuid(),
      role: 'assistant',
      content: responseText,
      sources,
      createdAt: new Date().toISOString(),
    }
  }

  private gatherContext(query: string): string {
    const projects = this.projectRepo.getAll()
    const sections: string[] = []
    const noProject = t('prompts.smart_chat.no_project')

    // 1. Search entries matching the query
    const matchingEntries = this.entryRepo.search(query)
    if (matchingEntries.length > 0) {
      const entriesContext = matchingEntries.slice(0, 15).map((e) => {
        const projectName = projects.find((p) => p.id === e.projectId)?.name || noProject
        return `- [${e.type}][${projectName}][${e.createdAt.split('T')[0]}] ${e.improvedText}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_entries_found')}\n${entriesContext}`)
    }

    // 2. Search tasks matching the query
    const matchingTasks = this.taskRepo.search(query)
    if (matchingTasks.length > 0) {
      const tasksContext = matchingTasks.slice(0, 10).map((task) => {
        const projectName = projects.find((p) => p.id === task.projectId)?.name || noProject
        return `- [${task.status}][${projectName}] ${task.title}${task.description ? ` — ${task.description}` : ''}${task.dueDate ? ` (prazo: ${task.dueDate})` : ''}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_tasks_found')}\n${tasksContext}`)
    }

    // 3. Search projects matching the query
    const matchingProjects = this.projectRepo.search(query)
    if (matchingProjects.length > 0) {
      const projectsContext = matchingProjects.slice(0, 5).map((p) => {
        return `- ${p.name}${p.description ? `: ${p.description}` : ''}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_projects_found')}\n${projectsContext}`)
    }

    // 4. If direct search yielded little, add recent context
    if (matchingEntries.length < 3) {
      const recentEntries = this.entryRepo.getAll().slice(0, 10)
      const recentContext = recentEntries.map((e) => {
        const projectName = projects.find((p) => p.id === e.projectId)?.name || noProject
        return `- [${e.type}][${projectName}][${e.createdAt.split('T')[0]}] ${e.improvedText}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_recent_entries')}\n${recentContext}`)
    }

    // 5. Add active tasks overview
    const allTasks = this.taskRepo.getAll()
    const pendingTasks = allTasks.filter((task) => task.status !== 'done').slice(0, 10)
    if (pendingTasks.length > 0) {
      const tasksOverview = pendingTasks.map((task) => {
        const projectName = projects.find((p) => p.id === task.projectId)?.name || noProject
        return `- [${task.status}][${projectName}] ${task.title}`
      }).join('\n')
      sections.push(`${t('prompts.smart_chat.context_pending_tasks')}\n${tasksOverview}`)
    }

    // 6. Add project list
    const projectList = projects.map((p) => `- ${p.name}`).join('\n')
    sections.push(`${t('prompts.smart_chat.context_active_projects')}\n${projectList}`)

    return sections.join('\n\n')
  }

  private extractSources(query: string): SmartChatSource[] {
    const sources: SmartChatSource[] = []
    const projects = this.projectRepo.getAll()

    const matchingEntries = this.entryRepo.search(query).slice(0, 3)
    for (const entry of matchingEntries) {
      const projectName = projects.find((p) => p.id === entry.projectId)?.name
      sources.push({
        type: 'entry',
        id: entry.id,
        label: entry.improvedText.slice(0, 60) + (entry.improvedText.length > 60 ? '...' : ''),
        projectName,
      })
    }

    const matchingTasks = this.taskRepo.search(query).slice(0, 2)
    for (const task of matchingTasks) {
      const projectName = projects.find((p) => p.id === task.projectId)?.name
      sources.push({
        type: 'task',
        id: task.id,
        label: task.title,
        projectName,
      })
    }

    return sources
  }
}
