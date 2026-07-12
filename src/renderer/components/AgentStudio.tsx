import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bot, Plus, Play, Square, Trash2, Power, PowerOff, ChevronRight,
  Loader2, CheckCircle2, XCircle, Clock, Send, ArrowLeft, Sparkles,
  ClipboardCheck, PenTool, BarChart3, Lightbulb, Users, Settings2, Pencil, Plug
} from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'

// === Types (mirroring shared types for renderer) ===

interface AgentDefinition {
  id: string
  name: string
  description: string
  persona: string
  icon: string
  color: string
  skills: string[]
  scope: { projectIds: string[] | 'all' }
  triggers: { type: string; scheduleConfig?: { expression: string } }[]
  canDelegate: string[]
  maxSteps: number
  isActive: boolean
  requiresApproval: boolean
  createdAt: string
  updatedAt: string
}

interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: string
  color: string
  persona: string
  skills: string[]
  scope: { projectIds: string[] | 'all' }
  triggers: { type: string }[]
  maxSteps: number
  requiresApproval: boolean
}

interface AgentExecutionSummary {
  id: string
  agentId: string
  agentName: string
  trigger: string
  input: string
  status: string
  stepCount: number
  result?: string
  createdAt: string
  completedAt?: string
}

interface AgentExecution {
  id: string
  agentId: string
  trigger: string
  input: string
  steps: AgentStep[]
  status: string
  result?: string
  error?: string
  createdAt: string
  completedAt?: string
}

interface AgentStep {
  id: string
  executionId: string
  stepNumber: number
  skill: string
  input: Record<string, any>
  output: Record<string, any> | null
  reasoning: string
  status: string
  createdAt: string
  completedAt?: string
}

// === Sub-views ===

type AgentView = 'list' | 'templates' | 'create' | 'run' | 'execution-log' | 'edit'

// === Icon mapping ===

const ICON_MAP: Record<string, React.ReactNode> = {
  ClipboardCheck: <ClipboardCheck size={20} />,
  PenTool: <PenTool size={20} />,
  BarChart3: <BarChart3 size={20} />,
  Lightbulb: <Lightbulb size={20} />,
  Users: <Users size={20} />,
  Bot: <Bot size={20} />,
}

const COLOR_MAP: Record<string, string> = {
  blue: '#4fc1ff',
  purple: '#c586c0',
  green: '#6abf69',
  yellow: '#e8a63b',
  orange: '#f48771',
  red: '#f44747',
  cyan: '#75beff',
}

function getAgentIcon(icon: string): React.ReactNode {
  return ICON_MAP[icon] || <Bot size={20} />
}

function getAgentColor(color: string): string {
  return COLOR_MAP[color] || COLOR_MAP.blue
}

// === Main Component ===

type TopTab = 'agents' | 'teams' | 'mcp'

