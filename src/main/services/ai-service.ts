import { AICategorizationResult, AIOperationType, AppSettings, MeetingProcessResult, Project, CustomEntryType, CustomActionStatus } from '../../shared/types'
import { CustomFieldsRepository } from '../database/repositories/custom-fields-repository'
import { AIProvider } from './ai-provider'
import { t, getLocale } from '../i18n'

function buildCategorizationPrompt(entryTypes: CustomEntryType[], actionStatuses: CustomActionStatus[]): string {
  const typeKeys = entryTypes.map(t => t.key).join(', ')
  const actionKeys = actionStatuses.filter(s => s.key !== 'done').map(s => s.key).join(', ')
  const noActionTypes = entryTypes.filter(t => !t.allowsAction).map(t => t.key)
  const actionTypes = entryTypes.filter(t => t.allowsAction).map(t => t.key)

  const noActionRules = noActionTypes.length > 0
    ? noActionTypes.map(type => t('prompts.categorization.no_action_rule', { type })).join('\n')
    : ''
  const actionRules = actionTypes.length > 0
    ? t('prompts.categorization.action_rule', { types: actionTypes.map(type => `"${type}"`).join(', ') })
    : ''

  return t('prompts.categorization.system', { typeKeys, actionKeys, noActionRules, actionRules })
}

export class AIService {
  constructor(
    private provider: AIProvider,
    private customFieldsRepo: CustomFieldsRepository
  ) { }

  async categorize(
    rawText: string,
    projects: Project[],
    settings: AppSettings
  ): Promise<AICategorizationResult> {
    const projectList = projects
      .map((p) => `- ${p.id}: ${p.name}${p.description ? ` (${p.description})` : ''}`)
      .join('\n')

    // Build dynamic prompt from custom fields
    const entryTypes = this.customFieldsRepo.getEntryTypes()
    const actionStatuses = this.customFieldsRepo.getActionStatuses()
    const categorizationPrompt = buildCategorizationPrompt(entryTypes, actionStatuses)

    const userMessage = t('prompts.categorization.user_message', {
      projectList: projectList || t('prompts.categorization.no_projects'),
      rawText,
    })

    const responseText = await this.provider.invoke(
      categorizationPrompt,
      userMessage,
      settings,
      'categorization'
    )

    // Extract JSON from response (handle possible markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON')
    }

