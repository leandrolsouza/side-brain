import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CaptureInput } from '../../../src/renderer/components/CaptureInput'
import { ToastProvider } from '../../../src/renderer/components/ToastContext'

// Helper to render with required providers
function renderCaptureInput(props = {}) {
  return render(
    <ToastProvider>
      <CaptureInput {...props} />
    </ToastProvider>
  )
}

describe('CaptureInput', () => {
  beforeEach(() => {
    // Setup default mocks for custom fields
    window.electronAPI.getCaptureTemplates = vi.fn().mockResolvedValue([
      {
        id: '1',
        label: 'Reunião',
        prefix: 'Reunião com ',
        placeholder: '[pessoa]',
        icon: 'Users',
        hintType: 'information',
        isDefault: true,
        sortOrder: 0,
      },
      {
        id: '2',
        label: 'Decisão',
        prefix: 'Decisão sobre ',
        placeholder: '[assunto]',
        icon: 'Gavel',
        hintType: 'decision',
        isDefault: true,
        sortOrder: 1,
      },
    ])
    window.electronAPI.getEntryTypes = vi.fn().mockResolvedValue([
      {
        id: '1',
        key: 'information',
        label: 'Informação',
        icon: 'Info',
        color: 'info',
        isDefault: true,
        sortOrder: 0,
        allowsAction: false,
      },
      {
        id: '2',
        key: 'decision',
        label: 'Decisão',
        icon: 'Gavel',
        color: 'warning',
        isDefault: true,
        sortOrder: 1,
        allowsAction: true,
      },
    ])
    window.electronAPI.getActionStatuses = vi.fn().mockResolvedValue([
      {
        id: '1',
        key: 'none',
        label: 'Sem ação',
        icon: 'Minus',
        color: 'neutral',
        isDefault: true,
        isFinal: false,
        sortOrder: 0,
      },
      {
        id: '2',
        key: 'action_needed',
        label: 'Ação necessária',
        icon: 'AlertCircle',
        color: 'warning',
        isDefault: true,
        isFinal: false,
        sortOrder: 1,
      },
    ])
    window.electronAPI.getProjects = vi.fn().mockResolvedValue([
      { id: 'p1', name: 'Backend API', isAutoSuggested: false },
      { id: 'p2', name: 'Frontend', isAutoSuggested: false },
    ])
    window.electronAPI.getStructuredTemplates = vi.fn().mockResolvedValue([])
    window.electronAPI.getCaptureSnippets = vi.fn().mockResolvedValue([])
  })

  describe('renderização', () => {
    it('deve renderizar o textarea e botão de enviar', async () => {
      renderCaptureInput()

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })
      expect(screen.getByText('Enviar')).toBeInTheDocument()
    })

    it('deve renderizar templates de captura', async () => {
      renderCaptureInput()

      await waitFor(() => {
        expect(screen.getByText('Reunião')).toBeInTheDocument()
        expect(screen.getByText('Decisão')).toBeInTheDocument()
      })
    })

    it('deve renderizar título e descrição', async () => {
      renderCaptureInput()

      await waitFor(() => {
        expect(screen.getByText('Captura Rápida')).toBeInTheDocument()
      })
    })

    it('deve mostrar hints de teclado', async () => {
      renderCaptureInput()

      expect(screen.getByText('enviar')).toBeInTheDocument()
      expect(screen.getByText('nova linha')).toBeInTheDocument()
    })
  })

  describe('input de texto', () => {
    it('deve permitir digitar texto', async () => {
      const user = userEvent.setup()
      renderCaptureInput()

      const textarea = await waitFor(() => screen.getByRole('textbox'))
      await user.type(textarea, 'Reunião com o cliente')

      expect(textarea).toHaveValue('Reunião com o cliente')
    })

    it('deve desabilitar envio quando textarea está vazio', async () => {
      renderCaptureInput()

      await waitFor(() => {
        const sendButton = screen.getByText('Enviar').closest('button')
        expect(sendButton).toBeDisabled()
      })
    })

    it('deve habilitar envio quando há texto', async () => {
      const user = userEvent.setup()
      renderCaptureInput()

      const textarea = await waitFor(() => screen.getByRole('textbox'))
      await user.type(textarea, 'Texto qualquer')

      const sendButton = screen.getByText('Enviar').closest('button')
      expect(sendButton).not.toBeDisabled()
    })
  })

  describe('templates', () => {
    it('deve preencher prefix ao clicar no template', async () => {
      const user = userEvent.setup()
      renderCaptureInput()

      await waitFor(() => screen.getByText('Reunião'))
      await user.click(screen.getByText('Reunião'))

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('Reunião com ')
    })

    it('deve desmarcar template ao clicar novamente', async () => {
      const user = userEvent.setup()
      renderCaptureInput()

      await waitFor(() => screen.getByText('Reunião'))
      await user.click(screen.getByText('Reunião'))

      // Click again to deactivate
      await user.click(screen.getByText('Reunião'))

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('')
    })
  })

  describe('fluxo de preview', () => {
    it('deve chamar previewEntry ao enviar', async () => {
      const user = userEvent.setup()
      window.electronAPI.previewEntry = vi.fn().mockResolvedValue({
        rawText: 'texto de teste',
        improvedText: 'Texto de teste melhorado',
        project: { id: 'p1', suggestedName: null, confidence: 0.9 },
        type: 'information',
        action: 'none',
        reasoning: 'Informação geral',
        suggestedTask: null,
      })

      renderCaptureInput()

      const textarea = await waitFor(() => screen.getByRole('textbox'))
      await user.type(textarea, 'texto de teste')
      await user.click(screen.getByText('Enviar'))

      await waitFor(() => {
        expect(window.electronAPI.previewEntry).toHaveBeenCalledWith('texto de teste', undefined)
      })
    })

    it('deve mostrar card de preview após AI responder', async () => {
      const user = userEvent.setup()
      window.electronAPI.previewEntry = vi.fn().mockResolvedValue({
        rawText: 'teste',
        improvedText: 'Texto melhorado pela IA',
        project: { id: 'p1', suggestedName: null, confidence: 0.9 },
        type: 'decision',
        action: 'action_needed',
        reasoning: 'Decisão técnica identificada',
        suggestedTask: { title: 'Implementar decisão', description: 'Fazer algo' },
      })

      renderCaptureInput()

      const textarea = await waitFor(() => screen.getByRole('textbox'))
      await user.type(textarea, 'teste')
      await user.click(screen.getByText('Enviar'))

      await waitFor(() => {
        expect(screen.getByText('Prévia da IA')).toBeInTheDocument()
      })

      // Shows improved text in the preview textarea (second textarea, first is the capture input)
      const textareas = screen.getAllByRole('textbox')
      const previewTextarea = textareas.find((t) => (t as HTMLTextAreaElement).value === 'Texto melhorado pela IA')
      expect(previewTextarea).toBeDefined()

      // Shows reasoning
      expect(screen.getByText('Decisão técnica identificada')).toBeInTheDocument()

      // Shows suggested task
      expect(screen.getByText('Implementar decisão')).toBeInTheDocument()
    })

    it('deve chamar confirmEntry ao confirmar preview', async () => {
      const user = userEvent.setup()
      window.electronAPI.previewEntry = vi.fn().mockResolvedValue({
        rawText: 'teste',
        improvedText: 'Teste melhorado',
        project: { id: 'p1', suggestedName: null, confidence: 0.9 },
        type: 'information',
        action: 'none',
        reasoning: 'Info',
        suggestedTask: null,
      })
      window.electronAPI.confirmEntry = vi.fn().mockResolvedValue({
        id: 'new-entry-id',
        rawText: 'teste',
        improvedText: 'Teste melhorado',
        projectId: 'p1',
        type: 'information',
        action: 'none',
        reviewStatus: 'auto_approved',
        createdAt: new Date().toISOString(),
      })

      renderCaptureInput()

      const textarea = await waitFor(() => screen.getByRole('textbox'))
      await user.type(textarea, 'teste')
      await user.click(screen.getByText('Enviar'))

      await waitFor(() => screen.getByText('Confirmar'))
      await user.click(screen.getByText('Confirmar'))

      await waitFor(() => {
        expect(window.electronAPI.confirmEntry).toHaveBeenCalledWith(
          expect.objectContaining({
            rawText: 'teste',
            improvedText: 'Teste melhorado',
            projectId: 'p1',
            type: 'information',
            action: 'none',
          })
        )
      })
    })

    it('deve voltar para idle ao cancelar preview', async () => {
      const user = userEvent.setup()
      window.electronAPI.previewEntry = vi.fn().mockResolvedValue({
        rawText: 'teste',
        improvedText: 'Teste melhorado',
        project: { id: 'p1', suggestedName: null, confidence: 0.9 },
        type: 'information',
        action: 'none',
        reasoning: 'Info',
        suggestedTask: null,
      })

      renderCaptureInput()

      const textarea = await waitFor(() => screen.getByRole('textbox'))
      await user.type(textarea, 'teste')
      await user.click(screen.getByText('Enviar'))

      await waitFor(() => screen.getByText('Voltar e editar'))
      await user.click(screen.getByText('Voltar e editar'))

      // Preview card should disappear
      expect(screen.queryByText('Prévia da IA')).not.toBeInTheDocument()
      // Textarea should still have text
      expect(screen.getByRole('textbox')).toHaveValue('teste')
    })
  })
})
