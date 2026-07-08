import React, { useState, useEffect } from 'react'
import { ChevronDown, FolderOpen, PenLine, Sparkles } from 'lucide-react'
import type { View } from '../App'

interface Project {
  id: string
  name: string
  description?: string
  isAutoSuggested: boolean
  entryCount?: number
}

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  onProjectSelect: (projectId: string, projectName: string) => void
  refreshKey: number
}

export function Sidebar({ currentView, onViewChange, onProjectSelect, refreshKey }: SidebarProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    projects: true,
    quickActions: true,
  })

  useEffect(() => {
    loadProjects()
  }, [refreshKey])

  const loadProjects = async () => {
    const data = await window.electronAPI.getProjects()
    setProjects(data)
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const getSidebarTitle = (): string => {
    switch (currentView) {
      case 'dashboard': return 'Dashboard'
      case 'capture': return 'Captura'
      case 'projects':
      case 'entries': return 'Explorer'
      case 'meeting': return 'Reunião'
      case 'settings': return 'Configurações'
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        {getSidebarTitle()}
      </div>

      <div className="sidebar-content">
        {/* Quick Actions Section */}
        <div className="sidebar-section">
          <div
            className="sidebar-section-header"
            onClick={() => toggleSection('quickActions')}
          >
            <ChevronDown
              size={16}
              className={`chevron ${!expandedSections.quickActions ? 'collapsed' : ''}`}
            />
            Ações Rápidas
          </div>
          {expandedSections.quickActions && (
            <div className="sidebar-section-body">
              <div
                className={`tree-item ${currentView === 'capture' ? 'selected' : ''}`}
                onClick={() => onViewChange('capture')}
              >
                <PenLine size={16} className="tree-item-icon" />
                <span className="tree-item-label">Nova Captura</span>
              </div>
            </div>
          )}
        </div>

        {/* Projects Section */}
        <div className="sidebar-section">
          <div
            className="sidebar-section-header"
            onClick={() => toggleSection('projects')}
          >
            <ChevronDown
              size={16}
              className={`chevron ${!expandedSections.projects ? 'collapsed' : ''}`}
            />
            Projetos
          </div>
          {expandedSections.projects && (
            <div className="sidebar-section-body">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="tree-item"
                  onClick={() => onProjectSelect(project.id, project.name)}
                >
                  <FolderOpen size={16} className="tree-item-icon" />
                  <span className="tree-item-label">{project.name}</span>
                  {project.isAutoSuggested && (
                    <Sparkles size={12} className="tree-item-icon" style={{ color: 'var(--vscode-notificationsWarningIcon-foreground)' }} />
                  )}
                </div>
              ))}
              {projects.length === 0 && (
                <div className="tree-item" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  <span className="tree-item-label">Nenhum projeto</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
