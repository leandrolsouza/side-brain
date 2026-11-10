import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import { dialog } from 'electron'
import { createTestDatabase, closeTestDatabase, getTestDatabase } from '../setup'
import { BackupService } from '../../../src/main/services/backup-service'
import { SettingsRepository } from '../../../src/main/database/repositories/settings-repository'

const FAKE_DB_PATH = path.join('/fake', 'userData', 'sidebrain.db')

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => path.join('/fake', 'userData', 'sidebrain.db'),
    closeDatabase: vi.fn(),
  }
})

vi.mock('node:fs', () => ({
  default: {
    constants: { COPYFILE_EXCL: 1 },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    renameSync: vi.fn(),
  },
}))

// app.getPath('userData') retorna '/tmp' no mock global de electron (tests/main/setup.ts)
const BACKUPS_DIR = path.join('/tmp', 'backups')

const fsMock = vi.mocked(fs)
const dialogMock = vi.mocked(dialog)

function mockBackupFiles(files: { name: string; mtime: Date; size?: number }[]): void {
  fsMock.readdirSync.mockReturnValue(files.map((f) => f.name) as any)
  fsMock.statSync.mockImplementation((filePath: any) => {
    const file = files.find((f) => path.join(BACKUPS_DIR, f.name) === filePath)
    return { mtime: file?.mtime ?? new Date(0), size: file?.size ?? 100 } as any
  })
}

