import { AICategorizationResult, AIOperationType, AppSettings, MeetingProcessResult, Project, CustomEntryType, CustomActionStatus } from '../../shared/types'
import { CustomFieldsRepository } from '../database/repositories/custom-fields-repository'
import { CategorizationFeedbackRepository } from '../database/repositories/categorization-feedback-repository'
import { EntryRepository } from '../database/repositories/entry-repository'
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
    private customFieldsRepo: CustomFieldsRepository,
    private feedbackRepo?: CategorizationFeedbackRepository,
    private entryRepo?: EntryRepository
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

    // Build user message with few-shot examples and temporal context
    const fewShotSection = this.buildFewShotSection()
    const temporalSection = this.buildTemporalContext()

    let userMessage = ''

    if (fewShotSection) {
      userMessage += fewShotSection + '\n\n'
    }

    if (temporalSection) {
      userMessage += temporalSection + '\n\n'
    }

    userMessage += t('prompts.categorization.user_message', {
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

  /**
   * Builds a few-shot section from recent user corrections.
   * These teach the AI the user's preferences for categorization.
   */
  private buildFewShotSection(): string {
    if (!this.feedbackRepo) return ''

    const examples = this.feedbackRepo.getRecentExamples(5)
    if (examples.length === 0) return ''

    const lines = examples.map((ex) => {
      const projectInfo = ex.correctedProjectName || ex.correctedProjectId || '?'
      return `- "${ex.rawText.slice(0, 80)}" → type: ${ex.correctedType}, action: ${ex.correctedAction}, project: ${projectInfo}`
    })

    return `## Exemplos de classificações anteriores (preferências do usuário):\n${lines.join('\n')}`
  }

  /**
   * Builds temporal context from the user's most recent entries.
   * Helps the AI understand what the user is currently working on.
   */
  private buildTemporalContext(): string {
    if (!this.entryRepo) return ''

    const recentEntries = this.entryRepo.getAll().slice(0, 5)
    if (recentEntries.length === 0) return ''

    const lines = recentEntries.map((e) => {
      return `- [${e.type}] ${e.improvedText.slice(0, 80)}`
    })

    return `## Contexto recente (últimas entradas do usuário):\n${lines.join('\n')}`
  }

  /**
   * Categorizes multiple entries in a single AI call.
   * Splits text by paragraph breaks and categorizes each separately.
   */
  async categorizeBatch(
    rawText: string,
    projects: Project[],
    settings: AppSettings
  ): Promise<AICategorizationResult[]> {
    // Split by double newlines (paragraph separator)
    const paragraphs = rawText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    if (paragraphs.length <= 1) {
      // Single entry — use normal categorize
      const result = await this.categorize(rawText, projects, settings)
      return [result]
    }

    const projectList = projects
      .map((p) => `- ${p.id}: ${p.name}${p.description ? ` (${p.description})` : ''}`)
      .join('\n')

    const entryTypes = this.customFieldsRepo.getEntryTypes()
    const actionStatuses = this.customFieldsRepo.getActionStatuses()
    const categorizationPrompt = buildCategorizationPrompt(entryTypes, actionStatuses)

    // Build batch prompt
    const numberedTexts = paragraphs.map((p, i) => `[${i + 1}] "${p}"`).join('\n\n')

    const batchSystemPrompt = categorizationPrompt + `\n\nIMPORTANTE: Você receberá MÚLTIPLOS textos numerados. Retorne um ARRAY JSON com um objeto para cada texto, na mesma ordem. O formato de cada objeto é o mesmo descrito acima.`

    const userMessage = `Projetos existentes:\n${projectList || '(nenhum projeto cadastrado)'}\n\nTextos para categorizar:\n${numberedTexts}`

    const responseText = await this.provider.invoke(
      batchSystemPrompt,
      userMessage,
      settings,
      'categorization'
    )

    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      try {
        const results = JSON.parse(jsonMatch[0]) as AICategorizationResult[]
        if (Array.isArray(results) && results.length > 0) {
          return results
        }
      } catch { /* fallback below */ }
    }

    // Fallback: try to find individual JSON objects
    const objectMatches = responseText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)
    if (objectMatches && objectMatches.length > 0) {
      const results: AICategorizationResult[] = []
      for (const match of objectMatches) {
        try {
          results.push(JSON.parse(match) as AICategorizationResult)
        } catch { /* skip malformed */ }
      }
      if (results.length > 0) return results
    }

    // Ultimate fallback: categorize each individually
    const results: AICategorizationResult[] = []
    for (const paragraph of paragraphs) {
      const result = await this.categorize(paragraph, projects, settings)
      results.push(result)
    }
    return results
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

  /**
   * AI-powered auto-fill for structured template fields.
   * Given the filled fields, suggests values for fields marked with aiAutoFill.
   */
  async autoFillTemplateFields(
    templateId: string,
    filledFields: Record<string, string>
  ): Promise<Record<string, string>> {
    const template = this.customFieldsRepo.getStructuredTemplates().find(t => t.id === templateId)
    if (!template) return {}

    const { settingsRepo } = require('./container').getContainer()
    const settings = settingsRepo.get()

    const autoFillFields = template.fields.filter(f => f.aiAutoFill && !filledFields[f.key])
    if (autoFillFields.length === 0) return {}

    const filledContext = Object.entries(filledFields)
      .filter(([_, v]) => v.trim())
      .map(([key, value]) => {
        const field = template.fields.find(f => f.key === key)
        return `${field?.label || key}: ${value}`
      })
      .join('\n')

    const fieldsToFill = autoFillFields.map(f => `- ${f.key} (${f.label}): ${f.placeholder || 'sem dica'}`).join('\n')

    const systemPrompt = `Você é um assistente de produtividade que ajuda a preencher campos de formulários com base no contexto fornecido.
Responda APENAS com um JSON válido contendo os campos preenchidos, sem explicações adicionais.
O formato deve ser: {"campo1": "valor1", "campo2": "valor2"}
Se não houver informação suficiente para preencher um campo, use uma string vazia.
Seja conciso e direto nos valores sugeridos.`

    const userMessage = `Template: "${template.name}"

Campos já preenchidos:
${filledContext}

Campos para preencher automaticamente:
${fieldsToFill}

Preencha os campos listados acima com base no contexto dos campos já preenchidos. Responda somente com o JSON.`

    try {
      const responseText = await this.provider.invoke(systemPrompt, userMessage, settings, 'categorization')

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return {}

      const parsed = JSON.parse(jsonMatch[0])
      // Only return keys that match actual auto-fill fields
      const result: Record<string, string> = {}
      for (const field of autoFillFields) {
        if (parsed[field.key] && typeof parsed[field.key] === 'string') {
          result[field.key] = parsed[field.key]
        }
      }
      return result
    } catch {
      return {}
    }
  }
}
