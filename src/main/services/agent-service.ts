import {
  AgentDefinition,
  AgentExecution,
  AgentExecutionSummary,
  AgentScope,
  AgentSkill,
  AgentStep,
  AgentTemplate,
  AgentTrigger,
  ToolDefinition,
} from '../../shared/types'
import { AgentRepository } from '../database/repositories/agent-repository'
import { AgentRuntime, ExecutionResult } from './agent-runtime'
import { AgentToolRegistry } from './agent-tool-registry'

/**
 * Built-in agent templates for quick setup.
 */
const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'template-arq-software',
    name: 'Advisor — Arq. de Software',
    description: 'Analisa decisões técnicas de código, padrões de design, acoplamento, e qualidade de implementação com base nos seus registros.',
    icon: 'Bot',
    color: 'cyan',
    persona: `Você é um Arquiteto de Software sênior atuando como advisor. O usuário também é arquiteto. Seu papel é analisar o que o usuário registrou no seu segundo cérebro e dar feedback focado em arquitetura de software.

Seu foco:
- Padrões de design e anti-patterns nas decisões registradas
- Acoplamento e coesão entre componentes/serviços mencionados
- Trade-offs de implementação (ex: performance vs manutenibilidade)
- Consistência de decisões técnicas de código entre projetos
- Riscos técnicos: débito técnico implícito, complexidade acidental
- Qualidade: testabilidade, observabilidade, resiliência

Como atuar:
- Leia as entries, decisions e tasks do usuário pra entender o contexto
- Questione trade-offs de código/design: "Esse padrão pode causar X"
- Identifique riscos que o usuário pode não ter visto
- Sugira alternativas quando encontrar problemas
- Conecte decisões de projetos diferentes que podem conflitar

Regras:
- Use APENAS dados encontrados no sistema. Nunca invente contexto.
- Seja técnico e direto. Sem explicações básicas.
- Foque em: design, código, testabilidade, manutenibilidade.
- Quando questionar, justifique em 1-2 frases.
- Se não tiver dados, diga claramente.`,
    skills: ['read_entries', 'read_tasks', 'read_projects', 'read_meetings', 'search_semantic', 'discover_connections'],
    scope: { projectIds: 'all' },
    triggers: [{ type: 'manual' }],
    maxSteps: 8,
    requiresApproval: false,
  },
  {
    id: 'template-arq-sistemas',
    name: 'Advisor — Arq. de Sistemas',
    description: 'Foca em infraestrutura, integração, escalabilidade, disponibilidade e operação dos sistemas registrados.',
    icon: 'Bot',
    color: 'green',
    persona: `Você é um Arquiteto de Sistemas sênior atuando como advisor. O usuário também é arquiteto. Seu papel é analisar o que o usuário registrou no seu segundo cérebro e dar feedback focado em arquitetura de sistemas/infraestrutura.

Seu foco:
- Infraestrutura e deploy: como os sistemas estão hospedados, escalados
- Integração entre sistemas: APIs, mensageria, sincronização
- Disponibilidade e resiliência: pontos únicos de falha, recovery
- Performance e escalabilidade: gargalos, limites de capacidade
- Segurança e compliance: exposição de dados, autenticação, auditoria
- Operação: monitoramento, alertas, runbooks, incident response

Como atuar:
- Leia entries, decisions e tasks pra mapear o cenário de infraestrutura
- Questione: "Se esse componente cair, o que acontece?" "Como escala?"
- Identifique dependências críticas entre sistemas/projetos
- Aponte quando uma decisão de software impacta a operação
- Sugira pontos de observabilidade ou resiliência que estejam faltando

Regras:
- Use APENAS dados encontrados no sistema. Nunca invente contexto.
- Seja direto e pragmático. Pense em produção.
- Foque em: infra, integração, escala, disponibilidade, segurança.
- Priorize riscos operacionais sobre melhorias incrementais.
- Se não tiver dados sobre a infra, pergunte.`,
    skills: ['read_entries', 'read_tasks', 'read_projects', 'read_meetings', 'search_semantic', 'discover_connections'],
    scope: { projectIds: 'all' },
    triggers: [{ type: 'manual' }],
    maxSteps: 8,
    requiresApproval: false,
  },
  {
    id: 'template-arq-solucoes',
    name: 'Advisor — Arq. de Soluções',
    description: 'Visão end-to-end: alinha decisões técnicas com objetivos de negócio, stakeholders, e roadmap.',
    icon: 'Bot',
    color: 'purple',
    persona: `Você é um Arquiteto de Soluções sênior atuando como advisor. O usuário também é arquiteto. Seu papel é analisar o que o usuário registrou no seu segundo cérebro e dar feedback com visão holística — conectando técnica com negócio.

Seu foco:
- Alinhamento técnico-negócio: as decisões técnicas suportam os objetivos?
- Visão end-to-end: como os componentes se conectam pra entregar valor?
- Stakeholder management: decisões que impactam outros times/áreas
- Roadmap e sequenciamento: o que deveria vir antes do quê?
- Buy vs Build: quando usar solução pronta vs desenvolver?
- Riscos de projeto: escopo, prazo, dependência de terceiros, capacidade do time

Como atuar:
- Leia entries, decisions e tasks pra entender o cenário completo
- Conecte decisões técnicas com impacto em negócio/produto
- Questione: "O cliente precisa disso agora?" "Isso entrega valor quando?"
- Identifique quando decisões de diferentes projetos precisam ser coordenadas
- Sugira sequenciamento quando identificar dependências cross-projeto
- Alerte sobre riscos de comunicação/alinhamento com stakeholders

Regras:
- Use APENAS dados encontrados no sistema. Nunca invente contexto.
- Pense como um C-level que entende código. Visão ampla.
- Foque em: valor, prioridade, alinhamento, viabilidade.
- Quando recomendar, conecte com o "por que" de negócio.
- Se faltar contexto de negócio nos dados, aponte isso.`,
    skills: ['read_entries', 'read_tasks', 'read_projects', 'read_meetings', 'search_semantic', 'discover_connections', 'generate_summary'],
    scope: { projectIds: 'all' },
    triggers: [{ type: 'manual' }],
    maxSteps: 8,
    requiresApproval: false,
  },
  {
    id: 'template-lider-equipe',
    name: 'Líder de Equipe',
    description: 'Orquestrador que coordena os 3 advisors de arquitetura. Você fala com ele, e ele distribui o trabalho entre os membros.',
    icon: 'Users',
    color: 'blue',
    persona: `Você é o líder de uma equipe de 3 arquitetos de IA que assessoram um arquiteto. Seu papel é COORDENAR, não fazer o trabalho sozinho.

Sua equipe:
- Arq. de Software: padrões de design, código, testabilidade, acoplamento
- Arq. de Sistemas: infra, integração, escala, disponibilidade, segurança
- Arq. de Soluções: visão end-to-end, alinhamento negócio, roadmap, stakeholders

Como funcionar:
1. Receba o pedido do usuário
2. Decida quais membros da equipe devem ser consultados (2-3)
3. Delegue sub-tarefas específicas pra cada um (use a tool "delegate")
4. Receba as respostas
5. Consolide em uma resposta única e coesa

Regras:
- SEMPRE delegue. Não tente responder sozinho.
- Seja específico na instrução de delegação: diga O QUE quer que analise.
- Na consolidação: organize por importância, resolva conflitos, destaque consensos.
- Se dois discordarem, apresente ambas visões + sua recomendação.
- Fale em primeira pessoa do plural: "analisamos", "identificamos", "recomendamos".
- Seja breve na intro e vá direto às conclusões.`,
    skills: ['read_entries', 'read_tasks', 'read_projects', 'delegate'],
    scope: { projectIds: 'all' },
    triggers: [{ type: 'manual' }],
    maxSteps: 12,
    requiresApproval: false,
  },
]

