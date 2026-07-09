import { v4 as uuid } from 'uuid'
import { getDatabase } from '../schema'
import { Meeting, MeetingStatus } from '../../../shared/types'

export class MeetingRepository {
  getAll(projectId?: string): Meeting[] {
    const db = getDatabase()

    let query = `
      SELECT id, project_id as projectId, title, participants, meeting_date as meetingDate,
             started_at as startedAt, ended_at as endedAt, status, raw_notes as rawNotes,
             pasted_transcription as pastedTranscription,
             generated_minutes as generatedMinutes, created_at as createdAt
      FROM meetings
    `

    let rows: any[]
    if (projectId) {
      query += ' WHERE project_id = ? ORDER BY meeting_date DESC, created_at DESC'
      rows = db.prepare(query).all(projectId) as any[]
    } else {
      query += ' ORDER BY meeting_date DESC, created_at DESC'
      rows = db.prepare(query).all() as any[]
    }

    return rows.map(this.deserialize)
  }

  getById(id: string): Meeting | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, project_id as projectId, title, participants, meeting_date as meetingDate,
             started_at as startedAt, ended_at as endedAt, status, raw_notes as rawNotes,
             pasted_transcription as pastedTranscription,
             generated_minutes as generatedMinutes, created_at as createdAt
      FROM meetings WHERE id = ?
    `).get(id) as any | undefined

    if (!row) return null
    return this.deserialize(row)
  }

  getActive(): Meeting | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, project_id as projectId, title, participants, meeting_date as meetingDate,
             started_at as startedAt, ended_at as endedAt, status, raw_notes as rawNotes,
             pasted_transcription as pastedTranscription,
             generated_minutes as generatedMinutes, created_at as createdAt
      FROM meetings WHERE status = 'active' LIMIT 1
    `).get() as any | undefined

    if (!row) return null
    return this.deserialize(row)
  }

  create(data: {
    projectId: string
    title: string
    participants?: string[]
    meetingDate?: string
  }): Meeting {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()
    const participants = JSON.stringify(data.participants || [])
    const rawNotes = JSON.stringify([])
    const meetingDate = data.meetingDate || now.slice(0, 10)

    db.prepare(`
      INSERT INTO meetings (id, project_id, title, participants, meeting_date, started_at, status, raw_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, data.projectId, data.title, participants, meetingDate, now, rawNotes, now)

    return {
      id,
      projectId: data.projectId,
      title: data.title,
      participants: data.participants || [],
      meetingDate,
      startedAt: now,
      endedAt: null,
      status: 'active',
      rawNotes: [],
      pastedTranscription: null,
      generatedMinutes: null,
      createdAt: now,
    }
  }

  addNote(id: string, note: string): Meeting | null {
    const meeting = this.getById(id)
    if (!meeting || meeting.status !== 'active') return null

    const updatedNotes = [...meeting.rawNotes, note]
    const db = getDatabase()
    db.prepare('UPDATE meetings SET raw_notes = ? WHERE id = ?')
      .run(JSON.stringify(updatedNotes), id)

    return { ...meeting, rawNotes: updatedNotes }
  }

  setTranscription(id: string, transcription: string): Meeting | null {
    const meeting = this.getById(id)
    if (!meeting) return null

    const db = getDatabase()
    db.prepare('UPDATE meetings SET pasted_transcription = ? WHERE id = ?')
      .run(transcription, id)

    return { ...meeting, pastedTranscription: transcription }
  }

  end(id: string): Meeting | null {
    const meeting = this.getById(id)
    if (!meeting || meeting.status !== 'active') return null

    const endedAt = new Date().toISOString()
    const db = getDatabase()
    db.prepare('UPDATE meetings SET status = ?, ended_at = ? WHERE id = ?')
      .run('ended', endedAt, id)

    return { ...meeting, status: 'ended', endedAt }
  }

  setProcessed(id: string, minutes: string): Meeting | null {
    const meeting = this.getById(id)
    if (!meeting) return null

    const db = getDatabase()
    db.prepare('UPDATE meetings SET status = ?, generated_minutes = ? WHERE id = ?')
      .run('processed', minutes, id)

    return { ...meeting, status: 'processed', generatedMinutes: minutes }
  }

  delete(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM meetings WHERE id = ?').run(id)
  }

  private deserialize(row: any): Meeting {
    return {
      ...row,
      participants: JSON.parse(row.participants || '[]'),
      rawNotes: JSON.parse(row.rawNotes || '[]'),
    }
  }
}
