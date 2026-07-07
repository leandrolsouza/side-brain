import React from 'react'
import { LayoutDashboard, PenLine, FolderOpen, ClipboardCheck, Settings } from 'lucide-react'
import type { View } from '../App'

interface ActivityBarProps {
  currentView: View
  onViewChange: (view: View) => void
}

const activityItems: { view: View; icon: React.ReactNode; tooltip: string }[] = [
  { view: 'dashboard', icon: <LayoutDashboard size={24} />, tooltip: 'Visão Geral' },
  { view: 'capture', icon: <PenLine size={24} />, tooltip: 'Captura Rápida' },
  { view: 'projects', icon: <FolderOpen size={24} />, tooltip: 'Projetos' },
  { view: 'review', icon: <ClipboardCheck size={24} />, tooltip: 'Revisão' },
]

export function ActivityBar({ currentView, onViewChange }: ActivityBarProps) {
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
        </div>
      ))}

      <div className="activity-bar-bottom">
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
