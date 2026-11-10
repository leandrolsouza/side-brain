import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { ChatActionExecutor } from '../../../src/main/services/chat-action-executor'
import { EntryRepository } from '../../../src/main/database/repositories/entry-repository'
import { ProjectRepository } from '../../../src/main/database/repositories/project-repository'
import { TaskRepository } from '../../../src/main/database/repositories/task-repository'
import { dialog } from 'electron'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('ChatActionExecutor', () => {
  let executor: ChatActionExecutor
  let entryRepo: EntryRepository
  let projectRepo: ProjectRepository
  let taskRepo: TaskRepository

  beforeEach(() => {
    createTestDatabase()
    entryRepo = new EntryRepository()
    projectRepo = new ProjectRepository()
    taskRepo = new TaskRepository()
    executor = new ChatActionExecutor(entryRepo, projectRepo, taskRepo)
    vi.clearAllMocks()
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false })
  })

  afterEach(() => {
    closeTestDatabase()
  })

  describe('parseActions', () => {
    it('deve extrair uma action válida e remover o bloco do texto', () => {
      const text = 'Vou criar a task.\n[ACTION]{"action":"create_task","title":"Deploy"}[/ACTION]\nPronto!'

      const { cleanText, payloads } = executor.parseActions(text)

      expect(payloads).toHaveLength(1)
      expect(payloads[0]).toEqual({ action: 'create_task', title: 'Deploy' })
      expect(cleanText).not.toContain('[ACTION]')
      expect(cleanText).toContain('Vou criar a task.')
      expect(cleanText).toContain('Pronto!')
    })

    it('deve extrair múltiplas actions do mesmo texto', () => {
      const text =
        '[ACTION]{"action":"create_task","title":"T1"}[/ACTION] meio [ACTION]{"action":"list_tasks"}[/ACTION]'

      const { cleanText, payloads } = executor.parseActions(text)

      expect(payloads).toHaveLength(2)
      expect(payloads[0].action).toBe('create_task')
      expect(payloads[1].action).toBe('list_tasks')
      expect(cleanText).toBe('meio')
    })

    it('deve ignorar JSON malformado sem lançar erro', () => {
      const text = '[ACTION]{invalid json}[/ACTION] resto do texto'

      const { cleanText, payloads } = executor.parseActions(text)

      expect(payloads).toHaveLength(0)
      expect(cleanText).toBe('resto do texto')
    })

    it('deve ignorar JSON válido sem campo action', () => {
      const text = '[ACTION]{"title":"sem action"}[/ACTION] texto'

      const { cleanText, payloads } = executor.parseActions(text)

      expect(payloads).toHaveLength(0)
      expect(cleanText).toBe('texto')
    })

    it('deve retornar texto inalterado quando não há actions', () => {
      const text = 'Resposta normal do assistente.'

      const { cleanText, payloads } = executor.parseActions(text)

      expect(payloads).toHaveLength(0)
      expect(cleanText).toBe('Resposta normal do assistente.')
    })
  })

  describe('executeActions — create_task', () => {
    it('deve criar task com projectId explícito', async () => {
      const project = projectRepo.create('Backend')

      const results = await executor.executeActions([
        { action: 'create_task', title: 'Fazer deploy', projectId: project.id },
      ])

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      expect(results[0].type).toBe('create_task')
      expect(results[0].data?.projectName).toBe('Backend')

      const tasks = taskRepo.getByProject(project.id)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Fazer deploy')
    })

    it('deve resolver projeto existente pelo nome', async () => {
      const project = projectRepo.create('Frontend')

      const results = await executor.executeActions([
        { action: 'create_task', title: 'Ajustar CSS', projectName: 'Frontend' },
      ])

      expect(results[0].success).toBe(true)
      expect(taskRepo.getByProject(project.id)).toHaveLength(1)
    })

    it('deve criar novo projeto quando projectName não existe', async () => {
      const results = await executor.executeActions([
        { action: 'create_task', title: 'Task nova', projectName: 'Projeto Inexistente' },
      ])

      expect(results[0].success).toBe(true)
      const project = projectRepo.findByName('Projeto Inexistente')
      expect(project).not.toBeNull()
      expect(taskRepo.getByProject(project!.id)).toHaveLength(1)
    })

    it('deve usar primeiro projeto ativo como fallback sem projeto informado', async () => {
      const project = projectRepo.create('Único Projeto')

      const results = await executor.executeActions([{ action: 'create_task', title: 'Task sem projeto' }])

      expect(results[0].success).toBe(true)
      expect(taskRepo.getByProject(project.id)).toHaveLength(1)
    })

    it('deve criar projeto "Geral" quando não há projetos', async () => {
      const results = await executor.executeActions([{ action: 'create_task', title: 'Primeira task' }])

      expect(results[0].success).toBe(true)
      const geral = projectRepo.findByName('Geral')
      expect(geral).not.toBeNull()
      expect(taskRepo.getByProject(geral!.id)).toHaveLength(1)
    })

    it('deve falhar quando título não é fornecido', async () => {
      const results = await executor.executeActions([{ action: 'create_task' }])

      expect(results[0].success).toBe(false)
      expect(results[0].description).toContain('obrigatório')
      expect(taskRepo.getAll()).toHaveLength(0)
    })
  })

  describe('executeActions — update_task_status', () => {
    it('deve rejeitar status inválido', async () => {
      const results = await executor.executeActions([
        { action: 'update_task_status', taskTitle: 'Qualquer', status: 'invalido' },
      ])

      expect(results[0].success).toBe(false)
      expect(results[0].description).toContain('Status inválido')
    })

    it('deve atualizar task pelo taskId', async () => {
      const project = projectRepo.create('P1')
      const task = taskRepo.create({ projectId: project.id, title: 'Revisar PR' })

      const results = await executor.executeActions([{ action: 'update_task_status', taskId: task.id, status: 'done' }])

      expect(results[0].success).toBe(true)
      expect(results[0].data?.newStatus).toBe('done')
      expect(taskRepo.getById(task.id)!.status).toBe('done')
    })

    it('deve buscar task por título preferindo o projeto informado', async () => {
      const p1 = projectRepo.create('Projeto A')
      const p2 = projectRepo.create('Projeto B')
      taskRepo.create({ projectId: p1.id, title: 'Revisar deploy' })
      const taskB = taskRepo.create({ projectId: p2.id, title: 'Revisar deploy' })

      const results = await executor.executeActions([
        { action: 'update_task_status', taskTitle: 'Revisar deploy', status: 'in_progress', projectName: 'Projeto B' },
      ])

      expect(results[0].success).toBe(true)
      expect(taskRepo.getById(taskB.id)!.status).toBe('in_progress')
    })

    it('deve falhar quando task não é encontrada', async () => {
      const results = await executor.executeActions([
        { action: 'update_task_status', taskTitle: 'Não existe', status: 'done' },
      ])

      expect(results[0].success).toBe(false)
      expect(results[0].description).toContain('Task não encontrada')
    })

    it('recusa uma atualização ambígua sem modificar tarefas', async () => {
      const project = projectRepo.create('P1')
      const first = taskRepo.create({ projectId: project.id, title: 'Revisar deploy' })
      const second = taskRepo.create({ projectId: project.id, title: 'Revisar deploy' })
      const [result] = await executor.executeActions([
        { action: 'update_task_status', taskTitle: 'Revisar deploy', status: 'done' },
      ])
      expect(result.success).toBe(false)
      expect(result.description).toContain('várias tarefas')
      expect(taskRepo.getById(first.id)?.status).toBe('todo')
      expect(taskRepo.getById(second.id)?.status).toBe('todo')
    })

    it('não altera dados quando o usuário recusa a confirmação', async () => {
      const project = projectRepo.create('P1')
      const task = taskRepo.create({ projectId: project.id, title: 'Revisar' })
      vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false })
      const [result] = await executor.executeActions([
        { action: 'update_task_status', taskId: task.id, status: 'done' },
      ])
      expect(result.success).toBe(false)
      expect(taskRepo.getById(task.id)?.status).toBe('todo')
    })

    it('confirma o alvo e modifica somente a tarefa escolhida', async () => {
      const project = projectRepo.create('P1')
      const task = taskRepo.create({ projectId: project.id, title: 'Revisar' })
      vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false })
      const [result] = await executor.executeActions([
        { action: 'update_task_status', taskTitle: 'Revisar', status: 'done' },
      ])
      expect(result.success).toBe(true)
      expect(vi.mocked(dialog.showMessageBox).mock.calls.at(-1)?.[0]).toMatchObject({
        detail: expect.stringContaining(task.id),
      })
      expect(taskRepo.getById(task.id)?.status).toBe('done')
    })

    it('não executa se a tarefa mudou durante a confirmação', async () => {
      const project = projectRepo.create('P1')
      const task = taskRepo.create({ projectId: project.id, title: 'Revisar' })
      vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
        taskRepo.update(task.id, { status: 'waiting' })
        return { response: 1, checkboxChecked: false }
      })
      const [result] = await executor.executeActions([
        { action: 'update_task_status', taskId: task.id, status: 'done' },
      ])
      expect(result.success).toBe(false)
      expect(taskRepo.getById(task.id)?.status).toBe('waiting')
    })
  })

  describe('executeActions — create_entry', () => {
    it('deve falhar sem texto', async () => {
      const results = await executor.executeActions([{ action: 'create_entry' }])

      expect(results[0].success).toBe(false)
      expect(results[0].description).toContain('obrigatório')
    })

    it('deve criar entry no projeto resolvido pelo nome', async () => {
      const project = projectRepo.create('Docs')

      const results = await executor.executeActions([
        { action: 'create_entry', text: 'Anotação importante', projectName: 'Docs', type: 'decision' },
      ])

      expect(results[0].success).toBe(true)
      const entries = entryRepo.getAll(project.id)
      expect(entries).toHaveLength(1)
      expect(entries[0].rawText).toBe('Anotação importante')
      expect(entries[0].type).toBe('decision')
    })

    it('deve criar projeto "Geral" como fallback quando não há projetos', async () => {
      const results = await executor.executeActions([{ action: 'create_entry', text: 'Nota' }])

      expect(results[0].success).toBe(true)
      const geral = projectRepo.findByName('Geral')
      expect(geral).not.toBeNull()
      expect(entryRepo.getAll(geral!.id)).toHaveLength(1)
    })
  })

  describe('executeActions — list_tasks', () => {
    it('deve listar apenas tasks não concluídas por padrão', async () => {
      const project = projectRepo.create('P1')
      taskRepo.create({ projectId: project.id, title: 'Aberta' })
      const done = taskRepo.create({ projectId: project.id, title: 'Feita' })
      taskRepo.update(done.id, { status: 'done' })

      const results = await executor.executeActions([{ action: 'list_tasks' }])

      expect(results[0].success).toBe(true)
      expect(results[0].data?.count).toBe(1)
      expect(results[0].data?.list).toContain('Aberta')
      expect(results[0].data?.list).not.toContain('Feita')
    })

    it('deve filtrar por status e projeto', async () => {
      const p1 = projectRepo.create('P1')
      const p2 = projectRepo.create('P2')
      const t1 = taskRepo.create({ projectId: p1.id, title: 'Task P1' })
      taskRepo.update(t1.id, { status: 'waiting' })
      taskRepo.create({ projectId: p2.id, title: 'Task P2' })

      const results = await executor.executeActions([{ action: 'list_tasks', projectName: 'P1', status: 'waiting' }])

      expect(results[0].success).toBe(true)
      expect(results[0].data?.count).toBe(1)
      expect(results[0].data?.list).toContain('Task P1')
    })
  })

  describe('executeActions — casos gerais', () => {
    it('deve retornar falha para ação desconhecida', async () => {
      const results = await executor.executeActions([{ action: 'acao_inexistente' as any }])

      expect(results[0].success).toBe(false)
      expect(results[0].description).toContain('Ação desconhecida')
    })

    it('deve capturar exceções e retornar resultado com erro', async () => {
      projectRepo.create('P1')
      vi.spyOn(taskRepo, 'create').mockImplementation(() => {
        throw new Error('db fail')
      })

      const results = await executor.executeActions([{ action: 'create_task', title: 'Vai falhar' }])

      expect(results[0].success).toBe(false)
      expect(results[0].description).toBe('Erro: db fail')
    })

    it('deve executar múltiplas actions em sequência', async () => {
      projectRepo.create('P1')

      const results = await executor.executeActions([{ action: 'create_task', title: 'T1' }, { action: 'list_tasks' }])

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
      expect(results[1].data?.count).toBe(1)
    })
  })
})
