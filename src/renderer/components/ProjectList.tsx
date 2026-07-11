import React, { useState, useEffect, useRef } from 'react'
import { FolderOpen, Plus, Sparkles, Pencil, Check, X, Archive, ArchiveRestore, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Project {
  id: string
  name: string
  description?: string
  isAutoSuggested: boolean
  active: boolean
  entryCount?: number
}

interface ProjectListProps {
  onSelectProject: (projectId: string, projectName: string) => void
  onProjectsChanged?: () => void
}

export function ProjectList({ onSelectProject, onProjectsChanged }: ProjectListProps) {
  const { t } = useTranslation('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadProjects()
  }, [showInactive])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const loadProjects = async () => {
    const data = await window.electronAPI.getProjects(showInactive)
    setProjects(data)
  }

  const handleToggleActive = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    await window.electronAPI.setProjectActive(project.id, !project.active)
    await loadProjects()
    onProjectsChanged?.()
  }

  const handleCreateProject = async () => {
    const trimmed = newProjectName.trim()
    if (!trimmed) return

    setIsCreating(true)
    try {
      await window.electronAPI.createProject(trimmed)
      setNewProjectName('')
      setShowCreateInput(false)
      await loadProjects()
      onProjectsChanged?.()
    } finally {
      setIsCreating(false)
    }
  }

  const startEditing = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    setEditingId(project.id)
    setEditingName(project.name)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveEditing = async () => {
    const trimmed = editingName.trim()
    if (!trimmed || !editingId) {
      cancelEditing()
      return
    }

    await window.electronAPI.updateProject(editingId, { name: trimmed })
    setEditingId(null)
    setEditingName('')
    await loadProjects()
    onProjectsChanged?.()
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEditing()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  return (
    <div className="flex-col">
      <div className="panel-header">
        <span className="panel-title">{t('title')}</span>
        <div className="flex-row">
          <button
            className={`vscode-button secondary`}
            onClick={() => setShowInactive(!showInactive)}
            title={showInactive ? t('hideArchived') : t('showArchived')}
          >
            {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
            {showInactive ? t('hideArchived') : t('showArchived')}
          </button>
          <button
            className="vscode-button secondary"
            onClick={() => setShowCreateInput(!showCreateInput)}
          >
            <Plus size={14} />
            {t('newProject')}
          </button>
        </div>
      </div>

      {showCreateInput && (
        <div className="flex-row mb-16" style={{ maxWidth: 400 }}>
          <input
            type="text"
            className="vscode-input"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder={t('projectNamePlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            autoFocus
          />
          <button
            className="vscode-button"
            onClick={handleCreateProject}
            disabled={isCreating || !newProjectName.trim()}
          >
            {t('common:create')}
          </button>
          <button
            className="vscode-button secondary"
            onClick={() => { setShowCreateInput(false); setNewProjectName('') }}
          >
            {t('common:cancel')}
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={48} className="empty-state-icon" />
          <span className="empty-state-text">
            {t('emptyState')}
          </span>
        </div>
      ) : (
        <div className="flex-col gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="vscode-card"
              onClick={() => editingId !== project.id && onSelectProject(project.id, project.name)}
              style={{
                cursor: editingId === project.id ? 'default' : 'pointer',
                opacity: project.active ? 1 : 0.6,
              }}
            >
              <div className="vscode-card-header">
                <div className="flex-row">
                  <FolderOpen size={16} style={{ color: project.active ? 'var(--vscode-notificationsInfoIcon-foreground)' : 'var(--vscode-descriptionForeground)' }} />

                  {editingId === project.id ? (
                    <>
                      <input
                        ref={editInputRef}
                        type="text"
                        className="vscode-input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onBlur={saveEditing}
                        style={{ flex: 1, padding: '2px 6px', fontSize: 13 }}
                      />
                      <button
                        className="icon-button"
                        onClick={(e) => { e.stopPropagation(); saveEditing() }}
                        title={t('common:save')}
                      >
                        <Check size={14} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={(e) => { e.stopPropagation(); cancelEditing() }}
                        title={t('common:cancel')}
                      >
                        <X size={14} style={{ color: 'var(--vscode-errorForeground)' }} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 600, flex: 1 }}>{project.name}</span>
                      {!project.active && (
                        <span className="vscode-badge" style={{ opacity: 0.8 }}>
                          <Archive size={10} style={{ display: 'inline', marginRight: 2 }} />
                          {t('archived')}
                        </span>
                      )}
                      {project.isAutoSuggested && (
                        <span className="vscode-badge warning">
                          <Sparkles size={10} style={{ display: 'inline', marginRight: 2 }} />
                          {t('suggested')}
                        </span>
                      )}
                      <button
                        className="icon-button"
                        onClick={(e) => handleToggleActive(e, project)}
                        title={project.active ? t('archiveProject') : t('reactivateProject')}
                      >
                        {project.active ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                      </button>
                      <button
                        className="icon-button"
                        onClick={(e) => startEditing(e, project)}
                        title={t('renameProject')}
                      >
                        <Pencil size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {project.description && editingId !== project.id && (
                <div className="vscode-card-body" style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>
                  {project.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
