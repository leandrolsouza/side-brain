import React, { useState, useEffect } from 'react'
import { CheckCircle2, PencilLine, ClipboardCheck } from 'lucide-react'

interface PendingEntry {
  id: string
  rawText: string
  improvedText: string
  projectId: string
  projectName?: string
  type: string
  action: string
  createdAt: string
}

export function ReviewInbox() {
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([])

  useEffect(() => {
    loadPending()
  }, [])

  const loadPending = async () => {
    const data = await window.electronAPI.getEntries()
    const pending = data.filter((e: any) => e.reviewStatus === 'pending')
    setPendingEntries(pending)
  }

  const handleApprove = async (id: string) => {
    await window.electronAPI.approveEntry(id)
    await loadPending()
  }

  const handleCorrect = async (id: string, corrections: Record<string, any>) => {
    await window.electronAPI.correctEntry(id, corrections)
    await loadPending()
  }

  return (
    <div className="flex-col">
      <div className="panel-header">
        <span className="panel-title">Revisão</span>
        {pendingEntries.length > 0 && (
          <span className="vscode-badge info">{pendingEntries.length} pendente{pendingEntries.length > 1 ? 's' : ''}</span>
        )}
      </div>
      <p className="panel-description">
        Entradas aguardando sua confirmação. Aprove ou corrija a categorização da IA.
      </p>

      {pendingEntries.length === 0 ? (
        <div className="empty-state">
          <ClipboardCheck size={48} className="empty-state-icon" />
          <span className="empty-state-text">
            Nenhuma entrada pendente de revisão.
          </span>
        </div>
      ) : (
        <div className="flex-col gap-4">
          {pendingEntries.map((entry) => (
            <div key={entry.id} className="vscode-card">
              <div className="vscode-card-header">
                <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                  {new Date(entry.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="vscode-card-body flex-col gap-8">
                <div>
                  <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Você digitou
                  </span>
                  <div style={{ marginTop: 2 }}>{entry.rawText}</div>
                </div>

                <div style={{ padding: '8px 12px', background: 'var(--vscode-input-background)', borderLeft: '2px solid var(--vscode-focusBorder)' }}>
                  <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Sugestão da IA
                  </span>
                  <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                    <span><strong>Projeto:</strong> {entry.projectName || entry.projectId}</span>
                    <span><strong>Tipo:</strong> {entry.type}</span>
                    <span><strong>Ação:</strong> {entry.action}</span>
                    <span><strong>Texto:</strong> {entry.improvedText}</span>
                  </div>
                </div>
              </div>

              <div className="vscode-card-footer">
                <button
                  className="vscode-button"
                  onClick={() => handleApprove(entry.id)}
                >
                  <CheckCircle2 size={14} />
                  Aprovar
                </button>
                <button
                  className="vscode-button secondary"
                  onClick={() => handleCorrect(entry.id, {})}
                >
                  <PencilLine size={14} />
                  Corrigir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
