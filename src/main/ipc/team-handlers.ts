import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import type { TeamCreateData, TeamUpdateData } from '../../shared/types'

export function registerTeamHandlers(): void {
  const { teamExecutionService } = getContainer()

  // ─── Team CRUD ────────────────────────────────────────────────

  safeHandle('team:getAll', async () => {
    return teamExecutionService.getAllTeams()
  })

  safeHandle('team:getById', async (_event, id: string) => {
    return teamExecutionService.getTeamById(id)
  })

  safeHandle('team:create', async (_event, data: TeamCreateData) => {
    return teamExecutionService.createTeam(data)
  })

  safeHandle('team:update', async (_event, id: string, data: TeamUpdateData) => {
    return teamExecutionService.updateTeam(id, data)
  })

  safeHandle('team:delete', async (_event, id: string) => {
    return teamExecutionService.deleteTeam(id)
  })

  // ─── Execution ────────────────────────────────────────────────

  safeHandle('team:runDiscussion', async (_event, teamId: string, input: string) => {
    return teamExecutionService.runDiscussion(teamId, input)
  })

  safeHandle('team:getExecutions', async (_event, teamId: string, limit?: number) => {
    return teamExecutionService.getExecutionsForTeam(teamId, limit)
  })

  safeHandle('team:getRecentExecutions', async (_event, limit?: number) => {
    return teamExecutionService.getRecentExecutions(limit)
  })

  safeHandle('team:getExecutionDetails', async (_event, executionId: string) => {
    return teamExecutionService.getExecutionDetails(executionId)
  })
}
