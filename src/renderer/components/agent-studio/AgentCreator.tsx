import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, Plus, Settings2, Sparkles } from 'lucide-react'
import type { AgentCreateData, AgentDefinition, AgentSkill, MCPToolInfo } from '@shared/types'
import { getAgentColor, getAgentIcon } from './agent-visuals'

const AVAILABLE_SKILLS: { key: AgentSkill; label: string; category: string }[] = [
  { key: 'read_entries', label: 'Ler entradas', category: 'Leitura' },
  { key: 'read_tasks', label: 'Ler tarefas', category: 'Leitura' },
  { key: 'read_projects', label: 'Ler projetos', category: 'Leitura' },
  { key: 'read_meetings', label: 'Ler reuniões', category: 'Leitura' },
  { key: 'create_task', label: 'Criar tarefa', category: 'Escrita' },
  { key: 'update_task', label: 'Atualizar tarefa', category: 'Escrita' },
  { key: 'create_entry', label: 'Criar entrada', category: 'Escrita' },
  { key: 'generate_summary', label: 'Gerar resumo', category: 'IA' },
  { key: 'generate_report', label: 'Gerar relatório', category: 'IA' },
  { key: 'search_semantic', label: 'Busca semântica', category: 'IA' },
  { key: 'discover_connections', label: 'Descobrir conexões', category: 'IA' },
  { key: 'send_notification', label: 'Enviar notificação', category: 'Sistema' },
  { key: 'delegate', label: 'Delegar para outro agente', category: 'Sistema' },
  { key: 'mcp_tools', label: 'Ferramentas MCP (externas)', category: 'Sistema' },
]

const SKILL_KEYS = new Set<string>(AVAILABLE_SKILLS.map((s) => s.key))

function isAgentSkill(skill: string): skill is AgentSkill {
  return SKILL_KEYS.has(skill)
}

const ICON_OPTIONS = ['Bot', 'ClipboardCheck', 'PenTool', 'BarChart3', 'Lightbulb', 'Users']
const COLOR_OPTIONS = ['blue', 'purple', 'green', 'yellow', 'orange', 'red', 'cyan']

