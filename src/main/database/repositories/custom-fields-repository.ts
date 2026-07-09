import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../schema'
import type { CustomEntryType, CustomActionStatus, CustomCaptureTemplate } from '../../../shared/types'

export class CustomFieldsRepository {
  // === Entry Types ===

  getEntryTypes(): CustomEntryType[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM custom_entry_types ORDER BY sort_order ASC').all() as any[]
    return rows.map(this.mapEntryTypeRow)
  }

  getEntryTypeByKey(key: string): CustomEntryType | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM custom_entry_types WHERE key = ?').get(key) as any
    return row ? this.mapEntryTypeRow(row) : null
  }

  createEntryType(data: Omit<CustomEntryType, 'id'>): CustomEntryType {
    const db = getDatabase()
    const id = uuidv4()
    db.prepare(
      `INSERT INTO custom_entry_types (id, key, label, icon, color, is_default, sort_order, allows_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.key, data.label, data.icon, data.color, data.isDefault ? 1 : 0, data.sortOrder, data.allowsAction ? 1 : 0)
    return { id, ...data }
  }

  updateEntryType(id: string, updates: Partial<Omit<CustomEntryType, 'id' | 'isDefault'>>): CustomEntryType | null {
    const db = getDatabase()
    const current = db.prepare('SELECT * FROM custom_entry_types WHERE id = ?').get(id) as any
    if (!current) return null

    const fields: string[] = []
    const values: any[] = []

    if (updates.key !== undefined) { fields.push('key = ?'); values.push(updates.key) }
    if (updates.label !== undefined) { fields.push('label = ?'); values.push(updates.label) }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color) }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder) }
    if (updates.allowsAction !== undefined) { fields.push('allows_action = ?'); values.push(updates.allowsAction ? 1 : 0) }

    if (fields.length === 0) return this.mapEntryTypeRow(current)

    values.push(id)
    db.prepare(`UPDATE custom_entry_types SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM custom_entry_types WHERE id = ?').get(id) as any
    return this.mapEntryTypeRow(updated)
  }

  deleteEntryType(id: string): boolean {
    const db = getDatabase()
    // Prevent deletion of default types
    const row = db.prepare('SELECT is_default FROM custom_entry_types WHERE id = ?').get(id) as any
    if (!row || row.is_default === 1) return false
    db.prepare('DELETE FROM custom_entry_types WHERE id = ?').run(id)
    return true
  }

  reorderEntryTypes(orderedIds: string[]): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE custom_entry_types SET sort_order = ? WHERE id = ?')
    const transaction = db.transaction(() => {
      orderedIds.forEach((id, index) => {
        stmt.run(index, id)
      })
    })
    transaction()
  }

  // === Action Statuses ===

  getActionStatuses(): CustomActionStatus[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM custom_action_statuses ORDER BY sort_order ASC').all() as any[]
    return rows.map(this.mapActionStatusRow)
  }

  getActionStatusByKey(key: string): CustomActionStatus | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM custom_action_statuses WHERE key = ?').get(key) as any
    return row ? this.mapActionStatusRow(row) : null
  }

  createActionStatus(data: Omit<CustomActionStatus, 'id'>): CustomActionStatus {
    const db = getDatabase()
    const id = uuidv4()
    db.prepare(
      `INSERT INTO custom_action_statuses (id, key, label, icon, color, is_default, is_final, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.key, data.label, data.icon, data.color, data.isDefault ? 1 : 0, data.isFinal ? 1 : 0, data.sortOrder)
    return { id, ...data }
  }

  updateActionStatus(id: string, updates: Partial<Omit<CustomActionStatus, 'id' | 'isDefault'>>): CustomActionStatus | null {
    const db = getDatabase()
    const current = db.prepare('SELECT * FROM custom_action_statuses WHERE id = ?').get(id) as any
    if (!current) return null

    const fields: string[] = []
    const values: any[] = []

    if (updates.key !== undefined) { fields.push('key = ?'); values.push(updates.key) }
    if (updates.label !== undefined) { fields.push('label = ?'); values.push(updates.label) }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color) }
    if (updates.isFinal !== undefined) { fields.push('is_final = ?'); values.push(updates.isFinal ? 1 : 0) }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder) }

    if (fields.length === 0) return this.mapActionStatusRow(current)

    values.push(id)
    db.prepare(`UPDATE custom_action_statuses SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM custom_action_statuses WHERE id = ?').get(id) as any
    return this.mapActionStatusRow(updated)
  }

  deleteActionStatus(id: string): boolean {
    const db = getDatabase()
    const row = db.prepare('SELECT is_default FROM custom_action_statuses WHERE id = ?').get(id) as any
    if (!row || row.is_default === 1) return false
    db.prepare('DELETE FROM custom_action_statuses WHERE id = ?').run(id)
    return true
  }

  reorderActionStatuses(orderedIds: string[]): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE custom_action_statuses SET sort_order = ? WHERE id = ?')
    const transaction = db.transaction(() => {
      orderedIds.forEach((id, index) => {
        stmt.run(index, id)
      })
    })
    transaction()
  }

  // === Capture Templates ===

  getCaptureTemplates(): CustomCaptureTemplate[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM custom_capture_templates ORDER BY sort_order ASC').all() as any[]
    return rows.map(this.mapCaptureTemplateRow)
  }

  createCaptureTemplate(data: Omit<CustomCaptureTemplate, 'id'>): CustomCaptureTemplate {
    const db = getDatabase()
    const id = uuidv4()
    db.prepare(
      `INSERT INTO custom_capture_templates (id, label, prefix, placeholder, icon, hint_type, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.label, data.prefix, data.placeholder, data.icon, data.hintType, data.isDefault ? 1 : 0, data.sortOrder)
    return { id, ...data }
  }

  updateCaptureTemplate(id: string, updates: Partial<Omit<CustomCaptureTemplate, 'id' | 'isDefault'>>): CustomCaptureTemplate | null {
    const db = getDatabase()
    const current = db.prepare('SELECT * FROM custom_capture_templates WHERE id = ?').get(id) as any
    if (!current) return null

    const fields: string[] = []
    const values: any[] = []

    if (updates.label !== undefined) { fields.push('label = ?'); values.push(updates.label) }
    if (updates.prefix !== undefined) { fields.push('prefix = ?'); values.push(updates.prefix) }
    if (updates.placeholder !== undefined) { fields.push('placeholder = ?'); values.push(updates.placeholder) }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
    if (updates.hintType !== undefined) { fields.push('hint_type = ?'); values.push(updates.hintType) }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder) }

    if (fields.length === 0) return this.mapCaptureTemplateRow(current)

    values.push(id)
    db.prepare(`UPDATE custom_capture_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM custom_capture_templates WHERE id = ?').get(id) as any
    return this.mapCaptureTemplateRow(updated)
  }

  deleteCaptureTemplate(id: string): boolean {
    const db = getDatabase()
    const row = db.prepare('SELECT is_default FROM custom_capture_templates WHERE id = ?').get(id) as any
    if (!row || row.is_default === 1) return false
    db.prepare('DELETE FROM custom_capture_templates WHERE id = ?').run(id)
    return true
  }

  reorderCaptureTemplates(orderedIds: string[]): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE custom_capture_templates SET sort_order = ? WHERE id = ?')
    const transaction = db.transaction(() => {
      orderedIds.forEach((id, index) => {
        stmt.run(index, id)
      })
    })
    transaction()
  }

  // === Row mappers ===

  private mapEntryTypeRow(row: any): CustomEntryType {
    return {
      id: row.id,
      key: row.key,
      label: row.label,
      icon: row.icon,
      color: row.color,
      isDefault: row.is_default === 1,
      sortOrder: row.sort_order,
      allowsAction: row.allows_action === 1,
    }
  }

  private mapActionStatusRow(row: any): CustomActionStatus {
    return {
      id: row.id,
      key: row.key,
      label: row.label,
      icon: row.icon,
      color: row.color,
      isDefault: row.is_default === 1,
      isFinal: row.is_final === 1,
      sortOrder: row.sort_order,
    }
  }

  private mapCaptureTemplateRow(row: any): CustomCaptureTemplate {
    return {
      id: row.id,
      label: row.label,
      prefix: row.prefix,
      placeholder: row.placeholder,
      icon: row.icon,
      hintType: row.hint_type,
      isDefault: row.is_default === 1,
      sortOrder: row.sort_order,
    }
  }
}