/**
 * High-level service that orchestrates agent management.
 * Handles CRUD, templates, scheduling, and execution coordination.
 */
export class AgentService {
  private scheduledTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(
    private agentRepo: AgentRepository,
    private agentRuntime: AgentRuntime,
    private toolRegistry: AgentToolRegistry
  ) { }

  // ─── Agent CRUD ───────────────────────────────────────────────

  getAll(): AgentDefinition[] {
    return this.agentRepo.getAll()
  }

  getById(id: string): AgentDefinition | null {
    return this.agentRepo.getById(id)
  }

  create(data: Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'>): AgentDefinition {
    const agent = this.agentRepo.create(data)
    this.setupSchedule(agent)
    return agent
  }

  createFromTemplate(templateId: string, overrides?: Partial<Pick<AgentDefinition, 'name' | 'scope' | 'triggers'>>): AgentDefinition {
    const template = AGENT_TEMPLATES.find((t) => t.id === templateId)
    if (!template) {
      throw new Error(`Template "${templateId}" not found`)
    }

    // For the team leader template, auto-populate canDelegate with existing agents
    let canDelegate: string[] = []
    if (templateId === 'template-lider-equipe') {
      const existingAgents = this.agentRepo.getActive()
      canDelegate = existingAgents.map((a) => a.id)
    }

    return this.create({
      name: overrides?.name || template.name,
      description: template.description,
      persona: template.persona,
      icon: template.icon,
      color: template.color,
      skills: template.skills,
      scope: overrides?.scope || template.scope,
      triggers: overrides?.triggers || template.triggers,
      canDelegate,
      maxSteps: template.maxSteps,
      isActive: true,
      requiresApproval: template.requiresApproval,
    })
  }

  update(id: string, data: Partial<Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'>>): AgentDefinition | null {
    const agent = this.agentRepo.update(id, data)
    if (agent) {
      // Reschedule if triggers changed
      this.clearSchedule(id)
      if (agent.isActive) {
        this.setupSchedule(agent)
      }
    }
    return agent
  }

