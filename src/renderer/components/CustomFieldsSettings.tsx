import React, { useState, useEffect } from 'react'
import {
  Plus, Trash2, GripVertical, Pencil, Check, X, Info, Gavel,
  MessageSquare, Lightbulb, AlertTriangle, RefreshCw, Users,
  Clock, CheckCircle2, Minus, AlertCircle, Circle, PenLine,
  Tag, Zap, Archive, Star, Flag, Heart, Shield, Eye, Bell,
  Bookmark, Coffee, FileText, Globe, Home, Key, Link, Lock,
  Mail, Map, Phone, Search, Settings, Smile, Target, Truck,
  Wifi, ArrowUp, ArrowDown
} from 'lucide-react'
import { useToast } from './ToastContext'
import { ConfirmModal } from './ConfirmModal'
import type { CustomEntryType, CustomActionStatus, CustomCaptureTemplate } from '@shared/types'

type ActiveTab = 'entry-types' | 'action-statuses' | 'capture-templates'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Info, Gavel, MessageSquare, Lightbulb, AlertTriangle, RefreshCw,
  Users, Clock, CheckCircle2, Minus, AlertCircle, Circle, PenLine,
  Tag, Zap, Archive, Star, Flag, Heart, Shield, Eye, Bell,
  Bookmark, Coffee, FileText, Globe, Home, Key, Link, Lock,
  Mail, Map, Phone, Search, Settings, Smile, Target, Truck,
  Wifi, Plus, GripVertical, Pencil, Check, X, ArrowUp, ArrowDown,
}

const AVAILABLE_ICONS = Object.keys(ICON_MAP)

const COLOR_OPTIONS = [
  { value: 'info', label: 'Azul' },
  { value: 'warning', label: 'Amarelo' },
  { value: 'error', label: 'Vermelho' },
  { value: 'success', label: 'Verde' },
  { value: 'neutral', label: 'Cinza' },
]

