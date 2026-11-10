import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useMeetingPreview } from './useMeetingPreview'

import type { Meeting, Project, MeetingStep, MeetingModeProps } from './meeting-types'

export function useMeetingController({ projectId, onFinished }: MeetingModeProps) {
  const { t } = useTranslation('meetings')
  const {
    generatedMinutes,
    setGeneratedMinutes,
    previewEntries,
    setPreviewEntries,
    previewTasks,
    setPreviewTasks,
    previewResolvedTasks,
    setPreviewResolvedTasks,
    isSaving,
    setIsSaving,
    savedEntryIds,
    setSavedEntryIds,
    savedTaskIds,
    setSavedTaskIds,
    setSavedResolvedTaskIds,
    showDeleteConfirm,
    setShowDeleteConfirm,
    userName,
    setUserName,
    editingEntryIndex,
    setEditingEntryIndex,
    editingTaskIndex,
    setEditingTaskIndex,
    editingEntryTypeIndex,
    setEditingEntryTypeIndex,
    toggleEntry,
    toggleTask,
    selectAllEntries,
    selectAllTasks,
    toggleResolvedTask,
    selectAllResolvedTasks,
    updateEntryText,
    updateEntryType,
    updateTaskTitle,
    updateTaskDescription,
  } = useMeetingPreview()
  const [step, setStep] = useState<MeetingStep>('setup')
  const [projects, setProjects] = useState<Project[]>([])
  const [meeting, setMeeting] = useState<Meeting | null>(null)

  // Setup form
  const [title, setTitle] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '')
  const [participantsInput, setParticipantsInput] = useState('')
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Meeting prep (suggested agenda)
  const [suggestedAgenda, setSuggestedAgenda] = useState<string | null>(null)
  const [isPreparingAgenda, setIsPreparingAgenda] = useState(false)

  // Active meeting
  const [noteInput, setNoteInput] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const noteInputRef = useRef<HTMLInputElement>(null)

  // Review/paste
  const [transcription, setTranscription] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
    checkActiveMeeting()
    loadUserName()
  }, [])

  // Sync selectedProjectId when prop changes (e.g. navigating from a project)
  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId)
    }
  }, [projectId])

  useEffect(() => {
    if (step === 'active' && meeting) {
      timerRef.current = setInterval(() => {
        const start = new Date(meeting.startedAt).getTime()
        const now = Date.now()
        setElapsed(Math.floor((now - start) / 1000))
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [step, meeting?.startedAt])

  const loadProjects = async () => {
    const data = await window.electronAPI.getProjects()
    setProjects(data)
    if (!selectedProjectId && data.length > 0) {
      setSelectedProjectId(data[0].id)
    }
  }

  const loadUserName = async () => {
    try {
      const settings = await window.electronAPI.getSettings()
      if (settings?.userName) {
        setUserName(settings.userName)
      }
    } catch {
      /* ignore */
    }
  }

  const checkActiveMeeting = async () => {
    const active = await window.electronAPI.getActiveMeeting()
    if (active) {
      setMeeting(active)
      setStep('active')
    }
  }

  const handlePrepareAgenda = async () => {
    if (!selectedProjectId || !title.trim()) return
    setIsPreparingAgenda(true)
    try {
      const participants = participantsInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      const agenda = await window.electronAPI.prepareMeeting(selectedProjectId, title.trim(), participants)
      setSuggestedAgenda(agenda)
    } catch (error) {
      console.error('Failed to prepare agenda:', error)
    } finally {
      setIsPreparingAgenda(false)
    }
  }

  const handleCopyAgenda = async () => {
    if (suggestedAgenda) {
      await navigator.clipboard.writeText(suggestedAgenda)
    }
  }

  const handleStart = async () => {
    if (!title.trim() || !selectedProjectId) return

    const participants = participantsInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    const created = await window.electronAPI.createMeeting({
      projectId: selectedProjectId,
      title: title.trim(),
      participants,
      meetingDate,
    })

    setMeeting(created)
    setStep('active')
  }

  const handleAddNote = async () => {
    const trimmed = noteInput.trim()
    if (!trimmed || !meeting) return

    const updated = await window.electronAPI.addMeetingNote(meeting.id, trimmed)
    if (updated) setMeeting(updated)
    setNoteInput('')
    noteInputRef.current?.focus()
  }

  const handleEnd = async () => {
    if (!meeting) return
    const updated = await window.electronAPI.endMeeting(meeting.id)
    if (updated) setMeeting(updated)
    setStep('review')
  }

  const handleProcess = async () => {
    if (!meeting) return
    setIsProcessing(true)
    setProcessError(null)
    try {
      if (transcription.trim()) {
        await window.electronAPI.setMeetingTranscription(meeting.id, transcription.trim())
      }

      // End the meeting if still active (e.g. paste mode)
      if (meeting.status === 'active') {
        const ended = await window.electronAPI.endMeeting(meeting.id)
        if (ended) setMeeting(ended)
      }

      // Step 1: AI analyzes — returns result without saving entries/tasks
      const result = await window.electronAPI.processMeeting(meeting.id)

      if (result) {
        setGeneratedMinutes(result.minutes || '')
        setPreviewEntries((result.entries || []).map((e: any) => ({ ...e, selected: true })))
        setPreviewTasks((result.tasks || []).map((t: any) => ({ ...t, selected: !t.similarTo })))
        setPreviewResolvedTasks((result.resolvedTasks || []).map((rt: any) => ({ ...rt, selected: true })))
        // Update meeting with minutes
        setMeeting((prev) => (prev ? { ...prev, generatedMinutes: result.minutes, status: 'processed' } : null))
      }

      setStep('select')
    } catch (error: any) {
      console.error('Failed to process meeting:', error)
      const message = error?.message || 'Erro desconhecido ao processar reunião'
      setProcessError(message.includes('invalid JSON') ? t('errorInvalidJson') : t('errorProcessing', { message }))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveSelected = async () => {
    if (!meeting) return
    setIsSaving(true)
    try {
      const selectedE = previewEntries
        .filter((e) => e.selected)
        .map(({ text, type, action }) => ({ text, type, action }))

      const selectedT = previewTasks
        .filter((t) => t.selected)
        .map(({ title, description, assignee }) => ({ title, description, assignee }))

      const resolvedIds = previewResolvedTasks.filter((rt) => rt.selected).map((rt) => rt.taskId)

      const result = await window.electronAPI.saveSelectedMeetingItems(meeting.id, selectedE, selectedT, resolvedIds)
      setSavedEntryIds(result.entryIds || [])
      setSavedTaskIds(result.taskIds || [])
      setSavedResolvedTaskIds(result.resolvedTaskIds || [])
      setStep('saved')
    } catch (error) {
      console.error('Failed to save selected items:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyMinutes = async () => {
    if (generatedMinutes) {
      await navigator.clipboard.writeText(generatedMinutes)
    }
  }

  const handleDownloadMinutes = () => {
    if (!generatedMinutes || !meeting) return
    const blob = new Blob([generatedMinutes], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ata-${meeting.title.replace(/\s+/g, '-').toLowerCase()}-${new Date(meeting.startedAt).toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReprocess = async () => {
    if (!meeting) return
    setIsProcessing(true)
    try {
      const result = await window.electronAPI.processMeeting(meeting.id)
      if (result) {
        setGeneratedMinutes(result.minutes || '')
        setPreviewEntries((result.entries || []).map((e: any) => ({ ...e, selected: true })))
        setPreviewTasks((result.tasks || []).map((t: any) => ({ ...t, selected: !t.similarTo })))
      }
    } catch (error) {
      console.error('Failed to reprocess meeting:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleNewMeeting = () => {
    setMeeting(null)
    setStep('setup')
    setTitle('')
    setParticipantsInput('')
    setMeetingDate(new Date().toISOString().slice(0, 10))
    setTranscription('')
    setGeneratedMinutes('')
    setPreviewEntries([])
    setPreviewTasks([])
    setSavedEntryIds([])
    setSavedTaskIds([])
    setElapsed(0)
  }

  const handleDeleteMeeting = async () => {
    if (!meeting) return
    try {
      if (savedEntryIds.length > 0 || savedTaskIds.length > 0) {
        // Delete meeting + associated data that was created
        await window.electronAPI.deleteMeetingWithData(meeting.id, savedEntryIds, savedTaskIds)
      } else {
        // Just delete the meeting (nothing was saved yet)
        await window.electronAPI.deleteMeeting(meeting.id)
      }
      setShowDeleteConfirm(false)
      handleNewMeeting()
    } catch (error) {
      console.error('Failed to delete meeting:', error)
    }
  }

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const typeLabels: Record<string, string> = {
    information: t('typeInfo'),
    decision: t('typeDecision'),
    demand: t('typeDemand'),
    idea: t('typeIdea'),
    blocker: t('typeBlocker'),
    update: t('typeUpdate'),
  }

  return {
    onFinished,
    t,
    step,
    setStep,
    projects,
    meeting,
    title,
    setTitle,
    selectedProjectId,
    setSelectedProjectId,
    participantsInput,
    setParticipantsInput,
    meetingDate,
    setMeetingDate,
    suggestedAgenda,
    isPreparingAgenda,
    noteInput,
    setNoteInput,
    elapsed,
    noteInputRef,
    transcription,
    setTranscription,
    isProcessing,
    processError,
    generatedMinutes,
    previewEntries,
    previewTasks,
    setPreviewTasks,
    previewResolvedTasks,
    isSaving,
    savedEntryIds,
    savedTaskIds,
    showDeleteConfirm,
    setShowDeleteConfirm,
    userName,
    editingEntryIndex,
    setEditingEntryIndex,
    editingTaskIndex,
    setEditingTaskIndex,
    editingEntryTypeIndex,
    setEditingEntryTypeIndex,
    handlePrepareAgenda,
    handleCopyAgenda,
    handleStart,
    handleAddNote,
    handleEnd,
    handleProcess,
    handleSaveSelected,
    toggleEntry,
    toggleTask,
    selectAllEntries,
    selectAllTasks,
    toggleResolvedTask,
    selectAllResolvedTasks,
    updateEntryText,
    updateEntryType,
    updateTaskTitle,
    updateTaskDescription,
    handleCopyMinutes,
    handleDownloadMinutes,
    handleReprocess,
    handleNewMeeting,
    handleDeleteMeeting,
    formatTime,
    typeLabels,
  }
}

export type MeetingController = ReturnType<typeof useMeetingController>
