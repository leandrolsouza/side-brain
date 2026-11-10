import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { Settings } from '../../../src/renderer/components/Settings'
import { AppProvider } from '../../../src/renderer/components/AppContext'
import { ToastProvider } from '../../../src/renderer/components/ToastContext'

function renderSettings() {
  return render(
    <AppProvider>
      <ToastProvider>
        <Settings />
      </ToastProvider>
    </AppProvider>
  )
}

describe('Settings - Language Selector', () => {
  beforeEach(() => {
    window.electronAPI.secureStorageAvailable = vi.fn().mockResolvedValue(true)
    // Mock additional APIs used by Settings
    window.electronAPI.getSettings = vi.fn().mockResolvedValue({
      aiProvider: 'bedrock',
      awsRegion: 'us-east-1',
      bedrockApiKey: '',
      modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
      openaiApiKey: '',
      openaiModelId: 'gpt-4.1',
      geminiApiKey: '',
      geminiModelId: 'gemini-3.5-flash',
      grokApiKey: '',
      grokModelId: 'grok-4.3-latest',
      localEndpoint: 'http://localhost:1234',
      localModelId: '',
      localApiKey: '',
      fontFamily: 'system-ui',
      fontSize: '14',
      dateFormat: 'DD/MM/YYYY',
      uiDensity: 'comfortable',
      language: 'pt-BR',
      backupFrequency: 'startup',
      backupLimit: '7',
      nativeNotifications: 'true',
      taskCheckInterval: '30',
      dailyDigestEnabled: 'true',
      dailyDigestSections: 'aiSuggestion,pendingTasks,yesterdayActivity',
      userName: '',
      trayEnabled: 'true',
    })
    window.electronAPI.updateSettings = vi.fn().mockResolvedValue(undefined)
    window.electronAPI.listBackups = vi.fn().mockResolvedValue([])
    // Mock getDatabasePath if it exists
    ;(window.electronAPI as any).getDatabasePath = vi.fn().mockResolvedValue({
      currentPath: '/tmp/sidebrain.db',
      defaultPath: '/tmp/sidebrain.db',
      isCustom: false,
    })
    ;(window.electronAPI as any).importBackup = vi.fn().mockResolvedValue({ success: true })
    ;(window.electronAPI as any).restoreBackup = vi.fn().mockResolvedValue({ success: true })
    ;(window.electronAPI as any).deleteBackup = vi.fn().mockResolvedValue(undefined)
    ;(window.electronAPI as any).resetDatabase = vi.fn().mockResolvedValue(undefined)
    ;(window.electronAPI as any).openDatabaseFolder = vi.fn().mockResolvedValue(undefined)
    ;(window.electronAPI as any).changeDatabaseLocation = vi.fn().mockResolvedValue({ success: true })
    ;(window.electronAPI as any).checkDatabaseExists = vi.fn().mockResolvedValue(false)
    ;(window.electronAPI as any).getEmbeddingsStatus = vi
      .fn()
      .mockResolvedValue({ indexed: 0, total: 0, isIndexing: false })
    ;(window.electronAPI as any).rebuildEmbeddings = vi.fn().mockResolvedValue(undefined)

    // Ensure i18n is set to pt-BR for tests
    i18n.changeLanguage('pt-BR')
  })

  it('avisa quando o armazenamento seguro não está disponível', async () => {
    window.electronAPI.secureStorageAvailable = vi.fn().mockResolvedValue(false)
    renderSettings()
    expect(await screen.findByRole('alert')).toHaveTextContent('armazenamento seguro do sistema está indisponível')
  })

  it('preserva alterações ao trocar de aba e não reenvia credenciais inalteradas', async () => {
    const user = userEvent.setup()
    renderSettings()
    const name = await screen.findByPlaceholderText('Ex: Leandro')
    await user.type(name, 'Ana')
    await user.click(screen.getByRole('button', { name: 'Aparência' }))
    await user.click(screen.getByRole('button', { name: 'Geral' }))
    expect(screen.getByPlaceholderText('Ex: Leandro')).toHaveValue('Ana')
    await user.click(screen.getByRole('button', { name: 'Salvar Configurações' }))
    await waitFor(() => expect(window.electronAPI.updateSettings).toHaveBeenCalled())
    expect(window.electronAPI.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ userName: 'Ana' }))
    expect(vi.mocked(window.electronAPI.updateSettings).mock.calls.at(-1)?.[0]).not.toHaveProperty('openaiApiKey')
  })

  it('solicita confirmação antes de importar backup', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Dados' }))
    await user.click(screen.getByRole('button', { name: 'Importar Backup' }))
    expect(window.electronAPI.importBackup).not.toHaveBeenCalled()
    expect(screen.getByText(/Restaurar um backup substituirá todos os dados atuais/)).toBeInTheDocument()
  })

  it('deve renderizar a aba Aparência com seletor de idioma', async () => {
    const user = userEvent.setup()
    renderSettings()

    // Navigate to Aparência tab
    await waitFor(() => {
      expect(screen.getByText('Aparência')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Aparência'))

    // Should show language section
    await waitFor(() => {
      expect(screen.getByText('Idioma')).toBeInTheDocument()
    })
  })

  it('deve exibir opções de idioma no select', async () => {
    const user = userEvent.setup()
    renderSettings()

    await waitFor(() => {
      expect(screen.getByText('Aparência')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Aparência'))

    await waitFor(() => {
      expect(screen.getByText('Português (Brasil)')).toBeInTheDocument()
      expect(screen.getByText('English')).toBeInTheDocument()
    })
  })

  it('deve ter pt-BR selecionado como padrão', async () => {
    const user = userEvent.setup()
    renderSettings()

    await waitFor(() => {
      expect(screen.getByText('Aparência')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Aparência'))

    await waitFor(() => {
      const select = screen.getByDisplayValue('Português (Brasil)') as HTMLSelectElement
      expect(select.value).toBe('pt-BR')
    })
  })

  it('deve chamar updateSettings ao trocar idioma para English', async () => {
    const user = userEvent.setup()
    renderSettings()

    await waitFor(() => {
      expect(screen.getByText('Aparência')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Aparência'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Português (Brasil)')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('Português (Brasil)')
    await user.selectOptions(select, 'en')

    await waitFor(() => {
      expect(window.electronAPI.updateSettings).toHaveBeenCalledWith({ language: 'en' })
    })
  })

  it('deve alterar idioma do i18n ao selecionar English', async () => {
    const user = userEvent.setup()
    renderSettings()

    await waitFor(() => {
      expect(screen.getByText('Aparência')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Aparência'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Português (Brasil)')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('Português (Brasil)')
    await user.selectOptions(select, 'en')

    await waitFor(() => {
      expect(i18n.language).toBe('en')
    })

    // Reset back to pt-BR for other tests
    await i18n.changeLanguage('pt-BR')
  })

  it('deve persistir idioma selecionado via electronAPI', async () => {
    const user = userEvent.setup()
    renderSettings()

    await waitFor(() => {
      expect(screen.getByText('Aparência')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Aparência'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Português (Brasil)')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('Português (Brasil)')
    await user.selectOptions(select, 'en')

    await waitFor(() => {
      expect(window.electronAPI.updateSettings).toHaveBeenCalledWith({ language: 'en' })
    })

    // Change back
    await user.selectOptions(select, 'pt-BR')

    await waitFor(() => {
      expect(window.electronAPI.updateSettings).toHaveBeenCalledWith({ language: 'pt-BR' })
    })

    // Reset i18n
    await i18n.changeLanguage('pt-BR')
  })
})
