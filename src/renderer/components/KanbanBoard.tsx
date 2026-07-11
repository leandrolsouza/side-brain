import React, { useState, useEffect } from 'react'
import { Plus, GripVertical, Trash2, ChevronRight, Calendar, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  assignee?: string | null
  dueDate?: string | null
  sourceEntryId?: string
  createdAt: string
  updatedAt: string
}

type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'done'

interface KanbanBoardProps {
  projectId: string
}

const COLUMN_STATUSES: { status: TaskStatus; color: string }[] = [
  { status: 'todo', color: 'var(--vscode-notificationsInfoIcon-foreground)' },
  { status: 'in_progress', color: 'var(--vscode-notificationsWarningIcon-foreground)' },
  { status: 'waiting', color: '#c586c0' },
  { status: 'done', color: 'var(--vscode-testing-iconPassed)' },
]

const COLUMN_LABEL_KEYS: Record<TaskStatus, string> = {
  todo: 'kanban.todo',
  in_progress: 'kanban.inProgress',
  waiting: 'kanban.waiting',
  done: 'kanban.done',
}

export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const { t, i18n } = useTranslation('projects')
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingInColumn, setAddingInColumn] = useState<TaskStatus | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDueDateTaskId, setEditingDueDateTaskId] = useState<string | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  useEffect(() => {
    loadTasks()
  }, [projectId])

  const loadTasks = async () => {
    const data = await window.electronAPI.getTasksByProject(projectId)
    setTasks(data)
  }

  const handleCreateTask = async (status: TaskStatus) => {
    const trimmed = newTaskTitle.trim()
    if (!trimmed) return

    await window.electronAPI.createTask({
      projectId,
      title: trimmed,
    })
    // If created in a column other than todo, update status
    if (status !== 'todo') {
      const allTasks = await window.electronAPI.getTasksByProject(projectId)
      const created = allTasks[allTasks.length - 1]
      if (created) {
        await window.electronAPI.updateTask(created.id, { status })
      }
    }
    setNewTaskTitle('')
    setAddingInColumn(null)
    await loadTasks()
  }

  const handleMoveTask = async (taskId: string, newStatus: TaskStatus) => {
    await window.electronAPI.updateTask(taskId, { status: newStatus })
    await loadTasks()
  }

  const handleDeleteTask = async (taskId: string) => {
    await window.electronAPI.deleteTask(taskId)
    await loadTasks()
  }

  const handleEditSave = async (taskId: string) => {
    const trimmed = editingTitle.trim()
    if (trimmed) {
      await window.electronAPI.updateTask(taskId, { title: trimmed })
      await loadTasks()
    }
    setEditingTaskId(null)
    setEditingTitle('')
  }

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingTitle(task.title)
  }

  const handleDueDateChange = async (taskId: string, dateValue: string) => {
    const dueDate = dateValue || null
    await window.electronAPI.updateTask(taskId, { dueDate })
    setEditingDueDateTaskId(null)
    await loadTasks()
  }

  const getDueDateInfo = (dueDate: string | null | undefined): { label: string; className: string } | null => {
    if (!dueDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDate + 'T00:00:00')
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    const formatted = due.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' })

    if (diffDays < 0) return { label: `${formatted} (${t('kanban.overdue')})`, className: 'due-overdue' }
    if (diffDays === 0) return { label: `${formatted} (${t('kanban.today')})`, className: 'due-today' }
    if (diffDays === 1) return { label: `${formatted} (${t('kanban.tomorrow')})`, className: 'due-tomorrow' }
    if (diffDays <= 7) return { label: `${formatted} (${diffDays}d)`, className: 'due-soon' }
    return { label: formatted, className: 'due-normal' }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) {
      await handleMoveTask(taskId, targetStatus)
    }
    setDraggedTaskId(null)
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
  }

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status)

  const getNextStatuses = (current: TaskStatus): TaskStatus[] => {
    switch (current) {
      case 'todo': return ['in_progress', 'waiting']
      case 'in_progress': return ['waiting', 'done']
      case 'waiting': return ['in_progress', 'done']
      case 'done': return ['todo']
    }
  }

  return (
    <div className="kanban-board">
      {COLUMN_STATUSES.map((column) => {
        const columnTasks = getTasksByStatus(column.status)
        const columnLabel = t(COLUMN_LABEL_KEYS[column.status])
        return (
          <div
            key={column.status}
            className={`kanban-column ${draggedTaskId ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            <div className="kanban-column-header">
              <span className="kanban-column-dot" style={{ background: column.color }} />
              <span className="kanban-column-title">{columnLabel}</span>
              <span className="kanban-column-count">{columnTasks.length}</span>
              <button
                className="icon-button"
                onClick={() => setAddingInColumn(column.status)}
                title={t('kanban.addTask')}
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="kanban-column-body">
              {addingInColumn === column.status && (
                <div className="kanban-card kanban-card-new">
                  <input
                    type="text"
                    className="vscode-input"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateTask(column.status)
                      if (e.key === 'Escape') { setAddingInColumn(null); setNewTaskTitle('') }
                    }}
                    onBlur={() => { setAddingInColumn(null); setNewTaskTitle('') }}
                    placeholder={t('kanban.taskPlaceholder')}
                    autoFocus
                  />
                </div>
              )}

              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  className={`kanban-card ${draggedTaskId === task.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="kanban-card-grip">
                    <GripVertical size={12} />
                  </div>

                  <div className="kanban-card-content">
                    {editingTaskId === task.id ? (
                      <input
                        type="text"
                        className="vscode-input"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(task.id)
                          if (e.key === 'Escape') { setEditingTaskId(null); setEditingTitle('') }
                        }}
                        onBlur={() => handleEditSave(task.id)}
                        autoFocus
                        style={{ fontSize: 12, padding: '2px 4px' }}
                      />
                    ) : (
                      <span
                        className="kanban-card-title"
                        onDoubleClick={() => startEditing(task)}
                      >
                        {task.title}
                      </span>
                    )}
                    {task.description && (
                      <span className="kanban-card-description">{task.description}</span>
                    )}

                    {/* Due date display / edit */}
                    {editingDueDateTaskId === task.id ? (
                      <input
                        type="date"
                        className="vscode-input kanban-due-input"
                        defaultValue={task.dueDate || ''}
                        onChange={(e) => handleDueDateChange(task.id, e.target.value)}
                        onBlur={() => setEditingDueDateTaskId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingDueDateTaskId(null)
                        }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`kanban-card-due ${getDueDateInfo(task.dueDate)?.className || ''}`}
                        onClick={() => setEditingDueDateTaskId(task.id)}
                        title={t('kanban.setDueDate')}
                      >
                        <Calendar size={10} />
                        {getDueDateInfo(task.dueDate)?.label || t('kanban.noDueDate')}
                      </span>
                    )}

                    {/* Assignee */}
                    {task.assignee && (
                      <span className="kanban-card-assignee">
                        <User size={10} />
                        {task.assignee}
                      </span>
                    )}
                  </div>

                  <div className="kanban-card-actions">
                    {getNextStatuses(task.status).map((nextStatus) => (
                      <button
                        key={nextStatus}
                        className="icon-button"
                        onClick={() => handleMoveTask(task.id, nextStatus)}
                        title={t('kanban.moveTo', { column: t(COLUMN_LABEL_KEYS[nextStatus]) })}
                      >
                        <ChevronRight size={12} />
                      </button>
                    ))}
                    <button
                      className="icon-button"
                      onClick={() => handleDeleteTask(task.id)}
                      title={t('kanban.deleteTask')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {columnTasks.length === 0 && !addingInColumn && (
                <div className="kanban-empty">{t('kanban.empty')}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
