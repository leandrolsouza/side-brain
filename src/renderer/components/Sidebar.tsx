import React, { useState, useEffect } from 'react'
import { ChevronDown, FolderOpen, PenLine, Video, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

const PROJECT_COLORS = [
  '#4fc1ff', // cyan
  '#c586c0', // purple
  '#6abf69', // green
  '#e8a63b', // amber
  '#f48771', // coral
  '#75beff', // blue
  '#dcdcaa', // gold
  '#9cdcfe', // light blue
  '#ce9178', // peach
  '#b5cea8', // lime
]

function getProjectColor(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length]
}

export function Sidebar({ currentView, onViewChange, onProjectSelect, refreshKey }: SidebarProps) {
  const { t } = useTranslation('common')
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
      case 'dashboard': return t('sidebar.dashboard')
      case 'capture': return t('sidebar.capture')
      case 'projects':
      case 'entries': return t('sidebar.explorer')
      case 'meeting': return t('sidebar.meeting')
      case 'settings': return t('sidebar.settings')
      case 'agents': return 'Agentes'
      default: return ''
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
            {t('sidebar.quickActions')}
          </div>
          {expandedSections.quickActions && (
            <div className="sidebar-section-body">
              <div
                className={`tree-item ${currentView === 'capture' ? 'selected' : ''}`}
                onClick={() => onViewChange('capture')}
              >
                <PenLine size={16} className="tree-item-icon" />
                <span className="tree-item-label">{t('sidebar.newCapture')}</span>
              </div>
              <div
                className={`tree-item ${currentView === 'meeting' ? 'selected' : ''}`}
                onClick={() => onViewChange('meeting')}
              >
                <Video size={16} className="tree-item-icon" />
                <span className="tree-item-label">{t('sidebar.newMeeting')}</span>
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
            {t('sidebar.projects')}
          </div>
          {expandedSections.projects && (
            <div className="sidebar-section-body">
              {projects.map((project, index) => (
                <div
                  key={project.id}
                  className="tree-item"
                  onClick={() => onProjectSelect(project.id, project.name)}
                >
                  <span className="project-color-dot" style={{ background: getProjectColor(index) }} />
                  <FolderOpen size={16} className="tree-item-icon" style={{ color: getProjectColor(index) }} />
                  <span className="tree-item-label">{project.name}</span>
                  {project.isAutoSuggested && (
                    <Sparkles size={12} className="tree-item-icon" style={{ color: 'var(--vscode-notificationsWarningIcon-foreground)' }} />
                  )}
                </div>
              ))}
              {projects.length === 0 && (
                <div className="tree-item" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  <span className="tree-item-label">{t('sidebar.noProjects')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
