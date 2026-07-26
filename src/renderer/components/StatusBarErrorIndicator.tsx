import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface StatusBarErrorIndicatorProps {
  onClick: () => void
}

export function StatusBarErrorIndicator({ onClick }: StatusBarErrorIndicatorProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    window.electronAPI
      .getUnresolvedErrorCount()
      .then(setCount)
      .catch(() => {})
    window.electronAPI.onErrorCountChanged((c) => setCount(c))
  }, [])

  return (
    <div
      className={`status-bar-item clickable error-indicator ${count > 0 ? 'has-errors' : ''}`}
      onClick={onClick}
      title={
        count > 0
          ? `${count} erro${count > 1 ? 's' : ''} não resolvido${count > 1 ? 's' : ''} — clique para abrir`
          : 'Sistema sem erros'
      }
    >
      {count > 0 ? (
        <>
          <AlertCircle size={14} />
          <span>{count}</span>
        </>
      ) : (
        <>
          <CheckCircle2 size={14} />
          <span>0 erros</span>
        </>
      )}
    </div>
  )
}
