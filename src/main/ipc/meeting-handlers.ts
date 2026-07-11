import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerMeetingHandlers(): void {
  const { meetingService } = getContainer()

  safeHandle('meeting:create', async (_event, data: { projectId: string; title: string; participants?: string[]; meetingDate?: string }) => {
    return meetingService.create(data)
  })

  safeHandle('meeting:getAll', async (_event, projectId?: string) => {
    return meetingService.getAll(projectId)
  })

  safeHandle('meeting:getById', async (_event, id: string) => {
    return meetingService.getById(id)
  })

  safeHandle('meeting:getActive', async () => {
    return meetingService.getActive()
  })

  safeHandle('meeting:addNote', async (_event, id: string, note: string) => {
    return meetingService.addNote(id, note)
  })

  safeHandle('meeting:setTranscription', async (_event, id: string, transcription: string) => {
    return meetingService.setTranscription(id, transcription)
  })

  safeHandle('meeting:end', async (_event, id: string) => {
    return meetingService.end(id)
  })

  safeHandle('meeting:process', async (_event, id: string) => {
    return meetingService.analyze(id)
  })

  safeHandle('meeting:saveSelected', async (_event, meetingId: string, selectedEntries: any[], selectedTasks: any[], resolvedTaskIds?: string[]) => {
    return meetingService.saveSelected(meetingId, selectedEntries, selectedTasks, resolvedTaskIds)
  })

  safeHandle('meeting:delete', async (_event, id: string) => {
    return meetingService.delete(id)
  })

  safeHandle('meeting:deleteWithData', async (_event, meetingId: string, entryIds: string[], taskIds: string[]) => {
    return meetingService.deleteWithData(meetingId, entryIds, taskIds)
  })

  safeHandle('meeting:prepare', async (_event, projectId: string, title: string, participants: string[]) => {
    return meetingService.prepareMeeting(projectId, title, participants)
  })
}
