import type React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Zap,
  FileText,
  Users,
  Gavel,
  Lightbulb,
  Coffee,
  Bug,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react'
import { useToast } from './ToastContext'
import { ConfirmModal } from './ConfirmModal'
import type { StructuredTemplate, CaptureSnippet, TemplateField, TemplateCategory } from '@shared/types'

type ManagerTab = 'templates' | 'snippets'

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  decision: 'Decisão',
  meeting: 'Reunião',
  bug: 'Bug',
  oneOnOne: '1:1',
  brainstorm: 'Brainstorm',
  standup: 'Standup',
  custom: 'Personalizado',
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  decision: Gavel,
  meeting: Users,
  bug: Bug,
  oneOnOne: Users,
  brainstorm: Lightbulb,
  standup: Coffee,
  custom: FileText,
}

export function TemplateManager() {
  const { t } = useTranslation('capture')
  const [activeTab, setActiveTab] = useState<ManagerTab>('templates')

  return (
    <div className="template-manager">
      <div className="panel-header">
        <span className="panel-title">{t('template_manager.title', { defaultValue: 'Formulários & Snippets' })}</span>
      </div>
      <p className="panel-description">
        {t('template_manager.description', {
          defaultValue: 'Gerencie templates de formulário estruturado e snippets de texto rápido.',
        })}
      </p>

      {/* Tabs */}
      <div className="settings-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`settings-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileText size={14} />
          {t('template_manager.tab_templates', { defaultValue: 'Formulários' })}
        </button>
        <button
          type="button"
          className={`settings-tab ${activeTab === 'snippets' ? 'active' : ''}`}
          onClick={() => setActiveTab('snippets')}
        >
          <Zap size={14} />
          {t('template_manager.tab_snippets', { defaultValue: 'Snippets' })}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'templates' && <TemplatesPanel />}
        {activeTab === 'snippets' && <SnippetsPanel />}
      </div>
    </div>
  )
}

// === Templates Panel ===

