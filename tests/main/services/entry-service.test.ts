import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { EntryService } from '../../../src/main/services/entry-service'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})
import { SettingsRepository } from '../../../src/main/database/repositories/settings-repository'
import type { AIService } from '../../../src/main/services/ai-service'
import type { AICategorizationResult } from '../../../src/shared/types'

// Mock do AIService
const mockAIService = {
  categorize: vi.fn(),
  generateSummary: vi.fn(),
  generateGlobalSummary: vi.fn(),
} as unknown as AIService

describe('EntryService', () => {
  let service: EntryService
  let entryRepo: EntryRepository
  let projectRepo: ProjectRepository
  let taskRepo: TaskRepository
  let settingsRepo: SettingsRepository

  beforeEach(() => {
    createTestDatabase()
    entryRepo = new EntryRepository()
    projectRepo = new ProjectRepository()
    taskRepo = new TaskRepository()
    settingsRepo = new SettingsRepository()
    service = new EntryService(entryRepo, projectRepo, taskRepo, settingsRepo, mockAIService)

    vi.clearAllMocks()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('createEntry', () => {
    it('deve criar entry com projeto existente quando AI categoriza com confiança', async () => {
      const project = projectRepo.create('Backend API')

      const aiResult: AICategorizationResult = {
        project: { id: project.id, suggestedName: null, confidence: 0.95 },
        type: 'decision',
        action: 'action_needed',
        improvedText: 'Decidimos usar PostgreSQL para o módulo de relatórios',
        reasoning: 'Decisão técnica sobre banco de dados',
        suggestedTask: null,
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      const result = await service.createEntry('decidimos usar postgres pro módulo de relatórios')

      expect(result.projectId).toBe(project.id)
      expect(result.improvedText).toBe('Decidimos usar PostgreSQL para o módulo de relatórios')
      expect(result.type).toBe('decision')
      expect(result.action).toBe('action_needed')
      expect(result.reviewStatus).toBe('auto_approved')
      expect(result.autoSuggestedProject).toBeUndefined()
    })

    it('deve criar novo projeto quando AI sugere nome novo', async () => {
      const aiResult: AICategorizationResult = {
        project: { id: null, suggestedName: 'Projeto Mobile', confidence: 0.8 },
        type: 'idea',
        action: 'action_needed',
        improvedText: 'Ideia de criar aplicativo mobile para clientes',
        reasoning: 'Nova ideia para projeto mobile',
        suggestedTask: {
          title: 'Pesquisar frameworks mobile',
          description: 'Avaliar React Native vs Flutter',
        },
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      const result = await service.createEntry('criar app mobile pros clientes')

      expect(result.autoSuggestedProject).toBeDefined()
      expect(result.autoSuggestedProject!.name).toBe('Projeto Mobile')
      expect(result.projectId).toBe(result.autoSuggestedProject!.id)

      // Verifica que o projeto foi criado
      const createdProject = projectRepo.getById(result.projectId)
      expect(createdProject).not.toBeNull()
      expect(createdProject!.name).toBe('Projeto Mobile')
      expect(createdProject!.isAutoSuggested).toBe(true)
    })

    it('deve reutilizar projeto existente quando AI sugere nome que já existe', async () => {
      const existing = projectRepo.create('Projeto Mobile')

      const aiResult: AICategorizationResult = {
        project: { id: null, suggestedName: 'Projeto Mobile', confidence: 0.75 },
        type: 'update',
        action: 'none',
        improvedText: 'Atualização sobre o projeto mobile',
        reasoning: 'Update sobre projeto existente',
        suggestedTask: null,
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      const result = await service.createEntry('atualização do app mobile')

      expect(result.projectId).toBe(existing.id)
      expect(result.autoSuggestedProject).toBeUndefined()
    })

    it('deve usar projeto "Sem Projeto" como fallback', async () => {
      const aiResult: AICategorizationResult = {
        project: { id: null, suggestedName: null, confidence: 0 },
        type: 'information',
        action: 'none',
        improvedText: 'Nota genérica sem projeto',
        reasoning: 'Não identificou projeto',
        suggestedTask: null,
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      const result = await service.createEntry('nota aleatória')

      const fallbackProject = projectRepo.findByName('Sem Projeto')
      expect(fallbackProject).not.toBeNull()
      expect(result.projectId).toBe(fallbackProject!.id)
    })

    it('deve criar task quando AI sugere', async () => {
      const project = projectRepo.create('Infra')

      const aiResult: AICategorizationResult = {
        project: { id: project.id, suggestedName: null, confidence: 0.9 },
        type: 'demand',
        action: 'action_needed',
        improvedText: 'O cliente solicitou migração para a AWS até sexta',
        reasoning: 'Demanda do cliente com prazo',
        suggestedTask: {
          title: 'Migrar infraestrutura para AWS',
          description: 'Prazo: até sexta-feira',
        },
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      await service.createEntry('cliente pediu migração pra aws até sexta')

      const tasks = taskRepo.getByProject(project.id)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Migrar infraestrutura para AWS')
      expect(tasks[0].description).toBe('Prazo: até sexta-feira')
      expect(tasks[0].status).toBe('todo')
    })

    it('deve criar task com status waiting quando action é waiting_response', async () => {
      const project = projectRepo.create('Backend')

      const aiResult: AICategorizationResult = {
        project: { id: project.id, suggestedName: null, confidence: 0.9 },
        type: 'demand',
        action: 'waiting_response',
        improvedText: 'Aguardando resposta do time de segurança',
        reasoning: 'Aguardando outra equipe',
        suggestedTask: {
          title: 'Cobrar resposta do time de segurança',
        },
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      await service.createEntry('esperando retorno de segurança')

      const tasks = taskRepo.getByProject(project.id)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].status).toBe('waiting')
    })

    it('não deve criar task duplicada com mesmo título no projeto', async () => {
      const project = projectRepo.create('Backend')
      taskRepo.create({ projectId: project.id, title: 'Revisar PR do login' })

      const aiResult: AICategorizationResult = {
        project: { id: project.id, suggestedName: null, confidence: 0.9 },
        type: 'demand',
        action: 'action_needed',
        improvedText: 'Preciso revisar a PR do login',
        reasoning: 'Demanda',
        suggestedTask: {
          title: 'Revisar PR do login',
        },
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      await service.createEntry('revisar PR do login')

      const tasks = taskRepo.getByProject(project.id)
      expect(tasks).toHaveLength(1) // Não criou duplicata
    })
  })

  describe('previewEntry', () => {
    it('deve retornar preview sem persistir nada', async () => {
      const project = projectRepo.create('Frontend')

      const aiResult: AICategorizationResult = {
        project: { id: project.id, suggestedName: null, confidence: 0.9 },
        type: 'blocker',
        action: 'action_needed',
        improvedText: 'Bug crítico na tela de checkout',
        reasoning: 'Bloqueio identificado',
        suggestedTask: {
          title: 'Corrigir bug no checkout',
        },
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      const preview = await service.previewEntry('bug no checkout')

      expect(preview.improvedText).toBe('Bug crítico na tela de checkout')
      expect(preview.type).toBe('blocker')
      expect(preview.project.id).toBe(project.id)
      expect(preview.suggestedTask).toBeDefined()
      expect(preview.suggestedTask!.title).toBe('Corrigir bug no checkout')

      // Nada foi persistido
      expect(entryRepo.getAll()).toHaveLength(0)
      expect(taskRepo.getAll()).toHaveLength(0)
    })

    it('deve respeitar projectIdHint quando AI tem baixa confiança', async () => {
      const hintProject = projectRepo.create('Projeto Hint')
      const aiProject = projectRepo.create('Projeto AI')

      const aiResult: AICategorizationResult = {
        project: { id: aiProject.id, suggestedName: null, confidence: 0.5 },
        type: 'information',
        action: 'none',
        improvedText: 'Nota melhorada',
        reasoning: 'Categorizacao',
        suggestedTask: null,
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      const preview = await service.previewEntry('nota', hintProject.id)

      // Hint deve prevalecer porque confiança da AI < 0.8
      expect(preview.project.id).toBe(hintProject.id)
      expect(preview.project.confidence).toBe(1.0)
    })

    it('deve usar projeto da AI quando confiança é alta mesmo com hint', async () => {
      const hintProject = projectRepo.create('Projeto Hint')
      const aiProject = projectRepo.create('Projeto AI')

      const aiResult: AICategorizationResult = {
        project: { id: aiProject.id, suggestedName: null, confidence: 0.95 },
        type: 'information',
        action: 'none',
        improvedText: 'Nota melhorada',
        reasoning: 'Categorizacao',
        suggestedTask: null,
      }
      mockAIService.categorize = vi.fn().mockResolvedValue(aiResult)

      const preview = await service.previewEntry('nota', hintProject.id)

      // AI com alta confiança prevalece sobre hint
      expect(preview.project.id).toBe(aiProject.id)
    })
  })

  describe('confirmEntry', () => {
    it('deve criar entry com dados confirmados pelo usuário', async () => {
      const project = projectRepo.create('Meu Projeto')

      const result = await service.confirmEntry({
        rawText: 'texto original',
        improvedText: 'Texto melhorado e confirmado',
        projectId: project.id,
        newProjectName: null,
        type: 'decision',
        action: 'action_needed',
        suggestedTask: null,
      })

      expect(result.rawText).toBe('texto original')
      expect(result.improvedText).toBe('Texto melhorado e confirmado')
      expect(result.projectId).toBe(project.id)
      expect(result.type).toBe('decision')
    })

    it('deve criar novo projeto quando newProjectName é fornecido', async () => {
      const result = await service.confirmEntry({
        rawText: 'nota',
        improvedText: 'Nota melhorada',
        projectId: null,
        newProjectName: 'Novo Projeto Criado',
        type: 'information',
        action: 'none',
        suggestedTask: null,
      })

      expect(result.autoSuggestedProject).toBeDefined()
      expect(result.autoSuggestedProject!.name).toBe('Novo Projeto Criado')

      const project = projectRepo.getById(result.projectId)
      expect(project!.name).toBe('Novo Projeto Criado')
    })

    it('deve criar task quando suggestedTask está presente', async () => {
      const project = projectRepo.create('Projeto com Task')

      await service.confirmEntry({
        rawText: 'demanda',
        improvedText: 'Demanda confirmada',
        projectId: project.id,
        newProjectName: null,
        type: 'demand',
        action: 'action_needed',
        suggestedTask: {
          title: 'Fazer deploy',
          description: 'Em produção até amanhã',
        },
      })

      const tasks = taskRepo.getByProject(project.id)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Fazer deploy')
      expect(tasks[0].description).toBe('Em produção até amanhã')
    })
  })

  describe('getEntries', () => {
    it('deve retornar entries delegando ao repository', () => {
      const project = projectRepo.create('P1')
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const entries = service.getEntries()
      expect(entries).toHaveLength(1)
    })

    it('deve filtrar por projectId', () => {
      const p1 = projectRepo.create('P1')
      const p2 = projectRepo.create('P2')
      entryRepo.create({
        rawText: 'E1',
        improvedText: 'E1',
        projectId: p1.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })
      entryRepo.create({
        rawText: 'E2',
        improvedText: 'E2',
        projectId: p2.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const entries = service.getEntries(p1.id)
      expect(entries).toHaveLength(1)
      expect(entries[0].rawText).toBe('E1')
    })
  })

  describe('updateEntry', () => {
    it('deve atualizar uma entry', () => {
      const project = projectRepo.create('P1')
      const entry = entryRepo.create({
        rawText: 'Original',
        improvedText: 'Original',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      const updated = service.updateEntry(entry.id, { type: 'blocker' })
      expect(updated).not.toBeNull()
      expect(updated!.type).toBe('blocker')
    })
  })

  describe('deleteEntry', () => {
    it('deve excluir uma entry', () => {
      const project = projectRepo.create('P1')
      const entry = entryRepo.create({
        rawText: 'Para deletar',
        improvedText: 'Para deletar',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      service.deleteEntry(entry.id)
      expect(entryRepo.getById(entry.id)).toBeNull()
    })
  })

  describe('generateSummary', () => {
    it('deve gerar resumo para um projeto com entries', async () => {
      const project = projectRepo.create('Backend')
      entryRepo.create({
        rawText: 'Deploy feito',
        improvedText: 'Deploy realizado com sucesso',
        projectId: project.id,
        type: 'update',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      mockAIService.generateSummary = vi.fn().mockResolvedValue('Resumo: Deploy do backend realizado.')

      const summary = await service.generateSummary(project.id)
      expect(summary).toBe('Resumo: Deploy do backend realizado.')
      expect(mockAIService.generateSummary).toHaveBeenCalledTimes(1)
    })

    it('deve lançar erro para projeto inexistente', async () => {
      await expect(service.generateSummary('id-inexistente')).rejects.toThrow('Project not found')
    })
  })

  describe('generateGlobalSummary', () => {
    it('deve gerar resumo global de todos os projetos', async () => {
      const project = projectRepo.create('Projeto')
      entryRepo.create({
        rawText: 'Entry',
        improvedText: 'Entry melhorada',
        projectId: project.id,
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
      })

      mockAIService.generateGlobalSummary = vi.fn().mockResolvedValue('Resumo global das atividades.')

      const summary = await service.generateGlobalSummary()
      expect(summary).toBe('Resumo global das atividades.')
      expect(mockAIService.generateGlobalSummary).toHaveBeenCalledTimes(1)
    })
  })
})
