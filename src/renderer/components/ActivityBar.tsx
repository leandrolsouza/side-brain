import React, { useState, useEffect } from 'react'
import { LayoutDashboard, PenLine, FolderOpen, ClipboardCheck, Video, Settings, Sun, Moon } from 'lucide-react'
import type { View, Theme } from '../App'

interface ActivityBarProps {
  currentView: View
  onViewChange: (view: View) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

const activityItems: { view: View; icon: React.ReactNode; tooltip: string }[] = [
  { view: 'dashboard', icon: <LayoutDashboard size={24} />, tooltip: 'Visão Geral (Ctrl+1)' },
  { view: 'capture', icon: <PenLine size={24} />, tooltip: 'Captura Rápida (Ctrl+2)' },
  { view: 'projects', icon: <FolderOpen size={24} />, tooltip: 'Projetos (Ctrl+3)' },
  { view: 'review', icon: <ClipboardCheck size={24} />, tooltip: 'Revisão (Ctrl+4)' },
  { view: 'meeting', icon: <Video size={24} />, tooltip: 'Nova Reunião' },
]

export function ActivityBar({ currentView, onViewChange, theme, onThemeChange }: ActivityBarProps) {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    loadPendingCount()
    const interval = setInterval(loadPendingCount, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadPendingCount = async () => {
    const entries = await window.electronAPI.getEntries()
    const count = entries.filter((e: any) => e.reviewStatus === 'pending').length
    setPendingCount(count)
  }

  const isActive = (view: View) =>
    currentView === view || (view === 'projects' && currentView === 'entries')

  return (
    <div className="activity-bar">
      {activityItems.map((item) => (
        <div
          key={item.view}
          className={`activity-bar-item ${isActive(item.view) ? 'active' : ''}`}
          onClick={() => onViewChange(item.view)}
          title={item.tooltip}
        >
          {item.icon}
          {item.view === 'review' && pendingCount > 0 && (
            <span className="badge">{pendingCount}</span>
          )}
        </div>
      ))}

      <div className="activity-bar-bottom">
        <div
          className="activity-bar-item"
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </div>
        <div
          className={`activity-bar-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => onViewChange('settings')}
          title="Configurações"
        >
          <Settings size={24} />
        </div>
      </div>
    </div>
  )
}
