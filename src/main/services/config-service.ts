import { app, dialog, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { closeDatabase } from '../database/schema'
import { createScopedLogger } from './logger'
import type { Workspace, WorkspaceConfig } from '../../shared/types'

const logger = createScopedLogger('config')

const CONFIG_FILENAME = 'config.json'
const DB_FILENAME = 'work-organizer.db'
const LOCK_FILENAME = 'work-organizer.lock'

const DEFAULT_WORKSPACE: Workspace = {
  id: 'default',
  name: 'Principal',
  emoji: '🏢',
  databasePath: '',
  createdAt: new Date().toISOString(),
}

const DEFAULT_CONFIG: WorkspaceConfig = {
  activeWorkspaceId: 'default',
  workspaces: [],
}

/**
 * Gerencia workspaces (multi-database) e o lock file.
 * O config.json guarda a lista de workspaces e qual está ativo.
 */
export class ConfigService {
  private configPath: string
  private lockFilePath: string | null = null

  constructor() {
    this.configPath = path.join(app.getPath('userData'), CONFIG_FILENAME)
    this.migrateIfNeeded()
  }

  // === Workspace Management ===

  /**
   * Retorna todos os workspaces configurados.
   */
  getWorkspaces(): Workspace[] {
    const config = this.readConfig()
    if (config.workspaces.length === 0) {
      // Garante que pelo menos o workspace padrão exista
      const defaultWs: Workspace = {
        ...DEFAULT_WORKSPACE,
        databasePath: this.getDefaultDatabasePath(),
      }
      config.workspaces = [defaultWs]
      config.activeWorkspaceId = defaultWs.id
      this.writeConfig(config)
      return [defaultWs]
    }
    return config.workspaces
  }

  /**
   * Retorna o workspace ativo.
   */
  getActiveWorkspace(): Workspace {
    const config = this.readConfig()
    const workspaces = this.getWorkspaces()
    const active = workspaces.find((ws) => ws.id === config.activeWorkspaceId)
    return active || workspaces[0]
  }

  /**
   * Cria um novo workspace.
   */
  createWorkspace(data: { name: string; emoji: string; databasePath: string }): Workspace {
    const config = this.readConfig()
    const workspaces = this.getWorkspaces()

    const newWorkspace: Workspace = {
      id: uuidv4(),
      name: data.name,
      emoji: data.emoji,
      databasePath: data.databasePath.endsWith('.db') ? data.databasePath : path.join(data.databasePath, DB_FILENAME),
      createdAt: new Date().toISOString(),
    }

    // Garante que o diretório existe
    const dir = path.dirname(newWorkspace.databasePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    workspaces.push(newWorkspace)
    config.workspaces = workspaces
    this.writeConfig(config)

    return newWorkspace
  }

  /**
   * Atualiza um workspace existente (nome, emoji).
   */
  updateWorkspace(id: string, updates: { name?: string; emoji?: string }): Workspace | null {
    const config = this.readConfig()
    const workspaces = this.getWorkspaces()
    const index = workspaces.findIndex((ws) => ws.id === id)

    if (index === -1) return null

    if (updates.name) workspaces[index].name = updates.name
    if (updates.emoji) workspaces[index].emoji = updates.emoji

    config.workspaces = workspaces
    this.writeConfig(config)

    return workspaces[index]
  }

  /**
   * Remove um workspace (não remove o arquivo .db).
   * Não permite remover o último workspace.
   */
  deleteWorkspace(id: string): { success: boolean; error?: string } {
    const config = this.readConfig()
    const workspaces = this.getWorkspaces()

    if (workspaces.length <= 1) {
      return { success: false, error: 'Não é possível remover o único workspace.' }
    }

    const index = workspaces.findIndex((ws) => ws.id === id)
    if (index === -1) {
      return { success: false, error: 'Workspace não encontrado.' }
    }

    workspaces.splice(index, 1)
    config.workspaces = workspaces

    // Se removeu o ativo, troca pro primeiro da lista
    if (config.activeWorkspaceId === id) {
      config.activeWorkspaceId = workspaces[0].id
    }

    this.writeConfig(config)
    return { success: true }
  }

  /**
   * Troca o workspace ativo. Fecha a DB atual e recarrega a janela.
   */
  async switchWorkspace(workspaceId: string): Promise<{ success: boolean; error?: string }> {
    const config = this.readConfig()
    const workspaces = this.getWorkspaces()
    const target = workspaces.find((ws) => ws.id === workspaceId)

    if (!target) {
      return { success: false, error: 'Workspace não encontrado.' }
    }

    if (config.activeWorkspaceId === workspaceId) {
      return { success: true } // Já é o ativo
    }

    try {
      // Checkpoint WAL e fecha a DB antes de trocar
      try {
        const { getDatabase } = require('../database/schema')
        const db = getDatabase()
        db.pragma('wal_checkpoint(TRUNCATE)')
      } catch {
        // Segue em frente
      }

      closeDatabase()
      this.releaseLock()

      // Salva o novo workspace ativo
      config.activeWorkspaceId = workspaceId
      this.writeConfig(config)

      // Recarrega a janela para usar o novo banco
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].reload()
      }

      return { success: true }
    } catch (error) {
      logger.error('[ConfigService] Erro ao trocar workspace:', error)
      return { success: false, error: 'Erro ao trocar de workspace.' }
    }
  }

  /**
   * Abre dialog para escolher a pasta do novo workspace.
   */
  async selectWorkspaceFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Escolher pasta para o workspace',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return path.join(result.filePaths[0], DB_FILENAME)
  }

  // === Database Path (compatibilidade) ===

  /**
   * Retorna o caminho da database do workspace ativo.
   */
  getDatabasePath(): string {
    const active = this.getActiveWorkspace()
    return active.databasePath
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
    const active = this.getActiveWorkspace()
    return active.databasePath !== this.getDefaultDatabasePath()
  }

  /**
   * Muda o caminho da database do workspace ativo.
   * mode: 'move' = move a DB atual pro novo local, 'new' = começa nova DB no local, 'existing' = usa DB já existente no destino
   */
  async setDatabasePath(
    newPath: string,
    mode: 'move' | 'new' | 'existing'
  ): Promise<{ success: boolean; error?: string }> {
    const currentDbPath = this.getDatabasePath()

    // Valida o novo caminho
    const validation = this.validatePath(newPath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    try {
      const newDbPath = newPath.endsWith('.db') ? newPath : path.join(newPath, DB_FILENAME)
      const newDir = path.dirname(newDbPath)

      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true })
      }

      if (mode === 'move' && fs.existsSync(currentDbPath)) {
        try {
          const { getDatabase } = require('../database/schema')
          const db = getDatabase()
          db.pragma('wal_checkpoint(TRUNCATE)')
        } catch {
          // Segue em frente
        }

        closeDatabase()
        this.releaseLock()

        fs.copyFileSync(currentDbPath, newDbPath)
        fs.unlinkSync(currentDbPath)

        const walPath = `${currentDbPath}-wal`
        const shmPath = `${currentDbPath}-shm`
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
      } else if (mode === 'new') {
        closeDatabase()
        this.releaseLock()
      } else if (mode === 'existing') {
        // Apenas reaponta para o DB existente no destino, sem mover nem criar
        if (!fs.existsSync(newDbPath)) {
          return { success: false, error: 'Nenhuma database encontrada no destino.' }
        }
        closeDatabase()
        this.releaseLock()
      }

      // Atualiza o workspace ativo com o novo caminho
      const config = this.readConfig()
      const workspaces = config.workspaces
      const activeIdx = workspaces.findIndex((ws) => ws.id === config.activeWorkspaceId)
      if (activeIdx !== -1) {
        workspaces[activeIdx].databasePath = newDbPath
        config.workspaces = workspaces
        this.writeConfig(config)
      }

      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].reload()
      }

      return { success: true }
    } catch (error) {
      logger.error('[ConfigService] Erro ao mudar caminho da database:', error)
      return { success: false, error: 'Erro ao mudar o caminho da database.' }
    }
  }

  /**
   * Reseta o caminho para o padrão (userData).
   */
  async resetToDefaultPath(mode: 'move' | 'new' | 'existing'): Promise<{ success: boolean; error?: string }> {
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

  acquireLock(): { acquired: boolean; owner?: string } {
    const dbPath = this.getDatabasePath()
    this.lockFilePath = dbPath.replace(/\.db$/, '.lock')

    if (fs.existsSync(this.lockFilePath)) {
      try {
        const lockData = JSON.parse(fs.readFileSync(this.lockFilePath, 'utf-8'))
        const lockAge = Date.now() - new Date(lockData.timestamp).getTime()

        if (lockAge > 5 * 60 * 1000) {
          this.writeLockFile()
          return { acquired: true }
        }

        return { acquired: false, owner: lockData.machine || 'outra máquina' }
      } catch {
        this.writeLockFile()
        return { acquired: true }
      }
    }

    this.writeLockFile()
    return { acquired: true }
  }

  releaseLock(): void {
    if (this.lockFilePath && fs.existsSync(this.lockFilePath)) {
      try {
        fs.unlinkSync(this.lockFilePath)
      } catch {
        // Silently fail
      }
    }
  }

  renewLock(): void {
    if (this.lockFilePath) {
      this.writeLockFile()
    }
  }

  private writeLockFile(): void {
    if (!this.lockFilePath) return
    const lockData = {
      machine: require('node:os').hostname(),
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

  private readConfig(): WorkspaceConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8')
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_CONFIG, ...parsed }
      }
    } catch (error) {
      logger.error('[ConfigService] Erro ao ler config.json:', error)
    }
    return { ...DEFAULT_CONFIG }
  }

  private writeConfig(config: WorkspaceConfig): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
    } catch (error) {
      logger.error('[ConfigService] Erro ao escrever config.json:', error)
    }
  }

  /**
   * Migra o config.json antigo (com databasePath string) para o formato de workspaces.
   */
  private migrateIfNeeded(): void {
    try {
      if (!fs.existsSync(this.configPath)) return

      const raw = fs.readFileSync(this.configPath, 'utf-8')
      const parsed = JSON.parse(raw)

      // Se já tem workspaces, não precisa migrar
      if (parsed.workspaces && Array.isArray(parsed.workspaces)) return

      // Config antigo: { databasePath: string }
      const oldDbPath = parsed.databasePath || this.getDefaultDatabasePath()

      const migratedConfig: WorkspaceConfig = {
        activeWorkspaceId: 'default',
        workspaces: [
          {
            id: 'default',
            name: 'Principal',
            emoji: '🏢',
            databasePath: oldDbPath && oldDbPath.trim() !== '' ? oldDbPath : this.getDefaultDatabasePath(),
            createdAt: new Date().toISOString(),
          },
        ],
      }

      this.writeConfig(migratedConfig)
      logger.info('[ConfigService] Config migrado para formato de workspaces.')
    } catch (error) {
      logger.error('[ConfigService] Erro na migração do config:', error)
    }
  }

  /**
   * Valida se o caminho é utilizável.
   */
  private validatePath(targetPath: string): { valid: boolean; error?: string } {
    const resolvedPath = targetPath.endsWith('.db') ? targetPath : path.join(targetPath, DB_FILENAME)
    const dir = path.dirname(resolvedPath)

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        fs.rmdirSync(dir)
      }
    } catch {
      return { valid: false, error: 'Não foi possível acessar ou criar o diretório.' }
    }

    try {
      const testFile = path.join(dir, `.write-test-${Date.now()}`)
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
    } catch {
      return { valid: false, error: 'Sem permissão de escrita neste diretório.' }
    }

    return { valid: true }
  }
}

// Singleton
let instance: ConfigService | null = null

export function getConfigService(): ConfigService {
  if (!instance) {
    instance = new ConfigService()
  }
  return instance
}
