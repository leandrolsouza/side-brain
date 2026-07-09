import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import type { ReportPeriod } from '../../shared/types'

export function registerReportsHandlers(): void {
  const { reportsService } = getContainer()

  safeHandle('reports:getData', async (_event, period: ReportPeriod) => {
    return reportsService.getReportsData(period)
  })
}
