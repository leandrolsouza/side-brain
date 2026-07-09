import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'
import type { CustomEntryType, CustomActionStatus, CustomCaptureTemplate } from '../../shared/types'

export function registerCustomFieldsHandlers(): void {
  const { customFieldsRepo } = getContainer()

  // Entry Types
  safeHandle('custom-fields:getEntryTypes', async () => {
    return customFieldsRepo.getEntryTypes()
  })

  safeHandle('custom-fields:createEntryType', async (_event, data: Omit<CustomEntryType, 'id'>) => {
    return customFieldsRepo.createEntryType(data)
  })

  safeHandle('custom-fields:updateEntryType', async (_event, id: string, updates: Partial<Omit<CustomEntryType, 'id' | 'isDefault'>>) => {
    return customFieldsRepo.updateEntryType(id, updates)
  })

  safeHandle('custom-fields:deleteEntryType', async (_event, id: string) => {
    return customFieldsRepo.deleteEntryType(id)
  })

  safeHandle('custom-fields:reorderEntryTypes', async (_event, orderedIds: string[]) => {
    return customFieldsRepo.reorderEntryTypes(orderedIds)
  })

  // Action Statuses
  safeHandle('custom-fields:getActionStatuses', async () => {
    return customFieldsRepo.getActionStatuses()
  })

  safeHandle('custom-fields:createActionStatus', async (_event, data: Omit<CustomActionStatus, 'id'>) => {
    return customFieldsRepo.createActionStatus(data)
  })

  safeHandle('custom-fields:updateActionStatus', async (_event, id: string, updates: Partial<Omit<CustomActionStatus, 'id' | 'isDefault'>>) => {
    return customFieldsRepo.updateActionStatus(id, updates)
  })

  safeHandle('custom-fields:deleteActionStatus', async (_event, id: string) => {
    return customFieldsRepo.deleteActionStatus(id)
  })

  safeHandle('custom-fields:reorderActionStatuses', async (_event, orderedIds: string[]) => {
    return customFieldsRepo.reorderActionStatuses(orderedIds)
  })

  // Capture Templates
  safeHandle('custom-fields:getCaptureTemplates', async () => {
    return customFieldsRepo.getCaptureTemplates()
  })

  safeHandle('custom-fields:createCaptureTemplate', async (_event, data: Omit<CustomCaptureTemplate, 'id'>) => {
    return customFieldsRepo.createCaptureTemplate(data)
  })

  safeHandle('custom-fields:updateCaptureTemplate', async (_event, id: string, updates: Partial<Omit<CustomCaptureTemplate, 'id' | 'isDefault'>>) => {
    return customFieldsRepo.updateCaptureTemplate(id, updates)
  })

  safeHandle('custom-fields:deleteCaptureTemplate', async (_event, id: string) => {
    return customFieldsRepo.deleteCaptureTemplate(id)
  })

  safeHandle('custom-fields:reorderCaptureTemplates', async (_event, orderedIds: string[]) => {
    return customFieldsRepo.reorderCaptureTemplates(orderedIds)
  })
}