  delete(id: string): boolean {
    this.clearSchedule(id)
    return this.agentRepo.delete(id)
  }

  toggleActive(id: string): AgentDefinition | null {
    const agent = this.agentRepo.getById(id)
    if (!agent) return null

    const updated = this.agentRepo.update(id, { isActive: !agent.isActive })
    if (updated) {
      if (updated.isActive) {
        this.setupSchedule(updated)
      } else {
        this.clearSchedule(id)
      }
    }
    return updated
  }

  // ─── Execution ────────────────────────────────────────────────

  /**
   * Run an agent with a user-provided input.
   */
  async run(agentId: string, input: string): Promise<ExecutionResult> {
    return this.agentRuntime.execute(agentId, input, { trigger: 'manual' })
  }

  /**
   * Cancel a running execution.
   */
  cancelExecution(executionId: string): void {
    this.agentRuntime.cancel(executionId)
  }

  /**
   * Get execution history for an agent.
   */
  getExecutions(agentId: string, limit = 20): AgentExecutionSummary[] {
    return this.agentRepo.getExecutionsForAgent(agentId, limit)
  }

  /**
   * Get all recent executions across all agents.
   */
  getRecentExecutions(limit = 50): AgentExecutionSummary[] {
    return this.agentRepo.getRecentExecutions(limit)
  }

  /**
   * Get full execution details with steps.
   */
  getExecutionDetails(executionId: string): AgentExecution | null {
    return this.agentRepo.getExecution(executionId)
  }

  // ─── Templates ────────────────────────────────────────────────

  getTemplates(): AgentTemplate[] {
    return AGENT_TEMPLATES
  }

  // ─── Available Skills / Tools ─────────────────────────────────

  getAvailableSkills(): { skill: AgentSkill; description: string }[] {
    const allTools = this.toolRegistry.getAllToolDefinitions()
    const skillMap: { skill: AgentSkill; description: string }[] = allTools.map((t) => ({
      skill: t.name as AgentSkill,
      description: t.description,
    }))

    // Add delegate (not in registry, handled by runtime)
    skillMap.push({
      skill: 'delegate',
      description: 'Delega uma tarefa para outro agente.',
    })

    return skillMap
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.toolRegistry.getAllToolDefinitions()
  }

  // ─── Scheduling ───────────────────────────────────────────────

  /**
   * Initialize scheduled agents on app startup.
   */
  initializeSchedules(): void {
    const agents = this.agentRepo.getActive()
    for (const agent of agents) {
      this.setupSchedule(agent)
    }
  }

  /**
   * Stop all scheduled executions (for app shutdown).
   */
  stopAllSchedules(): void {
    for (const [id, timer] of this.scheduledTimers) {
      clearInterval(timer)
    }
    this.scheduledTimers.clear()
  }

  private setupSchedule(agent: AgentDefinition): void {
    if (!agent.isActive) return

    for (const trigger of agent.triggers) {
      if (trigger.type !== 'schedule' || !trigger.scheduleConfig) continue

      const intervalMs = this.parseScheduleExpression(trigger.scheduleConfig.expression)
      if (!intervalMs) continue

      const timer = setInterval(async () => {
        try {
          const input = `Execução agendada (${trigger.scheduleConfig!.expression}). Analise o estado atual e execute suas responsabilidades.`
          await this.agentRuntime.execute(agent.id, input, { trigger: 'schedule' })
        } catch (error: any) {
          console.error(`Scheduled agent "${agent.name}" failed:`, error.message)
        }
      }, intervalMs)

      this.scheduledTimers.set(`${agent.id}:${trigger.scheduleConfig.expression}`, timer)
    }
  }

  private clearSchedule(agentId: string): void {
    for (const [key, timer] of this.scheduledTimers) {
      if (key.startsWith(`${agentId}:`)) {
        clearInterval(timer)
        this.scheduledTimers.delete(key)
      }
    }
  }

  /**
   * Parse a simplified schedule expression into milliseconds.
   * Supports: 'hourly', 'daily:HH:MM', 'every:Nm' (every N minutes)
   */
  private parseScheduleExpression(expression: string): number | null {
    if (expression === 'hourly') {
      return 60 * 60 * 1000
    }

    if (expression.startsWith('every:')) {
      const match = expression.match(/^every:(\d+)m$/)
      if (match) {
        return parseInt(match[1], 10) * 60 * 1000
      }
    }

    if (expression.startsWith('daily:')) {
      // For daily schedules, we use 24h interval (simplified approach)
      // A more precise implementation would use setTimeout to the exact time
      return 24 * 60 * 60 * 1000
    }

    if (expression.startsWith('weekly:')) {
      return 7 * 24 * 60 * 60 * 1000
    }

    return null
  }

  // ─── Maintenance ──────────────────────────────────────────────

  /**
   * Clean up old execution records.
   */
  cleanup(olderThanDays = 30): number {
    return this.agentRepo.deleteOldExecutions(olderThanDays)
  }
}
