import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Loader2, RefreshCw, X } from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'

interface ReportNarrativeProps {
  period: string
}

export function ReportNarrative({ period }: ReportNarrativeProps) {
  const { t } = useTranslation('reports')
  const [narrative, setNarrative] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const generateNarrative = async () => {
    setLoading(true)
    setError(false)
    try {
      const result = await window.electronAPI.generateReportNarrative(period as any)
      setNarrative(result)
      setShowModal(true)
    } catch (err) {
      console.error('Failed to generate narrative:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Compact CTA card */}
      <div className="report-narrative-card">
        <div className="report-narrative-header">
          <Sparkles size={16} />
          <span>{t('narrativeTitle')}</span>
          {narrative && (
            <button
              className="btn-icon"
              onClick={() => setShowModal(true)}
              title={t('narrativeView')}
              style={{ marginLeft: 'auto' }}
            >
              <Sparkles size={14} />
            </button>
          )}
        </div>
        {!narrative && !loading && !error && (
          <>
            <p className="report-narrative-description">{t('narrativeDescription')}</p>
            <button
              className="vscode-button"
              onClick={generateNarrative}
              style={{ marginTop: 8 }}
            >
              <Sparkles size={14} style={{ marginRight: 6 }} />
              {t('narrativeGenerate')}
            </button>
          </>
        )}
        {loading && (
          <div className="report-narrative-loading">
            <Loader2 size={14} className="spinning" />
            <span>{t('narrativeLoading')}</span>
          </div>
        )}
        {error && (
          <>
            <p className="report-narrative-error">{t('narrativeError')}</p>
            <button
              className="vscode-button secondary"
              onClick={generateNarrative}
              style={{ marginTop: 8 }}
            >
              {t('narrativeRetry')}
            </button>
          </>
        )}
        {narrative && !loading && !error && (
          <div className="report-narrative-inline-actions">
            <button
              className="vscode-button"
              onClick={() => setShowModal(true)}
            >
              {t('narrativeView')}
            </button>
            <button
              className="vscode-button secondary"
              onClick={generateNarrative}
              style={{ marginLeft: 8 }}
            >
              <RefreshCw size={14} style={{ marginRight: 4 }} />
              {t('narrativeRegenerate')}
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && narrative && (
        <div className="summary-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="summary-modal-header">
              <Sparkles size={16} />
              <span>{t('narrativeTitle')}</span>
              <button className="icon-button" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="summary-modal-body">
              <MarkdownViewer content={narrative} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
