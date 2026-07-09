import { AICategorizationResult, AIOperationType, AIProvider, AppSettings, MeetingProcessResult, Project } from '../../shared/types'
import { AIUsageRepository } from '../database/repositories/ai-usage-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'

const CATEGORIZATION_PROMPT = `Você é um assistente que organiza notas de trabalho.
Dada uma frase escrita rapidamente por alguém durante o dia de trabalho, você deve:

1. Identificar a qual projeto pertence (da lista fornecida, ou sugerir um novo)
2. Classificar o tipo: information, decision, demand, idea, blocker, update
3. Classificar a ação necessária: none, action_needed, waiting_response
4. Reescrever o texto de forma mais clara e objetiva (mantendo a essência)
5. Se houver uma ação implícita (algo que precisa ser feito, respondido, ou acompanhado), sugerir uma TAREFA concisa para um kanban

Responda APENAS com JSON válido no formato:
{
  "project": {
    "id": "id-existente-ou-null",
    "suggestedName": "Nome se for projeto novo, ou null",
    "confidence": 0.85
  },
  "type": "information",
  "action": "none",
  "improvedText": "Texto melhorado aqui",
  "reasoning": "Explicação breve da categorização",
  "suggestedTask": null
}

Para o campo "suggestedTask", use null se não houver ação necessária. Se houver, use:
{
  "suggestedTask": {
    "title": "Verbo + ação concisa (ex: Enviar relatório para João)",
    "description": "Detalhes adicionais ou prazo se mencionado"
  }
}

Regras para sugerir tasks:
- Só sugira task se action for "action_needed" ou "waiting_response"
- O título deve ser curto e começar com verbo no infinitivo
- Se o texto mencionar prazo, inclua no description
- NÃO crie task para informações passivas ou decisões já tomadas`

export class AIService {
  private aiUsageRepo = new AIUsageRepository()
  private settingsRepo = new SettingsRepository()

  private getBaseUrl(settings: AppSettings): string {
    return `https://bedrock-runtime.${settings.awsRegion}.amazonaws.com`
  }

