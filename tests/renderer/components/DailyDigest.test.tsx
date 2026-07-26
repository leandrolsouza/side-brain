import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DailyDigest } from '../../../src/renderer/components/DailyDigest'

const mockDigest = {
  greeting: 'Bom dia!',
  tasksNeedingAttention: {
    overdue: [
      {
        id: 't1',
        projectId: 'p1',
        title: 'Task atrasada 1',
        status: 'todo',
        createdAt: '2025-07-01',
        updatedAt: '2025-07-01',
      },
      {
        id: 't2',
        projectId: 'p1',
        title: 'Task atrasada 2',
        status: 'todo',
        createdAt: '2025-07-01',
        updatedAt: '2025-07-01',
      },
    ],
    inProgress: [
      {
        id: 't3',
        projectId: 'p1',
        title: 'Task em progresso',
        status: 'in_progress',
        createdAt: '2025-07-08',
        updatedAt: '2025-07-08',
      },
    ],
    waiting: [
      {
        id: 't4',
        projectId: 'p1',
        title: 'Task aguardando',
        status: 'waiting',
        createdAt: '2025-07-05',
        updatedAt: '2025-07-05',
      },
    ],
  },
  yesterdayActivity: {
    entriesCreated: [
      {
        id: 'e1',
        rawText: 'test',
        improvedText: 'Entry de ontem sobre o projeto alpha',
        projectId: 'p1',
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
        createdAt: '2025-07-10',
      },
    ],
    tasksCompleted: [
      {
        id: 't5',
        projectId: 'p1',
        title: 'Task completada',
        status: 'done',
        createdAt: '2025-07-01',
        updatedAt: '2025-07-10',
      },
    ],
    tasksCreated: [],
  },
  aiSuggestion: 'Foque em concluir as tasks do projeto Alpha hoje.',
  generatedAt: '2025-07-11T08:00:00Z',
}

