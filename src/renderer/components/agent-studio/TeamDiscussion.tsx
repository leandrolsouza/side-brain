import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, Send, Sparkles, Users, XCircle } from 'lucide-react'
import type { AgentDefinition, AgentTeam, TeamExecution } from '@shared/types'
import { MarkdownViewer } from '../MarkdownViewer'
import { getAgentColor, getAgentIcon } from './agent-visuals'

/**
 * Local discussion state: either a full TeamExecution from the main process,
 * or a minimal failure shape built in the catch block.
 */
type TeamDiscussionResult = Partial<TeamExecution> & { error?: string }

export function TeamDiscussion({
  team,
  agents,
  onBack,
}: {
  team: AgentTeam
  agents: AgentDefinition[]
  onBack: () => void
}) {
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [execution, setExecution] = useState<TeamDiscussionResult | null>(null)
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
    } catch (error) {
      setExecution({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        entries: [],
      })
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
        <button type="button" className="agent-btn-icon" onClick={onBack}>
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
        <button type="button" className="agent-btn-primary" onClick={handleRun} disabled={!input.trim() || isRunning}>
          {isRunning ? <Loader2 size={16} className="spinning" /> : <Send size={16} />}
          <span>{isRunning ? 'Discutindo...' : 'Iniciar Discussão'}</span>
        </button>
      </div>

      {/* Discussion Results */}
      {execution && (
        <div className="team-discussion-results">
          <h4 className="agent-section-title">Discussão</h4>

          {execution.entries?.map((entry, idx) => (
            <div
              key={idx}
              className={`team-discussion-entry ${entry.status}`}
              style={{ '--agent-color': getAgentColor(entry.agentColor) } as React.CSSProperties}
            >
              <div className="team-entry-header">
                <div className="agent-card-icon small" style={{ color: getAgentColor(entry.agentColor) }}>
                  {getAgentIcon(entry.agentIcon)}
                </div>
                <span className="team-entry-name">{entry.agentName}</span>
                {entry.status === 'completed' && <CheckCircle2 size={14} className="step-icon success" />}
                {entry.status === 'failed' && <XCircle size={14} className="step-icon error" />}
              </div>
              {entry.status === 'completed' ? (
                <div className="team-entry-response">
                  <MarkdownViewer content={entry.response} />
                </div>
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
              <div className="team-synthesis-content">
                <MarkdownViewer content={execution.synthesis} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
