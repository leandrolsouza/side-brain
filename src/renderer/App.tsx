import React, { useState, useEffect } from 'react'
import { ActivityBar } from './components/ActivityBar'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { CaptureInput } from './components/CaptureInput'
import { ProjectList } from './components/ProjectList'
import { ProjectView } from './components/ProjectView'
import { ReviewInbox } from './components/ReviewInbox'
import { Settings } from './components/Settings'
import { GlobalSearch } from './components/GlobalSearch'
import { DailyDigest } from './components/DailyDigest'

export type View = 'dashboard' | 'capture' | 'projects' | 'entries' | 'review' | 'settings'

export function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProjectName, setSelectedProjectName] = useState<string>('')
  const [projectsRefreshKey, setProjectsRefreshKey] = useState(0)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [showDigest, setShowDigest] = useState(false)

  // Show Daily Digest on app start
  useEffect(() => {
    const digestKey = `digest-shown-${new Date().toISOString().slice(0, 10)}`
    const alreadyShown = sessionStorage.getItem(digestKey)
    if (!alreadyShown) {
      setShowDigest(true)
      sessionStorage.setItem(digestKey, 'true')
    }
  }, [])

  // Ctrl+K global shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const refreshProjects = () => {
    setProjectsRefreshKey((k) => k + 1)
  }

  const handleProjectSelect = (projectId: string, projectName: string) => {
    setSelectedProjectId(projectId)
    setSelectedProjectName(projectName)
    setCurrentView('entries')
  }

  const handleBackToProjects = () => {
    setSelectedProjectId(null)
    setSelectedProjectName('')
    setCurrentView('projects')
  }

  const getTabTitle = (): string => {
    switch (currentView) {
      case 'dashboard': return 'Visão Geral'
      case 'capture': return 'Captura Rápida'
      case 'projects': return 'Projetos'
      case 'entries': return selectedProjectName || 'Entradas'
      case 'review': return 'Revisão'
      case 'settings': return 'Configurações'
    }
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigateToProject={handleProjectSelect} />
      case 'capture':
        return <CaptureInput onProjectsChanged={refreshProjects} />
      case 'projects':
        return <ProjectList onSelectProject={handleProjectSelect} onProjectsChanged={refreshProjects} />
      case 'entries':
        return selectedProjectId ? (
          <ProjectView projectId={selectedProjectId} projectName={selectedProjectName} onBack={handleBackToProjects} />
        ) : (
          <ProjectList onSelectProject={handleProjectSelect} onProjectsChanged={refreshProjects} />
        )
      case 'review':
        return <ReviewInbox />
      case 'settings':
        return <Settings />
    }
  }

  return (
    <div className="workbench">
      {/* Title Bar */}
      <div className="titlebar">
        <span className="titlebar-text">Work Organizer</span>
      </div>

      {/* Body: Activity Bar + Sidebar + Editor */}
      <div className="workbench-body">
        <ActivityBar currentView={currentView} onViewChange={setCurrentView} />
        <Sidebar currentView={currentView} onViewChange={setCurrentView} onProjectSelect={handleProjectSelect} refreshKey={projectsRefreshKey} />

        {/* Editor Area */}
        <div className="editor-area">
          {/* Tabs */}
          <div className="tabs-bar">
            <div className="tab active">
              <span>{getTabTitle()}</span>
            </div>
          </div>

          {/* Content */}
          <div className="editor-content">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigateToProject={handleProjectSelect}
      />

      {/* Daily Digest Modal */}
      {showDigest && (
        <DailyDigest
          onClose={() => setShowDigest(false)}
          onNavigateToProject={handleProjectSelect}
        />
      )}

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-bar-item">
          <span>Work Organizer v0.1.0</span>
        </div>
        <div className="status-bar-right">
          <div className="status-bar-item">
            <span>AI: Claude Sonnet</span>
          </div>
        </div>
      </div>
    </div>
  )
}
