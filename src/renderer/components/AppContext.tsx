import React, { createContext, useContext, useReducer, useCallback } from 'react'
import type { View, Theme } from '../App'

// === State ===

export interface AppState {
  currentView: View
  selectedProjectId: string | null
  selectedProjectName: string
  meetingProjectId: string | undefined
  projectInitialTab: 'entries' | 'kanban' | 'meetings' | undefined
  projectsRefreshKey: number
  isSearchOpen: boolean
  showDigest: boolean
  showAbout: boolean
  activeModelLabel: string
  aiStatus: 'idle' | 'processing' | 'error'
  theme: Theme
}

export const initialState: AppState = {
  currentView: 'dashboard',
  selectedProjectId: null,
  selectedProjectName: '',
  meetingProjectId: undefined,
  projectInitialTab: undefined,
  projectsRefreshKey: 0,
  isSearchOpen: false,
  showDigest: false,
  showAbout: false,
  activeModelLabel: 'Claude Sonnet 4',
  aiStatus: 'idle',
  theme: (localStorage.getItem('app-theme') as Theme) || 'dark',
}

// === Actions ===

export type AppAction =
  | { type: 'SET_VIEW'; view: View }
  | { type: 'SELECT_PROJECT'; projectId: string; projectName: string }
  | { type: 'NAVIGATE_TO_MEETING'; projectId?: string }
  | { type: 'BACK_TO_PROJECTS' }
  | { type: 'SET_PROJECT_TAB'; tab: 'entries' | 'kanban' | 'meetings' | undefined }
  | { type: 'REFRESH_PROJECTS' }
  | { type: 'SET_SEARCH_OPEN'; open: boolean }
  | { type: 'SET_DIGEST_OPEN'; open: boolean }
  | { type: 'SET_ABOUT_OPEN'; open: boolean }
  | { type: 'SET_MODEL_LABEL'; label: string }
  | { type: 'SET_AI_STATUS'; status: 'idle' | 'processing' | 'error' }
  | { type: 'SET_THEME'; theme: Theme }
  | { type: 'SET_SELECTED_PROJECT_NAME'; name: string }

// === Reducer ===

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.view }
    case 'SELECT_PROJECT':
      return {
        ...state,
        selectedProjectId: action.projectId,
        selectedProjectName: action.projectName,
        projectInitialTab: undefined,
        currentView: 'entries',
      }
    case 'NAVIGATE_TO_MEETING':
      return { ...state, meetingProjectId: action.projectId, currentView: 'meeting' }
    case 'BACK_TO_PROJECTS':
      return { ...state, selectedProjectId: null, selectedProjectName: '', currentView: 'projects' }
    case 'SET_PROJECT_TAB':
      return { ...state, projectInitialTab: action.tab }
    case 'REFRESH_PROJECTS':
      return { ...state, projectsRefreshKey: state.projectsRefreshKey + 1 }
    case 'SET_SEARCH_OPEN':
      return { ...state, isSearchOpen: action.open }
    case 'SET_DIGEST_OPEN':
      return { ...state, showDigest: action.open }
    case 'SET_ABOUT_OPEN':
      return { ...state, showAbout: action.open }
    case 'SET_MODEL_LABEL':
      return { ...state, activeModelLabel: action.label }
    case 'SET_AI_STATUS':
      return { ...state, aiStatus: action.status }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SET_SELECTED_PROJECT_NAME':
      return { ...state, selectedProjectName: action.name }
    default:
      return state
  }
}

// === Context ===

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  // Convenience actions for components
  navigateToProject: (projectId: string, projectName: string) => void
  navigateToMeeting: (projectId?: string) => void
  refreshProjects: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  const navigateToProject = useCallback((projectId: string, projectName: string) => {
    dispatch({ type: 'SELECT_PROJECT', projectId, projectName })
  }, [])

  const navigateToMeeting = useCallback((projectId?: string) => {
    dispatch({ type: 'NAVIGATE_TO_MEETING', projectId })
  }, [])

  const refreshProjects = useCallback(() => {
    dispatch({ type: 'REFRESH_PROJECTS' })
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch, navigateToProject, navigateToMeeting, refreshProjects }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
