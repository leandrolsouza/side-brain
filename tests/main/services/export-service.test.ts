import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { ExportService } from '../../../src/main/services/export-service'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'
import { CustomFieldsRepository } from '../../../src/main/database/repositories/custom-fields-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

const mockWriteFileSync = vi.fn()
vi.mock('fs', () => ({
  default: {
    writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
  },
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
}))

const mockShowSaveDialog = vi.fn()
vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: (...args: any[]) => mockShowSaveDialog(...args),
  },
  BrowserWindow: vi.fn(),
}))

describe('ExportService', () => {
  let service: ExportService
  let entryRepo: EntryRepository
  let projectRepo: ProjectRepository
  let taskRepo: TaskRepository
  let customFieldsRepo: CustomFieldsRepository
  let projectId: string

  beforeEach(() => {
    createTestDatabase()
    service = new ExportService()
    entryRepo = new EntryRepository()
    projectRepo = new ProjectRepository()
    taskRepo = new TaskRepository()
    customFieldsRepo = new CustomFieldsRepository()

    const project = projectRepo.create('Projeto Alpha', 'Descrição do projeto')
    projectId = project.id

    vi.clearAllMocks()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('exportProject', () => {
    it('deve lançar erro quando projeto não existe', async () => {
      await expect(service.exportProject('fake-id', 'markdown')).rejects.toThrow('Projeto não encontrado')
    })

    it('deve retornar success false quando usuário cancela o dialog', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: true })

      const result = await service.exportProject(projectId, 'markdown')

      expect(result.success).toBe(false)
      expect(mockWriteFileSync).not.toHaveBeenCalled()
    })

    it('deve exportar markdown com sucesso', async () => {
      // Prepara dados
      entryRepo.create({
        rawText: 'Nota 1',
        improvedText: 'Nota 1 melhorada',
        projectId,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      taskRepo.create({ projectId, title: 'Task 1', status: 'todo' })
      taskRepo.create({ projectId, title: 'Task 2', status: 'done' })

      // Cria custom entry type para que o export funcione
      customFieldsRepo.createEntryType({
        key: 'information',
        label: 'Informação',
        icon: 'Info',
        color: 'info',
        isDefault: true,
        sortOrder: 0,
        allowsAction: false,
      })

      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/tmp/export.md',
      })

      const result = await service.exportProject(projectId, 'markdown')

      expect(result.success).toBe(true)
      expect(result.filePath).toBe('/tmp/export.md')
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1)

      // Verifica conteúdo do markdown
      const markdownContent = mockWriteFileSync.mock.calls[0][1] as string
      expect(markdownContent).toContain('# Relatório: Projeto Alpha')
      expect(markdownContent).toContain('Descrição do projeto')
      expect(markdownContent).toContain('Total de entradas:** 1')
      expect(markdownContent).toContain('Total de tarefas:** 2')
      expect(markdownContent).toContain('Task 1')
      expect(markdownContent).toContain('Task 2')
    })

    it('deve incluir seções de tarefas agrupadas por status', async () => {
      taskRepo.create({ projectId, title: 'Task Todo', status: 'todo' })
      taskRepo.create({ projectId, title: 'Task In Progress', status: 'in_progress' })
      const doneTask = taskRepo.create({ projectId, title: 'Task Done' })
      taskRepo.update(doneTask.id, { status: 'done' })

      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/tmp/export.md',
      })

      await service.exportProject(projectId, 'markdown')

      const content = mockWriteFileSync.mock.calls[0][1] as string
      expect(content).toContain('A Fazer')
      expect(content).toContain('Em Andamento')
      expect(content).toContain('Concluído')
      expect(content).toContain('[ ] **Task Todo**')
      expect(content).toContain('[x] **Task Done**')
    })

    it('deve incluir due date nas tasks que têm prazo', async () => {
      taskRepo.create({ projectId, title: 'Task com prazo', status: 'todo', dueDate: '2025-12-31' })

      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/tmp/export.md',
      })

      await service.exportProject(projectId, 'markdown')

      const content = mockWriteFileSync.mock.calls[0][1] as string
      expect(content).toContain('prazo:')
      // Date formatting depends on timezone, just verify it renders a date
      expect(content).toMatch(/prazo: \d{2}\/\d{2}\/\d{4}/)
    })

    it('deve incluir entries agrupadas por tipo', async () => {
      customFieldsRepo.createEntryType({
        key: 'decision',
        label: 'Decisão',
        icon: 'Gavel',
        color: 'warning',
        isDefault: true,
        sortOrder: 1,
        allowsAction: true,
      })
      customFieldsRepo.createEntryType({
        key: 'blocker',
        label: 'Bloqueio',
        icon: 'Alert',
        color: 'error',
        isDefault: true,
        sortOrder: 2,
        allowsAction: true,
      })
      customFieldsRepo.createActionStatus({
        key: 'action_needed',
        label: 'Ação necessária',
        icon: 'Alert',
        color: 'warning',
        isDefault: true,
        isFinal: false,
        sortOrder: 0,
      })

      entryRepo.create({
        rawText: 'D1',
        improvedText: 'Decisão importante',
        projectId,
        type: 'decision',
        action: 'action_needed',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'B1',
        improvedText: 'Bug no deploy',
        projectId,
        type: 'blocker',
        action: 'action_needed',
        reviewStatus: 'auto_approved',
      })

      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/tmp/export.md',
      })

      await service.exportProject(projectId, 'markdown')

      const content = mockWriteFileSync.mock.calls[0][1] as string
      expect(content).toContain('Decisão')
      expect(content).toContain('Bloqueio')
      expect(content).toContain('Decisão importante')
      expect(content).toContain('Bug no deploy')
      expect(content).toContain('Ação necessária')
    })

    it('deve gerar relatório vazio quando projeto não tem dados', async () => {
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/tmp/empty.md',
      })

      await service.exportProject(projectId, 'markdown')

      const content = mockWriteFileSync.mock.calls[0][1] as string
      expect(content).toContain('# Relatório: Projeto Alpha')
      expect(content).toContain('Total de entradas:** 0')
      expect(content).toContain('Total de tarefas:** 0')
    })
  })
})
