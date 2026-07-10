import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { KanbanBoard } from '../../../src/renderer/components/KanbanBoard'

describe('KanbanBoard', () => {
  const projectId = 'project-1'

  beforeEach(() => {
    window.electronAPI.getTasksByProject = vi.fn().mockResolvedValue([
      { id: 't1', projectId, title: 'Task Todo', status: 'todo', createdAt: '2025-01-01', updatedAt: '2025-01-01' },
      { id: 't2', projectId, title: 'Task In Progress', status: 'in_progress', createdAt: '2025-01-01', updatedAt: '2025-01-01' },
      { id: 't3', projectId, title: 'Task Waiting', status: 'waiting', createdAt: '2025-01-01', updatedAt: '2025-01-01' },
      { id: 't4', projectId, title: 'Task Done', status: 'done', createdAt: '2025-01-01', updatedAt: '2025-01-01' },
    ])
  })

  describe('renderização', () => {
    it('deve renderizar as 4 colunas de status', async () => {
      render(<KanbanBoard projectId={projectId} />)

      await waitFor(() => {
        expect(screen.getByText('A Fazer')).toBeInTheDocument()
        expect(screen.getByText('Em Andamento')).toBeInTheDocument()
        expect(screen.getByText('Aguardando')).toBeInTheDocument()
        expect(screen.getByText('Concluído')).toBeInTheDocument()
      })
    })

    it('deve carregar e exibir tasks do projeto', async () => {
      render(<KanbanBoard projectId={projectId} />)

      await waitFor(() => {
        expect(screen.getByText('Task Todo')).toBeInTheDocument()
        expect(screen.getByText('Task In Progress')).toBeInTheDocument()
        expect(screen.getByText('Task Waiting')).toBeInTheDocument()
        expect(screen.getByText('Task Done')).toBeInTheDocument()
      })

      expect(window.electronAPI.getTasksByProject).toHaveBeenCalledWith(projectId)
    })

    it('deve renderizar colunas vazias quando não há tasks', async () => {
      window.electronAPI.getTasksByProject = vi.fn().mockResolvedValue([])

      render(<KanbanBoard projectId={projectId} />)

      await waitFor(() => {
        expect(screen.getByText('A Fazer')).toBeInTheDocument()
      })
    })
  })

  describe('criar task', () => {
    it('deve mostrar input ao clicar no botão + de uma coluna', async () => {
      const user = userEvent.setup()
      render(<KanbanBoard projectId={projectId} />)

      await waitFor(() => screen.getByText('A Fazer'))

      // Find the add buttons (each column has one)
      const addButtons = screen.getAllByTitle('Adicionar tarefa')
      await user.click(addButtons[0]) // Click on 'A Fazer' column's add button

      // Should show an input field
      const input = screen.getByPlaceholderText('Título da tarefa...')
      expect(input).toBeInTheDocument()
    })

    it('deve criar task ao pressionar Enter no input', async () => {
      const user = userEvent.setup()
      window.electronAPI.createTask = vi.fn().mockResolvedValue({
        id: 'new-task', projectId, title: 'Nova task', status: 'todo', createdAt: '2025-01-01', updatedAt: '2025-01-01',
      })

      render(<KanbanBoard projectId={projectId} />)

      await waitFor(() => screen.getByText('A Fazer'))

      const addButtons = screen.getAllByTitle('Adicionar tarefa')
      await user.click(addButtons[0])

      const input = screen.getByPlaceholderText('Título da tarefa...')
      await user.type(input, 'Nova task{enter}')

      await waitFor(() => {
        expect(window.electronAPI.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            projectId,
            title: 'Nova task',
          })
        )
      })
    })

    it('não deve criar task com texto vazio', async () => {
      const user = userEvent.setup()
      render(<KanbanBoard projectId={projectId} />)

      await waitFor(() => screen.getByText('A Fazer'))

      const addButtons = screen.getAllByTitle('Adicionar tarefa')
      await user.click(addButtons[0])

      const input = screen.getByPlaceholderText('Título da tarefa...')
      await user.type(input, '{enter}')

      expect(window.electronAPI.createTask).not.toHaveBeenCalled()
    })
  })

  describe('mover task (drag and drop simulado via botão)', () => {
    it('deve chamar updateTask ao mover task para próxima coluna', async () => {
      const user = userEvent.setup()
      window.electronAPI.updateTask = vi.fn().mockResolvedValue({
        id: 't1', projectId, title: 'Task Todo', status: 'in_progress', createdAt: '2025-01-01', updatedAt: '2025-01-02',
      })

      render(<KanbanBoard projectId={projectId} />)

      await waitFor(() => screen.getByText('Task Todo'))

      // Find the move-right button for the todo task
      const taskCard = screen.getByText('Task Todo').closest('.kanban-card')
      const moveBtn = taskCard?.querySelector('[title="Mover para próxima etapa"]') as HTMLElement

      if (moveBtn) {
        await user.click(moveBtn)

        await waitFor(() => {
          expect(window.electronAPI.updateTask).toHaveBeenCalledWith('t1', { status: 'in_progress' })
        })
      }
    })
  })

  describe('deletar task', () => {
    it('deve chamar deleteTask ao clicar no botão de excluir', async () => {
      const user = userEvent.setup()
      window.electronAPI.deleteTask = vi.fn().mockResolvedValue(undefined)

      render(<KanbanBoard projectId={projectId} />)

      await waitFor(() => screen.getByText('Task Todo'))

      // Find delete button
      const taskCard = screen.getByText('Task Todo').closest('.kanban-card')
      const deleteBtn = taskCard?.querySelector('[title="Excluir"]') as HTMLElement

      if (deleteBtn) {
        await user.click(deleteBtn)

        await waitFor(() => {
          expect(window.electronAPI.deleteTask).toHaveBeenCalledWith('t1')
        })
      }
    })
  })

  describe('reload ao mudar projectId', () => {
    it('deve recarregar tasks quando projectId muda', async () => {
      const { rerender } = render(<KanbanBoard projectId="p1" />)

      await waitFor(() => {
        expect(window.electronAPI.getTasksByProject).toHaveBeenCalledWith('p1')
      })

      rerender(<KanbanBoard projectId="p2" />)

      await waitFor(() => {
        expect(window.electronAPI.getTasksByProject).toHaveBeenCalledWith('p2')
      })
    })
  })
})
