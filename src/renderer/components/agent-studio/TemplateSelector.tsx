import { ArrowLeft, Loader2, Plus, Settings2, Sparkles } from 'lucide-react'
import type { AgentTemplate } from '@shared/types'
import { getAgentColor, getAgentIcon } from './agent-visuals'

export function TemplateSelector({
  templates,
  isLoading,
  onSelect,
  onBack,
  onCreateCustom,
}: {
  templates: AgentTemplate[]
  isLoading: boolean
  onSelect: (templateId: string) => void
  onBack: () => void
  onCreateCustom: () => void
}) {
  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <button type="button" className="agent-btn-icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="agent-studio-title">
          <Sparkles size={20} />
          <span>Criar Agente</span>
        </div>
        <button type="button" className="agent-btn-secondary" onClick={onCreateCustom}>
          <Settings2 size={16} />
          <span>Criar do zero</span>
        </button>
      </div>

      <p className="agent-subtitle">Escolha um template para começar, ou crie um agente customizado do zero.</p>

      <div className="agent-grid">
        {templates.map((template) => (
          <div key={template.id} className="agent-card template-card">
            <div className="agent-card-header">
              <div className="agent-card-icon" style={{ color: getAgentColor(template.color) }}>
                {getAgentIcon(template.icon)}
              </div>
              <div className="agent-card-info">
                <h4>{template.name}</h4>
                <p>{template.description}</p>
              </div>
            </div>

            <div className="agent-card-meta">
              <span className="agent-skill-count">{template.skills.length} skills</span>
              <span className="agent-meta-item">Max {template.maxSteps} passos</span>
            </div>

            <button
              type="button"
              className="agent-btn-primary full-width"
              onClick={() => onSelect(template.id)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 size={16} className="spinning" /> : <Plus size={16} />}
              <span>Criar</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