  async categorize(
    rawText: string,
    projects: Project[],
    settings: AppSettings
  ): Promise<AICategorizationResult> {
    const projectList = projects
      .map((p) => `- ${p.id}: ${p.name}${p.description ? ` (${p.description})` : ''}`)
      .join('\n')

    const userMessage = `Projetos existentes:
${projectList || '(nenhum projeto cadastrado ainda)'}

Texto para categorizar:
"${rawText}"`

    const responseText = await this.invokeConverse(
      CATEGORIZATION_PROMPT,
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

    const systemPrompt = 'Você é um assistente que gera resumos de projetos de trabalho. Responda em português.'

    const userMessage = `Gere um resumo executivo do projeto "${projectName}" baseado nas entradas e tasks recentes abaixo.
Inclua: status geral, decisões tomadas, ações pendentes, bloqueios.
Seja conciso e objetivo.

Entradas:
${entriesText}${tasksText}`

    return this.invokeConverse(systemPrompt, userMessage, settings, 'summary')
  }

  async processMeeting(
    title: string,
    participants: string[],
    content: string,
    settings: AppSettings,
    existingTasks?: { id: string; title: string; status: string }[]
  ): Promise<MeetingProcessResult> {
    const hasExistingTasks = existingTasks && existingTasks.length > 0

    const similarityInstructions = hasExistingTasks
      ? `
REGRAS PARA DETECÇÃO DE DUPLICATAS:
- Compare cada task sugerida com as TASKS EXISTENTES listadas abaixo
- Se uma task sugerida é semanticamente similar a uma existente (mesma ação, mesmo objetivo, mesmo escopo), adicione o campo "similarTo"
- "similarTo" deve conter: {"taskId": "id-da-task-existente", "taskTitle": "título-da-task-existente", "reason": "explicação curta de por que são similares"}
- Similar = mesma intenção, mesmo resultado esperado, mesmo responsável/escopo (ex: "Revisar proposta" e "Fazer revisão da proposta comercial" são similares)
- NÃO considere similar se: são ações distintas no mesmo tema, ou se uma é continuação/evolução da outra
- Se não há similaridade, omita o campo "similarTo"`
      : ''

    const systemPrompt = `Você é um assistente que gera atas de reunião estruturadas.
Dadas as anotações e/ou transcrição de uma reunião, gere:
1. Uma ata em markdown com: resumo, decisões, ações (com responsável se mencionado), e bloqueios
2. Uma lista CURTA de entries — APENAS os pontos que valem ser registrados para consulta futura
3. Uma lista de tasks para o kanban (ações concretas que alguém precisa executar)

Responda APENAS com JSON válido no formato:
{
  "minutes": "# Ata da Reunião\\n\\n## Resumo\\n...\\n\\n## Decisões\\n- ...\\n\\n## Ações\\n- [ ] Responsável: ação — prazo\\n\\n## Bloqueios\\n- ...",
  "entries": [
    {"text": "Texto da entrada", "type": "decision|blocker|request|update", "action": "none|action_needed|waiting_response"}
  ],
  "tasks": [
    {"title": "Verbo + ação concisa", "description": "Responsável e prazo se mencionado"}
  ]
}

REGRAS PARA ENTRIES (seja rigoroso):
- Crie entries APENAS para: decisões tomadas, bloqueios identificados, pedidos explícitos, e mudanças de status importantes
- NÃO crie entries para: informações contextuais, fatos óbvios, apresentações de pessoas, explicações técnicas, hipóteses, ou coisas que já estão na ata
- Se algo é apenas contexto (ex: "a rede tem múltiplas camadas"), NÃO vira entry — isso já está na ata
- Máximo de 5-8 entries por reunião. Menos é melhor. Só o que IMPORTA daqui 1 mês.

REGRAS PARA TASKS:
- Só crie tasks para ações concretas que alguém precisa FAZER
- Título começa com verbo no infinitivo
- Inclua o responsável na description se mencionado
- NÃO crie task para coisas genéricas como "discutir" ou "pensar sobre"
${similarityInstructions}

REGRAS PARA A ATA:
- O campo "minutes" deve ser markdown completo e bem formatado
- Na seção Ações, inclua responsável e prazo quando mencionados
- Seja conciso mas completo
- Escreva tudo em português`

    const participantsText = participants.length > 0
      ? `Participantes: ${participants.join(', ')}`
      : ''

    const existingTasksText = hasExistingTasks
      ? `\n\nTASKS EXISTENTES NO PROJETO (para verificar duplicatas):
${existingTasks.map((t) => `- [${t.id}] "${t.title}" (status: ${t.status})`).join('\n')}`
      : ''

    const userMessage = `Reunião: "${title}"
${participantsText}

Conteúdo capturado:
${content}${existingTasksText}`

    const responseText = await this.invokeConverse(systemPrompt, userMessage, settings, 'meeting_processing')

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON for meeting processing')
    }

    return JSON.parse(jsonMatch[0]) as MeetingProcessResult
  }

  async generateGlobalSummary(
    projectsData: { name: string; entries: { improvedText: string; type: string; action: string; createdAt: string }[]; tasks: { title: string; status: string }[] }[],
    settings: AppSettings
  ): Promise<string> {
    const systemPrompt = 'Você é um assistente que gera resumos executivos de trabalho. Responda em português.'

    const projectsSummaryText = projectsData.map((p) => {
      const entriesText = p.entries.slice(0, 5)
        .map((e) => `  [${e.type}][${e.action}] ${e.improvedText}`)
        .join('\n')
      const pendingTasks = p.tasks.filter((t) => t.status !== 'done')
      const tasksText = pendingTasks.length > 0
        ? '\n  Tasks pendentes: ' + pendingTasks.map((t) => t.title).join(', ')
        : ''
      return `### ${p.name}\n${entriesText}${tasksText}`
    }).join('\n\n')

    const userMessage = `Gere um resumo geral de TODOS os projetos abaixo. Para cada projeto, diga em 1-2 frases o status.
No final, destaque: itens que precisam de atenção imediata e bloqueios.
Seja direto e objetivo.

${projectsSummaryText}`

    return this.invokeConverse(systemPrompt, userMessage, settings, 'global_summary')
  }

