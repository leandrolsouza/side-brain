import { ArrowLeft, ChevronRight, Clock } from 'lucide-react'
import type { AgentDefinition, AgentExecution, AgentExecutionSummary } from '@shared/types'
import { ExecutionDetail } from './ExecutionDetail'
import { formatRelativeDate } from './format'
import { ExecutionStatusIcon } from './status-icons'

export function ExecutionLog({
  agent,
  executions,
  selectedExecution,
  onSelectExecution,
  onBack,
}: {
  agent: AgentDefinition
  executions: AgentExecutionSummary[]
  selectedExecution: AgentExecution | null
  onSelectExecution: (id: string) => void
  onBack: () => void
}) {
  return (
    <div className="agent-studio-panel">
      <div className="agent-studio-header">
        <button type="button" className="agent-btn-icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="agent-studio-title">
          <Clock size={20} />
          <span>Histórico — {agent.name}</span>
        </div>
      </div>

      {selectedExecution ? (
        <ExecutionDetail execution={selectedExecution} onBack={() => onSelectExecution('')} />
      ) : (
        <div className="agent-executions-list">
          {executions.length === 0 ? (
            <div className="agent-empty-state small">
              <p>Nenhuma execução registrada.</p>
            </div>
          ) : (
            executions.map((exec) => (
              <div key={exec.id} className="agent-execution-item" onClick={() => onSelectExecution(exec.id)}>
                <div className="agent-execution-status">
                  <ExecutionStatusIcon status={exec.status} />
                </div>
                <div className="agent-execution-info">
                  <span className="agent-execution-input">
                    {exec.input.slice(0, 80)}
                    {exec.input.length > 80 ? '...' : ''}
                  </span>
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
