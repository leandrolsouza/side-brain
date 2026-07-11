import { AICategorizationResult, AIOperationType, AppSettings, MeetingProcessResult, Project, CustomEntryType, CustomActionStatus } from '../../shared/types'
import { CustomFieldsRepository } from '../database/repositories/custom-fields-repository'
import { AIProvider } from './ai-provider'

function buildCategorizationPrompt(entryTypes: CustomEntryType[], actionStatuses: CustomActionStatus[]): string {
  const typeKeys = entryTypes.map(t => t.key).join(', ')
  const actionKeys = actionStatuses.filter(s => s.key !== 'done').map(s => s.key).join(', ')
  const noActionTypes = entryTypes.filter(t => !t.allowsAction).map(t => t.key)
  const actionTypes = entryTypes.filter(t => t.allowsAction).map(t => t.key)

  const noActionRules = noActionTypes.length > 0
    ? noActionTypes.map(t => `- Se type for "${t}", action DEVE ser "none"`).join('\n')
    : ''
  const actionRules = actionTypes.length > 0
    ? `- Apenas ${actionTypes.map(t => `"${t}"`).join(', ')} podem ter action diferente de "none"`
    : ''

  return `Você é um assistente que organiza notas de trabalho.
Dada uma frase escrita rapidamente por alguém durante o dia de trabalho, você deve:

1. Identificar a qual projeto pertence (da lista fornecida, ou sugerir um novo)
2. Classificar o tipo: ${typeKeys}
3. Classificar a ação necessária: ${actionKeys}
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

Regras para action:
${noActionRules}
${actionRules}

Regras para sugerir tasks:
- Só sugira task se action for "action_needed" ou "waiting_response"
- O título deve ser curto e começar com verbo no infinitivo
- Se o texto mencionar prazo, inclua no description
- NÃO crie task para informações passivas ou decisões já tomadas`
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

    const userMessage = `Projetos existentes:
${projectList || '(nenhum projeto cadastrado ainda)'}

Texto para categorizar:
"${rawText}"`

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

    const systemPrompt = 'Você é um assistente que gera resumos de projetos de trabalho. Responda em português.'

    const userMessage = `Gere um resumo executivo do projeto "${projectName}" baseado nas entradas e tasks recentes abaixo.
Inclua: status geral, decisões tomadas, ações pendentes, bloqueios.
Seja conciso e objetivo.

Entradas:
${entriesText}${tasksText}`

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
      ? `
REGRAS PARA DETECÇÃO DE DUPLICATAS:
- Compare cada task sugerida com as TASKS EXISTENTES listadas abaixo
- Se uma task sugerida é semanticamente similar a uma existente (mesma ação, mesmo objetivo, mesmo escopo), adicione o campo "similarTo"
- "similarTo" deve conter: {"taskId": "id-da-task-existente", "taskTitle": "título-da-task-existente", "reason": "explicação curta de por que são similares"}
- Similar = mesma intenção, mesmo resultado esperado, mesmo responsável/escopo (ex: "Revisar proposta" e "Fazer revisão da proposta comercial" são similares)
- NÃO considere similar se: são ações distintas no mesmo tema, ou se uma é continuação/evolução da outra
- Se não há similaridade, omita o campo "similarTo"

REGRAS PARA TASKS RESOLVIDAS (resolvedTasks):
- Analise o conteúdo da reunião e identifique se alguma TASK EXISTENTE foi CONCLUÍDA ou RESOLVIDA durante a reunião
- Uma task é considerada resolvida se: alguém confirmou que fez, foi apresentado o resultado, ou o grupo validou como feita
- Adicione no campo "resolvedTasks" cada task existente que foi resolvida: {"taskId": "id-da-task", "taskTitle": "título-da-task", "reason": "por que foi considerada resolvida"}
- Seja conservador: só marque como resolvida se houver evidência CLARA na transcrição
- NÃO marque como resolvida se: apenas foi mencionada, está em andamento, ou foi apenas discutida sem conclusão
- Se nenhuma task foi resolvida, retorne "resolvedTasks": []`
      : ''

    const assigneeInstructions = `
REGRAS PARA RESPONSÁVEL (assignee):
- Para CADA task, identifique quem é o responsável principal pela execução
- O campo "assignee" deve conter o PRIMEIRO NOME da pessoa responsável (ex: "Leandro", "Victor", "Carol")
- Se a task é para múltiplas pessoas, use o primeiro nome de quem lidera ou foi mencionado primeiro
- Se não conseguir identificar um responsável claro, use null
- Baseie-se nas ações mencionadas na reunião, quem se comprometeu a fazer, ou a quem foi delegado`

    const systemPrompt = `Você é um assistente que gera atas de reunião estruturadas.
Dadas as anotações e/ou transcrição de uma reunião, gere:
1. Uma ata em markdown com: resumo, decisões, ações (com responsável se mencionado), e bloqueios
2. Uma lista CURTA de entries — APENAS os pontos que valem ser registrados para consulta futura
3. Uma lista de tasks para o kanban (ações concretas que alguém precisa executar)
4. Uma lista de tasks existentes que foram RESOLVIDAS/CONCLUÍDAS durante a reunião

Responda APENAS com JSON válido no formato:
{
  "minutes": "# Ata da Reunião\\n\\n## Resumo\\n...\\n\\n## Decisões\\n- ...\\n\\n## Ações\\n- [ ] Responsável: ação — prazo\\n\\n## Bloqueios\\n- ...",
  "entries": [
    {"text": "Texto da entrada", "type": "decision|blocker|request|update", "action": "none|action_needed|waiting_response"}
  ],
  "tasks": [
    {"title": "Verbo + ação concisa", "description": "Responsável e prazo se mencionado", "assignee": "NomeDaPessoa ou null"}
  ],
  "resolvedTasks": [
    {"taskId": "id-da-task-existente", "taskTitle": "título-da-task", "reason": "motivo pelo qual foi considerada resolvida"}
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
${assigneeInstructions}
${similarityInstructions}

REGRAS PARA A ATA:
- O campo "minutes" deve ser markdown completo e bem formatado
- Na seção Ações, inclua responsável e prazo quando mencionados
- Seja conciso mas completo
- Escreva tudo em português`

    const participantsText = participants.length > 0
      ? `Participantes: ${participants.join(', ')}`
      : ''

    const userNameText = userName
      ? `\nO USUÁRIO que está registrando esta reunião é: "${userName}" (use este nome para identificar as tasks dele)`
      : ''

    const existingTasksText = hasExistingTasks
      ? `\n\nTASKS EXISTENTES NO PROJETO (para verificar duplicatas E identificar tasks resolvidas):
${existingTasks.map((t) => `- [${t.id}] "${t.title}" (status: ${t.status})`).join('\n')}`
      : ''

    const userMessage = `Reunião: "${title}"
${participantsText}${userNameText}

Conteúdo capturado:
${content}${existingTasksText}`

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
    const fixPrompt = `O JSON abaixo está com erro de sintaxe e não consegue ser parseado. Corrija APENAS os erros de sintaxe (vírgulas faltando, aspas não escapadas, etc) e retorne o JSON corrigido. NÃO altere o conteúdo, apenas conserte a formatação.

Retorne APENAS o JSON válido, sem explicações.`

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

    const systemPrompt = `Você é um assistente que analisa entradas de trabalho e identifica CONEXÕES SEMÂNTICAS entre elas.

Dado um conjunto de entradas (notas de trabalho), identifique pares de entradas que estão relacionadas.

Tipos de conexão possíveis:
- "related": As entradas tratam do mesmo tema ou contexto
- "follows_up": Uma entrada é continuação ou resultado da outra (a source é continuação do target)
- "contradicts": Uma entrada invalida ou contradiz informação da outra
- "depends_on": Uma entrada depende de algo mencionado na outra
- "evolves": Uma entrada representa uma evolução ou atualização da outra

REGRAS:
- Só sugira conexões quando houver relação SEMÂNTICA CLARA entre as entradas
- NÃO conecte entradas apenas por serem do mesmo projeto ou tipo
- Prefira qualidade sobre quantidade — menos conexões corretas > muitas conexões fracas
- O campo "reason" deve explicar brevemente POR QUE as entradas estão conectadas
- Máximo de 15 conexões sugeridas por chamada
- sourceId e targetId devem ser IDs válidos da lista fornecida

Responda APENAS com JSON válido no formato:
{
  "connections": [
    {"sourceId": "id-1", "targetId": "id-2", "connectionType": "related", "reason": "Ambas discutem a migração do banco de dados"}
  ]
}`

    const entriesText = entries.map((e, i) =>
      `[${e.id}] (${e.type}, ${new Date(e.createdAt).toLocaleDateString('pt-BR')}): ${e.improvedText}`
    ).join('\n')

    const userMessage = `Analise as seguintes entradas e identifique conexões semânticas entre elas:

${entriesText}`

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