  /**
   * Public wrapper for invokeConverse, used by other services (e.g. DigestService).
   */
  async invokeConversePublic(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings
  ): Promise<string> {
    return this.invokeConverse(systemPrompt, userMessage, settings, 'digest')
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
    return this.invokeConverse(systemPrompt, userMessage, settings, operationType)
  }

  /**
   * Routes to the appropriate provider based on settings.
   */
  private async invokeConverse(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType = 'categorization'
  ): Promise<string> {
    if (settings.aiProvider === 'local') {
      return this.invokeLocal(systemPrompt, userMessage, settings, operationType)
    }
    return this.invokeBedrock(systemPrompt, userMessage, settings, operationType)
  }

  /**
   * Calls a local OpenAI-compatible API (e.g. LM Studio, Ollama, LocalAI).
   * Endpoint default: http://localhost:1234/v1/chat/completions
   */
  private async invokeLocal(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType
  ): Promise<string> {
    const baseUrl = (settings.localEndpoint || 'http://localhost:1234').replace(/\/+$/, '')
    const url = `${baseUrl}/v1/chat/completions`

    const body = {
      model: settings.localModelId || undefined,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Some local servers support optional API key
    if (settings.localApiKey) {
      headers['Authorization'] = `Bearer ${settings.localApiKey}`
    }

    const startTime = Date.now()

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Local LLM API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    // OpenAI-compatible response format
    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0

    // Local LLMs are free, but we still record for stats
    const estimatedCost = 0

    try {
      this.aiUsageRepo.record({
        operationType,
        model: settings.localModelId || 'local',
        inputTokens,
        outputTokens,
        estimatedCost,
        latencyMs,
      })
    } catch (e) {
      console.error('Failed to record AI usage:', e)
    }

    const choice = data.choices?.[0]
    if (!choice?.message?.content) {
      throw new Error('Local LLM did not return a valid response')
    }

    return choice.message.content
  }

  /**
   * Calls the Bedrock Converse API using the API Key (Bearer Token).
   * Docs: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html
   */
  private async invokeBedrock(
    systemPrompt: string,
    userMessage: string,
    settings: AppSettings,
    operationType: AIOperationType = 'categorization'
  ): Promise<string> {
    const url = `${this.getBaseUrl(settings)}/model/${settings.modelId}/converse`

    const body = {
      system: [{ text: systemPrompt }],
      messages: [
        { role: 'user', content: [{ text: userMessage }] },
      ],
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.3,
      },
    }

    const startTime = Date.now()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.bedrockApiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Bedrock API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    // Extract token usage from Converse API response
    const inputTokens = data.usage?.inputTokens ?? 0
    const outputTokens = data.usage?.outputTokens ?? 0

    // Calculate estimated cost
    const currentSettings = this.settingsRepo.get()
    const priceInputPer1k = parseFloat(currentSettings.aiPriceInputPer1k) || 0.003
    const priceOutputPer1k = parseFloat(currentSettings.aiPriceOutputPer1k) || 0.015
    const estimatedCost = (inputTokens / 1000) * priceInputPer1k + (outputTokens / 1000) * priceOutputPer1k

    // Record usage
    try {
      this.aiUsageRepo.record({
        operationType,
        model: settings.modelId,
        inputTokens,
        outputTokens,
        estimatedCost,
        latencyMs,
      })
    } catch (e) {
      // Don't fail the AI call if usage recording fails
      console.error('Failed to record AI usage:', e)
    }

    // Converse API response format
    return data.output.message.content[0].text
  }
}
