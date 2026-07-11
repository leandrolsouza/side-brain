import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { MeetingService } from '../../../src/main/services/meeting-service'
import { MeetingRepository } from '../../../src/main/database/repositories/meeting-repository'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'
import { SettingsRepository } from '../../../src/main/database/repositories/settings-repository'
import { NotificationRepository } from '../../../src/main/database/repositories/notification-repository'
import { AIService } from '../../../src/main/services/ai-service'
import { MeetingProcessResult } from '../../../src/shared/types'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

vi.mock('../../../src/main/services/error-service', () => ({
  getErrorService: () => ({
    logError: vi.fn(),
  }),
}))

const mockAIService = {
  invokeConverseForChat: vi.fn().mockResolvedValue('# Pauta Sugerida\n\n## Urgente\n- Item 1'),
  processMeeting: vi.fn(),
} as unknown as AIService

describe('MeetingService', () => {
  let service: MeetingService
  let meetingRepo: MeetingRepository
  let entryRepo: EntryRepository
  let projectRepo: ProjectRepository
  let taskRepo: TaskRepository
  let settingsRepo: SettingsRepository
  let notificationRepo: NotificationRepository
  let projectId: string

  beforeEach(() => {
    createTestDatabase()
    meetingRepo = new MeetingRepository()
    entryRepo = new EntryRepository()
    projectRepo = new ProjectRepository()
    taskRepo = new TaskRepository()
    settingsRepo = new SettingsRepository()
    notificationRepo = new NotificationRepository()
    service = new MeetingService(
      meetingRepo, entryRepo, projectRepo, taskRepo, settingsRepo, notificationRepo, mockAIService
    )

    const project = projectRepo.create('Projeto Teste')
    projectId = project.id

    vi.clearAllMocks()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar meeting delegando ao repository', () => {
      const meeting = service.create({ projectId, title: 'Daily Standup' })

      expect(meeting.id).toBeDefined()
      expect(meeting.title).toBe('Daily Standup')
      expect(meeting.projectId).toBe(projectId)
      expect(meeting.status).toBe('active')
    })

    it('deve criar meeting com participants', () => {
      const meeting = service.create({
        projectId,
        title: 'Sprint',
        participants: ['Alice', 'Bob'],
      })

      expect(meeting.participants).toEqual(['Alice', 'Bob'])
    })
  })

  describe('getAll', () => {
    it('deve retornar todas as meetings', () => {
      service.create({ projectId, title: 'M1' })
      service.create({ projectId, title: 'M2' })

      expect(service.getAll()).toHaveLength(2)
    })

    it('deve filtrar por projectId', () => {
      const p2 = projectRepo.create('Projeto 2')
      service.create({ projectId, title: 'M1' })
      service.create({ projectId: p2.id, title: 'M2' })

      expect(service.getAll(projectId)).toHaveLength(1)
    })
  })

  describe('getById', () => {
    it('deve retornar meeting pelo ID', () => {
      const created = service.create({ projectId, title: 'Minha Meeting' })
      const found = service.getById(created.id)

      expect(found).not.toBeNull()
      expect(found!.title).toBe('Minha Meeting')
    })

    it('deve retornar null para ID inexistente', () => {
      expect(service.getById('fake-id')).toBeNull()
    })
  })

  describe('getActive', () => {
    it('deve retornar meeting ativa', () => {
      service.create({ projectId, title: 'Meeting Ativa' })
      const active = service.getActive()

      expect(active).not.toBeNull()
      expect(active!.title).toBe('Meeting Ativa')
    })
  })

  describe('addNote', () => {
    it('deve adicionar nota à meeting', () => {
      const meeting = service.create({ projectId, title: 'Meeting' })
      const updated = service.addNote(meeting.id, 'Ponto importante')

      expect(updated).not.toBeNull()
      expect(updated!.rawNotes).toContain('Ponto importante')
    })
  })

  describe('end', () => {
    it('deve encerrar meeting ativa', () => {
      const meeting = service.create({ projectId, title: 'Meeting' })
      const ended = service.end(meeting.id)

      expect(ended).not.toBeNull()
      expect(ended!.status).toBe('ended')
    })
  })

  describe('delete', () => {
    it('deve excluir meeting', () => {
      const meeting = service.create({ projectId, title: 'Para Excluir' })
      service.delete(meeting.id)

      expect(service.getById(meeting.id)).toBeNull()
    })
  })

  describe('deleteWithData', () => {
    it('deve excluir meeting e seus entries/tasks associados', () => {
      const meeting = service.create({ projectId, title: 'Meeting com dados' })

      const entry = entryRepo.create({
        rawText: 'Entry da meeting',
        improvedText: 'Entry da meeting',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      const task = taskRepo.create({ projectId, title: 'Task da meeting' })

      service.deleteWithData(meeting.id, [entry.id], [task.id])

      expect(service.getById(meeting.id)).toBeNull()
      expect(entryRepo.getById(entry.id)).toBeNull()
      expect(taskRepo.getById(task.id)).toBeNull()
    })

    it('deve funcionar com listas vazias de entries/tasks', () => {
      const meeting = service.create({ projectId, title: 'Meeting simples' })

      service.deleteWithData(meeting.id, [], [])

      expect(service.getById(meeting.id)).toBeNull()
    })
  })

  describe('prepareMeeting', () => {
    it('deve chamar AI com contexto do projeto', async () => {
      entryRepo.create({ rawText: 'Bloqueio', improvedText: 'Bloqueio no deploy', projectId, type: 'blocker', action: 'action_needed', reviewStatus: 'auto_approved' })
      taskRepo.create({ projectId, title: 'Task pendente', status: 'in_progress' })

      const result = await service.prepareMeeting(projectId, 'Daily', ['Alice'])

      expect(mockAIService.invokeConverseForChat).toHaveBeenCalledTimes(1)
      expect(result).toContain('Pauta Sugerida')

      // Verifica que o contexto inclui informações relevantes
      const callArgs = (mockAIService.invokeConverseForChat as any).mock.calls[0]
      const userMessage = callArgs[1] as string
      expect(userMessage).toContain('Daily')
      expect(userMessage).toContain('Alice')
    })

    it('deve lançar erro quando projeto não existe', async () => {
      await expect(
        service.prepareMeeting('id-inexistente', 'Meeting', [])
      ).rejects.toThrow('Project not found')
    })
  })

  describe('analyze', () => {
    it('deve processar meeting com AI e salvar minuta', async () => {
      const meeting = service.create({ projectId, title: 'Sprint Review' })
      service.addNote(meeting.id, 'Nota 1')
      service.addNote(meeting.id, 'Nota 2')
      service.end(meeting.id)

      const mockResult: MeetingProcessResult = {
        minutes: '# Ata da Reunião\n\n- Ponto 1',
        entries: [
          { text: 'Decisão sobre deploy', type: 'decision', action: 'action_needed' },
        ],
        tasks: [
          { title: 'Fazer deploy', description: 'Até sexta' },
        ],
      }
        ; (mockAIService.processMeeting as any) = vi.fn().mockResolvedValue(mockResult)

      const result = await service.analyze(meeting.id)

      expect(result).not.toBeNull()
      expect(result!.minutes).toContain('Ata da Reunião')
      expect(result!.entries).toHaveLength(1)
      expect(result!.tasks).toHaveLength(1)

      // Verifica que a minuta foi salva no meeting
      const updatedMeeting = service.getById(meeting.id)
      expect(updatedMeeting!.generatedMinutes).toContain('Ata da Reunião')
      expect(updatedMeeting!.status).toBe('processed')
    })

    it('deve retornar null para meeting inexistente', async () => {
      const result = await service.analyze('id-fake')
      expect(result).toBeNull()
    })

    it('deve criar notificação e lançar erro quando AI falha', async () => {
      const meeting = service.create({ projectId, title: 'Meeting' })
      service.end(meeting.id)

        ; (mockAIService.processMeeting as any) = vi.fn().mockRejectedValue(new Error('AI timeout'))

      await expect(service.analyze(meeting.id)).rejects.toThrow('AI timeout')

      // Notificação de erro deve ter sido criada
      const notifications = notificationRepo.getAll()
      expect(notifications).toHaveLength(1)
      expect(notifications[0].type).toBe('ai_error')
      expect(notifications[0].title).toContain('Erro ao processar reunião')
    })
  })

  describe('saveSelected', () => {
    it('deve criar entries e tasks selecionados pelo usuário', () => {
      const meeting = service.create({ projectId, title: 'Meeting' })

      const { entryIds, taskIds } = service.saveSelected(
        meeting.id,
        [
          { text: 'Decisão importante', type: 'decision', action: 'action_needed' },
          { text: 'Info adicional', type: 'information', action: 'none' },
        ],
        [
          { title: 'Implementar feature X', description: 'Até segunda' },
          { title: 'Revisar PR', assignee: 'Bob' },
        ]
      )

      expect(entryIds).toHaveLength(2)
      expect(taskIds).toHaveLength(2)

      // Verifica entries criadas
      const entry1 = entryRepo.getById(entryIds[0])
      expect(entry1).not.toBeNull()
      expect(entry1!.improvedText).toBe('Decisão importante')
      expect(entry1!.type).toBe('decision')
      expect(entry1!.projectId).toBe(projectId)

      // Verifica tasks criadas
      const task1 = taskRepo.getById(taskIds[0])
      expect(task1).not.toBeNull()
      expect(task1!.title).toBe('Implementar feature X')
      expect(task1!.description).toBe('Até segunda')
    })

    it('não deve criar task duplicada (mesmo título no projeto)', () => {
      const meeting = service.create({ projectId, title: 'Meeting' })
      taskRepo.create({ projectId, title: 'Task Existente' })

      const { taskIds } = service.saveSelected(
        meeting.id,
        [],
        [{ title: 'Task Existente' }]
      )

      // Não criou duplicata
      expect(taskIds).toHaveLength(0)
      const allTasks = taskRepo.getByProject(projectId)
      expect(allTasks).toHaveLength(1)
    })

    it('deve retornar arrays vazios para meeting inexistente', () => {
      const result = service.saveSelected('fake-id', [{ text: 'X', type: 'info', action: 'none' }], [])
      expect(result).toEqual({ entryIds: [], taskIds: [], resolvedTaskIds: [] })
    })

    it('deve salvar com listas vazias', () => {
      const meeting = service.create({ projectId, title: 'Meeting' })

      const { entryIds, taskIds } = service.saveSelected(meeting.id, [], [])

      expect(entryIds).toHaveLength(0)
      expect(taskIds).toHaveLength(0)
    })
  })
})
