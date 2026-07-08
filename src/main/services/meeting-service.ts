import { Meeting, MeetingProcessResult, EntryType, ActionStatus } from '../../shared/types'
import { MeetingRepository } from '../database/repositories/meeting-repository'
import { EntryRepository } from '../database/repositories/entry-repository'
import { TaskRepository } from '../database/repositories/task-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import { AIService } from './ai-service'

export class MeetingService {
  private meetingRepo = new MeetingRepository()
  private entryRepo = new EntryRepository()
  private taskRepo = new TaskRepository()
  private settingsRepo = new SettingsRepository()
  private aiService = new AIService()

  create(data: { projectId: string; title: string; participants?: string[] }): Meeting {
    return this.meetingRepo.create(data)
  }

  getAll(projectId?: string): Meeting[] {
    return this.meetingRepo.getAll(projectId)
  }

  getById(id: string): Meeting | null {
    return this.meetingRepo.getById(id)
  }

  getActive(): Meeting | null {
    return this.meetingRepo.getActive()
  }

  addNote(id: string, note: string): Meeting | null {
    return this.meetingRepo.addNote(id, note)
  }

  setTranscription(id: string, transcription: string): Meeting | null {
    return this.meetingRepo.setTranscription(id, transcription)
  }

  end(id: string): Meeting | null {
    return this.meetingRepo.end(id)
  }

  delete(id: string): void {
    return this.meetingRepo.delete(id)
  }

  /**
   * Step 1: Analyze the meeting content with AI.
   * Returns the AI result WITHOUT saving entries/tasks.
   * The user will select which items to keep.
   */
  async analyze(id: string): Promise<MeetingProcessResult | null> {
    const meeting = this.meetingRepo.getById(id)
    if (!meeting) return null

    const settings = this.settingsRepo.get()
    const content = this.buildMeetingContent(meeting)

    const result = await this.aiService.processMeeting(
      meeting.title,
      meeting.participants,
      content,
      settings
    )

    // Save the generated minutes on the meeting record
    this.meetingRepo.setProcessed(id, result.minutes)

    return result
  }

  /**
   * Step 2: Save only the selected entries and tasks.
   * Called after the user reviews and picks what they want.
   */
  saveSelected(
    meetingId: string,
    selectedEntries: { text: string; type: EntryType; action: ActionStatus }[],
    selectedTasks: { title: string; description?: string }[]
  ): void {
    const meeting = this.meetingRepo.getById(meetingId)
    if (!meeting) return

    // Create selected entries
    for (const entry of selectedEntries) {
      this.entryRepo.create({
        rawText: entry.text,
        improvedText: entry.text,
        projectId: meeting.projectId,
        type: entry.type,
        action: entry.action,
        reviewStatus: 'auto_approved',
      })
    }

    // Create selected tasks
    for (const task of selectedTasks) {
      const existing = this.taskRepo.findSimilar(meeting.projectId, task.title)
      if (!existing) {
        this.taskRepo.create({
          projectId: meeting.projectId,
          title: task.title,
          description: task.description,
          status: 'todo',
        })
      }
    }
  }

  private buildMeetingContent(meeting: Meeting): string {
    const parts: string[] = []

    if (meeting.rawNotes.length > 0) {
      parts.push('Notas manuais:')
      meeting.rawNotes.forEach((note, i) => {
        parts.push(`${i + 1}. ${note}`)
      })
    }

    if (meeting.pastedTranscription) {
      parts.push('')
      parts.push('Transcrição:')
      parts.push(meeting.pastedTranscription)
    }

    return parts.join('\n')
  }
}
