import React, { useState, useEffect } from 'react'
import { ActivityBar } from './components/ActivityBar'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { CaptureInput } from './components/CaptureInput'
import { ProjectList } from './components/ProjectList'
import { ProjectView } from './components/ProjectView'
import { MeetingMode } from './components/MeetingMode'
import { Settings } from './components/Settings'
import { GlobalSearch } from './components/GlobalSearch'
import { DailyDigest } from './components/DailyDigest'
import { AIUsageDashboard } from './components/AIUsageDashboard'
import { AboutModal } from './components/AboutModal'
import { WorkspaceSwitcher } from './components/WorkspaceSwitcher'

export type View = 'dashboard' | 'capture' | 'projects' | 'entries' | 'meeting' | 'settings' | 'ai-usage'
export type Theme = 'dark' | 'light'

const MODEL_LABELS: Record<string, string> = {
  'us.anthropic.claude-sonnet-5': 'Claude Sonnet 5',
  'us.anthropic.claude-sonnet-4-20250514-v1:0': 'Claude Sonnet 4',
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': 'Claude Haiku 4.5',
  'us.amazon.nova-2-lite-v1:0': 'Nova 2 Lite',
  'us.amazon.nova-pro-v1:0': 'Nova Pro',
  'us.amazon.nova-lite-v1:0': 'Nova Lite',
  'us.amazon.nova-micro-v1:0': 'Nova Micro',
}

export function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProjectName, setSelectedProjectName] = useState<string>('')
  const [projectsRefreshKey, setProjectsRefreshKey] = useState(0)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [showDigest, setShowDigest] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [activeModelLabel, setActiveModelLabel] = useState<string>('Claude Sonnet 4')
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('app-theme') as Theme) || 'dark'
  })

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('app-theme', theme)
  }, [theme])

  // Show Daily Digest on app start
  useEffect(() => {
    const digestKey = `digest-shown-${new Date().toISOString().slice(0, 10)}`
    const alreadyShown = sessionStorage.getItem(digestKey)
    if (!alreadyShown) {
      setShowDigest(true)
      sessionStorage.setItem(digestKey, 'true')
    }
  }, [])

  // Load active model from settings
  useEffect(() => {
    const loadModel = async () => {
      try {
        const data = await window.electronAPI.getSettings()
        if (data?.aiProvider === 'local') {
          const modelName = data.localModelId || 'LLM Local'
          setActiveModelLabel(`Local: ${modelName}`)
        } else if (data?.modelId) {
          setActiveModelLabel(MODEL_LABELS[data.modelId] || data.modelId)
        }
      } catch { /* ignore */ }
    }
    loadModel()
  }, [currentView])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K → global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
        return
      }
      // Ctrl+N → nova captura
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        setCurrentView('capture')
        return
      }
      // Ctrl+1/2/3/4/5 → navegar entre views
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
        e.preventDefault()
        const viewMap: Record<string, View> = {
          '1': 'dashboard',
          '2': 'capture',
          '3': 'projects',
          '4': 'meeting',
          '5': 'ai-usage',
        }
        const view = viewMap[e.key]
        if (view) setCurrentView(view)
        return
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
      case 'meeting': return 'Reunião'
      case 'settings': return 'Configurações'
      case 'ai-usage': return 'Uso da IA'
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
      case 'meeting':
        return <MeetingMode onFinished={() => setCurrentView('dashboard')} />
      case 'settings':
        return <Settings />
      case 'ai-usage':
        return <AIUsageDashboard />
    }
  }

  return (
    <div className="workbench">
      {/* Title Bar */}
      <div className="titlebar">
        <span className="titlebar-text">SideBrain</span>
      </div>

      {/* Body: Activity Bar + Sidebar + Editor */}
      <div className="workbench-body">
        <ActivityBar currentView={currentView} onViewChange={setCurrentView} theme={theme} onThemeChange={setTheme} onAboutClick={() => setShowAbout(true)} />
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

      {/* About Modal */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />

      {/* Status Bar */}
      <div className="status-bar">
        <WorkspaceSwitcher />
        <div className="status-bar-item">
          <span>SideBrain v0.1.0</span>
        </div>
        <div className="status-bar-right">
          <div className="status-bar-item clickable" onClick={() => setCurrentView('settings')} title="Clique para alterar o provedor de IA">
            <span>AI: {activeModelLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