describe('DailyDigest', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    onClose.mockClear()
    window.electronAPI.generateDailyDigest = vi.fn().mockResolvedValue(mockDigest)
    window.electronAPI.getEntryTypes = vi.fn().mockResolvedValue([
      { id: '1', key: 'information', label: 'Informação', icon: '📝', isDefault: true, sortOrder: 0 },
      { id: '2', key: 'decision', label: 'Decisão', icon: '⚖️', isDefault: true, sortOrder: 1 },
    ])
    window.electronAPI.getSettings = vi.fn().mockResolvedValue({
      dailyDigestSections: 'aiSuggestion,pendingTasks,yesterdayActivity',
    })
  })

  describe('estado de loading', () => {
    it('deve exibir spinner e mensagem de preparação enquanto carrega', () => {
      window.electronAPI.generateDailyDigest = vi.fn().mockReturnValue(new Promise(() => {}))

      render(<DailyDigest onClose={onClose} />)

      expect(screen.getByText('Preparando seu resumo do dia...')).toBeInTheDocument()
    })
  })

  describe('estado de erro', () => {
    it('deve exibir mensagem de erro quando API falha', async () => {
      window.electronAPI.generateDailyDigest = vi.fn().mockRejectedValue(new Error('Falha na AI'))

      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily Digest')).toBeInTheDocument()
        expect(screen.getByText(/Não foi possível gerar o digest/)).toBeInTheDocument()
      })
    })

    it('deve exibir botão de retry no estado de erro', async () => {
      window.electronAPI.generateDailyDigest = vi.fn().mockRejectedValue(new Error('Erro'))

      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
      })
    })

    it('deve chamar generateDailyDigest novamente ao clicar em retry', async () => {
      const user = userEvent.setup()
      window.electronAPI.generateDailyDigest = vi
        .fn()
        .mockRejectedValueOnce(new Error('Erro'))
        .mockResolvedValueOnce(mockDigest)

      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Tentar novamente'))

      await waitFor(() => {
        expect(window.electronAPI.generateDailyDigest).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('exibição do digest', () => {
    it('deve exibir o greeting', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Bom dia!')).toBeInTheDocument()
      })
    })

    it('deve exibir sugestão da AI', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Sugestão de foco')).toBeInTheDocument()
        expect(screen.getByText('Foque em concluir as tasks do projeto Alpha hoje.')).toBeInTheDocument()
      })
    })

    it('deve exibir contagem total de tasks pendentes', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        // 2 overdue + 1 inProgress + 1 waiting = 4
        expect(screen.getByText(/Tasks pendentes \(4\)/)).toBeInTheDocument()
      })
    })

    it('deve exibir tasks em progresso', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Em andamento')).toBeInTheDocument()
        expect(screen.getByText('Task em progresso')).toBeInTheDocument()
      })
    })

    it('deve exibir tasks a fazer (overdue)', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('A fazer')).toBeInTheDocument()
        expect(screen.getByText('Task atrasada 1')).toBeInTheDocument()
        expect(screen.getByText('Task atrasada 2')).toBeInTheDocument()
      })
    })

    it('deve exibir tasks aguardando', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Aguardando')).toBeInTheDocument()
        expect(screen.getByText('Task aguardando')).toBeInTheDocument()
      })
    })

    it('deve exibir atividade de ontem', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        // "📅 Ontem" is rendered as emoji + text in h3, use regex matcher
        expect(screen.getByText(/Ontem/)).toBeInTheDocument()
        expect(screen.getByText('entradas criadas')).toBeInTheDocument()
        expect(screen.getByText('tasks concluídas')).toBeInTheDocument()
        expect(screen.getByText('tasks criadas')).toBeInTheDocument()
      })
    })

    it('deve exibir contagens de atividade de ontem', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        const statNumbers = document.querySelectorAll('.digest-stat-number')
        expect(statNumbers[0].textContent).toBe('1') // entriesCreated
        expect(statNumbers[1].textContent).toBe('1') // tasksCompleted
        expect(statNumbers[2].textContent).toBe('0') // tasksCreated
      })
    })

    it('deve exibir preview das entries de ontem', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText(/Entry de ontem sobre o projeto alpha/)).toBeInTheDocument()
      })
    })

    it('deve exibir botão "Vamos lá!" no footer', async () => {
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Vamos lá! 🚀')).toBeInTheDocument()
      })
    })
  })

  describe('interação', () => {
    it('deve chamar onClose ao clicar no botão de fechar (✕)', async () => {
      const user = userEvent.setup()
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Bom dia!')).toBeInTheDocument()
      })

      await user.click(screen.getByText('✕'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('deve chamar onClose ao clicar no botão "Vamos lá!"', async () => {
      const user = userEvent.setup()
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Vamos lá! 🚀')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Vamos lá! 🚀'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('deve chamar onClose ao clicar no overlay', async () => {
      const user = userEvent.setup()
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Bom dia!')).toBeInTheDocument()
      })

      // Click on overlay (the outermost element)
      const overlay = document.querySelector('.digest-overlay')!
      await user.click(overlay)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('não deve chamar onClose ao clicar dentro do modal', async () => {
      const user = userEvent.setup()
      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Bom dia!')).toBeInTheDocument()
      })

      // Click inside the modal content
      await user.click(screen.getByText('Bom dia!'))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('sem dados pendentes', () => {
    it('deve exibir mensagem "tudo em dia" quando não há tasks pendentes', async () => {
      window.electronAPI.generateDailyDigest = vi.fn().mockResolvedValue({
        ...mockDigest,
        tasksNeedingAttention: { overdue: [], inProgress: [], waiting: [] },
      })

      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Nenhuma task pendente. Tudo em dia! 🎉')).toBeInTheDocument()
      })
    })
  })

  describe('sem sugestão AI', () => {
    it('não deve exibir seção de sugestão quando aiSuggestion é null', async () => {
      window.electronAPI.generateDailyDigest = vi.fn().mockResolvedValue({
        ...mockDigest,
        aiSuggestion: null,
      })

      render(<DailyDigest onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Bom dia!')).toBeInTheDocument()
      })

      expect(screen.queryByText('Sugestão de foco')).not.toBeInTheDocument()
    })
  })
})
