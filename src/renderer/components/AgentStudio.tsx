import { useEffect, useState } from 'react'
import { Bot, Plug, Users } from 'lucide-react'
import type {
  AgentCreateData,
  AgentDefinition,
  AgentExecution,
  AgentExecutionSummary,
  AgentTeam,
  AgentTemplate,
  TeamCreateData,
  TeamExecution,
} from '@shared/types'
import { AgentCreator } from './agent-studio/AgentCreator'
import { AgentList } from './agent-studio/AgentList'
import { AgentRunner } from './agent-studio/AgentRunner'
import { ExecutionLog } from './agent-studio/ExecutionLog'
import { MCPSettings } from './agent-studio/MCPSettings'
import { TeamCreator } from './agent-studio/TeamCreator'
import { TeamDiscussion } from './agent-studio/TeamDiscussion'
import { TeamList } from './agent-studio/TeamList'
import { TemplateSelector } from './agent-studio/TemplateSelector'

// === Sub-views ===

type AgentView = 'list' | 'templates' | 'create' | 'run' | 'execution-log' | 'edit'

type TopTab = 'agents' | 'teams' | 'mcp'

// === Main Component ===

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
  const [teams, setTeams] = useState<AgentTeam[]>([])
  const [teamView, setTeamView] = useState<'list' | 'create' | 'discussion' | 'history'>('list')
  const [selectedTeam, setSelectedTeam] = useState<AgentTeam | null>(null)
  const [, setTeamExecution] = useState<TeamExecution | null>(null)

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

  const handleCreateCustom = async (data: AgentCreateData) => {
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

  const handleSaveEdit = async (data: AgentCreateData) => {
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

  const handleCreateTeam = async (data: TeamCreateData) => {
    setIsLoading(true)
    try {
      await window.electronAPI.teamCreate(data)
      await loadTeams()
      setTeamView('list')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="agent-studio">
      {/* Top tab switcher — only show on list views */}
      {((topTab === 'agents' && view === 'list') ||
        (topTab === 'teams' && teamView === 'list') ||
        topTab === 'mcp') && (
        <div className="agent-tabs">
          <button
            type="button"
            className={`agent-tab ${topTab === 'agents' ? 'active' : ''}`}
            onClick={() => setTopTab('agents')}
          >
            <Bot size={16} /> Agentes
          </button>
          <button
            type="button"
            className={`agent-tab ${topTab === 'teams' ? 'active' : ''}`}
            onClick={() => setTopTab('teams')}
          >
            <Users size={16} /> Equipes
          </button>
          <button
            type="button"
            className={`agent-tab ${topTab === 'mcp' ? 'active' : ''}`}
            onClick={() => setTopTab('mcp')}
          >
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
              onBack={() => {
                setSelectedAgent(null)
                setView('list')
              }}
              editingAgent={selectedAgent}
            />
          )}
          {view === 'run' && selectedAgent && (
            <AgentRunner
              agent={selectedAgent}
              onBack={() => {
                setSelectedAgent(null)
                setView('list')
              }}
              onShowLog={() => handleShowExecutionLog(selectedAgent)}
            />
          )}
          {view === 'execution-log' && selectedAgent && (
            <ExecutionLog
              agent={selectedAgent}
              executions={executions}
              selectedExecution={selectedExecution}
              onSelectExecution={handleViewExecution}
              onBack={() => {
                setSelectedExecution(null)
                setView('list')
              }}
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
              onSelectTeam={(team) => {
                setSelectedTeam(team)
                setTeamView('discussion')
              }}
              onDeleteTeam={async (id) => {
                await window.electronAPI.teamDelete(id)
                await loadTeams()
              }}
            />
          )}
          {teamView === 'create' && (
            <TeamCreator
              agents={agents}
              isLoading={isLoading}
              onCreate={handleCreateTeam}
              onBack={() => setTeamView('list')}
            />
          )}
          {teamView === 'discussion' && selectedTeam && (
            <TeamDiscussion
              team={selectedTeam}
              agents={agents}
              onBack={() => {
                setSelectedTeam(null)
                setTeamExecution(null)
                setTeamView('list')
              }}
            />
          )}
        </>
      )}

      {/* === MCP Tab === */}
      {topTab === 'mcp' && <MCPSettings />}
    </div>
  )
}
