import React from 'react'
import { LayoutDashboard, PenLine, FolderOpen, Video, Settings, Sun, Moon, BarChart3, Info, MessageCircle, SlidersHorizontal, Network } from 'lucide-react'
import type { View, Theme } from '../App'

interface ActivityBarProps {
  currentView: View
  onViewChange: (view: View) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onAboutClick: () => void
}

const activityItems: { view: View; icon: React.ReactNode; tooltip: string }[] = [
  { view: 'dashboard', icon: <LayoutDashboard size={24} />, tooltip: 'Visão Geral (Ctrl+1)' },
  { view: 'capture', icon: <PenLine size={24} />, tooltip: 'Captura Rápida (Ctrl+2)' },
  { view: 'projects', icon: <FolderOpen size={24} />, tooltip: 'Projetos (Ctrl+3)' },
  { view: 'meeting', icon: <Video size={24} />, tooltip: 'Nova Reunião (Ctrl+4)' },
  { view: 'reports', icon: <BarChart3 size={24} />, tooltip: 'Métricas & Relatórios (Ctrl+5)' },
  { view: 'smart-chat', icon: <MessageCircle size={24} />, tooltip: 'Chat Inteligente (Ctrl+6)' },
  { view: 'connection-graph', icon: <Network size={24} />, tooltip: 'Mapa de Conexões (Ctrl+7)' },
]

export function ActivityBar({ currentView, onViewChange, theme, onThemeChange, onAboutClick }: ActivityBarProps) {
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
          className="activity-bar-item"
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </div>
        <div
          className="activity-bar-item"
          onClick={onAboutClick}
          title="Sobre o SideBrain"
        >
          <Info size={22} />
        </div>
        <div
          className={`activity-bar-item ${currentView === 'custom-fields' ? 'active' : ''}`}
          onClick={() => onViewChange('custom-fields')}
          title="Campos Personalizados"
        >
          <SlidersHorizontal size={22} />
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
