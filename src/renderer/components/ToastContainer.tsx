import React from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast, ToastType } from './ToastContext'

const ICON_MAP: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="app-toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`app-toast app-toast--${toast.type} ${toast.exiting ? 'app-toast--exit' : ''}`}
        >
          <div className="app-toast-icon">
            {ICON_MAP[toast.type]}
          </div>
          <span className="app-toast-message">{toast.message}</span>
          <button
            className="app-toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
