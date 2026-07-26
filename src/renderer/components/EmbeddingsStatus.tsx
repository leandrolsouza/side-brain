import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface Status {
  totalEntries: number
  indexedEntries: number
  totalTasks: number
  indexedTasks: number
  isIndexing: boolean
}

export function EmbeddingsStatus() {
  const { t } = useTranslation('settings')
  const [status, setStatus] = useState<Status | null>(null)
  const [supported, setSupported] = useState<boolean>(true)
  const [isIndexing, setIsIndexing] = useState(false)
  const [result, setResult] = useState<{ indexed: number; failed: number } | null>(null)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      const [s, sup] = await Promise.all([
        window.electronAPI.embeddingsGetStatus(),
        window.electronAPI.embeddingsSupportsEmbeddings(),
      ])
      setStatus(s)
      setSupported(sup)
    } catch (error) {
      console.error('Failed to load embeddings status:', error)
    }
  }

  const handleIndexAll = async () => {
    setIsIndexing(true)
    setResult(null)
    try {
      const res = await window.electronAPI.embeddingsIndexAll()
      setResult(res)
      await loadStatus()
    } catch (error) {
      console.error('Indexing failed:', error)
    } finally {
      setIsIndexing(false)
    }
  }

  const handleReindexAll = async () => {
    setIsIndexing(true)
    setResult(null)
    try {
      const res = await window.electronAPI.embeddingsReindexAll()
      setResult(res)
      await loadStatus()
    } catch (error) {
      console.error('Reindexing failed:', error)
    } finally {
      setIsIndexing(false)
    }
  }

  if (!supported) {
    return (
      <div className="embeddings-status">
        <div className="embeddings-unsupported">
          <AlertCircle size={14} />
          <span>{t('avancado.embeddings_unsupported')}</span>
        </div>
      </div>
    )
  }

  if (!status) return null

  const totalItems = status.totalEntries + status.totalTasks
  const indexedItems = status.indexedEntries + status.indexedTasks
  const percentage = totalItems > 0 ? Math.round((indexedItems / totalItems) * 100) : 0
  const isFullyIndexed = indexedItems === totalItems && totalItems > 0

  return (
    <div className="embeddings-status">
      <div className="embeddings-progress">
        <div className="embeddings-progress-bar">
          <div className="embeddings-progress-fill" style={{ width: `${percentage}%` }} />
        </div>
        <div className="embeddings-progress-label">
          {isFullyIndexed ? (
            <span className="embeddings-complete">
              <CheckCircle2 size={12} />
              {t('avancado.embeddings_complete')}
            </span>
          ) : (
            <span>{t('avancado.embeddings_progress', { indexed: indexedItems, total: totalItems, percentage })}</span>
          )}
        </div>
        <div className="embeddings-detail">
          <span>
            {t('avancado.embeddings_entries', { indexed: status.indexedEntries, total: status.totalEntries })}
          </span>
          <span>{t('avancado.embeddings_tasks', { indexed: status.indexedTasks, total: status.totalTasks })}</span>
        </div>
      </div>

      <div className="embeddings-actions" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="vscode-button secondary"
          onClick={handleIndexAll}
          disabled={isIndexing || isFullyIndexed}
        >
          {isIndexing ? (
            <>
              <Loader2 size={14} className="spinning" style={{ marginRight: 4 }} />
              {t('avancado.embeddings_indexing')}
            </>
          ) : (
            <>
              <RefreshCw size={14} style={{ marginRight: 4 }} />
              {t('avancado.embeddings_index_missing')}
            </>
          )}
        </button>
        <button
          type="button"
          className="vscode-button secondary"
          onClick={handleReindexAll}
          disabled={isIndexing}
          style={{ marginLeft: 8 }}
        >
          {t('avancado.embeddings_reindex_all')}
        </button>
      </div>

      {result && (
        <div className="embeddings-result" style={{ marginTop: 8 }}>
          <span>{t('avancado.embeddings_result', { indexed: result.indexed, failed: result.failed })}</span>
        </div>
      )}
    </div>
  )
}
