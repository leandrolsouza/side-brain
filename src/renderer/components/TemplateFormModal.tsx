import { useState, useCallback, useEffect } from 'react'
import { X, Sparkles, Send, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { StructuredTemplate, TemplateField } from '@shared/types'
import { useToast } from './ToastContext'

interface TemplateFormModalProps {
  isOpen: boolean
  template: StructuredTemplate
  onSubmit: (outputText: string, hintType: string, hintAction: string) => void
  onClose: () => void
}

export function TemplateFormModal({ isOpen, template, onSubmit, onClose }: TemplateFormModalProps) {
  const { t } = useTranslation('capture')
  const { addToast } = useToast()
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [isAutoFilling, setIsAutoFilling] = useState(false)

  // Reset fields when template changes
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {}
      for (const field of template.fields) {
        initial[field.key] = ''
      }
      setFieldValues(initial)
    }
  }, [isOpen, template.id])

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleAutoFill = useCallback(async () => {
    const hasRequiredFilled = template.fields.filter((f) => f.required).every((f) => fieldValues[f.key]?.trim())

    if (!hasRequiredFilled) {
      addToast(
        t('template_form.fill_required_first', { defaultValue: 'Preencha os campos obrigatórios primeiro' }),
        'warning'
      )
      return
    }

    setIsAutoFilling(true)
    try {
      const result = await window.electronAPI.autoFillTemplateFields(template.id, fieldValues)
      if (Object.keys(result).length > 0) {
        setFieldValues((prev) => ({ ...prev, ...result }))
        addToast(t('template_form.autofill_success', { defaultValue: 'Campos preenchidos pela IA' }), 'success')
      } else {
        addToast(
          t('template_form.autofill_empty', { defaultValue: 'Não foi possível preencher automaticamente' }),
          'info'
        )
      }
    } catch (error) {
      addToast(t('template_form.autofill_error', { defaultValue: 'Erro ao preencher com IA' }), 'error')
    } finally {
      setIsAutoFilling(false)
    }
  }, [template, fieldValues, addToast, t])

  const handleSubmit = useCallback(() => {
    // Check required fields
    const missingRequired = template.fields.filter((f) => f.required).filter((f) => !fieldValues[f.key]?.trim())

    if (missingRequired.length > 0) {
      addToast(
        t('template_form.missing_required', {
          defaultValue: 'Preencha: {{fields}}',
          fields: missingRequired.map((f) => f.label).join(', '),
        }),
        'warning'
      )
      return
    }

    // Build output text from the template's outputFormat
    let output = template.outputFormat
    for (const field of template.fields) {
      const value = fieldValues[field.key]?.trim() || ''
      output = output.replace(new RegExp(`\\{\\{${field.key}\\}\\}`, 'g'), value)
    }

    // Clean up empty sections (e.g. "Contexto: . Alternativas: ." becomes cleaner)
    output = output
      .replace(/\s*[A-Za-zÀ-ú]+:\s*\.\s*/g, ' ') // Remove "Label: ." patterns
      .replace(/\s{2,}/g, ' ')
      .trim()

    onSubmit(output, template.hintType, template.hintAction)
  }, [template, fieldValues, onSubmit, addToast, t])

  const hasAutoFillFields = template.fields.some((f) => f.aiAutoFill)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className="template-form-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="template-form-header">
          <div className="template-form-title">
            <span className={`template-form-icon color-${template.color}`}>{template.name}</span>
          </div>
          <button type="button" className="inline-action-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {template.description && <p className="template-form-description">{template.description}</p>}

        {/* Fields */}
        <div className="template-form-fields">
          {template.fields
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((field) => (
              <TemplateFieldInput
                key={field.id}
                field={field}
                value={fieldValues[field.key] || ''}
                onChange={(value) => handleFieldChange(field.key, value)}
              />
            ))}
        </div>

        {/* Actions */}
        <div className="template-form-actions">
          {hasAutoFillFields && (
            <button
              type="button"
              className="vscode-button secondary"
              onClick={handleAutoFill}
              disabled={isAutoFilling}
              title={t('template_form.autofill_tooltip', { defaultValue: 'Preencher campos opcionais com IA' })}
            >
              {isAutoFilling ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              <span>{t('template_form.autofill_button', { defaultValue: 'Completar com IA' })}</span>
            </button>
          )}
          <button type="button" className="vscode-button" onClick={handleSubmit}>
            <Send size={14} />
            <span>{t('template_form.submit_button', { defaultValue: 'Enviar para análise' })}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// === Individual field component ===

interface TemplateFieldInputProps {
  field: TemplateField
  value: string
  onChange: (value: string) => void
}

function TemplateFieldInput({ field, value, onChange }: TemplateFieldInputProps) {
  const label = (
    <label className="template-field-label">
      {field.label}
      {field.required && <span className="template-field-required">*</span>}
      {field.aiAutoFill && <Sparkles size={10} className="template-field-ai-icon" />}
    </label>
  )

  switch (field.type) {
    case 'textarea':
      return (
        <div className="template-field">
          {label}
          <textarea
            className="vscode-textarea template-field-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
          />
        </div>
      )

    case 'select':
      return (
        <div className="template-field">
          {label}
          <select
            className="vscode-select template-field-select"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{field.placeholder || 'Selecione...'}</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )

    case 'date':
      return (
        <div className="template-field">
          {label}
          <input
            type="date"
            className="vscode-input template-field-date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )

    case 'mention':
      return (
        <div className="template-field">
          {label}
          <input
            type="text"
            className="vscode-input template-field-mention"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'Nome da pessoa'}
          />
        </div>
      )
    default:
      return (
        <div className="template-field">
          {label}
          <input
            type="text"
            className="vscode-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      )
  }
}
