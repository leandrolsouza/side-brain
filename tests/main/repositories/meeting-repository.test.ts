import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { MeetingRepository } from '../../../src/main/database/repositories/meeting-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('MeetingRepository', () => {
  let repo: MeetingRepository
  let projectRepo: ProjectRepository
  let projectId: string

  beforeEach(() => {
    createTestDatabase()
    repo = new MeetingRepository()
    projectRepo = new ProjectRepository()
    const project = projectRepo.create('Projeto Teste')
    projectId = project.id
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('create', () => {
    it('deve criar uma meeting com dados básicos', () => {
      const meeting = repo.create({
        projectId,
        title: 'Daily Standup',
      })

      expect(meeting.id).toBeDefined()
      expect(meeting.projectId).toBe(projectId)
      expect(meeting.title).toBe('Daily Standup')
      expect(meeting.participants).toEqual([])
      expect(meeting.status).toBe('active')
      expect(meeting.rawNotes).toEqual([])
      expect(meeting.pastedTranscription).toBeNull()
      expect(meeting.generatedMinutes).toBeNull()
      expect(meeting.startedAt).toBeDefined()
      expect(meeting.endedAt).toBeNull()
    })

    it('deve criar meeting com participants e meetingDate', () => {
      const meeting = repo.create({
        projectId,
        title: 'Sprint Planning',
        participants: ['Alice', 'Bob', 'Carlos'],
        meetingDate: '2025-06-15',
      })

      expect(meeting.participants).toEqual(['Alice', 'Bob', 'Carlos'])
      expect(meeting.meetingDate).toBe('2025-06-15')
    })

    it('deve usar data atual como meetingDate default', () => {
      const meeting = repo.create({ projectId, title: 'Meeting' })
      const today = new Date().toISOString().slice(0, 10)
      expect(meeting.meetingDate).toBe(today)
    })
  })

  describe('getAll', () => {
    it('deve retornar todas as meetings', () => {
      repo.create({ projectId, title: 'Meeting 1' })
      repo.create({ projectId, title: 'Meeting 2' })

      const all = repo.getAll()
      expect(all).toHaveLength(2)
    })

    it('deve filtrar por projectId', () => {
      const project2 = projectRepo.create('Projeto 2')
      repo.create({ projectId, title: 'Meeting P1' })
      repo.create({ projectId: project2.id, title: 'Meeting P2' })

      const filtered = repo.getAll(projectId)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Meeting P1')
    })

    it('deve retornar lista vazia quando não há meetings', () => {
      expect(repo.getAll()).toEqual([])
    })

    it('deve deserializar JSON de participants e rawNotes', () => {
      repo.create({
        projectId,
        title: 'Meeting com participantes',
        participants: ['Ana', 'Bruno'],
      })

      const all = repo.getAll()
      expect(all[0].participants).toEqual(['Ana', 'Bruno'])
      expect(Array.isArray(all[0].rawNotes)).toBe(true)
    })
  })

  describe('getById', () => {
    it('deve retornar meeting pelo ID', () => {
      const created = repo.create({ projectId, title: 'Minha Meeting' })

      const found = repo.getById(created.id)
      expect(found).not.toBeNull()
      expect(found!.title).toBe('Minha Meeting')
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.getById('fake-id')).toBeNull()
    })
  })

  describe('getActive', () => {
    it('deve retornar a meeting ativa', () => {
      repo.create({ projectId, title: 'Meeting Ativa' })

      const active = repo.getActive()
      expect(active).not.toBeNull()
      expect(active!.title).toBe('Meeting Ativa')
      expect(active!.status).toBe('active')
    })

    it('deve retornar null quando não há meeting ativa', () => {
      const meeting = repo.create({ projectId, title: 'Meeting' })
      repo.end(meeting.id)

      expect(repo.getActive()).toBeNull()
    })
  })

  describe('addNote', () => {
    it('deve adicionar nota a uma meeting ativa', () => {
      const meeting = repo.create({ projectId, title: 'Meeting' })

      const updated = repo.addNote(meeting.id, 'Ponto discutido 1')
      expect(updated).not.toBeNull()
      expect(updated!.rawNotes).toEqual(['Ponto discutido 1'])
    })

    it('deve acumular notas', () => {
      const meeting = repo.create({ projectId, title: 'Meeting' })

      repo.addNote(meeting.id, 'Nota 1')
      const updated = repo.addNote(meeting.id, 'Nota 2')

      expect(updated!.rawNotes).toEqual(['Nota 1', 'Nota 2'])
    })

    it('não deve adicionar nota a meeting encerrada', () => {
      const meeting = repo.create({ projectId, title: 'Meeting' })
      repo.end(meeting.id)

      const result = repo.addNote(meeting.id, 'Tentativa')
      expect(result).toBeNull()
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.addNote('fake-id', 'nota')).toBeNull()
    })
  })

  describe('setTranscription', () => {
    it('deve definir transcrição na meeting', () => {
      const meeting = repo.create({ projectId, title: 'Meeting' })

      const updated = repo.setTranscription(meeting.id, 'Transcrição completa da reunião...')
      expect(updated).not.toBeNull()
      expect(updated!.pastedTranscription).toBe('Transcrição completa da reunião...')
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.setTranscription('fake-id', 'text')).toBeNull()
    })
  })

  describe('end', () => {
    it('deve encerrar uma meeting ativa', () => {
      const meeting = repo.create({ projectId, title: 'Meeting' })

      const ended = repo.end(meeting.id)
      expect(ended).not.toBeNull()
      expect(ended!.status).toBe('ended')
      expect(ended!.endedAt).toBeDefined()
    })

    it('não deve encerrar meeting já encerrada', () => {
      const meeting = repo.create({ projectId, title: 'Meeting' })
      repo.end(meeting.id)

      const result = repo.end(meeting.id)
      expect(result).toBeNull()
    })
  })

  describe('setProcessed', () => {
    it('deve marcar meeting como processada com minuta', () => {
      const meeting = repo.create({ projectId, title: 'Meeting' })
      repo.end(meeting.id)

      const processed = repo.setProcessed(meeting.id, '# Minuta\n\n- Ponto 1\n- Ponto 2')
      expect(processed).not.toBeNull()
      expect(processed!.status).toBe('processed')
      expect(processed!.generatedMinutes).toBe('# Minuta\n\n- Ponto 1\n- Ponto 2')
    })

    it('deve retornar null para ID inexistente', () => {
      expect(repo.setProcessed('fake-id', 'minutes')).toBeNull()
    })
  })

  describe('delete', () => {
    it('deve excluir uma meeting', () => {
      const meeting = repo.create({ projectId, title: 'Para Excluir' })

      repo.delete(meeting.id)
      expect(repo.getById(meeting.id)).toBeNull()
    })
  })
})
