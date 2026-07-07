import React, { useState, useEffect } from 'react'
import { ArrowLeft, Sparkles, X } from 'lucide-react'

interface Entry {
  id: string
  rawText: string
  improvedText: string
  projectId: string
  type: string
  action: string
  createdAt: string
}

interface EntryListProps {
  projectId: string
  onBack: () => void
}

const typeLabels: Record<string, string> = {
  information: 'Info',
  decision: 'Decisão',
  request: 'Pedido',
  idea: 'Ideia',
  blocker: 'Bloqueio',
  update: 'Atualização',
}

const typeBadgeVariant: Record<string, string> = {
  information: 'info',
  decision: 'warning',
  request: 'neutral',
  idea: 'success',
  blocker: 'error',
  update: 'info',
}

const actionLabels: Record<string, string> = {
  none: 'Sem ação',
  action_needed: 'Ação necessária',
  waiting_response: 'Aguardando resposta',
  done: 'Concluído',
}

export function EntryList({ projectId, onBack }: EntryListProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)

  useEffect(() => {
    loadEntries()
  }, [projectId])

  const loadEntries = async () => {
    const data = await window.electronAPI.getEntries(projectId)
    setEntries(data)
  }

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true)
    try {
      const result = await window.electronAPI.generateSummary(projectId)
      setSummary(result)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  const handleActionChange = async (entryId: string, newAction: string) => {
    await window.electronAPI.updateEntry(entryId, { action: newAction })
    await loadEntries()
  }

  return (
    <div className="flex-col">
      <div className="panel-header">
        <div className="flex-row">
          <button
            className="inline-action-btn"
            onClick={onBack}
            title="Voltar aos projetos"
            style={{ opacity: 1 }}
          >
            <ArrowLeft size={16} />
          </button>
          <span className="panel-title">Entradas do Projeto</span>
        </div>
        <button
          className="vscode-button"
          onClick={handleGenerateSummary}
          disabled={isLoadingSummary}
        >
          <Sparkles size={14} />
          {isLoadingSummary ? 'Gerando...' : 'Me atualiza'}
        </button>
      </div>

      {summary && (
        <div className="vscode-card mb-16" style={{ borderColor: 'var(--vscode-focusBorder)' }}>
          <div className="vscode-card-header">
            <span style={{ fontWeight: 600, color: 'var(--vscode-notificationsInfoIcon-foreground)' }}>
              Resumo por IA
            </span>
            <button
              className="inline-action-btn"
              onClick={() => setSummary(null)}
              style={{ opacity: 1 }}
            >
              <X size={14} />
            </button>
          </div>
          <div className="vscode-card-body">{summary}</div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            Nenhuma entrada neste projeto ainda.
          </span>
        </div>
      ) : (
        <div className="flex-col gap-4">
          {entries.map((entry) => (
            <div key={entry.id} className="vscode-card">
              <div className="vscode-card-header">
                <div className="flex-row">
                  <span className={`vscode-badge ${typeBadgeVariant[entry.type] || 'neutral'}`}>
                    {typeLabels[entry.type] || entry.type}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                    {new Date(entry.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <select
                  className="vscode-select"
                  value={entry.action}
                  onChange={(e) => handleActionChange(entry.id, e.target.value)}
                  style={{ fontSize: 11, padding: '2px 6px' }}
                >
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="vscode-card-body">
                {entry.improvedText}
              </div>
              {entry.rawText !== entry.improvedText && (
                <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginTop: 6, fontStyle: 'italic' }}>
                  Original: {entry.rawText}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
