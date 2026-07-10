import React, { useState } from 'react'
import { Database, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'

interface Props {
  onComplete: () => void
  onBack: () => void
}

export function OnboardingImport({ onComplete, onBack }: Props) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleImport = async () => {
    try {
      const result = await window.electronAPI.importBackup()
      if (result.success) {
        setStatus('success')
      } else if (result.error && result.error !== 'Operação cancelada.') {
        setStatus('error')
        setErrorMessage(result.error)
      }
      // If cancelled, stay on same screen (idle)
    } catch (err: any) {
      setStatus('error')
      setErrorMessage(err?.message || 'Erro ao importar')
    }
  }

  if (status === 'success') {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon onboarding-icon-success">
          <CheckCircle size={56} strokeWidth={1.5} />
        </div>
        <h1 className="onboarding-title">Base importada!</h1>
        <p className="onboarding-description">
          Seus projetos, entradas e tarefas foram restaurados com sucesso.
          O app vai reiniciar para aplicar os dados.
        </p>
        <button className="onboarding-btn-primary" onClick={onComplete}>
          Reiniciar app
        </button>
      </div>
    )
  }

  return (
    <div className="onboarding-step">
      <div className="onboarding-icon">
        <Database size={48} strokeWidth={1.5} />
      </div>
      <h1 className="onboarding-title">Importar base existente</h1>
      <p className="onboarding-description">
        Selecione o arquivo <code>.db</code> do SideBrain da sua outra máquina.
        Você pode encontrá-lo na pasta de dados do app ou em um backup exportado.
      </p>

      {status === 'error' && (
        <div className="onboarding-error">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="onboarding-actions">
        <button className="onboarding-btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <button className="onboarding-btn-primary" onClick={handleImport}>
          Selecionar arquivo .db
        </button>
      </div>

      <p className="onboarding-hint" style={{ marginTop: '16px' }}>
        Dica: na outra máquina, use Configurações → Backup → Exportar para gerar o arquivo.
      </p>
    </div>
  )
}