    return JSON.parse(jsonMatch[0]) as AICategorizationResult
  }

  async generateSummary(
    projectName: string,
    entries: { improvedText: string; type: string; action: string; createdAt: string }[],
    tasks: { title: string; status: string; description?: string }[],
    settings: AppSettings
  ): Promise<string> {
    const entriesText = entries
      .map((e) => `[${e.type}][${e.action}] ${e.improvedText} (${e.createdAt})`)
      .join('\n')

    const tasksText = tasks.length > 0
      ? '\n\nTasks no Kanban:\n' + tasks.map((t) => `[${t.status}] ${t.title}${t.description ? ` - ${t.description}` : ''}`).join('\n')
      : ''

    const systemPrompt = t('prompts.summary.system')
    const userMessage = t('prompts.summary.user_message', { projectName, entriesText, tasksText })

    return this.provider.invoke(systemPrompt, userMessage, settings, 'summary')
  }

  async processMeeting(
    title: string,
    participants: string[],
    content: string,
    settings: AppSettings,
    existingTasks?: { id: string; title: string; status: string }[],
    userName?: string
  ): Promise<MeetingProcessResult> {
    const hasExistingTasks = existingTasks && existingTasks.length > 0

    const similarityInstructions = hasExistingTasks
      ? t('prompts.meeting_processing.similarity_instructions')
      : ''

    const assigneeInstructions = t('prompts.meeting_processing.assignee_instructions')

    const systemPrompt = t('prompts.meeting_processing.system', {
      assigneeInstructions,
      similarityInstructions,
    })

    const participantsText = participants.length > 0
      ? t('prompts.meeting_processing.participants_text', { participants: participants.join(', ') })
      : ''

    const userNameText = userName
      ? t('prompts.meeting_processing.user_name_text', { userName })
      : ''

    const existingTasksText = hasExistingTasks
      ? t('prompts.meeting_processing.existing_tasks_text', {
        tasksList: existingTasks!.map((task) => `- [${task.id}] "${task.title}" (status: ${task.status})`).join('\n'),
      })
      : ''

    const userMessage = t('prompts.meeting_processing.user_header', {
      title,
      participantsText,
      userNameText,
      content,
      existingTasksText,
    })

    const responseText = await this.provider.invoke(systemPrompt, userMessage, settings, 'meeting_processing')

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      const error = new Error('AI did not return valid JSON for meeting processing') as any
      error.aiResponse = responseText.slice(0, 2000)
      throw error
    }

    const parsed = this.parseJsonSafe(jsonMatch[0])
    if (parsed) {
      return parsed as MeetingProcessResult
    }

    // JSON malformed — ask AI to fix it
    const fixedResult = await this.attemptJsonFix(jsonMatch[0], settings)
    if (fixedResult) {
      return fixedResult as MeetingProcessResult
    }

    const error = new Error('AI returned invalid JSON for meeting processing. Tente reprocessar.') as any
    error.aiResponse = jsonMatch[0].slice(0, 3000)
    throw error
  }

  private async attemptJsonFix(malformedJson: string, settings: AppSettings): Promise<any | null> {
    const fixPrompt = t('prompts.meeting_processing.json_fix')

    try {
      const fixedText = await this.provider.invoke(fixPrompt, malformedJson.slice(0, 8000), settings, 'meeting_processing')
      const fixedMatch = fixedText.match(/\{[\s\S]*\}/)
      if (!fixedMatch) return null
      return this.parseJsonSafe(fixedMatch[0])
    } catch {
      return null
    }
  }

  private parseJsonSafe(raw: string): any | null {
    // Attempt 1: direct parse
    try {
      return JSON.parse(raw)
    } catch { /* continue */ }

    // Attempt 2: remove trailing commas
    let sanitized = raw.replace(/,\s*([\]}])/g, '$1')
    try {
      return JSON.parse(sanitized)
    } catch { /* continue */ }

    // Attempt 3: fix unescaped newlines inside string values
    sanitized = sanitized.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
      return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    })
    try {
      return JSON.parse(sanitized)
    } catch { /* continue */ }

    // Attempt 4: more aggressive — try to find valid JSON by trimming from the end
    for (let i = sanitized.length; i > 100; i--) {
      if (sanitized[i - 1] === '}') {
        try {
          return JSON.parse(sanitized.substring(0, i))
        } catch { /* continue */ }
      }
    }

    return null
  }

  async generateGlobalSummary(
    projectsData: { name: string; entries: { improvedText: string; type: string; action: string; createdAt: string }[]; tasks: { title: string; status: string }[] }[],
    settings: AppSettings
  ): Promise<string> {
    const systemPrompt = t('prompts.global_summary.system')

    const projectsSummaryText = projectsData.map((p) => {
      const entriesText = p.entries.slice(0, 5)
        .map((e) => `  [${e.type}][${e.action}] ${e.improvedText}`)
        .join('\n')
      const pendingTasks = p.tasks.filter((task) => task.status !== 'done')
      const tasksText = pendingTasks.length > 0
        ? '\n  Tasks pendentes: ' + pendingTasks.map((task) => task.title).join(', ')
        : ''
      return `### ${p.name}\n${entriesText}${tasksText}`
    }).join('\n\n')

    const userMessage = t('prompts.global_summary.user_message', { projectsSummaryText })

    return this.provider.invoke(systemPrompt, userMessage, settings, 'global_summary')
  }

  /**
   * Public wrapper for invokeConverse, used by other services (e.g. DigestService).
   */
  async invokeConversePublic(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings
  ): Promise<string> {
    return this.provider.invoke(systemPrompt, userMessage, settings, 'digest')
  }

  /**
   * Public wrapper for smart chat and insights operations.
   */
  async invokeConverseForChat(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType = 'smart_chat'
  ): Promise<string> {
    return this.provider.invoke(systemPrompt, userMessage, settings, operationType)
  }

  /**
   * Analyzes a batch of entries and discovers semantic connections between them.
   * Returns suggested connections with type and reasoning.
   */
  async discoverConnections(
    entries: { id: string; improvedText: string; type: string; projectId: string; createdAt: string }[],
    settings: AppSettings
  ): Promise<{ sourceId: string; targetId: string; connectionType: string; reason: string }[]> {
    if (entries.length < 2) return []

    const locale = getLocale()
    const systemPrompt = t('prompts.connections.system')

    const entriesText = entries.map((e) =>
      `[${e.id}] (${e.type}, ${new Date(e.createdAt).toLocaleDateString(locale)}): ${e.improvedText}`
    ).join('\n')

    const userMessage = t('prompts.connections.user_message', { entriesText })

    const responseText = await this.provider.invoke(systemPrompt, userMessage, settings, 'connection_discovery')

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []

    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (!parsed.connections || !Array.isArray(parsed.connections)) return []

      // Validate that IDs exist in the input
      const validIds = new Set(entries.map(e => e.id))
      return parsed.connections.filter((c: any) =>
        c.sourceId && c.targetId && c.connectionType && c.reason &&
        validIds.has(c.sourceId) && validIds.has(c.targetId) &&
        c.sourceId !== c.targetId
      )
    } catch {
      return []
    }
  }
}
