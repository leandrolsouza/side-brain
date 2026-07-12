import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerAgentHandlers(): void {
  const { agentService } = getContainer()

  // ─── Agent CRUD ───────────────────────────────────────────────

  safeHandle('agent:getAll', async () => {
    return agentService.getAll()
  })

  safeHandle('agent:getById', async (_event, id: string) => {
    return agentService.getById(id)
  })

  safeHandle('agent:create', async (_event, data: any) => {
    return agentService.create(data)
  })

  safeHandle('agent:createFromTemplate', async (_event, templateId: string, overrides?: any) => {
    return agentService.createFromTemplate(templateId, overrides)
  })

  safeHandle('agent:update', async (_event, id: string, data: any) => {
    return agentService.update(id, data)
  })

  safeHandle('agent:delete', async (_event, id: string) => {
    return agentService.delete(id)
  })

  safeHandle('agent:toggleActive', async (_event, id: string) => {
    return agentService.toggleActive(id)
  })

  // ─── Execution ────────────────────────────────────────────────

  safeHandle('agent:run', async (_event, agentId: string, input: string) => {
    return agentService.run(agentId, input)
  })

  safeHandle('agent:cancelExecution', async (_event, executionId: string) => {
    agentService.cancelExecution(executionId)
    return { success: true }
  })

  safeHandle('agent:getExecutions', async (_event, agentId: string, limit?: number) => {
    return agentService.getExecutions(agentId, limit)
  })

  safeHandle('agent:getRecentExecutions', async (_event, limit?: number) => {
    return agentService.getRecentExecutions(limit)
  })

  safeHandle('agent:getExecutionDetails', async (_event, executionId: string) => {
    return agentService.getExecutionDetails(executionId)
  })

  // ─── Templates & Skills ───────────────────────────────────────

  safeHandle('agent:getTemplates', async () => {
    return agentService.getTemplates()
  })

  safeHandle('agent:getAvailableSkills', async () => {
    return agentService.getAvailableSkills()
  })

  safeHandle('agent:getToolDefinitions', async () => {
    return agentService.getToolDefinitions()
  })

  // ─── Maintenance ──────────────────────────────────────────────

  safeHandle('agent:cleanup', async (_event, olderThanDays?: number) => {
    return agentService.cleanup(olderThanDays)
  })

  // ─── AI-Assisted Creation ─────────────────────────────────────

  safeHandle('agent:generateFromDescription', async (_event, description: string) => {
    const { aiProvider, settingsRepo } = getContainer()
    const settings = settingsRepo.get()

    const systemPrompt = `Você é um assistente que cria agentes de IA para um aplicativo de produtividade chamado SideBrain. O usuário vai descrever o que quer que o agente faça, e você deve gerar a configuração completa.

O SideBrain é um "segundo cérebro" onde o usuário registra entries (notas), tasks, decisions, meetings, e organiza por projetos. Os agentes analisam esses dados e dão conselhos.

Skills disponíveis (escolha as relevantes):
- read_entries: Ler entradas/registros do usuário
- read_tasks: Ler tarefas
- read_projects: Ler projetos
- read_meetings: Ler reuniões
- create_task: Criar tarefas
- update_task: Atualizar tarefas
- create_entry: Criar entradas
- generate_summary: Gerar resumos
- generate_report: Gerar relatórios analíticos
- search_semantic: Busca semântica por similaridade
- discover_connections: Descobrir conexões entre entries
- send_notification: Enviar notificações
- delegate: Delegar para outro agente

Ícones disponíveis: Bot, ClipboardCheck, PenTool, BarChart3, Lightbulb, Users
Cores disponíveis: blue, purple, green, yellow, orange, red, cyan

Retorne APENAS um JSON válido (sem markdown, sem code block) com esta estrutura:
{
  "name": "Nome curto do agente",
  "description": "Descrição em 1 frase do que ele faz",
  "persona": "Instruções completas de comportamento (3-5 parágrafos detalhados)",
  "icon": "nome_do_icone",
  "color": "cor",
  "skills": ["skill1", "skill2", ...],
  "maxSteps": 6
}`

    const userMessage = `Crie um agente com base nesta descrição do usuário:\n\n"${description}"\n\nLembre-se: o agente trabalha sobre os DADOS do usuário no SideBrain. Ele não cria coisas do zero, ele analisa e aconselha com base no que já está registrado.`

    const responseText = await aiProvider.invoke(systemPrompt, userMessage, settings, 'agent_execution')

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON')
    }

    return JSON.parse(jsonMatch[0])
  })
}
