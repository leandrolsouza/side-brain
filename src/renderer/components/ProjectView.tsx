import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeft, List, LayoutGrid, Sparkles, X, Download, Video, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MarkdownViewer } from './MarkdownViewer'
import { EntryList } from './EntryList'
import { KanbanBoard } from './KanbanBoard'
import { MeetingHistory } from './MeetingHistory'

type ProjectTab = 'entries' | 'kanban' | 'meetings'
type ExportFormat = 'markdown' | 'pdf'

interface ProjectViewProps {
  projectId: string
  projectName: string
  initialTab?: ProjectTab
  onBack: () => void
  onNavigateToMeeting: (projectId?: string) => void
}

export function ProjectView({ projectId, projectName, initialTab, onBack, onNavigateToMeeting }: ProjectViewProps) {
  const { t } = useTranslation('projects')
  const [activeTab, setActiveTab] = useState<ProjectTab>(initialTab || 'entries')
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportMenu])

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true)
    try {
      const result = await window.electronAPI.generateSummary(projectId)
      setSummary(result)
    } catch (error) {
      console.error('Failed to generate project summary:', error)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  const handleExport = async (format: ExportFormat) => {
    setShowExportMenu(false)
    setIsExporting(true)
    try {
      await window.electronAPI.exportProject(projectId, format)
    } catch (error) {
      console.error('Failed to export project:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex-col" style={{ height: '100%' }}>
      {/* Project header with tabs */}
      <div className="project-view-header">
        <div className="flex-row">
          <button
            className="icon-button"
            onClick={onBack}
            title={t('backToProjects')}
            style={{ opacity: 1 }}
          >
            <ArrowLeft size={16} />
          </button>
          <span className="panel-title">{projectName}</span>
          <button
            className="vscode-button"
            onClick={handleGenerateSummary}
            disabled={isLoadingSummary}
            style={{ marginLeft: 12 }}
          >
            <Sparkles size={14} />
            {isLoadingSummary ? t('generatingSummary') : t('generateSummary')}
          </button>
          <div ref={exportMenuRef} style={{ position: 'relative', marginLeft: 8 }}>
            <button
              className="vscode-button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
            >
              <Download size={14} />
              {isExporting ? t('exporting') : t('export')}
            </button>
            {showExportMenu && (
              <div className="export-dropdown">
                <button className="export-dropdown-item" onClick={() => handleExport('markdown')}>
                  {t('exportMarkdown')}
                </button>
                <button className="export-dropdown-item" onClick={() => handleExport('pdf')}>
                  {t('exportPdf')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="project-view-tabs">
          <button
            className={`project-tab ${activeTab === 'entries' ? 'active' : ''}`}
            onClick={() => setActiveTab('entries')}
          >
            <List size={14} />
            {t('tabEntries')}
          </button>
          <button
            className={`project-tab ${activeTab === 'kanban' ? 'active' : ''}`}
            onClick={() => setActiveTab('kanban')}
          >
            <LayoutGrid size={14} />
            {t('tabKanban')}
          </button>
          <button
            className={`project-tab ${activeTab === 'meetings' ? 'active' : ''}`}
            onClick={() => setActiveTab('meetings')}
          >
            <Video size={14} />
            {t('tabMeetings')}
          </button>
        </div>
      </div>

      {/* Project-level summary modal */}
      {summary && (
        <div className="summary-modal-overlay" onClick={() => setSummary(null)}>
          <div className="summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="summary-modal-header">
              <Sparkles size={16} />
              <span>{t('projectSummary')}</span>
              <button className="icon-button" onClick={() => setSummary(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="summary-modal-body">
              <MarkdownViewer content={summary} />
            </div>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="project-view-content">
        {activeTab === 'entries' && (
          <EntryList projectId={projectId} />
        )}
        {activeTab === 'kanban' && (
          <KanbanBoard projectId={projectId} />
        )}
        {activeTab === 'meetings' && (
          <div className="flex-col" style={{ gap: 16, flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                className="vscode-button"
                onClick={() => onNavigateToMeeting(projectId)}
              >
                <Plus size={14} />
                {t('newMeeting')}
              </button>
            </div>
            <MeetingHistory projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  )
}
