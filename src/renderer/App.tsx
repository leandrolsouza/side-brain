import React, { useEffect, useState } from 'react'
import { ToastProvider } from './components/ToastContext'
import { ToastContainer } from './components/ToastContainer'
import { AppProvider, useApp } from './components/AppContext'
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
import { Reports } from './components/Reports'
import { AboutModal } from './components/AboutModal'
import { WorkspaceSwitcher } from './components/WorkspaceSwitcher'
import { SmartChat } from './components/SmartChat'
import { NotificationCenter } from './components/NotificationCenter'
import { ErrorCenter } from './components/ErrorCenter'
import { StatusBarErrorIndicator } from './components/StatusBarErrorIndicator'
import { CustomFieldsSettings } from './components/CustomFieldsSettings'
import { ConnectionGraph } from './components/ConnectionGraph'
import { UpdateNotification } from './components/UpdateNotification'
import { OnboardingFlow } from './components/OnboardingFlow'

export type View = 'dashboard' | 'capture' | 'projects' | 'entries' | 'meeting' | 'settings' | 'reports' | 'smart-chat' | 'error-center' | 'custom-fields' | 'connection-graph'
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

const FONT_FAMILY_STACKS: Record<string, string> = {
  'system-ui': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  'inter': '"Inter", system-ui, sans-serif',
  'segoe-ui': '"Segoe UI", system-ui, sans-serif',
  'roboto': '"Roboto", system-ui, sans-serif',
  'jetbrains-mono': '"JetBrains Mono", "Fira Code", monospace',
  'fira-code': '"Fira Code", "JetBrains Mono", monospace',
  'cascadia-code': '"Cascadia Code", "Fira Code", monospace',
  'georgia': 'Georgia, "Times New Roman", serif',
}

