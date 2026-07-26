import { CheckCircle2, Clock, Loader2, Square, XCircle } from 'lucide-react'

export function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={14} className="step-icon success" />
    case 'failed':
      return <XCircle size={14} className="step-icon error" />
    case 'running':
      return <Loader2 size={14} className="step-icon spinning" />
    default:
      return <Clock size={14} className="step-icon pending" />
  }
}

export function ExecutionStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={16} className="exec-icon success" />
    case 'failed':
      return <XCircle size={16} className="exec-icon error" />
    case 'running':
      return <Loader2 size={16} className="exec-icon spinning" />
    case 'cancelled':
      return <Square size={16} className="exec-icon cancelled" />
    default:
      return <Clock size={16} className="exec-icon pending" />
  }
}
