import { app, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { closeDatabase } from '../database/schema'

const CONFIG_FILENAME = 'config.json'
const DB_FILENAME = 'work-organizer.db'
const LOCK_FILENAME = 'work-organizer.lock'

interface AppConfig {
  databasePath: string
}

const DEFAULT_CONFIG: AppConfig = {
  databasePath: '',
}

/**
 * Gerencia o config.json local (nunca na nuvem) e o lock file da database.
 * O config.json guarda apenas o caminho da DB — é lido antes de abrir a database.
 */
export class ConfigService {
  private configPath: string
  private lockFilePath: string | null = null

  constructor() {
    this.configPath = path.join(app.getPath('userData'), CONFIG_FILENAME)
  }

  /**
   * Retorna o caminho da database configurado, ou o padrão se não configurado.
   */
  getDatabasePath(): string {
    const config = this.readConfig()
    if (config.databasePath && config.databasePath.trim() !== '') {
      return config.databasePath
    }
    return this.getDefaultDatabasePath()
  }

  /**
   * Caminho padrão da database (userData).
   */
  getDefaultDatabasePath(): string {
    return path.join(app.getPath('userData'), DB_FILENAME)
  }

  /**
   * Verifica se o caminho configurado é customizado (diferente do padrão).
   */
  isCustomPath(): boolean {
    const config = this.readConfig()
    return config.databasePath !== '' && config.databasePath !== this.getDefaultDatabasePath()
  }

  /**
   * Muda o caminho da database.
   * mode: 'move' = move a DB atual pro novo local, 'new' = começa nova DB no local
   */
  async setDatabasePath(
    newPath: string,
    mode: 'move' | 'new'
  ): Promise<{ success: boolean; error?: string }> {
    const currentDbPath = this.getDatabasePath()

    // Valida o novo caminho
    const validation = this.validatePath(newPath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    try {
      // Resolve o caminho completo do arquivo DB no novo diretório
      const newDbPath = newPath.endsWith('.db') ? newPath : path.join(newPath, DB_FILENAME)
      const newDir = path.dirname(newDbPath)

      // Garante que o diretório existe
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true })
      }

      if (mode === 'move' && fs.existsSync(currentDbPath)) {
        // Checkpoint WAL e fecha a DB antes de mover
        try {
          const { getDatabase } = require('../database/schema')
          const db = getDatabase()
          db.pragma('wal_checkpoint(TRUNCATE)')
        } catch {
          // Segue em frente
        }

        closeDatabase()
        this.releaseLock()

        // Move o arquivo principal
        fs.copyFileSync(currentDbPath, newDbPath)
        fs.unlinkSync(currentDbPath)

        // Move WAL/SHM se existirem
        const walPath = currentDbPath + '-wal'
        const shmPath = currentDbPath + '-shm'
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
      } else if (mode === 'new') {
        // Fecha a DB atual
        closeDatabase()
        this.releaseLock()
        // Não precisa fazer nada — getDatabase() vai criar uma nova no novo caminho
      }

      // Salva o novo caminho no config
      this.writeConfig({ databasePath: newDbPath })

      // Recarrega a janela para usar o novo caminho
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].reload()
      }

      return { success: true }
    } catch (error) {
      console.error('[ConfigService] Erro ao mudar caminho da database:', error)
      return { success: false, error: 'Erro ao mudar o caminho da database.' }
    }
  }

  /**
   * Reseta o caminho para o padrão (userData).
   * mode: 'move' = traz a DB de volta, 'new' = começa nova no local padrão
   */
  async resetToDefaultPath(mode: 'move' | 'new'): Promise<{ success: boolean; error?: string }> {
    const defaultPath = this.getDefaultDatabasePath()
    return this.setDatabasePath(defaultPath, mode)
  }

  /**
   * Abre um dialog para o usuário escolher a pasta da database.
   */
  async selectDatabaseFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Escolher pasta para a database',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return path.join(result.filePaths[0], DB_FILENAME)
  }

  // === Lock File ===

  /**
   * Tenta adquirir o lock da database.
   * Retorna true se conseguiu, false se já existe um lock (outra máquina usando).
   */
  acquireLock(): { acquired: boolean; owner?: string } {
    const dbPath = this.getDatabasePath()
    this.lockFilePath = dbPath.replace(/\.db$/, '.lock')

    if (fs.existsSync(this.lockFilePath)) {
      try {
        const lockData = JSON.parse(fs.readFileSync(this.lockFilePath, 'utf-8'))
        const lockAge = Date.now() - new Date(lockData.timestamp).getTime()

        // Se o lock tem mais de 5 minutos, considera abandonado
        if (lockAge > 5 * 60 * 1000) {
          this.writeLockFile()
          return { acquired: true }
        }

        return { acquired: false, owner: lockData.machine || 'outra máquina' }
      } catch {
        // Lock corrompido, sobrescreve
        this.writeLockFile()
        return { acquired: true }
      }
    }

    this.writeLockFile()
    return { acquired: true }
  }

  /**
   * Libera o lock file.
   */
  releaseLock(): void {
    if (this.lockFilePath && fs.existsSync(this.lockFilePath)) {
      try {
        fs.unlinkSync(this.lockFilePath)
      } catch {
        // Silently fail
      }
    }
  }

  /**
   * Renova o lock (chamado periodicamente enquanto o app está aberto).
   */
  renewLock(): void {
    if (this.lockFilePath) {
      this.writeLockFile()
    }
  }

  private writeLockFile(): void {
    if (!this.lockFilePath) return
    const lockData = {
      machine: require('os').hostname(),
      pid: process.pid,
      timestamp: new Date().toISOString(),
    }
    try {
      fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData, null, 2), 'utf-8')
    } catch {
      // Silently fail
    }
  }

  // === Config File ===

  private readConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8')
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_CONFIG, ...parsed }
      }
    } catch (error) {
      console.error('[ConfigService] Erro ao ler config.json:', error)
    }
    return { ...DEFAULT_CONFIG }
  }

  private writeConfig(config: Partial<AppConfig>): void {
    const current = this.readConfig()
    const merged = { ...current, ...config }
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8')
    } catch (error) {
      console.error('[ConfigService] Erro ao escrever config.json:', error)
    }
  }

  /**
   * Valida se o caminho é utilizável.
   */
  private validatePath(targetPath: string): { valid: boolean; error?: string } {
    const resolvedPath = targetPath.endsWith('.db') ? targetPath : path.join(targetPath, DB_FILENAME)
    const dir = path.dirname(resolvedPath)

    // Verifica se o diretório existe ou pode ser criado
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        fs.rmdirSync(dir) // Remove pra não poluir — será criado de verdade no setDatabasePath
      }
    } catch {
      return { valid: false, error: 'Não foi possível acessar ou criar o diretório.' }
    }

    // Verifica permissão de escrita
    try {
      const testFile = path.join(dir, '.write-test-' + Date.now())
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
    } catch {
      return { valid: false, error: 'Sem permissão de escrita neste diretório.' }
    }

    return { valid: true }
  }
}

// Singleton para garantir que o mesmo config é lido em todo o app
let instance: ConfigService | null = null

export function getConfigService(): ConfigService {
  if (!instance) {
    instance = new ConfigService()
  }
  return instance
}
