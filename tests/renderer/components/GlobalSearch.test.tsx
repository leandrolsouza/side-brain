import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { GlobalSearch } from '../../../src/renderer/components/GlobalSearch'

describe('GlobalSearch', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onNavigateToProject: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.electronAPI.getProjects = vi.fn().mockResolvedValue([
      { id: 'p1', name: 'Backend API', active: true, createdAt: '2025-01-01', isAutoSuggested: false },
      { id: 'p2', name: 'Frontend', active: true, createdAt: '2025-01-01', isAutoSuggested: false },
    ])
    window.electronAPI.getEntryTypes = vi.fn().mockResolvedValue([
      { id: '1', key: 'information', label: 'Informação', icon: 'Info', color: 'info', isDefault: true, sortOrder: 0, allowsAction: false },
    ])
  })

  describe('renderização', () => {
    it('deve renderizar quando isOpen=true', async () => {
      render(<GlobalSearch {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Buscar entradas, tasks, projetos...')).toBeInTheDocument()
      })
    })

    it('não deve renderizar quando isOpen=false', () => {
      render(<GlobalSearch {...defaultProps} isOpen={false} />)

      expect(screen.queryByPlaceholderText('Buscar entradas, tasks, projetos...')).not.toBeInTheDocument()
    })

    it('deve renderizar tabs de filtro', async () => {
      render(<GlobalSearch {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Tudo/)).toBeInTheDocument()
        expect(screen.getByText(/Projetos/)).toBeInTheDocument()
        expect(screen.getByText(/Entradas/)).toBeInTheDocument()
        expect(screen.getByText(/Tasks/)).toBeInTheDocument()
      })
    })

    it('deve renderizar footer com atalhos', () => {
      render(<GlobalSearch {...defaultProps} />)

      expect(screen.getByText('navegar')).toBeInTheDocument()
      expect(screen.getByText('abrir')).toBeInTheDocument()
      expect(screen.getByText('fechar')).toBeInTheDocument()
    })

    it('deve mostrar placeholder quando não há query', async () => {
      render(<GlobalSearch {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Digite para buscar em tudo')).toBeInTheDocument()
      })
    })
  })

  describe('busca', () => {
    it('deve chamar globalSearch após debounce', async () => {
      const user = userEvent.setup()
      window.electronAPI.globalSearch = vi.fn().mockResolvedValue({
        entries: [{ id: 'e1', rawText: 'Deploy', improvedText: 'Deploy na AWS', projectId: 'p1', type: 'information', action: 'none', reviewStatus: 'auto_approved', createdAt: '2025-01-15' }],
        tasks: [],
        projects: [],
      })

      render(<GlobalSearch {...defaultProps} />)

      const input = await waitFor(() => screen.getByPlaceholderText('Buscar entradas, tasks, projetos...'))
      await user.type(input, 'deploy')

      await waitFor(() => {
        expect(window.electronAPI.globalSearch).toHaveBeenCalledWith('deploy', {})
      }, { timeout: 1000 })
    })

    it('deve exibir resultados de busca', async () => {
      const user = userEvent.setup()
      window.electronAPI.globalSearch = vi.fn().mockResolvedValue({
        entries: [{ id: 'e1', rawText: 'Deploy', improvedText: 'Deploy na AWS', projectId: 'p1', type: 'information', action: 'none', reviewStatus: 'auto_approved', createdAt: '2025-06-15' }],
        tasks: [{ id: 't1', projectId: 'p1', title: 'Configurar CI/CD', status: 'todo', createdAt: '2025-06-15', updatedAt: '2025-06-15' }],
        projects: [{ id: 'p1', name: 'Backend API', active: true, createdAt: '2025-01-01', isAutoSuggested: false }],
      })

      render(<GlobalSearch {...defaultProps} />)

      const input = await waitFor(() => screen.getByPlaceholderText('Buscar entradas, tasks, projetos...'))
      await user.type(input, 'backend')

      await waitFor(() => {
        expect(screen.getByText('Deploy na AWS')).toBeInTheDocument()
        expect(screen.getByText('Configurar CI/CD')).toBeInTheDocument()
        expect(screen.getByText('Backend API')).toBeInTheDocument()
      }, { timeout: 1000 })
    })

    it('deve mostrar mensagem quando não há resultados', async () => {
      const user = userEvent.setup()
      window.electronAPI.globalSearch = vi.fn().mockResolvedValue({
        entries: [],
        tasks: [],
        projects: [],
      })

      render(<GlobalSearch {...defaultProps} />)

      const input = await waitFor(() => screen.getByPlaceholderText('Buscar entradas, tasks, projetos...'))
      await user.type(input, 'xyz-inexistente')

      await waitFor(() => {
        expect(screen.getByText(/Nenhum resultado/)).toBeInTheDocument()
      }, { timeout: 1000 })
    })

    it('não deve buscar quando query está vazio', async () => {
      render(<GlobalSearch {...defaultProps} />)

      // Wait for component to settle
      await waitFor(() => screen.getByText('Digite para buscar em tudo'))

      expect(window.electronAPI.globalSearch).not.toHaveBeenCalled()
    })
  })

  describe('interação', () => {
    it('deve fechar ao pressionar Escape', async () => {
      const user = userEvent.setup()
      render(<GlobalSearch {...defaultProps} />)

      const input = await waitFor(() => screen.getByPlaceholderText('Buscar entradas, tasks, projetos...'))
      await user.type(input, '{Escape}')

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('deve fechar ao clicar no overlay', async () => {
      const user = userEvent.setup()
      render(<GlobalSearch {...defaultProps} />)

      const overlay = document.querySelector('.global-search-overlay')
      if (overlay) {
        await user.click(overlay)
        expect(defaultProps.onClose).toHaveBeenCalled()
      }
    })

    it('deve navegar para projeto ao clicar em resultado de projeto', async () => {
      const user = userEvent.setup()
      window.electronAPI.globalSearch = vi.fn().mockResolvedValue({
        entries: [],
        tasks: [],
        projects: [{ id: 'p1', name: 'Backend API', active: true, createdAt: '2025-01-01', isAutoSuggested: false }],
      })

      render(<GlobalSearch {...defaultProps} />)

      const input = await waitFor(() => screen.getByPlaceholderText('Buscar entradas, tasks, projetos...'))
      await user.type(input, 'backend')

      await waitFor(() => screen.getByText('Backend API'), { timeout: 1000 })
      await user.click(screen.getByText('Backend API'))

      expect(defaultProps.onClose).toHaveBeenCalled()
      expect(defaultProps.onNavigateToProject).toHaveBeenCalledWith('p1', 'Backend API')
    })
  })

  describe('filtros por tab', () => {
    it('deve filtrar para mostrar apenas entries quando tab "Entradas" é clicado', async () => {
      const user = userEvent.setup()
      window.electronAPI.globalSearch = vi.fn().mockResolvedValue({
        entries: [{ id: 'e1', rawText: 'E', improvedText: 'Entry result', projectId: 'p1', type: 'information', action: 'none', reviewStatus: 'auto_approved', createdAt: '2025-06-15' }],
        tasks: [{ id: 't1', projectId: 'p1', title: 'Task result', status: 'todo', createdAt: '2025-06-15', updatedAt: '2025-06-15' }],
        projects: [],
      })

      render(<GlobalSearch {...defaultProps} />)

      const input = await waitFor(() => screen.getByPlaceholderText('Buscar entradas, tasks, projetos...'))
      await user.type(input, 'result')

      await waitFor(() => screen.getByText('Entry result'), { timeout: 1000 })

      // Click on "Entradas" tab
      await user.click(screen.getByText(/Entradas/))

      // Entry should still be visible, task should not
      expect(screen.getByText('Entry result')).toBeInTheDocument()
      expect(screen.queryByText('Task result')).not.toBeInTheDocument()
    })
  })
})
