import { ReportsRepository } from '../database/repositories/reports-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIService } from './ai-service'
import type { ReportsData, ReportPeriod } from '../../shared/types'
import { t } from '../i18n'

export class ReportsService {
  private reportsRepo = new ReportsRepository()

  constructor(
    private settingsRepo?: SettingsRepository,
    private aiService?: AIService
  ) { }

  private getDateRange(period: ReportPeriod): { dateFrom?: string; dateTo?: string } {
    if (period === 'all') return {}
    const now = new Date()
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const from = new Date(now)
    from.setDate(from.getDate() - days)
    return { dateFrom: from.toISOString(), dateTo: now.toISOString() }
  }

  getReportsData(period: ReportPeriod): ReportsData {
    const { dateFrom, dateTo } = this.getDateRange(period)

    return {
      overview: this.reportsRepo.getOverview(dateFrom, dateTo),
      activityTimeline: this.reportsRepo.getActivityTimeline(dateFrom, dateTo),
      entryTypeDistribution: this.reportsRepo.getEntryTypeDistribution(dateFrom, dateTo),
      projectRanking: this.reportsRepo.getProjectRanking(dateFrom, dateTo),
      taskFlow: this.reportsRepo.getTaskFlowStats(),
      weekdayActivity: this.reportsRepo.getWeekdayActivity(dateFrom, dateTo),
    }
  }

  /**
   * Generates an AI narrative analysis of the report data.
   * Takes the already-computed ReportsData and asks the AI to summarize
   * trends, highlight concerns, and suggest improvements.
   */
  async generateNarrative(period: ReportPeriod): Promise<string> {
    if (!this.settingsRepo || !this.aiService) {
      throw new Error('AI not configured for reports narrative')
    }

    const data = this.getReportsData(period)
    const settings = this.settingsRepo.get()

    // Build a concise data summary for the AI
    const dataSummary = this.buildDataSummary(data, period)

    const systemPrompt = t('prompts.reports_narrative.system')
    const userMessage = `Analise estes dados de produtividade e gere insights em formato narrativo:\n\n${dataSummary}`

    if (!systemPrompt || systemPrompt === 'prompts.reports_narrative.system') {
      // Fallback system prompt if i18n key not found
      return this.aiService.invokeConverseForChat(
        'Você é um analista de produtividade pessoal. Baseado nos dados de relatório do usuário, gere uma análise curta e acionável em português brasileiro. Escreva em 3-5 parágrafos curtos usando markdown. Identifique tendências, destaque preocupações e termine com 1-2 sugestões práticas. Não repita números brutos — interprete-os.',
        userMessage,
        settings,
        'insights'
      )
    }

    return this.aiService.invokeConverseForChat(
      systemPrompt,
      userMessage,
      settings,
      'insights'
    )
  }

  private buildDataSummary(data: ReportsData, period: ReportPeriod): string {
    const periodLabel = period === '7d' ? '7 dias' : period === '30d' ? '30 dias' : period === '90d' ? '90 dias' : 'todo o histórico'
    const parts: string[] = []

    // Overview
    parts.push(`Período: ${periodLabel}`)
    parts.push(`Entradas criadas: ${data.overview.totalEntries}`)
    parts.push(`Tarefas totais: ${data.overview.totalTasks} (${data.overview.tasksCompleted} concluídas, ${data.overview.tasksPending} pendentes)`)
    parts.push(`Taxa de conclusão: ${data.overview.completionRate}%`)
    parts.push(`Projetos ativos: ${data.overview.activeProjects}/${data.overview.totalProjects}`)
    parts.push(`Reuniões: ${data.overview.totalMeetings}`)
    if (data.overview.avgTaskResolutionDays !== null) {
      parts.push(`Tempo médio de resolução de tasks: ${data.overview.avgTaskResolutionDays.toFixed(1)} dias`)
    }

    // Task Flow
    parts.push(`\nDistribuição de tasks: ${data.taskFlow.todo} a fazer, ${data.taskFlow.inProgress} em andamento, ${data.taskFlow.waiting} aguardando, ${data.taskFlow.done} concluídas`)
    if (data.taskFlow.longestWaitingTask) {
      parts.push(`Task mais antiga em espera: "${data.taskFlow.longestWaitingTask.title}" (${data.taskFlow.longestWaitingTask.projectName}) — ${data.taskFlow.longestWaitingTask.daysSinceUpdate} dias`)
    }

    // Entry type distribution
    if (data.entryTypeDistribution.length > 0) {
      const typesStr = data.entryTypeDistribution
        .slice(0, 6)
        .map((d) => `${d.type}: ${d.count} (${d.percentage}%)`)
        .join(', ')
      parts.push(`\nTipos de entrada: ${typesStr}`)
    }

    // Project ranking (top 5)
    if (data.projectRanking.length > 0) {
      parts.push(`\nProjetos mais ativos:`)
      for (const p of data.projectRanking.slice(0, 5)) {
        parts.push(`- ${p.projectName}: ${p.entryCount} entradas, ${p.completedTasks}/${p.taskCount} tasks concluídas${p.blockerCount > 0 ? `, ${p.blockerCount} blockers` : ''}`)
      }
    }

    // Weekday patterns
    if (data.weekdayActivity.length > 0) {
      const busiestDay = data.weekdayActivity.reduce((a, b) => (a.entries + a.tasksCompleted > b.entries + b.tasksCompleted ? a : b))
      if (busiestDay.entries > 0 || busiestDay.tasksCompleted > 0) {
        parts.push(`\nDia mais produtivo: ${busiestDay.label} (${busiestDay.entries} entradas, ${busiestDay.tasksCompleted} tasks concluídas)`)
      }
    }

    // Activity trend (first vs last third)
    if (data.activityTimeline.length >= 6) {
      const third = Math.floor(data.activityTimeline.length / 3)
      const firstThird = data.activityTimeline.slice(0, third)
      const lastThird = data.activityTimeline.slice(-third)
      const avgFirst = firstThird.reduce((s, d) => s + d.entries, 0) / firstThird.length
      const avgLast = lastThird.reduce((s, d) => s + d.entries, 0) / lastThird.length
      const trend = avgLast > avgFirst * 1.2 ? 'crescente' : avgLast < avgFirst * 0.8 ? 'decrescente' : 'estável'
      parts.push(`Tendência de atividade: ${trend}`)
    }

    return parts.join('\n')
  }
}
