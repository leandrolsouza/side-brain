import React, { useState } from 'react'
import { ArrowLeft, List, LayoutGrid, Sparkles, X } from 'lucide-react'
import { EntryList } from './EntryList'
import { KanbanBoard } from './KanbanBoard'

type ProjectTab = 'entries' | 'kanban'

interface ProjectViewProps {
  projectId: string
  projectName: string
  onBack: () => void
}

export function ProjectView({ projectId, projectName, onBack }: ProjectViewProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>('entries')
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)

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
      </div>
    </div>
  )
}
