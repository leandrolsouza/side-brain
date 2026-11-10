import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MeetingMode } from '../../../src/renderer/components/MeetingMode'

describe('MeetingMode', () => {
  const activeMeeting = {
    id: 'meeting-1',
    projectId: 'project-1',
    title: 'Planejamento',
    participants: ['Ana'],
    meetingDate: '2026-11-10',
    startedAt: '2026-11-10T12:00:00.000Z',
    endedAt: null,
    status: 'active',
    rawNotes: [],
    pastedTranscription: null,
    generatedMinutes: null,
  }

  beforeEach(() => {
    window.electronAPI.getProjects = vi.fn().mockResolvedValue([{ id: 'project-1', name: 'Projeto A' }])
    window.electronAPI.getActiveMeeting = vi.fn().mockResolvedValue(null)
    window.electronAPI.getSettings = vi.fn().mockResolvedValue({ userName: '' })
    window.electronAPI.createMeeting = vi.fn().mockResolvedValue(activeMeeting)
    window.electronAPI.endMeeting = vi.fn().mockResolvedValue({ ...activeMeeting, status: 'ended' })
    window.electronAPI.setMeetingTranscription = vi.fn().mockResolvedValue(null)
    window.electronAPI.processMeeting = vi.fn().mockResolvedValue({
      minutes: 'Ata da reunião',
      entries: [{ text: 'Decisão registrada', type: 'decision', action: 'none' }],
      tasks: [
        { title: 'Tarefa nova' },
        { title: 'Tarefa duplicada', similarTo: { taskId: 'existing', taskTitle: 'Existente', reason: 'similar' } },
      ],
      resolvedTasks: [{ taskId: 'resolved', taskTitle: 'Tarefa concluída', reason: 'finalizada' }],
    })
    window.electronAPI.saveSelectedMeetingItems = vi
      .fn()
      .mockResolvedValue({ entryIds: ['e1'], taskIds: ['t1'], resolvedTaskIds: ['resolved'] })
  })

  it('mantém a transcrição e salva apenas os itens selecionados nas etapas seguintes', async () => {
    const user = userEvent.setup()
    render(<MeetingMode />)
    await screen.findByRole('option', { name: 'Projeto A' })
    await user.type(screen.getByPlaceholderText(/Sprint Planning/), 'Planejamento')
    await user.type(screen.getByPlaceholderText(/João, Maria/), 'Ana')
    await user.click(screen.getByText('Colar transcrição'))

    const transcription = await screen.findByPlaceholderText(/Cole a transcrição aqui/)
    await user.type(transcription, 'Discussão importante')
    await user.click(screen.getByRole('button', { name: 'Processar Reunião' }))
    await screen.findByText('Decisão registrada')
    expect(window.electronAPI.setMeetingTranscription).toHaveBeenCalledWith('meeting-1', 'Discussão importante')
    expect(window.electronAPI.endMeeting).toHaveBeenCalledWith('meeting-1')
    expect(screen.getByText('Tarefa duplicada').closest('label')?.querySelector('input')).not.toBeChecked()
    await user.click(screen.getByText('Tarefa duplicada'))
    await user.click(screen.getByText('Tarefa concluída'))

    await user.click(screen.getByRole('button', { name: /Salvar Selecionados/ }))
    await screen.findByText(/Reunião Salva/)
    expect(window.electronAPI.saveSelectedMeetingItems).toHaveBeenCalledWith(
      'meeting-1',
      [{ text: 'Decisão registrada', type: 'decision', action: 'none' }],
      [
        { title: 'Tarefa nova', description: undefined, assignee: undefined },
        { title: 'Tarefa duplicada', description: undefined, assignee: undefined },
      ],
      []
    )
  })

  it('retoma uma reunião ativa e adiciona notas', async () => {
    const user = userEvent.setup()
    window.electronAPI.getActiveMeeting = vi.fn().mockResolvedValue(activeMeeting)
    window.electronAPI.addMeetingNote = vi.fn().mockResolvedValue({ ...activeMeeting, rawNotes: ['Nota retomada'] })
    render(<MeetingMode />)
    const input = await screen.findByPlaceholderText(/Digite uma nota/)
    await user.type(input, 'Nota retomada{enter}')
    await waitFor(() => expect(window.electronAPI.addMeetingNote).toHaveBeenCalledWith('meeting-1', 'Nota retomada'))
    expect(await screen.findByText('Nota retomada')).toBeInTheDocument()
  })
})
