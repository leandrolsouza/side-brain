import React from 'react'
import { LayoutDashboard, PenLine, FolderOpen, Video, Settings, Sun, Moon, BarChart3, Info, MessageCircle, SlidersHorizontal, Network, Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { View, Theme } from '../App'

interface ActivityBarProps {
  currentView: View
  onViewChange: (view: View) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onAboutClick: () => void
}

export function ActivityBar({ currentView, onViewChange, theme, onThemeChange, onAboutClick }: ActivityBarProps) {
  const { t } = useTranslation('common')

  const activityItems: { view: View; icon: React.ReactNode; tooltip: string }[] = [
    { view: 'dashboard', icon: <LayoutDashboard size={24} />, tooltip: t('activityBar.dashboard') },
    { view: 'capture', icon: <PenLine size={24} />, tooltip: t('activityBar.capture') },
    { view: 'projects', icon: <FolderOpen size={24} />, tooltip: t('activityBar.projects') },
    { view: 'meeting', icon: <Video size={24} />, tooltip: t('activityBar.meeting') },
    { view: 'reports', icon: <BarChart3 size={24} />, tooltip: t('activityBar.reports') },
    { view: 'smart-chat', icon: <MessageCircle size={24} />, tooltip: t('activityBar.smartChat') },
    { view: 'connection-graph', icon: <Network size={24} />, tooltip: t('activityBar.connectionGraph') },
    { view: 'agents', icon: <Bot size={24} />, tooltip: t('activityBar.agents', { defaultValue: 'Agentes' }) },
  ]

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
          title={theme === 'dark' ? t('activityBar.lightTheme') : t('activityBar.darkTheme')}
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </div>
        <div
          className="activity-bar-item"
          onClick={onAboutClick}
          title={t('activityBar.about')}
        >
          <Info size={22} />
        </div>
        <div
          className={`activity-bar-item ${currentView === 'custom-fields' ? 'active' : ''}`}
          onClick={() => onViewChange('custom-fields')}
          title={t('activityBar.customFields')}
        >
          <SlidersHorizontal size={22} />
        </div>
        <div
          className={`activity-bar-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => onViewChange('settings')}
          title={t('activityBar.settings')}
        >
          <Settings size={24} />
        </div>
      </div>
    </div>
  )
}
