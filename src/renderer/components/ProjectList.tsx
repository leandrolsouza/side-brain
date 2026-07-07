import React, { useState, useEffect, useRef } from 'react'
import { FolderOpen, Plus, Sparkles, Pencil, Check, X } from 'lucide-react'

interface Project {
  id: string
  name: string
  description?: string
  isAutoSuggested: boolean
  entryCount?: number
}

interface ProjectListProps {
  onSelectProject: (projectId: string, projectName: string) => void
  onProjectsChanged?: () => void
}

export function ProjectList({ onSelectProject, onProjectsChanged }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const loadProjects = async () => {
    const data = await window.electronAPI.getProjects()
    setProjects(data)
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
        <span className="panel-title">Projetos</span>
        <button
          className="vscode-button secondary"
          onClick={() => setShowCreateInput(!showCreateInput)}
        >
          <Plus size={14} />
          Novo Projeto
        </button>
      </div>

      {showCreateInput && (
        <div className="flex-row mb-16" style={{ maxWidth: 400 }}>
          <input
            type="text"
            className="vscode-input"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nome do projeto..."
            onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            autoFocus
          />
          <button
            className="vscode-button"
            onClick={handleCreateProject}
            disabled={isCreating || !newProjectName.trim()}
          >
            Criar
          </button>
          <button
            className="vscode-button secondary"
            onClick={() => { setShowCreateInput(false); setNewProjectName('') }}
          >
            Cancelar
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={48} className="empty-state-icon" />
          <span className="empty-state-text">
            Nenhum projeto ainda. Crie um acima ou comece a digitar entradas — a IA vai sugerir projetos automaticamente.
          </span>
        </div>
      ) : (
        <div className="flex-col gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="vscode-card"
              onClick={() => editingId !== project.id && onSelectProject(project.id, project.name)}
              style={{ cursor: editingId === project.id ? 'default' : 'pointer' }}
            >
              <div className="vscode-card-header">
                <div className="flex-row">
                  <FolderOpen size={16} style={{ color: 'var(--vscode-notificationsInfoIcon-foreground)' }} />

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
                        title="Salvar"
                      >
                        <Check size={14} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={(e) => { e.stopPropagation(); cancelEditing() }}
                        title="Cancelar"
                      >
                        <X size={14} style={{ color: 'var(--vscode-errorForeground)' }} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 600, flex: 1 }}>{project.name}</span>
                      {project.isAutoSuggested && (
                        <span className="vscode-badge warning">
                          <Sparkles size={10} style={{ display: 'inline', marginRight: 2 }} />
                          sugerido
                        </span>
                      )}
                      <button
                        className="icon-button"
                        onClick={(e) => startEditing(e, project)}
                        title="Renomear projeto"
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
