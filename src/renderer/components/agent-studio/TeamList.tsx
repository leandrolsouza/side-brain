import { Play, Plus, Trash2, Users } from 'lucide-react'
import type { AgentDefinition, AgentTeam } from '@shared/types'
import { getAgentColor } from './agent-visuals'

export function TeamList({
  teams,
  agents,
  onCreateTeam,
  onSelectTeam,
  onDeleteTeam,
}: {
  teams: AgentTeam[]
  agents: AgentDefinition[]
  onCreateTeam: () => void
  onSelectTeam: (team: AgentTeam) => void
  onDeleteTeam: (id: string) => void
}) {
  const agentMap = new Map(agents.map((a) => [a.id, a]))

  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <div className="agent-studio-title">
          <Users size={20} />
          <span>Equipes</span>
        </div>
        <button type="button" className="agent-btn-primary" onClick={onCreateTeam}>
          <Plus size={16} />
          <span>Nova Equipe</span>
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="agent-empty-state">
          <Users size={48} strokeWidth={1} />
          <h3>Nenhuma equipe criada</h3>
          <p>
            Crie equipes de agentes que discutem e colaboram sobre um tópico. Cada membro analisa o assunto e vê as
            opiniões dos anteriores.
          </p>
          <button type="button" className="agent-btn-primary" onClick={onCreateTeam}>
            <Plus size={16} />
            <span>Criar Equipe</span>
          </button>
        </div>
      ) : (
        <div className="agent-grid">
          {teams.map((team) => (
            <div key={team.id} className="agent-card" onClick={() => onSelectTeam(team)}>
              <div className="agent-card-header">
                <div className="agent-card-icon" style={{ color: '#4fc1ff' }}>
                  <Users size={20} />
                </div>
                <div className="agent-card-info">
                  <h4>{team.name}</h4>
                  <p>{team.description}</p>
                </div>
              </div>
              <div className="agent-card-meta">
                <span className="agent-skill-count">{team.memberIds?.length || 0} membros</span>
                <span className="agent-meta-item">
                  {team.collaborationMode === 'sequential' ? 'Sequencial' : 'Paralelo'}
                </span>
              </div>
              <div className="team-members-preview">
                {(team.memberIds || []).slice(0, 4).map((id: string) => {
                  const agent = agentMap.get(id)
                  return agent ? (
                    <span key={id} className="team-member-chip" style={{ borderColor: getAgentColor(agent.color) }}>
                      {agent.name}
                    </span>
                  ) : null
                })}
              </div>
              <div className="agent-card-actions">
                <button
                  type="button"
                  className="agent-btn-icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectTeam(team)
                  }}
                  title="Iniciar Discussão"
                >
                  <Play size={16} />
                </button>
                <button
                  type="button"
                  className="agent-btn-icon danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteTeam(team.id)
                  }}
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
