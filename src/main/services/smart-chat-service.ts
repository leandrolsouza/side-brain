import { SmartChatMessage, SmartChatSource } from '../../shared/types'
import { EntryRepository } from '../database/repositories/entry-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIService } from './ai-service'
import { v4 as uuid } from 'uuid'

const SYSTEM_PROMPT = `Você é um assistente inteligente que ajuda o usuário a consultar seu histórico de trabalho.
Você tem acesso ao contexto de entradas (registros), tarefas e projetos do usuário.

Regras:
- Responda SEMPRE em português brasileiro
- Seja direto e objetivo
- Quando citar informações, mencione o projeto e a data quando relevante
- Se não encontrar informações suficientes no contexto, diga honestamente que não há registros sobre o assunto
- Formate a resposta em markdown quando útil (listas, negrito para destaque)
- Não invente informações que não estão no contexto fornecido
- Se a pergunta for ambígua, responda com o que encontrar e pergunte se quer mais detalhes

Você pode responder perguntas como:
- "O que decidimos sobre X?"
- "Quem me pediu aquele relatório?"
- "Qual o status do projeto Y?"
- "O que ficou pendente da reunião de ontem?"
- "Quais bloqueios temos agora?"
- "Resumo da semana no projeto Z"
`

export class SmartChatService {
  private entryRepo = new EntryRepository()
  private projectRepo = new ProjectRepository()
  private taskRepo = new TaskRepository()
  private settingsRepo = new SettingsRepository()
  private aiService = new AIService()

  async chat(userMessage: string): Promise<SmartChatMessage> {
    const settings = this.settingsRepo.get()

    // Search for relevant context based on the user's question
    const context = this.gatherContext(userMessage)

    const fullUserMessage = `${context}\n\n---\nPergunta do usuário: "${userMessage}"`

    const responseText = await this.aiService.invokeConverseForChat(
      SYSTEM_PROMPT,
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

    // 1. Search entries matching the query
    const matchingEntries = this.entryRepo.search(query)
    if (matchingEntries.length > 0) {
      const entriesContext = matchingEntries.slice(0, 15).map((e) => {
        const projectName = projects.find((p) => p.id === e.projectId)?.name || 'Sem projeto'
        return `- [${e.type}][${projectName}][${e.createdAt.split('T')[0]}] ${e.improvedText}`
      }).join('\n')
      sections.push(`## Entradas encontradas:\n${entriesContext}`)
    }

    // 2. Search tasks matching the query
    const matchingTasks = this.taskRepo.search(query)
    if (matchingTasks.length > 0) {
      const tasksContext = matchingTasks.slice(0, 10).map((t) => {
        const projectName = projects.find((p) => p.id === t.projectId)?.name || 'Sem projeto'
        return `- [${t.status}][${projectName}] ${t.title}${t.description ? ` — ${t.description}` : ''}${t.dueDate ? ` (prazo: ${t.dueDate})` : ''}`
      }).join('\n')
      sections.push(`## Tarefas encontradas:\n${tasksContext}`)
    }

    // 3. Search projects matching the query
    const matchingProjects = this.projectRepo.search(query)
    if (matchingProjects.length > 0) {
      const projectsContext = matchingProjects.slice(0, 5).map((p) => {
        return `- ${p.name}${p.description ? `: ${p.description}` : ''}`
      }).join('\n')
      sections.push(`## Projetos encontrados:\n${projectsContext}`)
    }

    // 4. If direct search yielded little, add recent context
    if (matchingEntries.length < 3) {
      const recentEntries = this.entryRepo.getAll().slice(0, 10)
      const recentContext = recentEntries.map((e) => {
        const projectName = projects.find((p) => p.id === e.projectId)?.name || 'Sem projeto'
        return `- [${e.type}][${projectName}][${e.createdAt.split('T')[0]}] ${e.improvedText}`
      }).join('\n')
      sections.push(`## Entradas recentes (contexto adicional):\n${recentContext}`)
    }

    // 5. Add active tasks overview
    const allTasks = this.taskRepo.getAll()
    const pendingTasks = allTasks.filter((t) => t.status !== 'done').slice(0, 10)
    if (pendingTasks.length > 0) {
      const tasksOverview = pendingTasks.map((t) => {
        const projectName = projects.find((p) => p.id === t.projectId)?.name || 'Sem projeto'
        return `- [${t.status}][${projectName}] ${t.title}`
      }).join('\n')
      sections.push(`## Tarefas pendentes:\n${tasksOverview}`)
    }

    // 6. Add project list
    const projectList = projects.map((p) => `- ${p.name}`).join('\n')
    sections.push(`## Projetos ativos:\n${projectList}`)

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
