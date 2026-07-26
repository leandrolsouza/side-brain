import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock, Loader2, Send, XCircle } from 'lucide-react'
import type { AgentDefinition, AgentRunResult, AgentStep } from '@shared/types'
import { MarkdownViewer } from '../MarkdownViewer'
import { getAgentColor, getAgentIcon } from './agent-visuals'
import { StepStatusIcon } from './status-icons'

export function AgentRunner({
  agent,
  onBack,
  onShowLog,
}: {
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
      const execution: AgentRunResult = await window.electronAPI.agentRun(agent.id, input.trim())
      setResult(execution.result || null)
      setError(execution.error || null)
      setSteps(execution.steps || [])
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Erro ao executar agente')
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
          <div className="agent-card-icon" style={{ color: getAgentColor(agent.color) }}>
            {getAgentIcon(agent.icon)}
          </div>
          <span>{agent.name}</span>
        </div>
        <button type="button" className="agent-btn-secondary" onClick={onShowLog}>
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
        <button type="button" className="agent-btn-primary" onClick={handleRun} disabled={!input.trim() || isRunning}>
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
              {step.reasoning && <p className="agent-step-reasoning">{step.reasoning.slice(0, 150)}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="agent-result success">
          <CheckCircle2 size={16} />
          <div className="agent-result-text">
            <MarkdownViewer content={result} />
          </div>
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
