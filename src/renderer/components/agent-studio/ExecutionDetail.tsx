import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import type { AgentExecution } from '@shared/types'
import { MarkdownViewer } from '../MarkdownViewer'
import { formatDate } from './format'
import { ExecutionStatusIcon, StepStatusIcon } from './status-icons'

export function ExecutionDetail({ execution, onBack }: { execution: AgentExecution; onBack: () => void }) {
  return (
    <div className="agent-execution-detail">
      <button type="button" className="agent-btn-text" onClick={onBack}>
        <ArrowLeft size={14} /> Voltar à lista
      </button>

      <div className="agent-execution-header-detail">
        <ExecutionStatusIcon status={execution.status} />
        <span className={`agent-execution-status-label ${execution.status}`}>
          {execution.status === 'completed'
            ? 'Concluída'
            : execution.status === 'failed'
              ? 'Falhou'
              : execution.status === 'running'
                ? 'Executando'
                : execution.status === 'cancelled'
                  ? 'Cancelada'
                  : execution.status}
        </span>
        <span className="agent-execution-date">{formatDate(execution.createdAt)}</span>
      </div>

      <div className="agent-execution-input-block">
        <strong>Input:</strong> {execution.input}
      </div>

      {execution.result && (
        <div className="agent-result success">
          <CheckCircle2 size={16} />
          <div className="agent-result-text">
            <MarkdownViewer content={execution.result} />
          </div>
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
              {step.reasoning && <p className="agent-step-reasoning">{step.reasoning.slice(0, 200)}</p>}
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