export function AgentCreator({
  agents,
  isLoading,
  onCreate,
  onBack,
  editingAgent,
}: {
  agents: AgentDefinition[]
  isLoading: boolean
  onCreate: (data: AgentCreateData) => void
  onBack: () => void
  editingAgent?: AgentDefinition
}) {
  const { t } = useTranslation('chat')
  const [name, setName] = useState(editingAgent?.name || '')
  const [description, setDescription] = useState(editingAgent?.description || '')
  const [persona, setPersona] = useState(editingAgent?.persona || '')
  const [icon, setIcon] = useState(editingAgent?.icon || 'Bot')
  const [color, setColor] = useState(editingAgent?.color || 'blue')
  const [skills, setSkills] = useState<AgentSkill[]>(
    editingAgent?.skills || ['read_entries', 'read_tasks', 'read_projects']
  )
  const [maxSteps, setMaxSteps] = useState(editingAgent?.maxSteps || 6)
  const [canDelegate, setCanDelegate] = useState<string[]>(editingAgent?.canDelegate || [])
  const [requiresApproval, setRequiresApproval] = useState(editingAgent?.requiresApproval || false)
  const [mcpTools, setMcpTools] = useState<MCPToolInfo[]>([])
  const [allowedMcpTools, setAllowedMcpTools] = useState(editingAgent?.scope.mcpTools || [])

  useEffect(() => {
    if (skills.includes('mcp_tools')) {
      window.electronAPI
        .mcpGetTools()
        .then(setMcpTools)
        .catch(() => setMcpTools([]))
    }
  }, [skills])

  const isEditing = !!editingAgent
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) return
    setIsGenerating(true)
    try {
      const generated = await window.electronAPI.agentGenerateFromDescription(aiPrompt.trim())
      if (generated.name) setName(generated.name)
      if (generated.description) setDescription(generated.description)
      if (generated.persona) setPersona(generated.persona)
      if (generated.icon) setIcon(generated.icon)
      if (generated.color) setColor(generated.color)
      if (generated.skills) setSkills(generated.skills.filter(isAgentSkill))
      if (generated.maxSteps) setMaxSteps(generated.maxSteps)
    } catch (error) {
      console.error('Failed to generate agent:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleSkill = (skill: AgentSkill) => {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))
  }

  const toggleDelegate = (agentId: string) => {
    setCanDelegate((prev) => (prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]))
  }

  const handleSubmit = () => {
    if (!name.trim() || !persona.trim()) return

    onCreate({
      name: name.trim(),
      description: description.trim(),
      persona: persona.trim(),
      icon,
      color,
      skills,
      scope: { ...(editingAgent?.scope || { projectIds: 'all' as const }), mcpTools: allowedMcpTools },
      triggers: editingAgent?.triggers || [{ type: 'manual' }],
      canDelegate,
      maxSteps,
      isActive: editingAgent?.isActive ?? true,
      requiresApproval,
    })
  }

  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <button type="button" className="agent-btn-icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="agent-studio-title">
          <Settings2 size={20} />
          <span>{isEditing ? `Editar — ${editingAgent!.name}` : 'Criar Agente Customizado'}</span>
        </div>
      </div>

      <div className="agent-form">
        {/* AI Generation */}
        {!isEditing && (
          <div className="agent-ai-generate">
            <div className="agent-ai-generate-header">
              <Sparkles size={16} />
              <span>Criar com IA</span>
            </div>
            <p className="agent-form-hint">
              Descreva o que você quer que o agente faça e a IA preenche tudo automaticamente.
            </p>
            <div className="agent-ai-generate-input">
              <input
                className="agent-form-input"
                placeholder="Ex: um agente que analise riscos de segurança nos meus projetos..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerateWithAI()
                }}
                disabled={isGenerating}
              />
              <button
                type="button"
                className="agent-btn-primary"
                onClick={handleGenerateWithAI}
                disabled={!aiPrompt.trim() || isGenerating}
              >
                {isGenerating ? <Loader2 size={14} className="spinning" /> : <Sparkles size={14} />}
                <span>{isGenerating ? 'Gerando...' : 'Gerar'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Basic info */}
        <div className="agent-form-section">
          <label className="agent-form-label">Nome</label>
          <input
            className="agent-form-input"
            placeholder="Ex: Meu Advisor, Analista de Riscos..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="agent-form-section">
          <label className="agent-form-label">Descrição curta</label>
          <input
            className="agent-form-input"
            placeholder="O que esse agente faz em uma frase"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="agent-form-section">
          <label className="agent-form-label">Persona / Instruções</label>
          <p className="agent-form-hint">
            Defina quem é esse agente, como ele se comporta, e o que ele deve fazer com seus dados.
          </p>
          <textarea
            className="agent-form-textarea"
            placeholder="Você é um... Seu papel é... Regras: ..."
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={6}
          />
        </div>

        {/* Appearance */}
        <div className="agent-form-row">
          <div className="agent-form-section">
            <label className="agent-form-label">Ícone</label>
            <div className="agent-form-options">
              {ICON_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`agent-option-btn ${icon === opt ? 'selected' : ''}`}
                  onClick={() => setIcon(opt)}
                  title={opt}
                >
                  {getAgentIcon(opt)}
                </button>
              ))}
            </div>
          </div>

          <div className="agent-form-section">
            <label className="agent-form-label">Cor</label>
            <div className="agent-form-options">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`agent-color-btn ${color === opt ? 'selected' : ''}`}
                  onClick={() => setColor(opt)}
                  style={{ background: getAgentColor(opt) }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="agent-form-section">
          <label className="agent-form-label">Skills (o que ele pode fazer)</label>
          <div className="agent-skills-grid">
            {AVAILABLE_SKILLS.map((s) => (
              <label key={s.key} className={`agent-skill-checkbox ${skills.includes(s.key) ? 'checked' : ''}`}>
                <input type="checkbox" checked={skills.includes(s.key)} onChange={() => toggleSkill(s.key)} />
                <span>{s.label}</span>
                <span className="agent-skill-category">{s.category}</span>
              </label>
            ))}
          </div>
        </div>

        {skills.includes('mcp_tools') && (
          <div className="agent-form-section">
            <span className="agent-form-label">{t('mcpPermissionsTitle')}</span>
            <p className="agent-form-hint">{t('mcpPermissionsHint')}</p>
            {mcpTools.length === 0 && <p>{t('mcpPermissionsEmpty')}</p>}
            {mcpTools.map((tool) => {
              const checked = allowedMcpTools.some((item) => item.serverId === tool.serverId && item.name === tool.name)
              return (
                <label key={`${tool.serverId}:${tool.name}`} className="agent-skill-checkbox">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setAllowedMcpTools((previous) =>
                        checked
                          ? previous.filter((item) => item.serverId !== tool.serverId || item.name !== tool.name)
                          : [...previous, { serverId: tool.serverId, name: tool.name }]
                      )
                    }
                  />
                  <span>
                    {tool.serverName} — {tool.name}
                  </span>
                </label>
              )
            })}
            {allowedMcpTools
              .filter((item) => !mcpTools.some((tool) => tool.serverId === item.serverId && tool.name === item.name))
              .map((item) => (
                <label key={`${item.serverId}:${item.name}`} className="agent-skill-checkbox">
                  <input
                    type="checkbox"
                    checked
                    onChange={() =>
                      setAllowedMcpTools((previous) =>
                        previous.filter((entry) => entry.serverId !== item.serverId || entry.name !== item.name)
                      )
                    }
                  />
                  <span>
                    {item.serverId} — {item.name} ({t('mcpToolOffline')})
                  </span>
                </label>
              ))}
          </div>
        )}

        {/* Delegation */}
        {skills.includes('delegate') && agents.length > 0 && (
          <div className="agent-form-section">
            <label className="agent-form-label">Pode delegar para</label>
            <div className="agent-delegate-list">
              {agents.map((a) => (
                <label key={a.id} className={`agent-skill-checkbox ${canDelegate.includes(a.id) ? 'checked' : ''}`}>
                  <input type="checkbox" checked={canDelegate.includes(a.id)} onChange={() => toggleDelegate(a.id)} />
                  <span>{a.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="agent-form-row">
          <div className="agent-form-section">
            <label className="agent-form-label">Máximo de passos</label>
            <input
              type="number"
              className="agent-form-input small"
              min={1}
              max={20}
              value={maxSteps}
              onChange={(e) => setMaxSteps(parseInt(e.target.value, 10) || 6)}
            />
          </div>

          <div className="agent-form-section">
            <label className="agent-form-label">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
              />{' '}
              Requer aprovação antes de executar ações
            </label>
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          className="agent-btn-primary full-width"
          onClick={handleSubmit}
          disabled={!name.trim() || !persona.trim() || isLoading}
        >
          {isLoading ? <Loader2 size={16} className="spinning" /> : <Plus size={16} />}
          <span>{isEditing ? 'Salvar Alterações' : 'Criar Agente'}</span>
        </button>
      </div>
    </div>
  )
}
