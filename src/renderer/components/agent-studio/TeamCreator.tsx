import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, Plus, Users } from 'lucide-react'
import type { AgentDefinition, TeamCollaborationMode, TeamCreateData } from '@shared/types'
import { getAgentColor, getAgentIcon } from './agent-visuals'

export function TeamCreator({
  agents,
  isLoading,
  onCreate,
  onBack,
}: {
  agents: AgentDefinition[]
  isLoading: boolean
  onCreate: (data: TeamCreateData) => void
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [mode, setMode] = useState<TeamCollaborationMode>('sequential')

  const toggleMember = (id: string) => {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  const moveMember = (index: number, direction: -1 | 1) => {
    const newIds = [...memberIds]
    const target = index + direction
    if (target < 0 || target >= newIds.length) return
    ;[newIds[index], newIds[target]] = [newIds[target], newIds[index]]
    setMemberIds(newIds)
  }

  const handleSubmit = () => {
    if (!name.trim() || memberIds.length < 2) return
    onCreate({
      name: name.trim(),
      description: description.trim(),
      memberIds,
      collaborationMode: mode,
      generateSynthesis: true,
    })
  }

  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <button type="button" className="agent-btn-icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="agent-studio-title">
          <Users size={20} />
          <span>Criar Equipe</span>
        </div>
      </div>

      <div className="agent-form">
        <div className="agent-form-section">
          <label className="agent-form-label">Nome da equipe</label>
          <input
            className="agent-form-input"
            placeholder="Ex: Equipe de Arquitetura, Conselho Técnico..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="agent-form-section">
          <label className="agent-form-label">Descrição</label>
          <input
            className="agent-form-input"
            placeholder="O que essa equipe faz?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="agent-form-section">
          <label className="agent-form-label">Modo de colaboração</label>
          <div className="agent-form-options">
            <button
              type="button"
              className={`agent-mode-btn ${mode === 'sequential' ? 'selected' : ''}`}
              onClick={() => setMode('sequential')}
            >
              <span>Sequencial</span>
              <small>Cada agente vê as respostas anteriores</small>
            </button>
            <button
              type="button"
              className={`agent-mode-btn ${mode === 'parallel' ? 'selected' : ''}`}
              onClick={() => setMode('parallel')}
            >
              <span>Paralelo</span>
              <small>Todos analisam independentemente</small>
            </button>
          </div>
        </div>

        <div className="agent-form-section">
          <label className="agent-form-label">Membros (selecione e ordene — a ordem importa no modo sequencial)</label>
          <div className="team-member-selector">
            {agents
              .filter((a) => a.isActive)
              .map((agent) => {
                const isSelected = memberIds.includes(agent.id)
                const index = memberIds.indexOf(agent.id)
                return (
                  <div key={agent.id} className={`team-member-row ${isSelected ? 'selected' : ''}`}>
                    <button type="button" className="agent-btn-icon" onClick={() => toggleMember(agent.id)}>
                      {isSelected ? (
                        <CheckCircle2 size={16} className="step-icon success" />
                      ) : (
                        <div className="team-unchecked" />
                      )}
                    </button>
                    <div className="agent-card-icon small" style={{ color: getAgentColor(agent.color) }}>
                      {getAgentIcon(agent.icon)}
                    </div>
                    <div className="team-member-info">
                      <span className="team-member-name">{agent.name}</span>
                      <span className="team-member-desc">{agent.description.slice(0, 60)}</span>
                    </div>
                    {isSelected && (
                      <div className="team-member-order">
                        <span className="team-order-badge">#{index + 1}</span>
                        <button
                          type="button"
                          className="agent-btn-icon"
                          onClick={() => moveMember(index, -1)}
                          disabled={index === 0}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="agent-btn-icon"
                          onClick={() => moveMember(index, 1)}
                          disabled={index === memberIds.length - 1}
                        >
                          ▼
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>

        <button
          type="button"
          className="agent-btn-primary full-width"
          onClick={handleSubmit}
          disabled={!name.trim() || memberIds.length < 2 || isLoading}
        >
          {isLoading ? <Loader2 size={16} className="spinning" /> : <Plus size={16} />}
          <span>Criar Equipe ({memberIds.length} membros)</span>
        </button>
      </div>
    </div>
  )
}
