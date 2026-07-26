import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDatabase, closeTestDatabase } from '../setup'
import { CustomFieldsRepository } from '../../../src/main/database/repositories/custom-fields-repository'

vi.mock('../../../src/main/database/schema', async () => {
  const setup = await import('../setup')
  return {
    getDatabase: () => setup.getTestDatabase(),
    getDatabasePath: () => ':memory:',
    closeDatabase: () => setup.closeTestDatabase(),
  }
})

describe('CustomFieldsRepository', () => {
  let repo: CustomFieldsRepository

  beforeEach(() => {
    createTestDatabase()
    repo = new CustomFieldsRepository()
  })

  afterEach(() => {
    closeTestDatabase()
  })

  // === Entry Types ===

  describe('EntryTypes', () => {
    describe('createEntryType', () => {
      it('deve criar um entry type custom', () => {
        const type = repo.createEntryType({
          key: 'feedback',
          label: 'Feedback',
          icon: 'MessageCircle',
          color: 'info',
          isDefault: false,
          sortOrder: 10,
          allowsAction: true,
        })

        expect(type.id).toBeDefined()
        expect(type.key).toBe('feedback')
        expect(type.label).toBe('Feedback')
        expect(type.icon).toBe('MessageCircle')
        expect(type.color).toBe('info')
        expect(type.isDefault).toBe(false)
        expect(type.sortOrder).toBe(10)
        expect(type.allowsAction).toBe(true)
      })
    })

    describe('getEntryTypes', () => {
      it('deve retornar tipos ordenados por sortOrder', () => {
        repo.createEntryType({
          key: 'b_type',
          label: 'B',
          icon: 'X',
          color: 'info',
          isDefault: false,
          sortOrder: 2,
          allowsAction: true,
        })
        repo.createEntryType({
          key: 'a_type',
          label: 'A',
          icon: 'X',
          color: 'info',
          isDefault: false,
          sortOrder: 1,
          allowsAction: true,
        })

        const types = repo.getEntryTypes()
        expect(types[0].key).toBe('a_type')
        expect(types[1].key).toBe('b_type')
      })

      it('deve retornar vazio quando não há tipos', () => {
        expect(repo.getEntryTypes()).toEqual([])
      })
    })

    describe('getEntryTypeByKey', () => {
      it('deve retornar tipo pela key', () => {
        repo.createEntryType({
          key: 'feedback',
          label: 'Feedback',
          icon: 'X',
          color: 'info',
          isDefault: false,
          sortOrder: 0,
          allowsAction: true,
        })

        const found = repo.getEntryTypeByKey('feedback')
        expect(found).not.toBeNull()
        expect(found!.label).toBe('Feedback')
      })

      it('deve retornar null para key inexistente', () => {
        expect(repo.getEntryTypeByKey('nonexistent')).toBeNull()
      })
    })

    describe('updateEntryType', () => {
      it('deve atualizar campos do entry type', () => {
        const type = repo.createEntryType({
          key: 'feedback',
          label: 'Feedback',
          icon: 'X',
          color: 'info',
          isDefault: false,
          sortOrder: 0,
          allowsAction: true,
        })

        const updated = repo.updateEntryType(type.id, { label: 'Feedback do Cliente', color: 'warning' })
        expect(updated).not.toBeNull()
        expect(updated!.label).toBe('Feedback do Cliente')
        expect(updated!.color).toBe('warning')
        expect(updated!.key).toBe('feedback') // não alterado
      })

      it('deve retornar null para ID inexistente', () => {
        expect(repo.updateEntryType('fake-id', { label: 'X' })).toBeNull()
      })

      it('deve retornar tipo inalterado quando updates está vazio', () => {
        const type = repo.createEntryType({
          key: 'test',
          label: 'Test',
          icon: 'X',
          color: 'info',
          isDefault: false,
          sortOrder: 0,
          allowsAction: true,
        })

        const result = repo.updateEntryType(type.id, {})
        expect(result!.label).toBe('Test')
      })
    })

    describe('deleteEntryType', () => {
      it('deve excluir tipo não-default', () => {
        const type = repo.createEntryType({
          key: 'custom',
          label: 'Custom',
          icon: 'X',
          color: 'info',
          isDefault: false,
          sortOrder: 0,
          allowsAction: true,
        })

        const deleted = repo.deleteEntryType(type.id)
        expect(deleted).toBe(true)
        expect(repo.getEntryTypeByKey('custom')).toBeNull()
      })

      it('não deve excluir tipo default', () => {
        const type = repo.createEntryType({
          key: 'builtin',
          label: 'Built-in',
          icon: 'X',
          color: 'info',
          isDefault: true,
          sortOrder: 0,
          allowsAction: true,
        })

        const deleted = repo.deleteEntryType(type.id)
        expect(deleted).toBe(false)
        expect(repo.getEntryTypeByKey('builtin')).not.toBeNull()
      })

      it('deve retornar false para ID inexistente', () => {
        expect(repo.deleteEntryType('fake-id')).toBe(false)
      })
    })

    describe('reorderEntryTypes', () => {
      it('deve reordenar tipos por IDs', () => {
        const t1 = repo.createEntryType({
          key: 'first',
          label: 'First',
          icon: 'X',
          color: 'info',
          isDefault: false,
          sortOrder: 0,
          allowsAction: true,
        })
        const t2 = repo.createEntryType({
          key: 'second',
          label: 'Second',
          icon: 'X',
          color: 'info',
          isDefault: false,
          sortOrder: 1,
          allowsAction: true,
        })
        const t3 = repo.createEntryType({
          key: 'third',
          label: 'Third',
          icon: 'X',
          color: 'info',
          isDefault: false,
          sortOrder: 2,
          allowsAction: true,
        })

        // Inverte a ordem
        repo.reorderEntryTypes([t3.id, t1.id, t2.id])

        const types = repo.getEntryTypes()
        expect(types[0].key).toBe('third')
        expect(types[1].key).toBe('first')
        expect(types[2].key).toBe('second')
      })
    })
  })

  // === Action Statuses ===

  describe('ActionStatuses', () => {
    describe('createActionStatus', () => {
      it('deve criar um action status custom', () => {
        const status = repo.createActionStatus({
          key: 'blocked',
          label: 'Bloqueado',
          icon: 'Ban',
          color: 'error',
          isDefault: false,
          isFinal: false,
          sortOrder: 5,
        })

        expect(status.id).toBeDefined()
        expect(status.key).toBe('blocked')
        expect(status.label).toBe('Bloqueado')
        expect(status.isFinal).toBe(false)
      })
    })

    describe('getActionStatuses', () => {
      it('deve retornar statuses ordenados por sortOrder', () => {
        repo.createActionStatus({
          key: 'z',
          label: 'Z',
          icon: 'X',
          color: 'info',
          isDefault: false,
          isFinal: false,
          sortOrder: 2,
        })
        repo.createActionStatus({
          key: 'a',
          label: 'A',
          icon: 'X',
          color: 'info',
          isDefault: false,
          isFinal: false,
          sortOrder: 1,
        })

        const statuses = repo.getActionStatuses()
        expect(statuses[0].key).toBe('a')
        expect(statuses[1].key).toBe('z')
      })
    })

    describe('getActionStatusByKey', () => {
      it('deve retornar status pela key', () => {
        repo.createActionStatus({
          key: 'blocked',
          label: 'Bloqueado',
          icon: 'X',
          color: 'error',
          isDefault: false,
          isFinal: false,
          sortOrder: 0,
        })

        const found = repo.getActionStatusByKey('blocked')
        expect(found).not.toBeNull()
        expect(found!.label).toBe('Bloqueado')
      })

      it('deve retornar null para key inexistente', () => {
        expect(repo.getActionStatusByKey('nonexistent')).toBeNull()
      })
    })

    describe('updateActionStatus', () => {
      it('deve atualizar campos do action status', () => {
        const status = repo.createActionStatus({
          key: 'blocked',
          label: 'Bloqueado',
          icon: 'Ban',
          color: 'error',
          isDefault: false,
          isFinal: false,
          sortOrder: 0,
        })

        const updated = repo.updateActionStatus(status.id, { label: 'Impedido', isFinal: true })
        expect(updated).not.toBeNull()
        expect(updated!.label).toBe('Impedido')
        expect(updated!.isFinal).toBe(true)
      })

      it('deve retornar null para ID inexistente', () => {
        expect(repo.updateActionStatus('fake-id', { label: 'X' })).toBeNull()
      })
    })

    describe('deleteActionStatus', () => {
      it('deve excluir status não-default', () => {
        const status = repo.createActionStatus({
          key: 'custom',
          label: 'Custom',
          icon: 'X',
          color: 'info',
          isDefault: false,
          isFinal: false,
          sortOrder: 0,
        })

        expect(repo.deleteActionStatus(status.id)).toBe(true)
        expect(repo.getActionStatusByKey('custom')).toBeNull()
      })

      it('não deve excluir status default', () => {
        const status = repo.createActionStatus({
          key: 'builtin',
          label: 'Built-in',
          icon: 'X',
          color: 'info',
          isDefault: true,
          isFinal: false,
          sortOrder: 0,
        })

        expect(repo.deleteActionStatus(status.id)).toBe(false)
      })
    })

    describe('reorderActionStatuses', () => {
      it('deve reordenar statuses por IDs', () => {
        const s1 = repo.createActionStatus({
          key: 'first',
          label: 'First',
          icon: 'X',
          color: 'info',
          isDefault: false,
          isFinal: false,
          sortOrder: 0,
        })
        const s2 = repo.createActionStatus({
          key: 'second',
          label: 'Second',
          icon: 'X',
          color: 'info',
          isDefault: false,
          isFinal: false,
          sortOrder: 1,
        })

        repo.reorderActionStatuses([s2.id, s1.id])

        const statuses = repo.getActionStatuses()
        expect(statuses[0].key).toBe('second')
        expect(statuses[1].key).toBe('first')
      })
    })
  })

  // === Capture Templates ===

  describe('CaptureTemplates', () => {
    describe('createCaptureTemplate', () => {
      it('deve criar um capture template', () => {
        const template = repo.createCaptureTemplate({
          label: 'Bug Report',
          prefix: 'Bug: ',
          placeholder: '[descrição do bug encontrado]',
          icon: 'Bug',
          hintType: 'blocker',
          isDefault: false,
          sortOrder: 10,
        })

        expect(template.id).toBeDefined()
        expect(template.label).toBe('Bug Report')
        expect(template.prefix).toBe('Bug: ')
        expect(template.placeholder).toBe('[descrição do bug encontrado]')
        expect(template.icon).toBe('Bug')
        expect(template.hintType).toBe('blocker')
        expect(template.isDefault).toBe(false)
        expect(template.sortOrder).toBe(10)
      })
    })

    describe('getCaptureTemplates', () => {
      it('deve retornar templates ordenados por sortOrder', () => {
        repo.createCaptureTemplate({
          label: 'B',
          prefix: '',
          placeholder: '',
          icon: 'X',
          hintType: 'info',
          isDefault: false,
          sortOrder: 2,
        })
        repo.createCaptureTemplate({
          label: 'A',
          prefix: '',
          placeholder: '',
          icon: 'X',
          hintType: 'info',
          isDefault: false,
          sortOrder: 1,
        })

        const templates = repo.getCaptureTemplates()
        expect(templates[0].label).toBe('A')
        expect(templates[1].label).toBe('B')
      })
    })

    describe('updateCaptureTemplate', () => {
      it('deve atualizar campos do template', () => {
        const template = repo.createCaptureTemplate({
          label: 'Original',
          prefix: 'P: ',
          placeholder: 'ph',
          icon: 'X',
          hintType: 'info',
          isDefault: false,
          sortOrder: 0,
        })

        const updated = repo.updateCaptureTemplate(template.id, { label: 'Atualizado', prefix: 'Novo: ' })
        expect(updated).not.toBeNull()
        expect(updated!.label).toBe('Atualizado')
        expect(updated!.prefix).toBe('Novo: ')
        expect(updated!.placeholder).toBe('ph') // não alterado
      })

      it('deve retornar null para ID inexistente', () => {
        expect(repo.updateCaptureTemplate('fake-id', { label: 'X' })).toBeNull()
      })
    })

    describe('deleteCaptureTemplate', () => {
      it('deve excluir template não-default', () => {
        const template = repo.createCaptureTemplate({
          label: 'Custom',
          prefix: '',
          placeholder: '',
          icon: 'X',
          hintType: 'info',
          isDefault: false,
          sortOrder: 0,
        })

        expect(repo.deleteCaptureTemplate(template.id)).toBe(true)
      })

      it('não deve excluir template default', () => {
        const template = repo.createCaptureTemplate({
          label: 'Built-in',
          prefix: '',
          placeholder: '',
          icon: 'X',
          hintType: 'info',
          isDefault: true,
          sortOrder: 0,
        })

        expect(repo.deleteCaptureTemplate(template.id)).toBe(false)
      })
    })

    describe('reorderCaptureTemplates', () => {
      it('deve reordenar templates por IDs', () => {
        const t1 = repo.createCaptureTemplate({
          label: 'First',
          prefix: '',
          placeholder: '',
          icon: 'X',
          hintType: 'info',
          isDefault: false,
          sortOrder: 0,
        })
        const t2 = repo.createCaptureTemplate({
          label: 'Second',
          prefix: '',
          placeholder: '',
          icon: 'X',
          hintType: 'info',
          isDefault: false,
          sortOrder: 1,
        })

        repo.reorderCaptureTemplates([t2.id, t1.id])

        const templates = repo.getCaptureTemplates()
        expect(templates[0].label).toBe('Second')
        expect(templates[1].label).toBe('First')
      })
    })
  })
})
