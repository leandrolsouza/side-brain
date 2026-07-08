import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeft, List, LayoutGrid, Sparkles, X, Download, Video } from 'lucide-react'
import { EntryList } from './EntryList'
import { KanbanBoard } from './KanbanBoard'
import { MeetingMode } from './MeetingMode'
import { MeetingHistory } from './MeetingHistory'

type ProjectTab = 'entries' | 'kanban' | 'meetings'
type ExportFormat = 'markdown' | 'pdf'

interface ProjectViewProps {
  projectId: string
  projectName: string
  onBack: () => void
}

export function ProjectView({ projectId, projectName, onBack }: ProjectViewProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>('entries')
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
            title="Voltar aos projetos"
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
            {isLoadingSummary ? 'Gerando...' : 'Me atualiza'}
          </button>
          <div ref={exportMenuRef} style={{ position: 'relative', marginLeft: 8 }}>
            <button
              className="vscode-button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
            >
              <Download size={14} />
              {isExporting ? 'Exportando...' : 'Exportar'}
            </button>
            {showExportMenu && (
              <div className="export-dropdown">
                <button className="export-dropdown-item" onClick={() => handleExport('markdown')}>
                  Markdown (.md)
                </button>
                <button className="export-dropdown-item" onClick={() => handleExport('pdf')}>
                  PDF (.pdf)
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
            Entradas
          </button>
          <button
            className={`project-tab ${activeTab === 'kanban' ? 'active' : ''}`}
            onClick={() => setActiveTab('kanban')}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
          <button
            className={`project-tab ${activeTab === 'meetings' ? 'active' : ''}`}
            onClick={() => setActiveTab('meetings')}
          >
            <Video size={14} />
            Reuniões
          </button>
        </div>
      </div>

      {/* Project-level summary */}
      {summary && (
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-header">
            <Sparkles size={14} />
            <span>Resumo do Projeto</span>
            <button className="icon-button" onClick={() => setSummary(null)} style={{ opacity: 1 }}>
              <X size={14} />
            </button>
          </div>
          <div className="dashboard-summary-text">{summary}</div>
        </div>
      )}

      {/* Tab content */}
      <div className="project-view-content">
        {activeTab === 'entries' && (
          <EntryList projectId={projectId} onBack={onBack} />
        )}
        {activeTab === 'kanban' && (
          <KanbanBoard projectId={projectId} />
        )}
        {activeTab === 'meetings' && (
          <div className="flex-col" style={{ gap: 16 }}>
            <MeetingMode projectId={projectId} onFinished={() => setActiveTab('meetings')} />
            <MeetingHistory projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  )
}
