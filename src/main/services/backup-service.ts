import { app, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { BackupInfo } from '../../shared/types'
import { closeDatabase, getDatabase, getDatabasePath } from '../database/schema'
import { getErrorService } from './error-service'
import { SettingsRepository } from '../database/repositories/settings-repository'

const BACKUPS_DIR = 'backups'

export class BackupService {
  private periodicInterval: ReturnType<typeof setInterval> | null = null

  private getBackupsDir(): string {
    const dir = path.join(app.getPath('userData'), BACKUPS_DIR)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  private getDbPath(): string {
    return getDatabasePath()
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-')
  }

  private getBackupLimit(): number {
    try {
      const settings = new SettingsRepository().get()
      const limit = Number(settings.backupLimit)
      return limit >= 3 && limit <= 30 ? limit : 7
    } catch {
      return 7
    }
  }

  /**
   * Inicia backup periódico baseado na configuração de frequência.
   * Deve ser chamado após o startup.
   */
  startPeriodicBackup(): void {
    this.stopPeriodicBackup()

    try {
      const settings = new SettingsRepository().get()
      const freq = settings.backupFrequency

      if (freq === 'startup' || freq === 'disabled') return

      const hours = Number(freq.replace('h', ''))
      if (isNaN(hours) || hours <= 0) return

      const ms = hours * 60 * 60 * 1000
      this.periodicInterval = setInterval(() => {
        this.createAutoBackup()
      }, ms)
    } catch {
      // If settings can't be read, don't schedule
    }
  }

  stopPeriodicBackup(): void {
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval)
      this.periodicInterval = null
    }
  }

  /**
   * Cria backup automático no startup do app (se frequência não estiver desativada).
   * Mantém no máximo o limite configurado, removendo os mais antigos.
   */
  createAutoBackup(): void {
    try {
      const settings = new SettingsRepository().get()
      if (settings.backupFrequency === 'disabled') return
    } catch {
      // If settings can't be read, proceed with backup (safe default)
    }

    const dbPath = this.getDbPath()
    if (!fs.existsSync(dbPath)) return

    // Garante que o database está fechado para copiar com integridade
    // Na prática, chamamos antes de abrir a DB no startup
    const backupsDir = this.getBackupsDir()
    const timestamp = this.formatTimestamp(new Date())
    const backupFilename = `backup_${timestamp}.db`
    const backupPath = path.join(backupsDir, backupFilename)

    try {
      fs.copyFileSync(dbPath, backupPath)
      this.rotateBackups()
    } catch (error: any) {
      getErrorService().logError({
        category: 'database',
        severity: 'warning',
        message: 'Erro ao criar backup automático',
        stack: error?.stack,
        context: { operation: 'autoBackup', dbPath, backupPath },
      })
      console.error('[BackupService] Erro ao criar backup automático:', error)
    }
  }

  /**
   * Remove backups mais antigos que o limite configurado.
   */
  private rotateBackups(): void {
    const backupsDir = this.getBackupsDir()
    const backups = this.listBackupsInternal(backupsDir)
    const maxBackups = this.getBackupLimit()

    if (backups.length > maxBackups) {
      const toDelete = backups.slice(maxBackups)
      for (const backup of toDelete) {
        try {
          fs.unlinkSync(backup.filePath)
        } catch (error: any) {
          getErrorService().logError({
            category: 'system',
            severity: 'warning',
            message: 'Erro ao deletar backup antigo',
            stack: error?.stack,
            context: { operation: 'rotateBackups', filePath: backup.filePath },
          })
          console.error('[BackupService] Erro ao deletar backup antigo:', error)
        }
      }
    }
  }

  /**
   * Lista backups disponíveis, ordenados do mais recente ao mais antigo.
   */
  listBackups(): BackupInfo[] {
    const backupsDir = this.getBackupsDir()
    return this.listBackupsInternal(backupsDir)
  }

  private listBackupsInternal(backupsDir: string): BackupInfo[] {
    if (!fs.existsSync(backupsDir)) return []

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))

    const backups: BackupInfo[] = files.map(filename => {
      const filePath = path.join(backupsDir, filename)
      const stats = fs.statSync(filePath)
      return {
        filename,
        filePath,
        createdAt: stats.mtime.toISOString(),
        sizeBytes: stats.size,
      }
    })

    // Ordena do mais recente ao mais antigo
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return backups
  }

  /**
   * Exporta backup manual — abre file dialog pra salvar.
   */
  async createManualBackup(): Promise<{ success: boolean; filePath?: string }> {
    const dbPath = this.getDbPath()
    if (!fs.existsSync(dbPath)) {
      return { success: false }
    }

    const timestamp = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).replace(/\//g, '-')

    const result = await dialog.showSaveDialog({
      title: 'Exportar Backup',
      defaultPath: `sidebrain_backup_${timestamp}.db`,
      filters: [
        { name: 'SQLite Database', extensions: ['db'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

    try {
      // Faz checkpoint do WAL antes de copiar
      const db = getDatabase()
      db.pragma('wal_checkpoint(TRUNCATE)')
      fs.copyFileSync(dbPath, result.filePath)
      return { success: true, filePath: result.filePath }
    } catch (error: any) {
      getErrorService().logError({
        category: 'database',
        severity: 'error',
        message: 'Erro ao exportar backup manual',
        stack: error?.stack,
        context: { operation: 'manualBackup', targetPath: result.filePath },
      })
      console.error('[BackupService] Erro ao exportar backup:', error)
      return { success: false }
    }
  }

  /**
   * Restaura de um backup automático (pelo filePath).
   */
  async restoreFromAutoBackup(backupFilePath: string): Promise<{ success: boolean; error?: string }> {
    if (!fs.existsSync(backupFilePath)) {
      return { success: false, error: 'Arquivo de backup não encontrado.' }
    }

    return this.performRestore(backupFilePath)
  }

  /**
   * Importa backup de arquivo externo — abre file dialog.
   */
  async importBackup(): Promise<{ success: boolean; error?: string }> {
    const result = await dialog.showOpenDialog({
      title: 'Importar Backup',
      filters: [
        { name: 'SQLite Database', extensions: ['db'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Operação cancelada.' }
    }

    return this.performRestore(result.filePaths[0])
  }

  /**
   * Executa a restauração: fecha DB, cria backup de segurança, substitui, reinicia.
   */
  private async performRestore(sourceFilePath: string): Promise<{ success: boolean; error?: string }> {
    const dbPath = this.getDbPath()

    try {
      // Cria backup de segurança antes de restaurar
      const backupsDir = this.getBackupsDir()
      const safetyBackup = path.join(backupsDir, `pre_restore_${this.formatTimestamp(new Date())}.db`)

      if (fs.existsSync(dbPath)) {
        // Checkpoint WAL antes de fechar
        try {
          const db = getDatabase()
          db.pragma('wal_checkpoint(TRUNCATE)')
        } catch {
          // Se não conseguir, segue em frente
        }

        // Fecha a database
        closeDatabase()

        // Backup de segurança
        fs.copyFileSync(dbPath, safetyBackup)
      }

      // Substitui a database
      fs.copyFileSync(sourceFilePath, dbPath)

      // Remove WAL e SHM orphans se existirem
      const walPath = dbPath + '-wal'
      const shmPath = dbPath + '-shm'
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)

      // Reinicia a janela pra recarregar tudo com a nova DB
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].reload()
      }

      return { success: true }
    } catch (error: any) {
      getErrorService().logError({
        category: 'database',
        severity: 'error',
        message: 'Erro ao restaurar backup',
        stack: error?.stack,
        context: { operation: 'restore', sourceFilePath },
      })
      console.error('[BackupService] Erro ao restaurar backup:', error)
      return { success: false, error: 'Erro ao restaurar backup. Verifique o arquivo.' }
    }
  }

  /**
   * Deleta um backup específico.
   */
  deleteBackup(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Reseta a database: arquiva a atual com timestamp e cria uma nova vazia.
   * O app recarrega automaticamente após o reset.
   */
  async resetDatabase(): Promise<{ success: boolean; archivedPath?: string; error?: string }> {
    const dbPath = this.getDbPath()

    try {
      const backupsDir = this.getBackupsDir()
      const timestamp = this.formatTimestamp(new Date())
      const archivedFilename = `archived_${timestamp}.db`
      const archivedPath = path.join(backupsDir, archivedFilename)

      if (fs.existsSync(dbPath)) {
        // Checkpoint WAL antes de fechar
        try {
          const db = getDatabase()
          db.pragma('wal_checkpoint(TRUNCATE)')
        } catch {
          // Se não conseguir, segue em frente
        }

        // Fecha a database
        closeDatabase()

        // Arquiva a database atual
        fs.renameSync(dbPath, archivedPath)

        // Remove WAL e SHM orphans se existirem
        const walPath = dbPath + '-wal'
        const shmPath = dbPath + '-shm'
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
      }

      // Ao recarregar, getDatabase() vai criar uma nova DB com schema vazio
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].reload()
      }

      return { success: true, archivedPath }
    } catch (error: any) {
      getErrorService().logError({
        category: 'database',
        severity: 'critical',
        message: 'Erro ao resetar database',
        stack: error?.stack,
        context: { operation: 'resetDatabase', dbPath },
      })
      console.error('[BackupService] Erro ao resetar database:', error)
      return { success: false, error: 'Erro ao resetar database.' }
    }
  }
}