export function CustomFieldsSettings() {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<ActiveTab>('entry-types')

  return (
    <div className="flex-col" style={{ height: '100%' }}>
      <div className="panel-header">
        <span className="panel-title">Campos Personalizados</span>
      </div>
      <p className="panel-description">
        Configure os tipos de entrada, status de ação e templates de captura do seu workspace.
      </p>

      {/* Tabs */}
      <div className="settings-tabs" style={{ marginBottom: 16 }}>
        {([
          { id: 'entry-types', label: 'Tipos de Entrada' },
          { id: 'action-statuses', label: 'Status de Ação' },
          { id: 'capture-templates', label: 'Templates de Captura' },
        ] as { id: ActiveTab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'entry-types' && <EntryTypesPanel />}
        {activeTab === 'action-statuses' && <ActionStatusesPanel />}
        {activeTab === 'capture-templates' && <CaptureTemplatesPanel />}
      </div>
    </div>
  )
}

// === Entry Types Panel ===

function EntryTypesPanel() {
  const { addToast } = useToast()
  const [items, setItems] = useState<CustomEntryType[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [formKey, setFormKey] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formIcon, setFormIcon] = useState('Circle')
  const [formColor, setFormColor] = useState('neutral')
  const [formAllowsAction, setFormAllowsAction] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const data = await window.electronAPI.getEntryTypes()
    setItems(data)
  }

  const startEdit = (item: CustomEntryType) => {
    setEditingId(item.id)
    setFormKey(item.key)
    setFormLabel(item.label)
    setFormIcon(item.icon)
    setFormColor(item.color)
    setFormAllowsAction(item.allowsAction)
    setIsAdding(false)
  }

  const startAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setFormKey('')
    setFormLabel('')
    setFormIcon('Circle')
    setFormColor('neutral')
    setFormAllowsAction(true)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsAdding(false)
  }

  const saveEdit = async () => {
    if (!formKey.trim() || !formLabel.trim()) {
      addToast('Preencha chave e label', 'error')
      return
    }

    if (editingId) {
      await window.electronAPI.updateEntryType(editingId, {
        key: formKey.trim(),
        label: formLabel.trim(),
        icon: formIcon,
        color: formColor,
        allowsAction: formAllowsAction,
      })
      addToast('Tipo atualizado', 'success')
    } else {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sortOrder)) + 1 : 0
      await window.electronAPI.createEntryType({
        key: formKey.trim().toLowerCase().replace(/\s+/g, '_'),
        label: formLabel.trim(),
        icon: formIcon,
        color: formColor,
        isDefault: false,
        sortOrder: maxOrder,
        allowsAction: formAllowsAction,
      })
      addToast('Tipo criado', 'success')
    }
    cancelEdit()
    await load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const result = await window.electronAPI.deleteEntryType(deleteTarget)
    if (result) {
      addToast('Tipo removido', 'success')
    } else {
      addToast('Não é possível remover tipos padrão', 'error')
    }
    setDeleteTarget(null)
    await load()
  }

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newItems = [...items]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newItems.length) return
    ;[newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]]
    setItems(newItems)
    await window.electronAPI.reorderEntryTypes(newItems.map(i => i.id))
  }

  return (
    <div className="flex-col gap-8">
      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
          Define quais tipos uma entrada pode ter. A IA usa esses tipos para classificar.
        </span>
        <button className="vscode-button" onClick={startAdd} disabled={isAdding}>
          <Plus size={14} />
          Novo Tipo
        </button>
      </div>

      {/* Add form */}
      {isAdding && (
        <FieldForm
          formKey={formKey} setFormKey={setFormKey}
          formLabel={formLabel} setFormLabel={setFormLabel}
          formIcon={formIcon} setFormIcon={setFormIcon}
          formColor={formColor} setFormColor={setFormColor}
          extraField={
            <label className="custom-fields-checkbox">
              <input type="checkbox" checked={formAllowsAction} onChange={(e) => setFormAllowsAction(e.target.checked)} />
              <span>Permite ação (entries com este tipo podem ter status de ação)</span>
            </label>
          }
          onSave={saveEdit}
          onCancel={cancelEdit}
        />
      )}

      {/* List */}
      {items.map((item, index) => (
        <div key={item.id} className="custom-fields-item">
          {editingId === item.id ? (
            <FieldForm
              formKey={formKey} setFormKey={setFormKey}
              formLabel={formLabel} setFormLabel={setFormLabel}
              formIcon={formIcon} setFormIcon={setFormIcon}
              formColor={formColor} setFormColor={setFormColor}
              extraField={
                <label className="custom-fields-checkbox">
                  <input type="checkbox" checked={formAllowsAction} onChange={(e) => setFormAllowsAction(e.target.checked)} />
                  <span>Permite ação</span>
                </label>
              }
              onSave={saveEdit}
              onCancel={cancelEdit}
            />
          ) : (
            <div className="custom-fields-row">
              <div className="custom-fields-row-left">
                <div className="custom-fields-order-btns">
                  <button className="inline-action-btn" onClick={() => moveItem(index, 'up')} disabled={index === 0} title="Mover para cima">
                    <ArrowUp size={12} />
                  </button>
                  <button className="inline-action-btn" onClick={() => moveItem(index, 'down')} disabled={index === items.length - 1} title="Mover para baixo">
                    <ArrowDown size={12} />
                  </button>
                </div>
                <IconPreview name={item.icon} />
                <span className={`vscode-badge ${item.color}`}>{item.label}</span>
                <span className="custom-fields-key">{item.key}</span>
                {!item.allowsAction && <span className="custom-fields-tag">sem ação</span>}
                {item.isDefault && <span className="custom-fields-tag">padrão</span>}
              </div>
              <div className="custom-fields-row-right">
                <button className="inline-action-btn" onClick={() => startEdit(item)} title="Editar">
                  <Pencil size={14} />
                </button>
                {!item.isDefault && (
                  <button className="inline-action-btn" onClick={() => setDeleteTarget(item.id)} title="Excluir" style={{ color: 'var(--vscode-errorForeground)' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Excluir tipo de entrada"
        message="Tem certeza? Entradas existentes com este tipo não serão afetadas, mas o tipo não estará mais disponível para novas entradas."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// === Action Statuses Panel ===

function ActionStatusesPanel() {
  const { addToast } = useToast()
  const [items, setItems] = useState<CustomActionStatus[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [formKey, setFormKey] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formIcon, setFormIcon] = useState('Circle')
  const [formColor, setFormColor] = useState('neutral')
  const [formIsFinal, setFormIsFinal] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    const data = await window.electronAPI.getActionStatuses()
    setItems(data)
  }

  const startEdit = (item: CustomActionStatus) => {
    setEditingId(item.id)
    setFormKey(item.key)
    setFormLabel(item.label)
    setFormIcon(item.icon)
    setFormColor(item.color)
    setFormIsFinal(item.isFinal)
    setIsAdding(false)
  }

  const startAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setFormKey('')
    setFormLabel('')
    setFormIcon('Circle')
    setFormColor('neutral')
    setFormIsFinal(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsAdding(false)
  }

  const saveEdit = async () => {
    if (!formKey.trim() || !formLabel.trim()) {
      addToast('Preencha chave e label', 'error')
      return
    }

    if (editingId) {
      await window.electronAPI.updateActionStatus(editingId, {
        key: formKey.trim(),
        label: formLabel.trim(),
        icon: formIcon,
        color: formColor,
        isFinal: formIsFinal,
      })
      addToast('Status atualizado', 'success')
    } else {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sortOrder)) + 1 : 0
      await window.electronAPI.createActionStatus({
        key: formKey.trim().toLowerCase().replace(/\s+/g, '_'),
        label: formLabel.trim(),
        icon: formIcon,
        color: formColor,
        isDefault: false,
        isFinal: formIsFinal,
        sortOrder: maxOrder,
      })
      addToast('Status criado', 'success')
    }
    cancelEdit()
    await load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const result = await window.electronAPI.deleteActionStatus(deleteTarget)
    if (result) {
      addToast('Status removido', 'success')
    } else {
      addToast('Não é possível remover status padrão', 'error')
    }
    setDeleteTarget(null)
    await load()
  }

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newItems = [...items]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newItems.length) return
    ;[newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]]
    setItems(newItems)
    await window.electronAPI.reorderActionStatuses(newItems.map(i => i.id))
  }

  return (
    <div className="flex-col gap-8">
      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
          Define os possíveis status de ação para entradas que permitem ação.
        </span>
        <button className="vscode-button" onClick={startAdd} disabled={isAdding}>
          <Plus size={14} />
          Novo Status
        </button>
      </div>

      {isAdding && (
        <FieldForm
          formKey={formKey} setFormKey={setFormKey}
          formLabel={formLabel} setFormLabel={setFormLabel}
          formIcon={formIcon} setFormIcon={setFormIcon}
          formColor={formColor} setFormColor={setFormColor}
          extraField={
            <label className="custom-fields-checkbox">
              <input type="checkbox" checked={formIsFinal} onChange={(e) => setFormIsFinal(e.target.checked)} />
              <span>Status final (indica conclusão)</span>
            </label>
          }
          onSave={saveEdit}
          onCancel={cancelEdit}
        />
      )}

      {items.map((item, index) => (
        <div key={item.id} className="custom-fields-item">
          {editingId === item.id ? (
            <FieldForm
              formKey={formKey} setFormKey={setFormKey}
              formLabel={formLabel} setFormLabel={setFormLabel}
              formIcon={formIcon} setFormIcon={setFormIcon}
              formColor={formColor} setFormColor={setFormColor}
              extraField={
                <label className="custom-fields-checkbox">
                  <input type="checkbox" checked={formIsFinal} onChange={(e) => setFormIsFinal(e.target.checked)} />
                  <span>Status final</span>
                </label>
              }
              onSave={saveEdit}
              onCancel={cancelEdit}
            />
          ) : (
            <div className="custom-fields-row">
              <div className="custom-fields-row-left">
                <div className="custom-fields-order-btns">
                  <button className="inline-action-btn" onClick={() => moveItem(index, 'up')} disabled={index === 0} title="Mover para cima">
                    <ArrowUp size={12} />
                  </button>
                  <button className="inline-action-btn" onClick={() => moveItem(index, 'down')} disabled={index === items.length - 1} title="Mover para baixo">
                    <ArrowDown size={12} />
                  </button>
                </div>
                <IconPreview name={item.icon} />
                <span className={`vscode-badge ${item.color}`}>{item.label}</span>
                <span className="custom-fields-key">{item.key}</span>
                {item.isFinal && <span className="custom-fields-tag">final</span>}
                {item.isDefault && <span className="custom-fields-tag">padrão</span>}
              </div>
              <div className="custom-fields-row-right">
                <button className="inline-action-btn" onClick={() => startEdit(item)} title="Editar">
                  <Pencil size={14} />
                </button>
                {!item.isDefault && (
                  <button className="inline-action-btn" onClick={() => setDeleteTarget(item.id)} title="Excluir" style={{ color: 'var(--vscode-errorForeground)' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Excluir status de ação"
        message="Tem certeza? Entradas existentes com este status não serão afetadas, mas o status não estará mais disponível."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// === Capture Templates Panel ===

function CaptureTemplatesPanel() {
  const { addToast } = useToast()
  const [items, setItems] = useState<CustomCaptureTemplate[]>([])
  const [entryTypes, setEntryTypes] = useState<CustomEntryType[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [formLabel, setFormLabel] = useState('')
  const [formPrefix, setFormPrefix] = useState('')
  const [formPlaceholder, setFormPlaceholder] = useState('')
  const [formIcon, setFormIcon] = useState('PenLine')
  const [formHintType, setFormHintType] = useState('information')

  useEffect(() => { load() }, [])

  const load = async () => {
    const [templates, types] = await Promise.all([
      window.electronAPI.getCaptureTemplates(),
      window.electronAPI.getEntryTypes(),
    ])
    setItems(templates)
    setEntryTypes(types)
  }

  const startEdit = (item: CustomCaptureTemplate) => {
    setEditingId(item.id)
    setFormLabel(item.label)
    setFormPrefix(item.prefix)
    setFormPlaceholder(item.placeholder)
    setFormIcon(item.icon)
    setFormHintType(item.hintType)
    setIsAdding(false)
  }

  const startAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setFormLabel('')
    setFormPrefix('')
    setFormPlaceholder('')
    setFormIcon('PenLine')
    setFormHintType('information')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsAdding(false)
  }

  const saveEdit = async () => {
    if (!formLabel.trim()) {
      addToast('Preencha o label', 'error')
      return
    }

    if (editingId) {
      await window.electronAPI.updateCaptureTemplate(editingId, {
        label: formLabel.trim(),
        prefix: formPrefix,
        placeholder: formPlaceholder,
        icon: formIcon,
        hintType: formHintType,
      })
      addToast('Template atualizado', 'success')
    } else {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sortOrder)) + 1 : 0
      await window.electronAPI.createCaptureTemplate({
        label: formLabel.trim(),
        prefix: formPrefix,
        placeholder: formPlaceholder,
        icon: formIcon,
        hintType: formHintType,
        isDefault: false,
        sortOrder: maxOrder,
      })
      addToast('Template criado', 'success')
    }
    cancelEdit()
    await load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const result = await window.electronAPI.deleteCaptureTemplate(deleteTarget)
    if (result) {
      addToast('Template removido', 'success')
    } else {
      addToast('Não é possível remover templates padrão', 'error')
    }
    setDeleteTarget(null)
    await load()
  }

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newItems = [...items]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newItems.length) return
    ;[newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]]
    setItems(newItems)
    await window.electronAPI.reorderCaptureTemplates(newItems.map(i => i.id))
  }

  const templateForm = (
    <div className="custom-fields-form">
      <div className="custom-fields-form-row">
        <div className="custom-fields-form-field">
          <label>Label</label>
          <input className="vscode-input" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Ex: Reunião" />
        </div>
        <div className="custom-fields-form-field">
          <label>Ícone</label>
          <IconPicker value={formIcon} onChange={setFormIcon} />
        </div>
      </div>
      <div className="custom-fields-form-row">
        <div className="custom-fields-form-field" style={{ flex: 1 }}>
          <label>Prefixo</label>
          <input className="vscode-input" value={formPrefix} onChange={(e) => setFormPrefix(e.target.value)} placeholder="Ex: Reunião com " />
        </div>
        <div className="custom-fields-form-field" style={{ flex: 1 }}>
          <label>Tipo sugerido</label>
          <select className="vscode-select" value={formHintType} onChange={(e) => setFormHintType(e.target.value)}>
            {entryTypes.map((et) => (
              <option key={et.key} value={et.key}>{et.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="custom-fields-form-field">
        <label>Placeholder</label>
        <input className="vscode-input" value={formPlaceholder} onChange={(e) => setFormPlaceholder(e.target.value)} placeholder="Ex: [pessoa]: [assunto discutido]" />
      </div>
      <div className="custom-fields-form-actions">
        <button className="vscode-button" onClick={saveEdit}><Check size={14} /> Salvar</button>
        <button className="vscode-button secondary" onClick={cancelEdit}><X size={14} /> Cancelar</button>
      </div>
    </div>
  )

  return (
    <div className="flex-col gap-8">
      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
          Templates aparecem na tela de captura como atalhos para preencher o texto rapidamente.
        </span>
        <button className="vscode-button" onClick={startAdd} disabled={isAdding}>
          <Plus size={14} />
          Novo Template
        </button>
      </div>

      {isAdding && templateForm}

      {items.map((item, index) => (
        <div key={item.id} className="custom-fields-item">
          {editingId === item.id ? (
            templateForm
          ) : (
            <div className="custom-fields-row">
              <div className="custom-fields-row-left">
                <div className="custom-fields-order-btns">
                  <button className="inline-action-btn" onClick={() => moveItem(index, 'up')} disabled={index === 0} title="Mover para cima">
                    <ArrowUp size={12} />
                  </button>
                  <button className="inline-action-btn" onClick={() => moveItem(index, 'down')} disabled={index === items.length - 1} title="Mover para baixo">
                    <ArrowDown size={12} />
                  </button>
                </div>
                <IconPreview name={item.icon} />
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <span className="custom-fields-key">{item.prefix}...</span>
                {item.isDefault && <span className="custom-fields-tag">padrão</span>}
              </div>
              <div className="custom-fields-row-right">
                <button className="inline-action-btn" onClick={() => startEdit(item)} title="Editar">
                  <Pencil size={14} />
                </button>
                {!item.isDefault && (
                  <button className="inline-action-btn" onClick={() => setDeleteTarget(item.id)} title="Excluir" style={{ color: 'var(--vscode-errorForeground)' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Excluir template de captura"
        message="Tem certeza que deseja excluir este template?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// === Shared Components ===

function IconPreview({ name }: { name: string }) {
  const Icon = ICON_MAP[name] || Circle
  return <Icon size={16} />
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="icon-picker-wrapper">
      <button className="icon-picker-trigger vscode-input" onClick={() => setIsOpen(!isOpen)}>
        <IconPreview name={value} />
        <span>{value}</span>
      </button>
      {isOpen && (
        <div className="icon-picker-dropdown">
          {AVAILABLE_ICONS.map((iconName) => (
            <button
              key={iconName}
              className={`icon-picker-option ${value === iconName ? 'active' : ''}`}
              onClick={() => { onChange(iconName); setIsOpen(false) }}
              title={iconName}
            >
              <IconPreview name={iconName} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface FieldFormProps {
  formKey: string
  setFormKey: (v: string) => void
  formLabel: string
  setFormLabel: (v: string) => void
  formIcon: string
  setFormIcon: (v: string) => void
  formColor: string
  setFormColor: (v: string) => void
  extraField?: React.ReactNode
  onSave: () => void
  onCancel: () => void
}

function FieldForm({
  formKey, setFormKey, formLabel, setFormLabel,
  formIcon, setFormIcon, formColor, setFormColor,
  extraField, onSave, onCancel,
}: FieldFormProps) {
  return (
    <div className="custom-fields-form">
      <div className="custom-fields-form-row">
        <div className="custom-fields-form-field">
          <label>Chave (identificador)</label>
          <input className="vscode-input" value={formKey} onChange={(e) => setFormKey(e.target.value)} placeholder="Ex: my_type" />
        </div>
        <div className="custom-fields-form-field">
          <label>Label (exibição)</label>
          <input className="vscode-input" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Ex: Meu Tipo" />
        </div>
      </div>
      <div className="custom-fields-form-row">
        <div className="custom-fields-form-field">
          <label>Ícone</label>
          <IconPicker value={formIcon} onChange={setFormIcon} />
        </div>
        <div className="custom-fields-form-field">
          <label>Cor</label>
          <select className="vscode-select" value={formColor} onChange={(e) => setFormColor(e.target.value)}>
            {COLOR_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      {extraField}
      <div className="custom-fields-form-actions">
        <button className="vscode-button" onClick={onSave}><Check size={14} /> Salvar</button>
        <button className="vscode-button secondary" onClick={onCancel}><X size={14} /> Cancelar</button>
      </div>
    </div>
  )
}
