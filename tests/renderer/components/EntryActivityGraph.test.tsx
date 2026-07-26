import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EntryActivityGraph } from '../../../src/renderer/components/EntryActivityGraph'

describe('EntryActivityGraph', () => {
  beforeEach(() => {
    window.electronAPI.getEntryActivityHeatmap = vi.fn().mockResolvedValue([])
  })

  describe('renderização', () => {
    it('deve exibir loading enquanto carrega dados', () => {
      // Keep the promise pending to simulate loading
      window.electronAPI.getEntryActivityHeatmap = vi.fn().mockReturnValue(new Promise(() => {}))

      render(<EntryActivityGraph />)

      expect(screen.getByText('Atividade de Registros')).toBeInTheDocument()
      expect(screen.getByText('Carregando...')).toBeInTheDocument()
    })

    it('deve renderizar título após carregamento', async () => {
      render(<EntryActivityGraph />)

      await waitFor(() => {
        expect(screen.getByText('Atividade de Registros')).toBeInTheDocument()
      })
    })

    it('deve exibir estatísticas com dados vazios', async () => {
      render(<EntryActivityGraph />)

      await waitFor(() => {
        // All stats should be 0
        const statValues = document.querySelectorAll('.activity-stat-value')
        expect(statValues).toHaveLength(3)
        expect(statValues[0].textContent).toBe('0') // totalEntries
        expect(statValues[1].textContent).toBe('0') // currentStreak
        expect(statValues[2].textContent).toBe('0') // longestStreak
        // labels
        expect(screen.getByText('registros (20 semanas)')).toBeInTheDocument()
        expect(screen.getByText('dias seguidos')).toBeInTheDocument()
        expect(screen.getByText('maior sequência')).toBeInTheDocument()
      })
    })

    it('deve exibir legenda', async () => {
      render(<EntryActivityGraph />)

      await waitFor(() => {
        expect(screen.getByText('Menos')).toBeInTheDocument()
        expect(screen.getByText('Mais')).toBeInTheDocument()
      })
    })

    it('deve chamar getEntryActivityHeatmap com WEEKS=20', async () => {
      render(<EntryActivityGraph />)

      await waitFor(() => {
        expect(window.electronAPI.getEntryActivityHeatmap).toHaveBeenCalledWith(20)
      })
    })
  })

  describe('com dados de atividade', () => {
    it('deve somar total de entries corretamente', async () => {
      const today = new Date()
      const toDateStr = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      const twoDaysAgo = new Date(today)
      twoDaysAgo.setDate(today.getDate() - 2)

      window.electronAPI.getEntryActivityHeatmap = vi.fn().mockResolvedValue([
        { date: toDateStr(today), count: 5 },
        { date: toDateStr(yesterday), count: 3 },
        { date: toDateStr(twoDaysAgo), count: 2 },
      ])

      render(<EntryActivityGraph />)

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument()
      })
    })

    it('deve calcular streak atual corretamente', async () => {
      const today = new Date()
      const toDateStr = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      // Create a 3-day streak ending today
      const days = []
      for (let i = 0; i < 3; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        days.push({ date: toDateStr(d), count: 2 })
      }

      window.electronAPI.getEntryActivityHeatmap = vi.fn().mockResolvedValue(days)

      render(<EntryActivityGraph />)

      await waitFor(() => {
        // Current streak should be 3
        const statValues = document.querySelectorAll('.activity-stat-value')
        expect(statValues[1].textContent).toBe('3') // currentStreak
      })
    })

    it('deve calcular maior sequência corretamente', async () => {
      const today = new Date()
      const toDateStr = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      // Create a 5-day streak in the past (10 days ago)
      // and a 2-day streak ending today
      const days = []
      for (let i = 0; i < 5; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() - 10 - i)
        days.push({ date: toDateStr(d), count: 1 })
      }
      for (let i = 0; i < 2; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        days.push({ date: toDateStr(d), count: 1 })
      }

      window.electronAPI.getEntryActivityHeatmap = vi.fn().mockResolvedValue(days)

      render(<EntryActivityGraph />)

      await waitFor(() => {
        const statValues = document.querySelectorAll('.activity-stat-value')
        expect(statValues[2].textContent).toBe('5') // longestStreak
      })
    })
  })

  describe('grid de atividade', () => {
    it('deve renderizar células do grid com classes de nível corretas', async () => {
      const today = new Date()
      const toDateStr = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      window.electronAPI.getEntryActivityHeatmap = vi.fn().mockResolvedValue([
        { date: toDateStr(today), count: 10 }, // level 4
      ])

      render(<EntryActivityGraph />)

      await waitFor(() => {
        const level4Cells = document.querySelectorAll('.activity-graph-cell.level-4')
        expect(level4Cells.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('deve renderizar colunas (semanas) no grid', async () => {
      render(<EntryActivityGraph />)

      await waitFor(() => {
        const weeks = document.querySelectorAll('.activity-graph-week')
        // Should have approximately 20-21 weeks
        expect(weeks.length).toBeGreaterThanOrEqual(20)
        expect(weeks.length).toBeLessThanOrEqual(22)
      })
    })

    it('cada semana deve ter 7 dias', async () => {
      render(<EntryActivityGraph />)

      await waitFor(() => {
        const weeks = document.querySelectorAll('.activity-graph-week')
        if (weeks.length > 0) {
          const firstWeek = weeks[0]
          const cells = firstWeek.querySelectorAll('.activity-graph-cell')
          expect(cells.length).toBe(7)
        }
      })
    })
  })

  describe('labels de meses', () => {
    it('deve renderizar labels de meses', async () => {
      render(<EntryActivityGraph />)

      await waitFor(() => {
        const monthLabels = document.querySelectorAll('.activity-graph-month')
        // Should have at least a few month labels for 20 weeks
        expect(monthLabels.length).toBeGreaterThanOrEqual(4)
      })
    })
  })

  describe('labels de dias da semana', () => {
    it('deve renderizar labels dos dias da semana', async () => {
      render(<EntryActivityGraph />)

      await waitFor(() => {
        const dayLabels = document.querySelectorAll('.activity-graph-day-label')
        expect(dayLabels.length).toBe(7)
      })
    })

    it('deve mostrar labels alternados (apenas indices pares)', async () => {
      render(<EntryActivityGraph />)

      await waitFor(() => {
        const dayLabels = document.querySelectorAll('.activity-graph-day-label')
        // Indices 0, 2, 4, 6 should have text; 1, 3, 5 should be empty
        expect(dayLabels[0].textContent).not.toBe('')
        expect(dayLabels[1].textContent).toBe('')
        expect(dayLabels[2].textContent).not.toBe('')
        expect(dayLabels[3].textContent).toBe('')
      })
    })
  })

  describe('tratamento de erro', () => {
    it('deve lidar com erro na API sem quebrar', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      window.electronAPI.getEntryActivityHeatmap = vi.fn().mockRejectedValue(new Error('API Error'))

      render(<EntryActivityGraph />)

      await waitFor(() => {
        // Should still render the component (with empty data)
        expect(screen.getByText('Atividade de Registros')).toBeInTheDocument()
      })

      consoleSpy.mockRestore()
    })
  })
})