describe('BackupService', () => {
  let service: BackupService
  let backup: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createTestDatabase()
    vi.resetAllMocks()
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readdirSync.mockReturnValue([] as any)
    backup = vi.spyOn(getTestDatabase(), 'backup').mockResolvedValue({ totalPages: 1, remainingPages: 0 })
    service = new BackupService()
  })

  afterEach(() => {
    service.stopPeriodicBackup()
    closeTestDatabase()
  })

  describe('listBackups', () => {
    it('deve listar apenas arquivos backup_*.db ordenados do mais recente ao mais antigo', () => {
      mockBackupFiles([
        { name: 'backup_antigo.db', mtime: new Date('2026-01-01T10:00:00Z'), size: 111 },
        { name: 'outro-arquivo.txt', mtime: new Date('2026-01-05T10:00:00Z') },
        { name: 'backup_recente.db', mtime: new Date('2026-02-01T10:00:00Z'), size: 222 },
      ])
      // readdirSync retorna todos, o service filtra por prefixo/sufixo
      fsMock.readdirSync.mockReturnValue(['backup_antigo.db', 'outro-arquivo.txt', 'backup_recente.db'] as any)

      const backups = service.listBackups()

      expect(backups).toHaveLength(2)
      expect(backups[0].filename).toBe('backup_recente.db')
      expect(backups[0].sizeBytes).toBe(222)
      expect(backups[1].filename).toBe('backup_antigo.db')
    })

    it('deve retornar lista vazia quando a pasta não existe', () => {
      fsMock.existsSync.mockReturnValue(false)

      const backups = service.listBackups()

      expect(backups).toEqual([])
      expect(fsMock.mkdirSync).toHaveBeenCalledWith(BACKUPS_DIR, { recursive: true })
    })
  })

  describe('createAutoBackup', () => {
    it('deve criar um snapshot SQLite na pasta de backups', async () => {
      await service.createAutoBackup()

      expect(backup).toHaveBeenCalledTimes(1)
      const [dest] = backup.mock.calls[0]
      expect(String(dest)).toContain(path.join(BACKUPS_DIR, 'backup_'))
      expect(String(dest).endsWith('.db')).toBe(true)
    })

    it('não deve criar backup quando a frequência está desativada', async () => {
      new SettingsRepository().update({ backupFrequency: 'disabled' })

      await service.createAutoBackup()

      expect(backup).not.toHaveBeenCalled()
    })

    it('não deve copiar quando o arquivo da database não existe', async () => {
      fsMock.existsSync.mockImplementation((p: any) => p !== FAKE_DB_PATH)

      await service.createAutoBackup()

      expect(backup).not.toHaveBeenCalled()
    })

    it('deve rotacionar backups além do limite configurado (padrão 7)', async () => {
      const files = Array.from({ length: 9 }, (_, i) => ({
        name: `backup_${i}.db`,
        mtime: new Date(2026, 0, 10 - i), // índice menor = mais recente
      }))
      mockBackupFiles(files)

      await service.createAutoBackup()

      // 9 backups listados, limite 7 → remove os 2 mais antigos
      expect(fsMock.unlinkSync).toHaveBeenCalledTimes(2)
      const deleted = fsMock.unlinkSync.mock.calls.map((c) => String(c[0]))
      expect(deleted).toContain(path.join(BACKUPS_DIR, 'backup_7.db'))
      expect(deleted).toContain(path.join(BACKUPS_DIR, 'backup_8.db'))
    })
  })

  it('suspende e retoma o agendamento periódico', async () => {
    vi.useFakeTimers()
    try {
      new SettingsRepository().update({ backupFrequency: '4h' })
      service.startPeriodicBackup()
      service.pausePeriodicBackup()
      service.startPeriodicBackup()
      await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000)
      expect(backup).not.toHaveBeenCalled()
      service.resumePeriodicBackup()
      await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000)
      expect(backup).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  describe('createManualBackup', () => {
    it('deve retornar success false quando o dialog é cancelado', async () => {
      dialogMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' } as any)

      const result = await service.createManualBackup()

      expect(result.success).toBe(false)
      expect(fsMock.copyFileSync).not.toHaveBeenCalled()
    })

    it('deve copiar a database para o destino escolhido', async () => {
      const target = path.join('/export', 'meu-backup.db')
      dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: target } as any)

      const result = await service.createManualBackup()

      expect(result).toEqual({ success: true, filePath: target })
      expect(backup).toHaveBeenCalledWith(target)
    })

    it('deve retornar success false quando a database não existe', async () => {
      fsMock.existsSync.mockReturnValue(false)

      const result = await service.createManualBackup()

      expect(result.success).toBe(false)
      expect(dialogMock.showSaveDialog).not.toHaveBeenCalled()
    })

    it('deve retornar success false quando a cópia falha', async () => {
      dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/export/x.db' } as any)
      backup.mockRejectedValue(new Error('disk full'))

      const result = await service.createManualBackup()

      expect(result.success).toBe(false)
    })
  })

  describe('restoreFromAutoBackup', () => {
    it('deve falhar quando o arquivo de backup não existe', async () => {
      fsMock.existsSync.mockReturnValue(false)

      const result = await service.restoreFromAutoBackup('/backups/nao-existe.db')

      expect(result.success).toBe(false)
      expect(result.error).toContain('não encontrado')
    })

    it('deve rejeitar um arquivo inválido sem substituir a database', async () => {
      const sourceBackup = path.join(BACKUPS_DIR, 'backup_x.db')

      const result = await service.restoreFromAutoBackup(sourceBackup)

      expect(result.success).toBe(false)
      expect(fsMock.renameSync).not.toHaveBeenCalled()
      expect(backup).not.toHaveBeenCalled()
    })
  })

  describe('importBackup', () => {
    it('deve retornar erro quando o dialog é cancelado', async () => {
      dialogMock.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] } as any)

      const result = await service.importBackup()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Operação cancelada.')
    })
  })

  describe('deleteBackup', () => {
    it('deve deletar arquivo existente e retornar true', () => {
      const filePath = path.join(BACKUPS_DIR, 'backup_x.db')

      expect(service.deleteBackup(filePath)).toBe(true)
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(filePath)
    })

    it('deve retornar false quando o arquivo não existe', () => {
      fsMock.existsSync.mockReturnValue(false)

      expect(service.deleteBackup('/backups/x.db')).toBe(false)
      expect(fsMock.unlinkSync).not.toHaveBeenCalled()
    })

    it('deve retornar false quando unlink falha', () => {
      fsMock.unlinkSync.mockImplementation(() => {
        throw new Error('EPERM')
      })

      expect(service.deleteBackup('/backups/x.db')).toBe(false)
    })
  })

  describe('resetDatabase', () => {
    it('deve arquivar a database atual e limpar WAL/SHM', async () => {
      const result = await service.resetDatabase()

      expect(result.success).toBe(true)
      expect(result.archivedPath).toContain('archived_')
      const [dest] = backup.mock.calls[0]
      expect(String(dest)).toContain(path.join(BACKUPS_DIR, 'archived_'))
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(FAKE_DB_PATH)
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(`${FAKE_DB_PATH}-wal`)
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(`${FAKE_DB_PATH}-shm`)
    })

    it('deve retornar erro quando o arquivamento falha', async () => {
      backup.mockRejectedValue(new Error('EBUSY'))

      const result = await service.resetDatabase()

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })
})
