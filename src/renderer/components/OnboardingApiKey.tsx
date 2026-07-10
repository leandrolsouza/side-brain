import React, { useState } from 'react'
import { Key } from 'lucide-react'

interface Props {
  onNext: (apiKey: string, provider: string) => void
  onSkip: () => void
}

export function OnboardingApiKey({ onNext, onSkip }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState('bedrock')

  const handleContinue = () => {
    onNext(apiKey, provider)
  }

  return (
    <div className="onboarding-step">
      <div className="onboarding-icon">
        <Key size={48} strokeWidth={1.5} />
      </div>
      <h1 className="onboarding-title">Configurar IA</h1>
      <p className="onboarding-description">
        O SideBrain usa inteligência artificial para categorizar suas entradas,
        sugerir tarefas e gerar resumos. Configure sua chave de API para ativar esses recursos.
      </p>

      <div className="onboarding-form">
        <label className="onboarding-label">Provedor</label>
        <select
          className="onboarding-select"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="bedrock">AWS Bedrock</option>
          <option value="openai">OpenAI</option>
          <option value="gemini">Google Gemini</option>
          <option value="grok">Grok</option>
          <option value="local">LLM Local</option>
        </select>

        {provider !== 'local' && (
          <>
            <label className="onboarding-label">Chave de API</label>
            <input
              type="password"
              className="onboarding-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === 'bedrock' ? 'Sua API Key do AWS Bedrock' :
                provider === 'openai' ? 'sk-...' :
                provider === 'gemini' ? 'Sua API Key do Gemini' :
                'Sua API Key do Grok'
              }
            />
          </>
        )}

        {provider === 'local' && (
          <>
            <label className="onboarding-label">Endpoint</label>
            <input
              type="text"
              className="onboarding-input"
              value="http://localhost:1234"
              disabled
              placeholder="http://localhost:1234"
            />
            <p className="onboarding-hint">
              Compatível com LM Studio, Ollama e outros servidores OpenAI-compatíveis.
            </p>
          </>
        )}
      </div>

      <div className="onboarding-actions">
        <button className="onboarding-btn-secondary" onClick={onSkip}>
          Configurar depois
        </button>
        <button
          className="onboarding-btn-primary"
          onClick={handleContinue}
          disabled={provider !== 'local' && !apiKey.trim()}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
