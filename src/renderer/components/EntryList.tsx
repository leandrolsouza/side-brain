import React, { useState, useEffect } from 'react'
import { ArrowLeft, Sparkles, X, Trash2 } from 'lucide-react'
import { ConfirmModal } from './ConfirmModal'
import { MarkdownViewer } from './MarkdownViewer'

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

export function EntryList({ projectId, onBack }: EntryListProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Dynamic labels from custom fields
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({})
  const [typeBadgeVariant, setTypeBadgeVariant] = useState<Record<string, string>>({})
  const [actionLabels, setActionLabels] = useState<Record<string, string>>({})
  const [typesAllowsAction, setTypesAllowsAction] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadEntries()
    loadCustomFields()
  }, [projectId])

  const loadCustomFields = async () => {
    const [types, statuses] = await Promise.all([
      window.electronAPI.getEntryTypes(),
      window.electronAPI.getActionStatuses(),
    ])
    setTypeLabels(Object.fromEntries(types.map(t => [t.key, t.label])))
    setTypeBadgeVariant(Object.fromEntries(types.map(t => [t.key, t.color])))
    setActionLabels(Object.fromEntries(statuses.map(s => [s.key, s.label])))
    setTypesAllowsAction(Object.fromEntries(types.map(t => [t.key, t.allowsAction])))
  }

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

  const handleDelete = async (entryId: string) => {
    setDeleteTarget(entryId)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await window.electronAPI.deleteEntry(deleteTarget)
    setDeleteTarget(null)
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
        <div className="summary-modal-overlay" onClick={() => setSummary(null)}>
          <div className="summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="summary-modal-header">
              <Sparkles size={16} />
              <span>Resumo do Projeto</span>
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
                <div className="flex-row">
                  {typesAllowsAction[entry.type] !== false && (
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
                  )}
                  <button
                    className="inline-action-btn"
                    onClick={() => handleDelete(entry.id)}
                    title="Excluir entrada"
                    style={{ opacity: 0.6, color: 'var(--vscode-errorForeground)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
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

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Excluir entrada"
        message="Tem certeza que deseja excluir esta entrada? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
