import { ReportsRepository } from '../database/repositories/reports-repository'
import type { ReportsData, ReportPeriod } from '../../shared/types'

export class ReportsService {
  private reportsRepo = new ReportsRepository()

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
}
