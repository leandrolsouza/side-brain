import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../ToastContext'

export function useDatabaseSettings() {
  const { t } = useTranslation('settings')
  const { addToast } = useToast()
  const [backups, setBackups] = useState<
    { filename: string; filePath: string; createdAt: string; sizeBytes: number }[]
  >([])
  const [backupLoading, setBackupLoading] = useState(false)
  const [dbPathInfo, setDbPathInfo] = useState<{ currentPath: string; defaultPath: string; isCustom: boolean } | null>(
    null
  )
  const [dbPathLoading, setDbPathLoading] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    confirmLabel: string
    cancelLabel?: string
    alternativeLabel?: string
    secondAlternativeLabel?: string
    variant: 'danger' | 'warning' | 'default'
    onConfirm: () => void
    onAlternative?: () => void
    onSecondAlternative?: () => void
  } | null>(null)

  useEffect(() => {
    loadBackups()
    loadDbPath()
  }, [])

  const loadBackups = async () => {
    const list = await window.electronAPI.listBackups()
    setBackups(list)
  }

  const loadDbPath = async () => {
    const info = await window.electronAPI.getDatabasePath()
    setDbPathInfo(info)
  }

  const showBackupMessage = (type: 'success' | 'error', text: string) => {
    addToast(text, type === 'success' ? 'success' : 'error')
  }

  const handleExportBackup = async () => {
    setBackupLoading(true)
    try {
      const result = await window.electronAPI.createManualBackup()
      if (result.success) {
        showBackupMessage('success', t('dados.backup_export_success'))
      }
    } catch {
      showBackupMessage('error', t('dados.backup_export_error'))
    } finally {
      setBackupLoading(false)
    }
  }

  const handleImportBackup = async () => {
    setConfirmModal({
      title: t('modals.import_title'),
      message: t('modals.import_message'),
      confirmLabel: t('modals.import_confirm'),
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        setBackupLoading(true)
        try {
          const result = await window.electronAPI.importBackup()
          if (result.success) {
            showBackupMessage('success', t('dados.backup_import_success'))
          } else if (result.error && result.error !== 'Operação cancelada.') {
            showBackupMessage('error', result.error)
          }
        } catch {
          showBackupMessage('error', t('dados.backup_import_error'))
        } finally {
          setBackupLoading(false)
        }
      },
    })
  }

  const handleRestoreBackup = async (filePath: string) => {
    setConfirmModal({
      title: t('modals.restore_title'),
      message: t('modals.restore_message'),
      confirmLabel: t('modals.restore_confirm'),
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        setBackupLoading(true)
        try {
          const result = await window.electronAPI.restoreBackup(filePath)
          if (result.success) {
            showBackupMessage('success', t('dados.backup_restore_success'))
          } else if (result.error) {
            showBackupMessage('error', result.error)
          }
        } catch {
          showBackupMessage('error', t('dados.backup_restore_error'))
        } finally {
          setBackupLoading(false)
        }
      },
    })
  }

  const handleDeleteBackup = async (filePath: string) => {
    setConfirmModal({
      title: t('modals.delete_title'),
      message: t('modals.delete_message'),
      confirmLabel: t('modals.delete_confirm'),
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null)
        await window.electronAPI.deleteBackup(filePath)
        loadBackups()
      },
    })
  }

  const handleResetDatabase = async () => {
    setConfirmModal({
      title: t('modals.reset_db_title'),
      message: t('modals.reset_db_message'),
      confirmLabel: t('modals.reset_db_confirm'),
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null)
        setBackupLoading(true)
        try {
          const result = await window.electronAPI.resetDatabase()
          if (result.success) {
            showBackupMessage('success', t('avancado.reset_db_success'))
          } else if (result.error) {
            showBackupMessage('error', result.error)
          }
        } catch {
          showBackupMessage('error', t('avancado.reset_db_error'))
        } finally {
          setBackupLoading(false)
        }
      },
    })
  }

  const handleChangeDatabasePath = async () => {
    const selectedPath = await window.electronAPI.selectDatabaseFolder()
    if (!selectedPath) return

    const existsAtDestination = await window.electronAPI.checkDatabaseExists(selectedPath)

    const message = existsAtDestination ? t('modals.change_db_message_exists') : t('modals.change_db_message')

    setConfirmModal({
      title: t('modals.change_db_title'),
      message,
      confirmLabel: t('modals.change_db_move'),
      alternativeLabel: t('modals.change_db_new'),
      secondAlternativeLabel: existsAtDestination ? t('modals.change_db_existing') : undefined,
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        await executeDatabasePathChange(selectedPath, 'move')
      },
      onAlternative: async () => {
        setConfirmModal(null)
        await executeDatabasePathChange(selectedPath, 'new')
      },
      onSecondAlternative: existsAtDestination
        ? async () => {
            setConfirmModal(null)
            await executeDatabasePathChange(selectedPath, 'existing')
          }
        : undefined,
    })
  }

  const executeDatabasePathChange = async (path: string, mode: 'move' | 'new' | 'existing') => {
    setDbPathLoading(true)
    try {
      const result = await window.electronAPI.setDatabasePath(path, mode)
      if (result.success) {
        showBackupMessage('success', t('dados.db_change_success'))
      } else if (result.error) {
        showBackupMessage('error', result.error)
      }
    } catch {
      showBackupMessage('error', t('dados.db_change_error'))
    } finally {
      setDbPathLoading(false)
    }
  }

  const handleResetDatabasePath = async () => {
    if (!dbPathInfo?.isCustom) return

    const defaultPath = dbPathInfo.defaultPath
    const existsAtDefault = await window.electronAPI.checkDatabaseExists(defaultPath)

    const message = existsAtDefault ? t('modals.restore_default_message_exists') : t('modals.restore_default_message')

    setConfirmModal({
      title: t('modals.restore_default_title'),
      message,
      confirmLabel: t('modals.change_db_move'),
      alternativeLabel: t('modals.change_db_new'),
      secondAlternativeLabel: existsAtDefault ? t('modals.change_db_existing') : undefined,
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(null)
        await executeResetDatabasePath('move')
      },
      onAlternative: async () => {
        setConfirmModal(null)
        await executeResetDatabasePath('new')
      },
      onSecondAlternative: existsAtDefault
        ? async () => {
            setConfirmModal(null)
            await executeResetDatabasePath('existing')
          }
        : undefined,
    })
  }

  const executeResetDatabasePath = async (mode: 'move' | 'new' | 'existing') => {
    setDbPathLoading(true)
    try {
      const result = await window.electronAPI.resetDatabasePath(mode)
      if (result.success) {
        showBackupMessage('success', t('dados.db_restore_default_success'))
      } else if (result.error) {
        showBackupMessage('error', result.error)
      }
    } catch {
      showBackupMessage('error', t('dados.db_restore_default_error'))
    } finally {
      setDbPathLoading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return {
    backups,
    backupLoading,
    dbPathInfo,
    dbPathLoading,
    confirmModal,
    setConfirmModal,
    handleExportBackup,
    handleImportBackup,
    handleRestoreBackup,
    handleDeleteBackup,
    handleResetDatabase,
    handleChangeDatabasePath,
    handleResetDatabasePath,
    formatFileSize,
    formatDate,
  }
}
