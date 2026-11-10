import { useState } from 'react'
import type { ProcessedEntry, ProcessedTask, ResolvedTask } from './meeting-types'

export function useMeetingPreview() {
  // Selection step
  const [generatedMinutes, setGeneratedMinutes] = useState('')
  const [previewEntries, setPreviewEntries] = useState<ProcessedEntry[]>([])
  const [previewTasks, setPreviewTasks] = useState<ProcessedTask[]>([])
  const [previewResolvedTasks, setPreviewResolvedTasks] = useState<ResolvedTask[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [savedEntryIds, setSavedEntryIds] = useState<string[]>([])
  const [savedTaskIds, setSavedTaskIds] = useState<string[]>([])
  const [savedResolvedTaskIds, setSavedResolvedTaskIds] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [userName, setUserName] = useState('')
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null)
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null)
  const [editingEntryTypeIndex, setEditingEntryTypeIndex] = useState<number | null>(null)

  const toggleEntry = (index: number) => {
    setPreviewEntries((prev) => prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e)))
  }

  const toggleTask = (index: number) => {
    setPreviewTasks((prev) => prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t)))
  }

  const selectAllEntries = (value: boolean) => {
    setPreviewEntries((prev) => prev.map((e) => ({ ...e, selected: value })))
  }

  const selectAllTasks = (value: boolean) => {
    setPreviewTasks((prev) => prev.map((t) => ({ ...t, selected: value })))
  }

  const toggleResolvedTask = (index: number) => {
    setPreviewResolvedTasks((prev) => prev.map((rt, i) => (i === index ? { ...rt, selected: !rt.selected } : rt)))
  }

  const selectAllResolvedTasks = (value: boolean) => {
    setPreviewResolvedTasks((prev) => prev.map((rt) => ({ ...rt, selected: value })))
  }

  const updateEntryText = (index: number, text: string) => {
    setPreviewEntries((prev) => prev.map((e, i) => (i === index ? { ...e, text } : e)))
  }

  const updateEntryType = (index: number, type: string) => {
    setPreviewEntries((prev) => prev.map((e, i) => (i === index ? { ...e, type } : e)))
    setEditingEntryTypeIndex(null)
  }

  const updateTaskTitle = (index: number, title: string) => {
    setPreviewTasks((prev) => prev.map((t, i) => (i === index ? { ...t, title } : t)))
  }

  const updateTaskDescription = (index: number, description: string) => {
    setPreviewTasks((prev) => prev.map((t, i) => (i === index ? { ...t, description } : t)))
  }

  return {
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
    savedResolvedTaskIds,
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
  }
}
