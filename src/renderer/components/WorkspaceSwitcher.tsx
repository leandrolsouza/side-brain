import React, { useState, useEffect, useRef } from 'react'
import { Briefcase, Plus, ChevronDown, Pencil, Trash2, FolderOpen, Check, X } from 'lucide-react'
import type { Workspace } from '../../shared/types'

interface WorkspaceSwitcherProps {
  onWorkspaceChanged?: () => void
}

const EMOJI_OPTIONS = ['🏢', '🏠', '💼', '🎯', '🚀', '📚', '🎨', '🔬', '💡', '🌐', '⚡', '🛠️']

export function WorkspaceSwitcher({ onWorkspaceChanged }: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('💼')
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [switching, setSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadWorkspaces()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsCreating(false)
        setIsEditing(null)
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Ctrl+Shift+W shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'W') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadWorkspaces = async () => {
    const [list, active] = await Promise.all([
      window.electronAPI.getWorkspaces(),
      window.electronAPI.getActiveWorkspace(),
    ])
    setWorkspaces(list)
    setActiveWorkspace(active)
  }

  const handleSwitch = async (workspaceId: string) => {
    if (workspaceId === activeWorkspace?.id) {
      setIsOpen(false)
      return
    }
    setSwitching(true)
    const result = await window.electronAPI.switchWorkspace(workspaceId)
    if (!result.success) {
      setSwitching(false)
      alert(result.error || 'Erro ao trocar workspace')
    }
    // On success, the window reloads automatically
  }

  const handleCreate = async () => {
    if (!newName.trim()) return

    const folderPath = await window.electronAPI.selectWorkspaceFolder()
    if (!folderPath) return

    await window.electronAPI.createWorkspace({
      name: newName.trim(),
      emoji: newEmoji,
      databasePath: folderPath,
    })

    setNewName('')
    setNewEmoji('💼')
    setIsCreating(false)
    await loadWorkspaces()
    onWorkspaceChanged?.()
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return

    await window.electronAPI.updateWorkspace(id, {
      name: editName.trim(),
      emoji: editEmoji,
    })

    setIsEditing(null)
    await loadWorkspaces()
    onWorkspaceChanged?.()
  }

  const handleDelete = async (id: string) => {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) return

    const confirmed = confirm(`Remover workspace "${ws.name}"?\n\nO arquivo de dados NÃO será apagado.`)
    if (!confirmed) return

    const result = await window.electronAPI.deleteWorkspace(id)
    if (!result.success) {
      alert(result.error || 'Erro ao remover workspace')
      return
    }

    await loadWorkspaces()
    onWorkspaceChanged?.()
  }

  const startEditing = (ws: Workspace) => {
    setIsEditing(ws.id)
    setEditName(ws.name)
    setEditEmoji(ws.emoji)
  }

  if (!activeWorkspace) return null

  return (
    <div className="workspace-switcher" ref={dropdownRef}>
      <button
        className="workspace-switcher-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        title="Trocar workspace (Ctrl+Shift+W)"
      >
        <span className="workspace-emoji">{activeWorkspace.emoji}</span>
        <span className="workspace-name">{activeWorkspace.name}</span>
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className="workspace-dropdown">
          <div className="workspace-dropdown-header">
            <Briefcase size={14} />
            <span>Workspaces</span>
          </div>

          <div className="workspace-list">
            {workspaces.map((ws) => (
              <div key={ws.id} className={`workspace-item ${ws.id === activeWorkspace.id ? 'active' : ''}`}>
                {isEditing === ws.id ? (
                  <div className="workspace-edit-form">
                    <div className="workspace-edit-row">
                      <button
                        className="emoji-picker-btn"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      >
                        {editEmoji}
                      </button>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="workspace-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(ws.id)
                          if (e.key === 'Escape') setIsEditing(null)
                        }}
                      />
                      <button className="workspace-btn-icon" onClick={() => handleUpdate(ws.id)} title="Salvar">
                        <Check size={14} />
                      </button>
                      <button className="workspace-btn-icon" onClick={() => setIsEditing(null)} title="Cancelar">
                        <X size={14} />
                      </button>
                    </div>
                    {showEmojiPicker && (
                      <div className="emoji-grid">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            className={`emoji-option ${editEmoji === emoji ? 'selected' : ''}`}
                            onClick={() => { setEditEmoji(emoji); setShowEmojiPicker(false) }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      className="workspace-item-main"
                      onClick={() => handleSwitch(ws.id)}
                    >
                      <span className="workspace-emoji">{ws.emoji}</span>
                      <span className="workspace-item-name">{ws.name}</span>
                      {ws.id === activeWorkspace.id && <Check size={12} className="workspace-check" />}
                    </button>
                    <div className="workspace-item-actions">
                      <button className="workspace-btn-icon" onClick={() => startEditing(ws)} title="Editar">
                        <Pencil size={12} />
                      </button>
                      {workspaces.length > 1 && (
                        <button className="workspace-btn-icon danger" onClick={() => handleDelete(ws.id)} title="Remover">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {isCreating ? (
            <div className="workspace-create-form">
              <div className="workspace-edit-row">
                <button
                  className="emoji-picker-btn"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  {newEmoji}
                </button>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome do workspace"
                  className="workspace-input"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') setIsCreating(false)
                  }}
                />
                <button className="workspace-btn-icon" onClick={handleCreate} title="Criar e escolher pasta">
                  <FolderOpen size={14} />
                </button>
                <button className="workspace-btn-icon" onClick={() => setIsCreating(false)} title="Cancelar">
                  <X size={14} />
                </button>
              </div>
              {showEmojiPicker && (
                <div className="emoji-grid">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      className={`emoji-option ${newEmoji === emoji ? 'selected' : ''}`}
                      onClick={() => { setNewEmoji(emoji); setShowEmojiPicker(false) }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button className="workspace-add-btn" onClick={() => setIsCreating(true)}>
              <Plus size={14} />
              <span>Novo workspace</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
