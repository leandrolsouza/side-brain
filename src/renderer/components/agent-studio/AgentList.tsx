import type React from 'react'
import { Bot, Clock, Pencil, Play, Plus, Power, PowerOff, Sparkles, Trash2 } from 'lucide-react'
import type { AgentDefinition } from '@shared/types'
import { getAgentColor, getAgentIcon } from './agent-visuals'

export function AgentList({
  agents,
  onSelect,
  onEdit,
  onShowTemplates,
  onDelete,
  onToggleActive,
  onShowLog,
}: {
  agents: AgentDefinition[]
  onSelect: (agent: AgentDefinition) => void
  onEdit: (agent: AgentDefinition) => void
  onShowTemplates: () => void
  onDelete: (id: string) => void
  onToggleActive: (id: string) => void
  onShowLog: (agent: AgentDefinition) => void
}) {
  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <div className="agent-studio-title">
          <Bot size={20} />
          <span>Agent Studio</span>
        </div>
        <button type="button" className="agent-btn-primary" onClick={onShowTemplates}>
          <Plus size={16} />
          <span>Novo Agente</span>
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="agent-empty-state">
          <Bot size={48} strokeWidth={1} />
          <h3>Nenhum agente criado</h3>
          <p>Crie agentes com habilidades específicas para automatizar tarefas no seu workspace.</p>
          <button type="button" className="agent-btn-primary" onClick={onShowTemplates}>
            <Sparkles size={16} />
            <span>Criar a partir de template</span>
          </button>
        </div>
      ) : (
        <div className="agent-grid">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`agent-card ${!agent.isActive ? 'inactive' : ''}`}
              style={{ '--agent-color': getAgentColor(agent.color) } as React.CSSProperties}
            >
              <div className="agent-card-header">
                <div className="agent-card-icon" style={{ color: getAgentColor(agent.color) }}>
                  {getAgentIcon(agent.icon)}
                </div>
                <div className="agent-card-info">
                  <h4>{agent.name}</h4>
                  <p>{agent.description}</p>
                </div>
              </div>

              <div className="agent-card-meta">
                <span className="agent-skill-count">{agent.skills.length} skills</span>
                <span className={`agent-status ${agent.isActive ? 'active' : 'inactive'}`}>
                  {agent.isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="agent-card-actions">
                <button type="button" className="agent-btn-icon" onClick={() => onSelect(agent)} title="Executar">
                  <Play size={16} />
                </button>
                <button type="button" className="agent-btn-icon" onClick={() => onEdit(agent)} title="Editar">
                  <Pencil size={16} />
                </button>
                <button type="button" className="agent-btn-icon" onClick={() => onShowLog(agent)} title="Histórico">
                  <Clock size={16} />
                </button>
                <button
                  type="button"
                  className="agent-btn-icon"
                  onClick={() => onToggleActive(agent.id)}
                  title={agent.isActive ? 'Desativar' : 'Ativar'}
                >
                  {agent.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                </button>
                <button
                  type="button"
                  className="agent-btn-icon danger"
                  onClick={() => onDelete(agent.id)}
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