function TemplatesPanel() {
  const { t } = useTranslation('capture')
  const { addToast } = useToast()
  const [templates, setTemplates] = useState<StructuredTemplate[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    const result = await window.electronAPI.getStructuredTemplates()
    setTemplates(result)
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleDelete = async () => {
    if (!deleteTarget) return
    const success = await window.electronAPI.deleteStructuredTemplate(deleteTarget)
    if (success) {
      addToast(t('template_manager.template_deleted', { defaultValue: 'Template excluído' }), 'success')
      loadTemplates()
    } else {
      addToast(
        t('template_manager.cannot_delete_default', { defaultValue: 'Templates padrão não podem ser excluídos' }),
        'warning'
      )
    }
    setDeleteTarget(null)
  }

  return (
    <div className="template-panel">
      <div className="template-panel-toolbar">
        <button type="button" className="vscode-button secondary" onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus size={14} />
          <span>{t('template_manager.add_template', { defaultValue: 'Novo formulário' })}</span>
        </button>
      </div>

      {isAdding && (
        <TemplateEditor
          onSave={async (data) => {
            await window.electronAPI.createStructuredTemplate(data)
            setIsAdding(false)
            loadTemplates()
            addToast(t('template_manager.template_created', { defaultValue: 'Formulário criado' }), 'success')
          }}
          onCancel={() => setIsAdding(false)}
        />
      )}

      <div className="template-list">
        {templates.map((tpl) => {
          const Icon = CATEGORY_ICONS[tpl.category] || FileText
          const isExpanded = expandedId === tpl.id

          return (
            <div key={tpl.id} className="template-list-item">
              <div className="template-list-item-header" onClick={() => setExpandedId(isExpanded ? null : tpl.id)}>
                <Icon size={16} />
                <span className="template-list-item-name">{tpl.name}</span>
                <span className={`template-list-item-badge color-${tpl.color}`}>
                  {CATEGORY_LABELS[tpl.category] || tpl.category}
                </span>
                <span className="template-list-item-fields">
                  {tpl.fields.length} campo{tpl.fields.length !== 1 ? 's' : ''}
                </span>
                <div className="template-list-item-actions">
                  {!tpl.isDefault && (
                    <>
                      <button
                        type="button"
                        className="inline-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(tpl.id)
                        }}
                        title="Editar"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className="inline-action-btn danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(tpl.id)
                        }}
                        title="Excluir"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {isExpanded && (
                <div className="template-list-item-details">
                  {tpl.description && <p className="template-detail-description">{tpl.description}</p>}
                  <div className="template-detail-fields">
                    {tpl.fields
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((f) => (
                        <div key={f.id} className="template-detail-field">
                          <span className="template-detail-field-label">
                            {f.label}
                            {f.required && <span className="text-required">*</span>}
                            {f.aiAutoFill && <span className="text-ai">✨</span>}
                          </span>
                          <span className="template-detail-field-type">{f.type}</span>
                        </div>
                      ))}
                  </div>
                  <div className="template-detail-output">
                    <strong>Formato de saída:</strong> <code>{tpl.outputFormat}</code>
                  </div>
                </div>
              )}

              {editingId === tpl.id && (
                <TemplateEditor
                  initial={tpl}
                  onSave={async (data) => {
                    await window.electronAPI.updateStructuredTemplate(tpl.id, data)
                    setEditingId(null)
                    loadTemplates()
                    addToast(
                      t('template_manager.template_updated', { defaultValue: 'Formulário atualizado' }),
                      'success'
                    )
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title={t('template_manager.delete_confirm_title', { defaultValue: 'Excluir formulário' })}
        message={t('template_manager.delete_confirm_message', {
          defaultValue: 'Tem certeza que deseja excluir este formulário? Esta ação não pode ser desfeita.',
        })}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// === Template Editor (inline form for create/edit) ===

interface TemplateEditorProps {
  initial?: StructuredTemplate
  onSave: (data: Omit<StructuredTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}

function TemplateEditor({ initial, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [category, setCategory] = useState<TemplateCategory>(initial?.category || 'custom')
  const [color, setColor] = useState(initial?.color || 'neutral')
  const [icon, setIcon] = useState(initial?.icon || 'FileText')
  const [hintType, setHintType] = useState(initial?.hintType || 'information')
  const [hintAction, setHintAction] = useState(initial?.hintAction || 'none')
  const [outputFormat, setOutputFormat] = useState(initial?.outputFormat || '')
  const [fields, setFields] = useState<TemplateField[]>(initial?.fields || [])

  const addField = () => {
    const newField: TemplateField = {
      id: `f${Date.now()}`,
      key: '',
      label: '',
      type: 'text',
      required: false,
      aiAutoFill: false,
      sortOrder: fields.length,
    }
    setFields([...fields, newField])
  }

  const updateField = (index: number, updates: Partial<TemplateField>) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], ...updates }
    setFields(updated)
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    if (!name.trim()) return
    if (fields.length === 0) return

    // Auto-generate output format if empty
    let format = outputFormat
    if (!format.trim()) {
      format = `${fields.map((f) => `${f.label}: {{${f.key}}}`).join('. ')}.`
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      category,
      fields: fields.map((f, i) => ({ ...f, sortOrder: i })),
      outputFormat: format,
      hintType,
      hintAction,
      isDefault: false,
      sortOrder: 99,
    })
  }

  return (
    <div className="template-editor">
      <div className="template-editor-row">
        <div className="template-editor-field" style={{ flex: 2 }}>
          <label>Nome</label>
          <input
            className="vscode-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do formulário"
          />
        </div>
        <div className="template-editor-field" style={{ flex: 1 }}>
          <label>Categoria</label>
          <select
            className="vscode-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as TemplateCategory)}
          >
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="template-editor-field" style={{ flex: 1 }}>
          <label>Cor</label>
          <select className="vscode-select" value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="neutral">Neutro</option>
            <option value="info">Info</option>
            <option value="warning">Alerta</option>
            <option value="error">Erro</option>
            <option value="success">Sucesso</option>
          </select>
        </div>
      </div>

      <div className="template-editor-field">
        <label>Descrição (opcional)</label>
        <input
          className="vscode-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Breve descrição do propósito"
        />
      </div>

      <div className="template-editor-row">
        <div className="template-editor-field" style={{ flex: 1 }}>
          <label>Tipo sugerido</label>
          <input
            className="vscode-input"
            value={hintType}
            onChange={(e) => setHintType(e.target.value)}
            placeholder="information"
          />
        </div>
        <div className="template-editor-field" style={{ flex: 1 }}>
          <label>Ação sugerida</label>
          <input
            className="vscode-input"
            value={hintAction}
            onChange={(e) => setHintAction(e.target.value)}
            placeholder="none"
          />
        </div>
      </div>

      {/* Fields editor */}
      <div className="template-editor-fields-section">
        <div className="template-editor-fields-header">
          <label>Campos ({fields.length})</label>
          <button type="button" className="vscode-button secondary" onClick={addField} style={{ padding: '2px 8px' }}>
            <Plus size={12} />
            <span>Campo</span>
          </button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="template-editor-field-row">
            <input
              className="vscode-input"
              value={field.key}
              onChange={(e) => updateField(index, { key: e.target.value })}
              placeholder="chave"
              style={{ width: 80 }}
            />
            <input
              className="vscode-input"
              value={field.label}
              onChange={(e) => updateField(index, { label: e.target.value })}
              placeholder="Label"
              style={{ flex: 1 }}
            />
            <select
              className="vscode-select"
              value={field.type}
              onChange={(e) => updateField(index, { type: e.target.value as TemplateField['type'] })}
              style={{ width: 100 }}
            >
              <option value="text">Texto</option>
              <option value="textarea">Texto longo</option>
              <option value="select">Seleção</option>
              <option value="date">Data</option>
              <option value="mention">Pessoa</option>
            </select>
            <label className="template-editor-checkbox" title="Obrigatório">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => updateField(index, { required: e.target.checked })}
              />
              <span>Req</span>
            </label>
            <label className="template-editor-checkbox" title="Auto-fill IA">
              <input
                type="checkbox"
                checked={field.aiAutoFill || false}
                onChange={(e) => updateField(index, { aiAutoFill: e.target.checked })}
              />
              <span>IA</span>
            </label>
            <button type="button" className="inline-action-btn danger" onClick={() => removeField(index)}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="template-editor-field">
        <label>Formato de saída (usar {'{{chave}}'} para interpolação)</label>
        <input
          className="vscode-input"
          value={outputFormat}
          onChange={(e) => setOutputFormat(e.target.value)}
          placeholder="{{campo1}}: {{campo2}}. Contexto: {{campo3}}."
        />
      </div>

      <div className="template-editor-actions">
        <button
          type="button"
          className="vscode-button"
          onClick={handleSave}
          disabled={!name.trim() || fields.length === 0}
        >
          <Check size={14} />
          <span>{initial ? 'Salvar alterações' : 'Criar formulário'}</span>
        </button>
        <button type="button" className="vscode-button secondary" onClick={onCancel}>
          <X size={14} />
          <span>Cancelar</span>
        </button>
      </div>
    </div>
  )
}

// === Snippets Panel ===

function SnippetsPanel() {
  const { t } = useTranslation('capture')
  const { addToast } = useToast()
  const [snippets, setSnippets] = useState<CaptureSnippet[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Form state
  const [formTrigger, setFormTrigger] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('general')

  const loadSnippets = useCallback(async () => {
    const result = await window.electronAPI.getCaptureSnippets()
    setSnippets(result)
  }, [])

  useEffect(() => {
    loadSnippets()
  }, [loadSnippets])

  const resetForm = () => {
    setFormTrigger('')
    setFormLabel('')
    setFormContent('')
    setFormCategory('general')
  }

  const startEditing = (snippet: CaptureSnippet) => {
    setEditingId(snippet.id)
    setFormTrigger(snippet.triggerKey)
    setFormLabel(snippet.label)
    setFormContent(snippet.content)
    setFormCategory(snippet.category)
  }

  const handleSave = async () => {
    if (!formTrigger.trim() || !formLabel.trim() || !formContent.trim()) return

    if (editingId) {
      await window.electronAPI.updateCaptureSnippet(editingId, {
        triggerKey: formTrigger.trim(),
        label: formLabel.trim(),
        content: formContent.trim(),
        category: formCategory,
      })
      setEditingId(null)
      addToast(t('template_manager.snippet_updated', { defaultValue: 'Snippet atualizado' }), 'success')
    } else {
      await window.electronAPI.createCaptureSnippet({
        triggerKey: formTrigger.trim(),
        label: formLabel.trim(),
        content: formContent.trim(),
        category: formCategory,
        isDefault: false,
      })
      setIsAdding(false)
      addToast(t('template_manager.snippet_created', { defaultValue: 'Snippet criado' }), 'success')
    }

    resetForm()
    loadSnippets()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const success = await window.electronAPI.deleteCaptureSnippet(deleteTarget)
    if (success) {
      addToast(t('template_manager.snippet_deleted', { defaultValue: 'Snippet excluído' }), 'success')
      loadSnippets()
    } else {
      addToast(
        t('template_manager.cannot_delete_default', { defaultValue: 'Snippets padrão não podem ser excluídos' }),
        'warning'
      )
    }
    setDeleteTarget(null)
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    resetForm()
  }

  return (
    <div className="template-panel">
      <div className="template-panel-toolbar">
        <button
          type="button"
          className="vscode-button secondary"
          onClick={() => {
            resetForm()
            setIsAdding(true)
          }}
          disabled={isAdding || !!editingId}
        >
          <Plus size={14} />
          <span>{t('template_manager.add_snippet', { defaultValue: 'Novo snippet' })}</span>
        </button>
      </div>

      {/* Form (add/edit) */}
      {(isAdding || editingId) && (
        <div className="snippet-editor">
          <div className="template-editor-row">
            <div className="template-editor-field" style={{ width: 100 }}>
              <label>Atalho</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ opacity: 0.5 }}>/</span>
                <input
                  className="vscode-input"
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value.replace(/\s/g, ''))}
                  placeholder="dec"
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div className="template-editor-field" style={{ flex: 1 }}>
              <label>Nome</label>
              <input
                className="vscode-input"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Decisão rápida"
              />
            </div>
            <div className="template-editor-field" style={{ width: 120 }}>
              <label>Categoria</label>
              <select className="vscode-select" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                <option value="general">Geral</option>
                <option value="decision">Decisão</option>
                <option value="demand">Demanda</option>
                <option value="bug">Bug</option>
                <option value="oneOnOne">1:1</option>
                <option value="update">Atualização</option>
                <option value="blocker">Bloqueio</option>
                <option value="idea">Ideia</option>
              </select>
            </div>
          </div>

          <div className="template-editor-field">
            <label>Conteúdo (use {'{{cursor}}'} para posicionar o cursor após expansão)</label>
            <textarea
              className="vscode-textarea"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Decisão sobre [assunto]: [o que foi decidido]. Contexto: {{cursor}}"
              rows={3}
            />
          </div>

          <div className="template-editor-actions">
            <button
              type="button"
              className="vscode-button"
              onClick={handleSave}
              disabled={!formTrigger.trim() || !formLabel.trim() || !formContent.trim()}
            >
              <Check size={14} />
              <span>{editingId ? 'Salvar' : 'Criar'}</span>
            </button>
            <button type="button" className="vscode-button secondary" onClick={handleCancel}>
              <X size={14} />
              <span>Cancelar</span>
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="snippet-list">
        {snippets.map((snippet) => (
          <div key={snippet.id} className="snippet-list-item">
            <span className="snippet-list-trigger">/{snippet.triggerKey}</span>
            <span className="snippet-list-label">{snippet.label}</span>
            <span className="snippet-list-usage">{snippet.usageCount}×</span>
            <div className="snippet-list-actions">
              {!snippet.isDefault && (
                <>
                  <button
                    type="button"
                    className="inline-action-btn"
                    onClick={() => startEditing(snippet)}
                    title="Editar"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="inline-action-btn danger"
                    onClick={() => setDeleteTarget(snippet.id)}
                    title="Excluir"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
              <button
                type="button"
                className="inline-action-btn"
                onClick={() => {
                  navigator.clipboard.writeText(`/${snippet.triggerKey}`)
                  addToast('Copiado!', 'success')
                }}
                title="Copiar atalho"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title={t('template_manager.delete_snippet_title', { defaultValue: 'Excluir snippet' })}
        message={t('template_manager.delete_snippet_message', {
          defaultValue: 'Tem certeza que deseja excluir este snippet?',
        })}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
