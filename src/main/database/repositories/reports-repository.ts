import { getDatabase } from '../schema'
import type {
  ProductivityOverview,
  ActivityTimelinePoint,
  EntryTypeDistribution,
  ProjectRanking,
  TaskFlowStats,
  WeekdayActivity,
  EntryType,
} from '../../../shared/types'

export class ReportsRepository {
  private getDateFilter(dateFrom?: string, dateTo?: string): { where: string; params: string[] } {
    const conditions: string[] = []
    const params: string[] = []
    if (dateFrom) {
      conditions.push('created_at >= ?')
      params.push(dateFrom)
    }
    if (dateTo) {
      conditions.push('created_at <= ?')
      params.push(dateTo)
    }
    return {
      where: conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '',
      params,
    }
  }

  getOverview(dateFrom?: string, dateTo?: string): ProductivityOverview {
    const db = getDatabase()
    const { where: entryWhere, params: entryParams } = this.getDateFilter(dateFrom, dateTo)

    // Entries count
    const entryCount = db.prepare(
      `SELECT COUNT(*) as count FROM entries${entryWhere}`
    ).get(...entryParams) as { count: number }

    // Tasks total and by status
    const { where: taskWhere, params: taskParams } = this.getDateFilter(dateFrom, dateTo)
    const taskStats = db.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status != 'done' THEN 1 ELSE 0 END) as pending
      FROM tasks${taskWhere}`
    ).get(...taskParams) as { total: number; completed: number; pending: number }

    // Projects
    const projectStats = db.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active
      FROM projects`
    ).get() as { total: number; active: number }

    // Meetings count
    const meetingCount = db.prepare(
      `SELECT COUNT(*) as count FROM meetings${entryWhere.replace('created_at', 'created_at')}`
    ).get(...entryParams) as { count: number }

    // Average task resolution time (days between created_at and updated_at for done tasks)
    const avgResolution = db.prepare(
      `SELECT AVG(JULIANDAY(updated_at) - JULIANDAY(created_at)) as avgDays
       FROM tasks
       WHERE status = 'done'${dateFrom ? ' AND updated_at >= ?' : ''}${dateTo ? ' AND updated_at <= ?' : ''}`
    ).get(...(dateFrom && dateTo ? [dateFrom, dateTo] : dateFrom ? [dateFrom] : dateTo ? [dateTo] : [])) as { avgDays: number | null }

    const completionRate = taskStats.total > 0
      ? Math.round((taskStats.completed / taskStats.total) * 100)
      : 0

    return {
      totalEntries: entryCount.count,
      totalTasks: taskStats.total,
      tasksCompleted: taskStats.completed,
      tasksPending: taskStats.pending,
      completionRate,
      activeProjects: projectStats.active,
      totalProjects: projectStats.total,
      totalMeetings: meetingCount.count,
      avgTaskResolutionDays: avgResolution.avgDays ? Math.round(avgResolution.avgDays * 10) / 10 : null,
    }
  }

  getActivityTimeline(dateFrom?: string, dateTo?: string): ActivityTimelinePoint[] {
    const db = getDatabase()

    // Generate date range for last N days
    const params: string[] = []
    let dateCondition = ''
    if (dateFrom) {
      dateCondition = ' AND date >= ?'
      params.push(dateFrom.split('T')[0])
    }
    if (dateTo) {
      dateCondition += ' AND date <= ?'
      params.push(dateTo.split('T')[0])
    }

    // Entries per day
    const entriesByDay = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM entries
      WHERE 1=1${dateCondition.replace(/date/g, "DATE(created_at)")}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(...params) as { date: string; count: number }[]

    // Tasks created per day
    const tasksCreatedByDay = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM tasks
      WHERE 1=1${dateCondition.replace(/date/g, "DATE(created_at)")}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(...params) as { date: string; count: number }[]

    // Tasks completed per day (approximation: updated_at when status is done)
    const tasksCompletedByDay = db.prepare(`
      SELECT DATE(updated_at) as date, COUNT(*) as count
      FROM tasks
      WHERE status = 'done'${dateCondition.replace(/date/g, "DATE(updated_at)")}
      GROUP BY DATE(updated_at)
      ORDER BY date ASC
    `).all(...params) as { date: string; count: number }[]

    // Merge into timeline
    const dateMap = new Map<string, ActivityTimelinePoint>()

    for (const row of entriesByDay) {
      dateMap.set(row.date, { date: row.date, entries: row.count, tasksCreated: 0, tasksCompleted: 0 })
    }
    for (const row of tasksCreatedByDay) {
      const existing = dateMap.get(row.date)
      if (existing) {
        existing.tasksCreated = row.count
      } else {
        dateMap.set(row.date, { date: row.date, entries: 0, tasksCreated: row.count, tasksCompleted: 0 })
      }
    }
    for (const row of tasksCompletedByDay) {
      const existing = dateMap.get(row.date)
      if (existing) {
        existing.tasksCompleted = row.count
      } else {
        dateMap.set(row.date, { date: row.date, entries: 0, tasksCreated: 0, tasksCompleted: row.count })
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  getEntryTypeDistribution(dateFrom?: string, dateTo?: string): EntryTypeDistribution[] {
    const db = getDatabase()
    const { where, params } = this.getDateFilter(dateFrom, dateTo)

    const rows = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM entries${where}
      GROUP BY type
      ORDER BY count DESC
    `).all(...params) as { type: EntryType; count: number }[]

    const total = rows.reduce((sum, r) => sum + r.count, 0)

    return rows.map((row) => ({
      type: row.type,
      count: row.count,
      percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }))
  }

  getProjectRanking(dateFrom?: string, dateTo?: string): ProjectRanking[] {
    const db = getDatabase()

    const dateConditionEntries = dateFrom || dateTo
      ? ` AND e.created_at ${dateFrom ? '>= ?' : ''} ${dateFrom && dateTo ? 'AND e.created_at' : ''} ${dateTo ? '<= ?' : ''}`
      : ''
    const dateConditionTasks = dateFrom || dateTo
      ? ` AND t.created_at ${dateFrom ? '>= ?' : ''} ${dateFrom && dateTo ? 'AND t.created_at' : ''} ${dateTo ? '<= ?' : ''}`
      : ''

    const dateParams = [dateFrom, dateTo].filter(Boolean) as string[]

    // Get projects with their counts
    const rows = db.prepare(`
      SELECT
        p.id as projectId,
        p.name as projectName,
        (SELECT COUNT(*) FROM entries e WHERE e.project_id = p.id${dateConditionEntries}) as entryCount,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id${dateConditionTasks}) as taskCount,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done'${dateConditionTasks}) as completedTasks,
        (SELECT COUNT(*) FROM entries e WHERE e.project_id = p.id AND e.type = 'blocker'${dateConditionEntries}) as blockerCount,
        (SELECT MAX(e.created_at) FROM entries e WHERE e.project_id = p.id) as lastActivityDate
      FROM projects p
      WHERE p.active = 1
      ORDER BY entryCount + taskCount DESC
    `).all(...dateParams, ...dateParams, ...dateParams, ...dateParams) as ProjectRanking[]

    return rows
  }

  getTaskFlowStats(): TaskFlowStats {
    const db = getDatabase()

    const statusCounts = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
      FROM tasks
    `).get() as { todo: number; inProgress: number; waiting: number; done: number }

    // Average lead time for completed tasks
    const avgLead = db.prepare(`
      SELECT AVG(JULIANDAY(updated_at) - JULIANDAY(created_at)) as avgDays
      FROM tasks WHERE status = 'done'
    `).get() as { avgDays: number | null }

    // Longest waiting task
    const longestWaiting = db.prepare(`
      SELECT t.id, t.title, p.name as projectName,
             CAST(JULIANDAY('now') - JULIANDAY(t.updated_at) AS INTEGER) as daysSinceUpdate
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.status = 'waiting'
      ORDER BY t.updated_at ASC
      LIMIT 1
    `).get() as { id: string; title: string; projectName: string; daysSinceUpdate: number } | undefined

    return {
      todo: statusCounts.todo || 0,
      inProgress: statusCounts.inProgress || 0,
      waiting: statusCounts.waiting || 0,
      done: statusCounts.done || 0,
      avgLeadTimeDays: avgLead.avgDays ? Math.round(avgLead.avgDays * 10) / 10 : null,
      longestWaitingTask: longestWaiting || null,
    }
  }

  getWeekdayActivity(dateFrom?: string, dateTo?: string): WeekdayActivity[] {
    const db = getDatabase()
    const { where, params } = this.getDateFilter(dateFrom, dateTo)

    const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

    // SQLite strftime('%w', ...) returns 0=Sunday
    const entryRows = db.prepare(`
      SELECT CAST(strftime('%w', created_at) AS INTEGER) as dow, COUNT(*) as count
      FROM entries${where}
      GROUP BY dow
    `).all(...params) as { dow: number; count: number }[]

    const taskRows = db.prepare(`
      SELECT CAST(strftime('%w', updated_at) AS INTEGER) as dow, COUNT(*) as count
      FROM tasks
      WHERE status = 'done'${dateFrom ? ' AND updated_at >= ?' : ''}${dateTo ? ' AND updated_at <= ?' : ''}
      GROUP BY dow
    `).all(...(dateFrom && dateTo ? [dateFrom, dateTo] : dateFrom ? [dateFrom] : dateTo ? [dateTo] : [])) as { dow: number; count: number }[]

    const entryMap = new Map(entryRows.map((r) => [r.dow, r.count]))
    const taskMap = new Map(taskRows.map((r) => [r.dow, r.count]))

    return WEEKDAY_LABELS.map((label, i) => ({
      dayOfWeek: i,
      label,
      entries: entryMap.get(i) || 0,
      tasksCompleted: taskMap.get(i) || 0,
    }))
  }
}
