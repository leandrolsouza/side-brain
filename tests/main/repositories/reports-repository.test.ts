import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { ReportsRepository } from '../../../src/main/database/repositories/reports-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'
import { MeetingRepository } from '../../../src/main/database/repositories/meeting-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('ReportsRepository', () => {
  let repo: ReportsRepository
  let projectRepo: ProjectRepository
  let entryRepo: EntryRepository
  let taskRepo: TaskRepository
  let meetingRepo: MeetingRepository
  let projectId: string

  beforeEach(() => {
    createTestDatabase()
    repo = new ReportsRepository()
    projectRepo = new ProjectRepository()
    entryRepo = new EntryRepository()
    taskRepo = new TaskRepository()
    meetingRepo = new MeetingRepository()

    const project = projectRepo.create('Projeto Teste')
    projectId = project.id
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('getOverview', () => {
    it('deve retornar overview zerado quando não há dados', () => {
      const overview = repo.getOverview()

      expect(overview.totalEntries).toBe(0)
      expect(overview.totalTasks).toBe(0)
      expect(overview.tasksCompleted).toBeNull() // SUM returns null when no rows
      expect(overview.tasksPending).toBeNull()
      expect(overview.completionRate).toBe(0)
      expect(overview.totalProjects).toBe(1) // projeto criado no beforeEach
      expect(overview.activeProjects).toBe(1)
      expect(overview.totalMeetings).toBe(0)
      expect(overview.avgTaskResolutionDays).toBeNull()
    })

    it('deve contar entries e tasks corretamente', () => {
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'E2',
        improvedText: 'E2',
        projectId,
        type: 'decision',
        action: 'action_needed',
        reviewStatus: 'auto_approved',
      })

      taskRepo.create({ projectId, title: 'T1', status: 'todo' })
      taskRepo.create({ projectId, title: 'T2', status: 'done' })
      taskRepo.create({ projectId, title: 'T3', status: 'in_progress' })

      const overview = repo.getOverview()

      expect(overview.totalEntries).toBe(2)
      expect(overview.totalTasks).toBe(3)
      expect(overview.tasksCompleted).toBe(1)
      expect(overview.tasksPending).toBe(2)
      expect(overview.completionRate).toBe(33) // 1/3 ~= 33%
    })

    it('deve contar meetings', () => {
      meetingRepo.create({ projectId, title: 'Daily' })
      meetingRepo.create({ projectId, title: 'Sprint Review' })

      const overview = repo.getOverview()
      expect(overview.totalMeetings).toBe(2)
    })

    it('deve contar projetos ativos e total', () => {
      const p2 = projectRepo.create('Projeto 2')
      const p3 = projectRepo.create('Projeto Inativo')
      projectRepo.setActive(p3.id, false)

      const overview = repo.getOverview()
      expect(overview.totalProjects).toBe(3)
      expect(overview.activeProjects).toBe(2)
    })

    it('deve calcular avgTaskResolutionDays para tasks done', () => {
      const db = getTestDatabase()
      const { v4: uuidv4 } = require('uuid')

      // Task criada 3 dias atrás e completada agora
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO tasks (id, project_id, title, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), projectId, 'Task resolvida', 'done', threeDaysAgo, now)

      const overview = repo.getOverview()
      expect(overview.avgTaskResolutionDays).not.toBeNull()
      expect(overview.avgTaskResolutionDays!).toBeGreaterThanOrEqual(2.5)
      expect(overview.avgTaskResolutionDays!).toBeLessThanOrEqual(3.5)
    })
  })

  describe('getActivityTimeline', () => {
    it('deve retornar timeline vazia quando não há dados', () => {
      const timeline = repo.getActivityTimeline()
      expect(timeline).toEqual([])
    })

    it('deve agregar entries e tasks por dia', () => {
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'E2',
        improvedText: 'E2',
        projectId,
        type: 'decision',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      taskRepo.create({ projectId, title: 'T1' })

      const timeline = repo.getActivityTimeline()

      expect(timeline.length).toBeGreaterThanOrEqual(1)
      const today = new Date().toISOString().split('T')[0]
      const todayPoint = timeline.find((p) => p.date === today)
      expect(todayPoint).toBeDefined()
      expect(todayPoint!.entries).toBe(2)
      expect(todayPoint!.tasksCreated).toBe(1)
    })

    it('deve incluir tasks completadas no dia certo', () => {
      const task = taskRepo.create({ projectId, title: 'Para completar' })
      taskRepo.update(task.id, { status: 'done' })

      const timeline = repo.getActivityTimeline()
      const today = new Date().toISOString().split('T')[0]
      const todayPoint = timeline.find((p) => p.date === today)
      expect(todayPoint).toBeDefined()
      expect(todayPoint!.tasksCompleted).toBe(1)
    })

    it('deve ordenar timeline por data ascendente', () => {
      const db = getTestDatabase()
      const { v4: uuidv4 } = require('uuid')

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      db.prepare(`
        INSERT INTO entries (id, raw_text, improved_text, project_id, type, action, review_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), 'Old', 'Old', projectId, 'information', 'none', 'auto_approved', twoDaysAgo)

      entryRepo.create({
        rawText: 'Today',
        improvedText: 'Today',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const timeline = repo.getActivityTimeline()
      expect(timeline.length).toBe(2)
      expect(timeline[0].date < timeline[1].date).toBe(true)
    })
  })

  describe('getEntryTypeDistribution', () => {
    it('deve retornar distribuição vazia quando não há entries', () => {
      const dist = repo.getEntryTypeDistribution()
      expect(dist).toEqual([])
    })

    it('deve calcular distribuição por tipo', () => {
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'E2',
        improvedText: 'E2',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'E3',
        improvedText: 'E3',
        projectId,
        type: 'decision',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'E4',
        improvedText: 'E4',
        projectId,
        type: 'blocker',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const dist = repo.getEntryTypeDistribution()

      expect(dist).toHaveLength(3)
      // Ordenado por count DESC
      expect(dist[0].type).toBe('information')
      expect(dist[0].count).toBe(2)
      expect(dist[0].percentage).toBe(50) // 2/4 = 50%
      expect(dist[1].count).toBe(1)
      expect(dist[2].count).toBe(1)
    })
  })

  describe('getProjectRanking', () => {
    it('deve retornar ranking de projetos ativos', () => {
      const p2 = projectRepo.create('Projeto 2')

      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'E2',
        improvedText: 'E2',
        projectId,
        type: 'blocker',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      taskRepo.create({ projectId, title: 'T1' })
      taskRepo.create({ projectId, title: 'T2', status: 'done' })

      entryRepo.create({
        rawText: 'E3',
        improvedText: 'E3',
        projectId: p2.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const ranking = repo.getProjectRanking()

      expect(ranking.length).toBeGreaterThanOrEqual(2)
      // Primeiro projeto tem mais atividade (2 entries + 2 tasks vs 1 entry)
      expect(ranking[0].projectName).toBe('Projeto Teste')
      expect(ranking[0].entryCount).toBe(2)
      expect(ranking[0].taskCount).toBe(2)
      expect(ranking[0].completedTasks).toBe(1)
      expect(ranking[0].blockerCount).toBe(1)
    })

    it('não deve incluir projetos inativos', () => {
      const inactive = projectRepo.create('Inativo')
      projectRepo.setActive(inactive.id, false)

      const ranking = repo.getProjectRanking()
      const names = ranking.map((r) => r.projectName)
      expect(names).not.toContain('Inativo')
    })
  })

  describe('getTaskFlowStats', () => {
    it('deve retornar stats zerados quando não há tasks', () => {
      const stats = repo.getTaskFlowStats()

      expect(stats.todo).toBe(0)
      expect(stats.inProgress).toBe(0)
      expect(stats.waiting).toBe(0)
      expect(stats.done).toBe(0)
      expect(stats.avgLeadTimeDays).toBeNull()
      expect(stats.longestWaitingTask).toBeNull()
    })

    it('deve contar tasks por status', () => {
      taskRepo.create({ projectId, title: 'T1', status: 'todo' })
      taskRepo.create({ projectId, title: 'T2', status: 'todo' })
      taskRepo.create({ projectId, title: 'T3', status: 'in_progress' })
      taskRepo.create({ projectId, title: 'T4', status: 'waiting' })
      const t5 = taskRepo.create({ projectId, title: 'T5' })
      taskRepo.update(t5.id, { status: 'done' })

      const stats = repo.getTaskFlowStats()

      expect(stats.todo).toBe(2)
      expect(stats.inProgress).toBe(1)
      expect(stats.waiting).toBe(1)
      expect(stats.done).toBe(1)
    })

    it('deve identificar longest waiting task', () => {
      const db = getTestDatabase()
      const { v4: uuidv4 } = require('uuid')

      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      db.prepare(`
        INSERT INTO tasks (id, project_id, title, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), projectId, 'Task antiga em waiting', 'waiting', fiveDaysAgo, fiveDaysAgo)

      taskRepo.create({ projectId, title: 'Task recente em waiting', status: 'waiting' })

      const stats = repo.getTaskFlowStats()

      expect(stats.longestWaitingTask).not.toBeNull()
      expect(stats.longestWaitingTask!.title).toBe('Task antiga em waiting')
      expect(stats.longestWaitingTask!.daysSinceUpdate).toBeGreaterThanOrEqual(4)
    })
  })

  describe('getWeekdayActivity', () => {
    it('deve retornar 7 dias da semana', () => {
      const weekday = repo.getWeekdayActivity()

      expect(weekday).toHaveLength(7)
      expect(weekday[0].label).toBe('Domingo')
      expect(weekday[1].label).toBe('Segunda')
      expect(weekday[6].label).toBe('Sábado')
    })

    it('deve contar entries no dia da semana correto', () => {
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const weekday = repo.getWeekdayActivity()
      const todayDow = new Date().getDay()

      expect(weekday[todayDow].entries).toBe(1)
    })

    it('deve contar tasks completadas no dia da semana correto', () => {
      const task = taskRepo.create({ projectId, title: 'Task' })
      taskRepo.update(task.id, { status: 'done' })

      const weekday = repo.getWeekdayActivity()
      const todayDow = new Date().getDay()

      expect(weekday[todayDow].tasksCompleted).toBe(1)
    })

    it('deve retornar zeros para dias sem atividade', () => {
      const weekday = repo.getWeekdayActivity()

      for (const day of weekday) {
        expect(day.entries).toBe(0)
        expect(day.tasksCompleted).toBe(0)
      }
    })
  })
})