function AppContent() {
  const { state, dispatch, navigateToProject, navigateToMeeting, refreshProjects } = useApp()
  const { currentView, selectedProjectId, selectedProjectName, meetingProjectId, projectInitialTab, projectsRefreshKey, isSearchOpen, showDigest, showAbout, activeModelLabel, aiStatus, theme } = state
  const [appVersion, setAppVersion] = useState<string>('')
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const settings = await window.electronAPI.getSettings()
        setShowOnboarding(settings.onboardingCompleted !== 'true')
      } catch {
        setShowOnboarding(false)
      }
    }
    checkOnboarding()
  }, [])

  // Load app version
  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion)
  }, [])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('app-theme', theme)
    window.electronAPI.setNativeTheme(theme)
  }, [theme])

  // Track AI processing status via custom events
  useEffect(() => {
    const handleAiStart = () => dispatch({ type: 'SET_AI_STATUS', status: 'processing' })
    const handleAiEnd = () => dispatch({ type: 'SET_AI_STATUS', status: 'idle' })
    const handleAiError = () => {
      dispatch({ type: 'SET_AI_STATUS', status: 'error' })
      setTimeout(() => dispatch({ type: 'SET_AI_STATUS', status: 'idle' }), 3000)
    }
    window.addEventListener('ai:start', handleAiStart)
    window.addEventListener('ai:end', handleAiEnd)
    window.addEventListener('ai:error', handleAiError)
    return () => {
      window.removeEventListener('ai:start', handleAiStart)
      window.removeEventListener('ai:end', handleAiEnd)
      window.removeEventListener('ai:error', handleAiError)
    }
  }, [dispatch])

  // Show Daily Digest on app start (if enabled in settings)
  useEffect(() => {
    const checkDigest = async () => {
      const digestKey = `digest-shown-${new Date().toISOString().slice(0, 10)}`
      const alreadyShown = sessionStorage.getItem(digestKey)
      if (alreadyShown) return

      try {
        const data = await window.electronAPI.getSettings()
        if (data?.dailyDigestEnabled === 'false') return
      } catch { /* if settings fail, show digest anyway */ }

      dispatch({ type: 'SET_DIGEST_OPEN', open: true })
      sessionStorage.setItem(digestKey, 'true')
    }
    checkDigest()
  }, [dispatch])

  // Load active model from settings
  useEffect(() => {
    const loadModel = async () => {
      try {
        const data = await window.electronAPI.getSettings()
        const providerLabels: Record<string, string> = {
          bedrock: 'Bedrock',
          openai: 'OpenAI',
          gemini: 'Gemini',
          grok: 'Grok',
          local: 'Local',
        }
        const provider = providerLabels[data?.aiProvider || 'bedrock'] || 'Bedrock'

        if (data?.aiProvider === 'local') {
          const modelName = data.localModelId || 'LLM Local'
          dispatch({ type: 'SET_MODEL_LABEL', label: `${provider} · ${modelName}` })
        } else if (data?.aiProvider === 'openai') {
          const modelName = data.openaiModelId || 'gpt-4.1'
          dispatch({ type: 'SET_MODEL_LABEL', label: `${provider} · ${modelName}` })
        } else if (data?.aiProvider === 'gemini') {
          const modelName = data.geminiModelId || 'gemini-3.5-flash'
          dispatch({ type: 'SET_MODEL_LABEL', label: `${provider} · ${modelName}` })
        } else if (data?.aiProvider === 'grok') {
          const modelName = data.grokModelId || 'grok-4.3-latest'
          dispatch({ type: 'SET_MODEL_LABEL', label: `${provider} · ${modelName}` })
        } else if (data?.modelId) {
          dispatch({ type: 'SET_MODEL_LABEL', label: `${provider} · ${MODEL_LABELS[data.modelId] || data.modelId}` })
        }
        // Apply font settings
        const fontFamily = data?.fontFamily || 'system-ui'
        const fontSize = data?.fontSize || '14'
        const stack = FONT_FAMILY_STACKS[fontFamily] || FONT_FAMILY_STACKS['system-ui']
        document.documentElement.style.setProperty('--content-font-family', stack)
        document.documentElement.style.setProperty('--content-font-size', `${fontSize}px`)

        // Apply UI density
        const density = data?.uiDensity || 'comfortable'
        document.documentElement.setAttribute('data-density', density)

        // Store dateFormat for components to read
        const dateFormat = data?.dateFormat || 'DD/MM/YYYY'
        document.documentElement.setAttribute('data-date-format', dateFormat)
      } catch { /* ignore */ }
    }
    loadModel()
  }, [currentView, dispatch])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        dispatch({ type: 'SET_SEARCH_OPEN', open: true })
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        dispatch({ type: 'SET_VIEW', view: 'capture' })
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '7') {
        e.preventDefault()
        const viewMap: Record<string, View> = {
          '1': 'dashboard',
          '2': 'capture',
          '3': 'projects',
          '4': 'meeting',
          '5': 'reports',
          '6': 'smart-chat',
          '7': 'error-center',
        }
        const view = viewMap[e.key]
        if (view) dispatch({ type: 'SET_VIEW', view })
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch])

  const handleBackToProjects = () => {
    dispatch({ type: 'BACK_TO_PROJECTS' })
  }

  const getTabTitle = (): string => {
    switch (currentView) {
      case 'dashboard': return 'Visão Geral'
      case 'capture': return 'Captura Rápida'
      case 'projects': return 'Projetos'
      case 'entries': return selectedProjectName || 'Entradas'
      case 'meeting': return 'Reunião'
      case 'settings': return 'Configurações'
      case 'reports': return 'Métricas & Relatórios'
      case 'smart-chat': return 'Chat Inteligente'
      case 'error-center': return 'Central de Erros'
      case 'custom-fields': return 'Campos Personalizados'
      case 'connection-graph': return 'Mapa de Conexões'
    }
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigateToProject={navigateToProject} />
      case 'capture':
        return <CaptureInput onProjectsChanged={refreshProjects} />
      case 'projects':
        return <ProjectList onSelectProject={navigateToProject} onProjectsChanged={refreshProjects} />
      case 'entries':
        return selectedProjectId ? (
          <ProjectView projectId={selectedProjectId} projectName={selectedProjectName} initialTab={projectInitialTab} onBack={handleBackToProjects} onNavigateToMeeting={navigateToMeeting} />
        ) : (
          <ProjectList onSelectProject={navigateToProject} onProjectsChanged={refreshProjects} />
        )
      case 'meeting':
        return <MeetingMode projectId={meetingProjectId} onFinished={(projId) => {
          if (projId) {
            dispatch({ type: 'SELECT_PROJECT', projectId: projId, projectName: '' })
            dispatch({ type: 'SET_PROJECT_TAB', tab: 'kanban' })
            window.electronAPI.getProjects().then((projects) => {
              const found = projects.find((p: any) => p.id === projId)
              if (found) dispatch({ type: 'SET_SELECTED_PROJECT_NAME', name: found.name })
            })
          } else {
            dispatch({ type: 'SET_VIEW', view: 'dashboard' })
          }
        }} />
      case 'settings':
        return <Settings />
      case 'reports':
        return <Reports />
      case 'smart-chat':
        return <SmartChat />
      case 'error-center':
        return <ErrorCenter />
      case 'custom-fields':
        return <CustomFieldsSettings />
      case 'connection-graph':
        return <ConnectionGraph />
    }
  }

  // Show nothing while checking onboarding status
  if (showOnboarding === null) {
    return <div className="onboarding-loading" />
  }

  // Show onboarding flow for first-time users
  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
  }

  return (
    <div className="workbench">
      {/* Title Bar */}
      <div className="titlebar">
        <span className="titlebar-text">SideBrain</span>
      </div>

      {/* Body: Activity Bar + Sidebar + Editor */}
      <div className="workbench-body">
        <ActivityBar currentView={currentView} onViewChange={(v) => dispatch({ type: 'SET_VIEW', view: v })} theme={theme} onThemeChange={(t) => dispatch({ type: 'SET_THEME', theme: t })} onAboutClick={() => dispatch({ type: 'SET_ABOUT_OPEN', open: true })} />
        <Sidebar currentView={currentView} onViewChange={(v) => dispatch({ type: 'SET_VIEW', view: v })} onProjectSelect={navigateToProject} refreshKey={projectsRefreshKey} />

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
        onClose={() => dispatch({ type: 'SET_SEARCH_OPEN', open: false })}
        onNavigateToProject={navigateToProject}
      />

      {/* Daily Digest Modal */}
      {showDigest && (
        <DailyDigest
          onClose={() => dispatch({ type: 'SET_DIGEST_OPEN', open: false })}
          onNavigateToProject={navigateToProject}
        />
      )}

      {/* About Modal */}
      <AboutModal isOpen={showAbout} onClose={() => dispatch({ type: 'SET_ABOUT_OPEN', open: false })} />

      {/* Status Bar */}
      <div className="status-bar">
        <WorkspaceSwitcher />
        <div className="status-bar-item">
          <span>SideBrain v{appVersion}</span>
        </div>
        <div className="status-bar-right">
          <StatusBarErrorIndicator onClick={() => dispatch({ type: 'SET_VIEW', view: 'error-center' })} />
          <NotificationCenter />
          <UpdateNotification />
          <div className="status-bar-item ai-status-indicator" title={aiStatus === 'processing' ? 'IA processando...' : aiStatus === 'error' ? 'Erro na IA' : 'IA conectada'}>
            <span className={`ai-status-dot ${aiStatus}`} />
            <span>{aiStatus === 'processing' ? 'IA processando...' : 'AI: ' + activeModelLabel}</span>
            {aiStatus === 'processing' && <span className="ai-status-progress" />}
          </div>
          <div className="status-bar-item clickable" onClick={() => dispatch({ type: 'SET_VIEW', view: 'settings' })} title="Clique para alterar o provedor de IA">
            <span>⚙</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
      <ToastContainer />
    </ToastProvider>
  )
}
