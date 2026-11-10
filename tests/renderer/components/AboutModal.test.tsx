import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AboutModal } from '../../../src/renderer/components/AboutModal'

describe('AboutModal update check', () => {
  beforeEach(() => {
    window.electronAPI.getAppVersion = vi.fn().mockResolvedValue('0.9.0')
  })

  it('shows the available version returned by the updater', async () => {
    window.electronAPI.checkForUpdates = vi.fn().mockResolvedValue({
      status: 'available',
      info: { version: '1.0.0' },
    })
    render(<AboutModal isOpen onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /verificar atualizações/i }))
    expect(await screen.findByText(/1\.0\.0/)).toBeInTheDocument()
  })

  it('shows an error instead of claiming the app is up to date', async () => {
    window.electronAPI.checkForUpdates = vi.fn().mockResolvedValue({ status: 'error', error: '404' })
    render(<AboutModal isOpen onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /verificar atualizações/i }))
    expect(await screen.findByText(/não foi possível verificar atualizações/i)).toBeInTheDocument()
  })
})