export function AgentStudio() {
  const [topTab, setTopTab] = useState<TopTab>('agents')
  const [view, setView] = useState<AgentView>('list')
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null)
  const [executions, setExecutions] = useState<AgentExecutionSummary[]>([])
  const [selectedExecution, setSelectedExecution] = useState<AgentExecution | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Team state
  const [teams, setTeams] = useState<any[]>([])
  const [teamView, setTeamView] = useState<'list' | 'create' | 'discussion' | 'history'>('list')
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [teamExecution, setTeamExecution] = useState<any>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  useEffect(() => {
    if (topTab === 'teams') loadTeams()
  }, [topTab])

  const loadAgents = async () => {
    try {
      const data = await window.electronAPI.agentGetAll()
      setAgents(data)
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  const loadTeams = async () => {
    try {
      const data = await window.electronAPI.teamGetAll()
      setTeams(data)
    } catch (error) {
      console.error('Failed to load teams:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      const data = await window.electronAPI.agentGetTemplates()
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      setIsLoading(true)
      await window.electronAPI.agentCreateFromTemplate(templateId)
      await loadAgents()
      setView('list')
    } catch (error) {
      console.error('Failed to create agent:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCustom = async (data: any) => {
    try {
      setIsLoading(true)
      await window.electronAPI.agentCreate(data)
      await loadAgents()
      setView('list')
    } catch (error) {
      console.error('Failed to create custom agent:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (agent: AgentDefinition) => {
    setSelectedAgent(agent)
    setView('edit')
  }

  const handleSaveEdit = async (data: any) => {
    if (!selectedAgent) return
    try {
      setIsLoading(true)
      await window.electronAPI.agentUpdate(selectedAgent.id, data)
      await loadAgents()
      setSelectedAgent(null)
      setView('list')
    } catch (error) {
      console.error('Failed to update agent:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI.agentDelete(id)
      await loadAgents()
      if (selectedAgent?.id === id) {
        setSelectedAgent(null)
        setView('list')
      }
    } catch (error) {
      console.error('Failed to delete agent:', error)
    }
  }

  const handleToggleActive = async (id: string) => {
    try {
      await window.electronAPI.agentToggleActive(id)
      await loadAgents()
    } catch (error) {
      console.error('Failed to toggle agent:', error)
    }
  }

  const handleSelectAgent = (agent: AgentDefinition) => {
    setSelectedAgent(agent)
    setView('run')
  }

  const handleShowTemplates = async () => {
    await loadTemplates()
    setView('templates')
  }

  const handleShowExecutionLog = async (agent: AgentDefinition) => {
    setSelectedAgent(agent)
    try {
      const data = await window.electronAPI.agentGetExecutions(agent.id, 30)
      setExecutions(data)
      setView('execution-log')
    } catch (error) {
      console.error('Failed to load executions:', error)
    }
  }

  const handleViewExecution = async (executionId: string) => {
    try {
      const data = await window.electronAPI.agentGetExecutionDetails(executionId)
      setSelectedExecution(data)
    } catch (error) {
      console.error('Failed to load execution:', error)
    }
  }

  return (
    <div className="agent-studio">
      {/* Top tab switcher — only show on list views */}
      {((topTab === 'agents' && view === 'list') || (topTab === 'teams' && teamView === 'list') || topTab === 'mcp') && (
        <div className="agent-tabs">
          <button className={`agent-tab ${topTab === 'agents' ? 'active' : ''}`} onClick={() => setTopTab('agents')}>
            <Bot size={16} /> Agentes
          </button>
          <button className={`agent-tab ${topTab === 'teams' ? 'active' : ''}`} onClick={() => setTopTab('teams')}>
            <Users size={16} /> Equipes
          </button>
          <button className={`agent-tab ${topTab === 'mcp' ? 'active' : ''}`} onClick={() => setTopTab('mcp')}>
            <Plug size={16} /> MCP
          </button>
        </div>
      )}

      {/* === Agents Tab === */}
      {topTab === 'agents' && (
        <>
          {view === 'list' && (
            <AgentList
              agents={agents}
              onSelect={handleSelectAgent}
              onEdit={handleEdit}
              onShowTemplates={handleShowTemplates}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
              onShowLog={handleShowExecutionLog}
            />
          )}
          {view === 'templates' && (
            <TemplateSelector
              templates={templates}
              isLoading={isLoading}
              onSelect={handleCreateFromTemplate}
              onBack={() => setView('list')}
              onCreateCustom={() => setView('create')}
            />
          )}
          {view === 'create' && (
            <AgentCreator
              agents={agents}
              isLoading={isLoading}
              onCreate={handleCreateCustom}
              onBack={() => setView('templates')}
            />
          )}
          {view === 'edit' && selectedAgent && (
            <AgentCreator
              agents={agents}
              isLoading={isLoading}
              onCreate={handleSaveEdit}
              onBack={() => { setSelectedAgent(null); setView('list') }}
              editingAgent={selectedAgent}
            />
          )}
          {view === 'run' && selectedAgent && (
            <AgentRunner
              agent={selectedAgent}
              onBack={() => { setSelectedAgent(null); setView('list') }}
              onShowLog={() => handleShowExecutionLog(selectedAgent)}
            />
          )}
          {view === 'execution-log' && selectedAgent && (
            <ExecutionLog
              agent={selectedAgent}
              executions={executions}
              selectedExecution={selectedExecution}
              onSelectExecution={handleViewExecution}
              onBack={() => { setSelectedExecution(null); setView('list') }}
            />
          )}
        </>
      )}

      {/* === Teams Tab === */}
      {topTab === 'teams' && (
        <>
          {teamView === 'list' && (
            <TeamList
              teams={teams}
              agents={agents}
              onCreateTeam={() => setTeamView('create')}
              onSelectTeam={(team) => { setSelectedTeam(team); setTeamView('discussion') }}
              onDeleteTeam={async (id) => { await window.electronAPI.teamDelete(id); await loadTeams() }}
            />
          )}
          {teamView === 'create' && (
            <TeamCreator
              agents={agents}
              isLoading={isLoading}
              onCreate={async (data) => {
                setIsLoading(true)
                try {
                  await window.electronAPI.teamCreate(data)
                  await loadTeams()
                  setTeamView('list')
                } finally { setIsLoading(false) }
              }}
              onBack={() => setTeamView('list')}
            />
          )}
          {teamView === 'discussion' && selectedTeam && (
            <TeamDiscussion
              team={selectedTeam}
              agents={agents}
              onBack={() => { setSelectedTeam(null); setTeamExecution(null); setTeamView('list') }}
            />
          )}
        </>
      )}

      {/* === MCP Tab === */}
      {topTab === 'mcp' && (
        <MCPSettings />
      )}
    </div>
  )
}

// === Agent List ===

function AgentList({ agents, onSelect, onEdit, onShowTemplates, onDelete, onToggleActive, onShowLog }: {
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
        <button className="agent-btn-primary" onClick={onShowTemplates}>
          <Plus size={16} />
          <span>Novo Agente</span>
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="agent-empty-state">
          <Bot size={48} strokeWidth={1} />
          <h3>Nenhum agente criado</h3>
          <p>Crie agentes com habilidades específicas para automatizar tarefas no seu workspace.</p>
          <button className="agent-btn-primary" onClick={onShowTemplates}>
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
                <button className="agent-btn-icon" onClick={() => onSelect(agent)} title="Executar">
                  <Play size={16} />
                </button>
                <button className="agent-btn-icon" onClick={() => onEdit(agent)} title="Editar">
                  <Pencil size={16} />
                </button>
                <button className="agent-btn-icon" onClick={() => onShowLog(agent)} title="Histórico">
                  <Clock size={16} />
                </button>
                <button className="agent-btn-icon" onClick={() => onToggleActive(agent.id)} title={agent.isActive ? 'Desativar' : 'Ativar'}>
                  {agent.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                </button>
                <button className="agent-btn-icon danger" onClick={() => onDelete(agent.id)} title="Excluir">
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

// === Template Selector ===

function TemplateSelector({ templates, isLoading, onSelect, onBack, onCreateCustom }: {
  templates: AgentTemplate[]
  isLoading: boolean
  onSelect: (templateId: string) => void
  onBack: () => void
  onCreateCustom: () => void
}) {
  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <button className="agent-btn-icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="agent-studio-title">
          <Sparkles size={20} />
          <span>Criar Agente</span>
        </div>
        <button className="agent-btn-secondary" onClick={onCreateCustom}>
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

// === Agent Creator (custom) ===

const AVAILABLE_SKILLS: { key: string; label: string; category: string }[] = [
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

const ICON_OPTIONS = ['Bot', 'ClipboardCheck', 'PenTool', 'BarChart3', 'Lightbulb', 'Users']
const COLOR_OPTIONS = ['blue', 'purple', 'green', 'yellow', 'orange', 'red', 'cyan']

function AgentCreator({ agents, isLoading, onCreate, onBack, editingAgent }: {
  agents: AgentDefinition[]
  isLoading: boolean
  onCreate: (data: any) => void
  onBack: () => void
  editingAgent?: AgentDefinition
}) {
  const [name, setName] = useState(editingAgent?.name || '')
  const [description, setDescription] = useState(editingAgent?.description || '')
  const [persona, setPersona] = useState(editingAgent?.persona || '')
  const [icon, setIcon] = useState(editingAgent?.icon || 'Bot')
  const [color, setColor] = useState(editingAgent?.color || 'blue')
  const [skills, setSkills] = useState<string[]>(editingAgent?.skills || ['read_entries', 'read_tasks', 'read_projects'])
  const [maxSteps, setMaxSteps] = useState(editingAgent?.maxSteps || 6)
  const [canDelegate, setCanDelegate] = useState<string[]>(editingAgent?.canDelegate || [])
  const [requiresApproval, setRequiresApproval] = useState(editingAgent?.requiresApproval || false)

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
      if (generated.skills) setSkills(generated.skills)
      if (generated.maxSteps) setMaxSteps(generated.maxSteps)
    } catch (error) {
      console.error('Failed to generate agent:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    )
  }

  const toggleDelegate = (agentId: string) => {
    setCanDelegate((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    )
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
      scope: { projectIds: 'all' as const },
      triggers: [{ type: 'manual' }],
      canDelegate,
      maxSteps,
      isActive: true,
      requiresApproval,
    })
  }

  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <button className="agent-btn-icon" onClick={onBack}>
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
            <p className="agent-form-hint">Descreva o que você quer que o agente faça e a IA preenche tudo automaticamente.</p>
            <div className="agent-ai-generate-input">
              <input
                className="agent-form-input"
                placeholder="Ex: um agente que analise riscos de segurança nos meus projetos..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateWithAI() }}
                disabled={isGenerating}
              />
              <button
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
          <p className="agent-form-hint">Defina quem é esse agente, como ele se comporta, e o que ele deve fazer com seus dados.</p>
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
                <input
                  type="checkbox"
                  checked={skills.includes(s.key)}
                  onChange={() => toggleSkill(s.key)}
                />
                <span>{s.label}</span>
                <span className="agent-skill-category">{s.category}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Delegation */}
        {skills.includes('delegate') && agents.length > 0 && (
          <div className="agent-form-section">
            <label className="agent-form-label">Pode delegar para</label>
            <div className="agent-delegate-list">
              {agents.map((a) => (
                <label key={a.id} className={`agent-skill-checkbox ${canDelegate.includes(a.id) ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={canDelegate.includes(a.id)}
                    onChange={() => toggleDelegate(a.id)}
                  />
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
              onChange={(e) => setMaxSteps(parseInt(e.target.value) || 6)}
            />
          </div>

          <div className="agent-form-section">
            <label className="agent-form-label">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
              />
              {' '}Requer aprovação antes de executar ações
            </label>
          </div>
        </div>

        {/* Submit */}
        <button
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

// === Agent Runner ===

function AgentRunner({ agent, onBack, onShowLog }: {
  agent: AgentDefinition
  onBack: () => void
  onShowLog: () => void
}) {
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<AgentStep[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleRun = async () => {
    if (!input.trim() || isRunning) return

    setIsRunning(true)
    setResult(null)
    setError(null)
    setSteps([])

    try {
      const execution = await window.electronAPI.agentRun(agent.id, input.trim())
      setResult(execution.result || null)
      setError(execution.error || null)
      setSteps(execution.steps || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao executar agente')
    } finally {
      setIsRunning(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRun()
    }
  }

  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <button className="agent-btn-icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="agent-studio-title">
          <div className="agent-card-icon" style={{ color: getAgentColor(agent.color) }}>
            {getAgentIcon(agent.icon)}
          </div>
          <span>{agent.name}</span>
        </div>
        <button className="agent-btn-secondary" onClick={onShowLog}>
          <Clock size={16} />
          <span>Histórico</span>
        </button>
      </div>

      <p className="agent-subtitle">{agent.description}</p>

      {/* Input area */}
      <div className="agent-input-area">
        <textarea
          ref={inputRef}
          className="agent-input"
          placeholder={`Diga ao ${agent.name} o que fazer...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isRunning}
        />
        <button
          className="agent-btn-primary"
          onClick={handleRun}
          disabled={!input.trim() || isRunning}
        >
          {isRunning ? <Loader2 size={16} className="spinning" /> : <Send size={16} />}
          <span>{isRunning ? 'Executando...' : 'Executar'}</span>
        </button>
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="agent-steps">
          <h4 className="agent-section-title">Passos executados ({steps.length})</h4>
          {steps.map((step) => (
            <div key={step.id} className={`agent-step ${step.status}`}>
              <div className="agent-step-header">
                <StepStatusIcon status={step.status} />
                <span className="agent-step-skill">{step.skill}</span>
                <span className="agent-step-number">#{step.stepNumber}</span>
              </div>
              {step.reasoning && (
                <p className="agent-step-reasoning">{step.reasoning.slice(0, 150)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="agent-result success">
          <CheckCircle2 size={16} />
          <div className="agent-result-text"><MarkdownViewer content={result} /></div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="agent-result error">
          <XCircle size={16} />
          <div className="agent-result-text">{error}</div>
        </div>
      )}
    </div>
  )
}

// === Execution Log ===

function ExecutionLog({ agent, executions, selectedExecution, onSelectExecution, onBack }: {
  agent: AgentDefinition
  executions: AgentExecutionSummary[]
  selectedExecution: AgentExecution | null
  onSelectExecution: (id: string) => void
  onBack: () => void
}) {
  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <button className="agent-btn-icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="agent-studio-title">
          <Clock size={20} />
          <span>Histórico — {agent.name}</span>
        </div>
      </div>

      {selectedExecution ? (
        <ExecutionDetail
          execution={selectedExecution}
          onBack={() => onSelectExecution('')}
        />
      ) : (
        <div className="agent-executions-list">
          {executions.length === 0 ? (
            <div className="agent-empty-state small">
              <p>Nenhuma execução registrada.</p>
            </div>
          ) : (
            executions.map((exec) => (
              <div
                key={exec.id}
                className="agent-execution-item"
                onClick={() => onSelectExecution(exec.id)}
              >
                <div className="agent-execution-status">
                  <ExecutionStatusIcon status={exec.status} />
                </div>
                <div className="agent-execution-info">
                  <span className="agent-execution-input">{exec.input.slice(0, 80)}{exec.input.length > 80 ? '...' : ''}</span>
                  <span className="agent-execution-meta">
                    {exec.stepCount} passos · {formatRelativeDate(exec.createdAt)}
                  </span>
                </div>
                <ChevronRight size={16} className="agent-execution-chevron" />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// === Execution Detail ===

function ExecutionDetail({ execution, onBack }: {
  execution: AgentExecution
  onBack: () => void
}) {
  return (
    <div className="agent-execution-detail">
      <button className="agent-btn-text" onClick={onBack}>
        <ArrowLeft size={14} /> Voltar à lista
      </button>

      <div className="agent-execution-header-detail">
        <ExecutionStatusIcon status={execution.status} />
        <span className={`agent-execution-status-label ${execution.status}`}>
          {execution.status === 'completed' ? 'Concluída' :
            execution.status === 'failed' ? 'Falhou' :
              execution.status === 'running' ? 'Executando' :
                execution.status === 'cancelled' ? 'Cancelada' : execution.status}
        </span>
        <span className="agent-execution-date">{formatDate(execution.createdAt)}</span>
      </div>

      <div className="agent-execution-input-block">
        <strong>Input:</strong> {execution.input}
      </div>

      {execution.result && (
        <div className="agent-result success">
          <CheckCircle2 size={16} />
          <div className="agent-result-text"><MarkdownViewer content={execution.result} /></div>
        </div>
      )}

      {execution.error && (
        <div className="agent-result error">
          <XCircle size={16} />
          <div className="agent-result-text">{execution.error}</div>
        </div>
      )}

      {execution.steps.length > 0 && (
        <div className="agent-steps">
          <h4 className="agent-section-title">Passos ({execution.steps.length})</h4>
          {execution.steps.map((step) => (
            <div key={step.id} className={`agent-step ${step.status}`}>
              <div className="agent-step-header">
                <StepStatusIcon status={step.status} />
                <span className="agent-step-skill">{step.skill}</span>
                <span className="agent-step-number">#{step.stepNumber}</span>
              </div>
              {step.reasoning && (
                <p className="agent-step-reasoning">{step.reasoning.slice(0, 200)}</p>
              )}
              {step.output && (
                <details className="agent-step-output">
                  <summary>Output</summary>
                  <pre>{JSON.stringify(step.output, null, 2).slice(0, 500)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// === Helpers ===

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 size={14} className="step-icon success" />
    case 'failed': return <XCircle size={14} className="step-icon error" />
    case 'running': return <Loader2 size={14} className="step-icon spinning" />
    default: return <Clock size={14} className="step-icon pending" />
  }
}

function ExecutionStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 size={16} className="exec-icon success" />
    case 'failed': return <XCircle size={16} className="exec-icon error" />
    case 'running': return <Loader2 size={16} className="exec-icon spinning" />
    case 'cancelled': return <Square size={16} className="exec-icon cancelled" />
    default: return <Clock size={16} className="exec-icon pending" />
  }
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min atrás`
  if (diffHours < 24) return `${diffHours}h atrás`
  if (diffDays < 7) return `${diffDays}d atrás`
  return date.toLocaleDateString('pt-BR')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// === Team List ===

function TeamList({ teams, agents, onCreateTeam, onSelectTeam, onDeleteTeam }: {
  teams: any[]
  agents: AgentDefinition[]
  onCreateTeam: () => void
  onSelectTeam: (team: any) => void
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
        <button className="agent-btn-primary" onClick={onCreateTeam}>
          <Plus size={16} />
          <span>Nova Equipe</span>
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="agent-empty-state">
          <Users size={48} strokeWidth={1} />
          <h3>Nenhuma equipe criada</h3>
          <p>Crie equipes de agentes que discutem e colaboram sobre um tópico. Cada membro analisa o assunto e vê as opiniões dos anteriores.</p>
          <button className="agent-btn-primary" onClick={onCreateTeam}>
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
                <span className="agent-meta-item">{team.collaborationMode === 'sequential' ? 'Sequencial' : 'Paralelo'}</span>
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
                <button className="agent-btn-icon" onClick={(e) => { e.stopPropagation(); onSelectTeam(team) }} title="Iniciar Discussão">
                  <Play size={16} />
                </button>
                <button className="agent-btn-icon danger" onClick={(e) => { e.stopPropagation(); onDeleteTeam(team.id) }} title="Excluir">
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

// === Team Creator ===

function TeamCreator({ agents, isLoading, onCreate, onBack }: {
  agents: AgentDefinition[]
  isLoading: boolean
  onCreate: (data: any) => void
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [mode, setMode] = useState<'sequential' | 'parallel'>('sequential')

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
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
        <button className="agent-btn-icon" onClick={onBack}>
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
            <button className={`agent-mode-btn ${mode === 'sequential' ? 'selected' : ''}`} onClick={() => setMode('sequential')}>
              <span>Sequencial</span>
              <small>Cada agente vê as respostas anteriores</small>
            </button>
            <button className={`agent-mode-btn ${mode === 'parallel' ? 'selected' : ''}`} onClick={() => setMode('parallel')}>
              <span>Paralelo</span>
              <small>Todos analisam independentemente</small>
            </button>
          </div>
        </div>

        <div className="agent-form-section">
          <label className="agent-form-label">Membros (selecione e ordene — a ordem importa no modo sequencial)</label>
          <div className="team-member-selector">
            {agents.filter((a) => a.isActive).map((agent) => {
              const isSelected = memberIds.includes(agent.id)
              const index = memberIds.indexOf(agent.id)
              return (
                <div key={agent.id} className={`team-member-row ${isSelected ? 'selected' : ''}`}>
                  <button className="agent-btn-icon" onClick={() => toggleMember(agent.id)}>
                    {isSelected ? <CheckCircle2 size={16} className="step-icon success" /> : <div className="team-unchecked" />}
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
                      <button className="agent-btn-icon" onClick={() => moveMember(index, -1)} disabled={index === 0}>▲</button>
                      <button className="agent-btn-icon" onClick={() => moveMember(index, 1)} disabled={index === memberIds.length - 1}>▼</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <button
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

// === Team Discussion (Run + Results) ===

function TeamDiscussion({ team, agents, onBack }: {
  team: any
  agents: AgentDefinition[]
  onBack: () => void
}) {
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [execution, setExecution] = useState<any>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const agentMap = new Map(agents.map((a) => [a.id, a]))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleRun = async () => {
    if (!input.trim() || isRunning) return
    setIsRunning(true)
    setExecution(null)

    try {
      const result = await window.electronAPI.teamRunDiscussion(team.id, input.trim())
      setExecution(result)
    } catch (error: any) {
      setExecution({ status: 'failed', error: error.message, entries: [] })
    } finally {
      setIsRunning(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRun()
    }
  }

  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <button className="agent-btn-icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="agent-studio-title">
          <Users size={20} />
          <span>{team.name}</span>
        </div>
      </div>

      <p className="agent-subtitle">{team.description}</p>

      <div className="team-members-preview" style={{ marginBottom: 16 }}>
        {(team.memberIds || []).map((id: string, i: number) => {
          const agent = agentMap.get(id)
          return agent ? (
            <span key={id} className="team-member-chip" style={{ borderColor: getAgentColor(agent.color) }}>
              {i + 1}. {agent.name}
            </span>
          ) : null
        })}
      </div>

      {/* Input */}
      <div className="agent-input-area">
        <textarea
          ref={inputRef}
          className="agent-input"
          placeholder="Qual tema a equipe deve discutir?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isRunning}
        />
        <button
          className="agent-btn-primary"
          onClick={handleRun}
          disabled={!input.trim() || isRunning}
        >
          {isRunning ? <Loader2 size={16} className="spinning" /> : <Send size={16} />}
          <span>{isRunning ? 'Discutindo...' : 'Iniciar Discussão'}</span>
        </button>
      </div>

      {/* Discussion Results */}
      {execution && (
        <div className="team-discussion-results">
          <h4 className="agent-section-title">Discussão</h4>

          {execution.entries?.map((entry: any, idx: number) => (
            <div key={idx} className={`team-discussion-entry ${entry.status}`} style={{ '--agent-color': getAgentColor(entry.agentColor) } as React.CSSProperties}>
              <div className="team-entry-header">
                <div className="agent-card-icon small" style={{ color: getAgentColor(entry.agentColor) }}>
                  {getAgentIcon(entry.agentIcon)}
                </div>
                <span className="team-entry-name">{entry.agentName}</span>
                {entry.status === 'completed' && <CheckCircle2 size={14} className="step-icon success" />}
                {entry.status === 'failed' && <XCircle size={14} className="step-icon error" />}
              </div>
              {entry.status === 'completed' ? (
                <div className="team-entry-response"><MarkdownViewer content={entry.response} /></div>
              ) : (
                <div className="team-entry-error">Erro: {entry.error}</div>
              )}
            </div>
          ))}

          {/* Synthesis */}
          {execution.synthesis && (
            <div className="team-synthesis">
              <div className="team-synthesis-header">
                <Sparkles size={16} />
                <span>Síntese</span>
              </div>
              <div className="team-synthesis-content"><MarkdownViewer content={execution.synthesis} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// === MCP Settings ===

interface MCPServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
}

interface MCPStatus {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  toolCount: number
  error?: string
}

function MCPSettings() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [statuses, setStatuses] = useState<MCPStatus[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showJsonEditor, setShowJsonEditor] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [serverTools, setServerTools] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newArgs, setNewArgs] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadServers()
    loadStatuses()
  }, [])

  const loadServers = async () => {
    try {
      const data = await window.electronAPI.mcpGetServers()
      setServers(data)
    } catch (error) {
      console.error('Failed to load MCP servers:', error)
    }
  }

  const loadStatuses = async () => {
    try {
      const data = await window.electronAPI.mcpGetStatuses()
      setStatuses(data)
    } catch (error) {
      console.error('Failed to load MCP statuses:', error)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim() || !newCommand.trim()) return
    setIsLoading(true)
    try {
      await window.electronAPI.mcpAddServer({
        name: newName.trim(),
        command: newCommand.trim(),
        args: newArgs.trim() ? newArgs.trim().split(' ') : [],
        enabled: true,
      })
      setNewName('')
      setNewCommand('')
      setNewArgs('')
      setShowAddForm(false)
      await loadServers()
      await loadStatuses()
    } catch (error) {
      console.error('Failed to add MCP server:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportJson = async () => {
    setJsonError(null)
    try {
      const parsed = JSON.parse(jsonInput.trim())

      // Support both formats:
      // 1. { "mcpServers": { "name": { command, args, env } } }  (Claude Desktop / Kiro style)
      // 2. { "name": { command, args, env } }  (direct object)
      const serversObj = parsed.mcpServers || parsed

      if (typeof serversObj !== 'object' || Array.isArray(serversObj)) {
        setJsonError('JSON inválido. Esperado um objeto com servers configurados.')
        return
      }

      setIsLoading(true)
      let count = 0

      for (const [name, config] of Object.entries(serversObj) as [string, any][]) {
        if (!config.command) continue

        await window.electronAPI.mcpAddServer({
          name,
          command: config.command,
          args: config.args || [],
          env: config.env,
          enabled: config.disabled !== true,
        })
        count++
      }

      if (count === 0) {
        setJsonError('Nenhum server válido encontrado no JSON.')
        setIsLoading(false)
        return
      }

      setJsonInput('')
      setShowJsonEditor(false)
      await loadServers()
      await loadStatuses()
    } catch (error: any) {
      setJsonError(`Erro ao parsear JSON: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await window.electronAPI.mcpRemoveServer(id)
      await loadServers()
      await loadStatuses()
    } catch (error) {
      console.error('Failed to remove MCP server:', error)
    }
  }

  const handleConnect = async (id: string) => {
    try {
      await window.electronAPI.mcpConnect(id)
      await loadStatuses()
    } catch (error) {
      console.error('Failed to connect MCP server:', error)
      await loadStatuses()
    }
  }

  const handleDisconnect = async (id: string) => {
    try {
      await window.electronAPI.mcpDisconnect(id)
      await loadStatuses()
    } catch (error) {
      console.error('Failed to disconnect MCP server:', error)
    }
  }

  const toggleExpand = async (id: string) => {
    if (expandedServer === id) {
      setExpandedServer(null)
      setServerTools([])
      return
    }
    setExpandedServer(id)
    try {
      const tools = await window.electronAPI.mcpGetTools()
      setServerTools(tools.filter((t: any) => t.serverId === id))
    } catch {
      setServerTools([])
    }
  }

  const getStatus = (id: string): MCPStatus | undefined => {
    return statuses.find((s) => s.id === id)
  }

  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <div className="agent-studio-title">
          <Plug size={20} />
          <span>MCP Servers</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="agent-btn-secondary" onClick={() => { setShowJsonEditor(true); setShowAddForm(false) }}>
            <span>{ } JSON</span>
          </button>
          <button className="agent-btn-primary" onClick={() => { setShowAddForm(true); setShowJsonEditor(false) }}>
            <Plus size={16} />
            <span>Adicionar</span>
          </button>
        </div>
      </div>

      <p className="agent-subtitle">
        Conecte servidores MCP para dar acesso externo aos seus agentes (GitHub, Jira, banco de dados, APIs, etc).
        Agentes com a skill "Ferramentas MCP" podem usar as tools desses servidores.
      </p>

      {/* Add form */}
      {showAddForm && (
        <div className="mcp-add-form">
          <div className="agent-form-section">
            <label className="agent-form-label">Nome</label>
            <input
              className="agent-form-input"
              placeholder="Ex: GitHub, Postgres, File System..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="agent-form-section">
            <label className="agent-form-label">Comando</label>
            <input
              className="agent-form-input"
              placeholder="Ex: npx, uvx, node, python..."
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
            />
          </div>
          <div className="agent-form-section">
            <label className="agent-form-label">Argumentos (separados por espaço)</label>
            <input
              className="agent-form-input"
              placeholder="Ex: @modelcontextprotocol/server-github ou path/to/server.js"
              value={newArgs}
              onChange={(e) => setNewArgs(e.target.value)}
            />
          </div>
          <div className="mcp-add-actions">
            <button className="agent-btn-primary" onClick={handleAdd} disabled={!newName.trim() || !newCommand.trim() || isLoading}>
              {isLoading ? <Loader2 size={14} className="spinning" /> : <Plus size={14} />}
              <span>Adicionar</span>
            </button>
            <button className="agent-btn-secondary" onClick={() => setShowAddForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* JSON Editor */}
      {showJsonEditor && (
        <div className="mcp-add-form">
          <div className="agent-form-section">
            <label className="agent-form-label">Importar JSON</label>
            <p className="agent-form-hint">
              Cole o JSON de configuração MCP. Suporta o formato do Claude Desktop, Kiro, e similares.
            </p>
            <textarea
              className="agent-form-textarea mcp-json-editor"
              placeholder={`{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["@modelcontextprotocol/server-github"],\n      "env": { "GITHUB_TOKEN": "seu-token" }\n    }\n  }\n}`}
              value={jsonInput}
              onChange={(e) => { setJsonInput(e.target.value); setJsonError(null) }}
              rows={10}
            />
            {jsonError && <p className="mcp-json-error">{jsonError}</p>}
          </div>
          <div className="mcp-add-actions">
            <button className="agent-btn-primary" onClick={handleImportJson} disabled={!jsonInput.trim() || isLoading}>
              {isLoading ? <Loader2 size={14} className="spinning" /> : <Plus size={14} />}
              <span>Importar</span>
            </button>
            <button className="agent-btn-secondary" onClick={() => { setShowJsonEditor(false); setJsonError(null) }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Server list */}
      {servers.length === 0 && !showAddForm && !showJsonEditor ? (
        <div className="agent-empty-state">
          <Plug size={48} strokeWidth={1} />
          <h3>Nenhum server MCP configurado</h3>
          <p>Adicione servidores MCP para expandir as capacidades dos seus agentes com ferramentas externas.</p>
          <button className="agent-btn-primary" onClick={() => setShowAddForm(true)}>
            <Plus size={16} />
            <span>Adicionar Server</span>
          </button>
        </div>
      ) : (
        <div className="mcp-server-list">
          {servers.map((server) => {
            const status = getStatus(server.id)
            return (
              <div key={server.id} className={`mcp-server-card ${expandedServer === server.id ? 'expanded' : ''}`}>
                <div className="mcp-server-main" onClick={() => status?.status === 'connected' ? toggleExpand(server.id) : null}>
                  <div className="mcp-server-info">
                    <div className="mcp-server-header">
                      <Plug size={16} className={`mcp-status-icon ${status?.status || 'disconnected'}`} />
                      <span className="mcp-server-name">{server.name}</span>
                      <span className={`mcp-status-badge ${status?.status || 'disconnected'}`}>
                        {status?.status === 'connected' ? `Conectado · ${status.toolCount} tools` :
                          status?.status === 'connecting' ? 'Conectando...' :
                            status?.status === 'error' ? 'Erro' : 'Desconectado'}
                      </span>
                      {status?.status === 'connected' && (
                        <ChevronRight size={14} className={`mcp-expand-icon ${expandedServer === server.id ? 'rotated' : ''}`} />
                      )}
                    </div>
                    <div className="mcp-server-command">
                      <code>{server.command} {server.args.join(' ')}</code>
                    </div>
                  </div>
                  <div className="mcp-server-actions" onClick={(e) => e.stopPropagation()}>
                    {status?.status === 'connected' ? (
                      <button className="agent-btn-icon" onClick={() => handleDisconnect(server.id)} title="Desconectar">
                        <PowerOff size={16} />
                      </button>
                    ) : (
                      <button className="agent-btn-icon" onClick={() => handleConnect(server.id)} title="Conectar">
                        <Power size={16} />
                      </button>
                    )}
                    <button className="agent-btn-icon danger" onClick={() => handleRemove(server.id)} title="Remover">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {expandedServer === server.id && serverTools.length > 0 && (
                  <div className="mcp-tools-list">
                    {serverTools.map((tool: any, idx: number) => (
                      <div key={idx} className="mcp-tool-item">
                        <span className="mcp-tool-name">{tool.name}</span>
                        <span className="mcp-tool-desc">{tool.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
