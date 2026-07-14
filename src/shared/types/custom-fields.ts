// === Custom Fields Types (user-configurable) ===

export interface CustomEntryType {
  id: string
  key: string        // machine-readable identifier (e.g. 'information', 'decision')
  label: string      // display name (e.g. 'Informação', 'Decisão')
  icon: string       // lucide icon name (e.g. 'Info', 'Gavel')
  color: string      // badge color variant (e.g. 'info', 'warning', 'error', 'success', 'neutral')
  isDefault: boolean // built-in types that can't be deleted
  sortOrder: number
  allowsAction: boolean // whether entries of this type can have actions (or always 'none')
}

export interface CustomActionStatus {
  id: string
  key: string        // machine-readable identifier (e.g. 'none', 'action_needed')
  label: string      // display name (e.g. 'Sem ação', 'Ação necessária')
  icon: string       // lucide icon name
  color: string      // badge color variant
  isDefault: boolean
  isFinal: boolean   // whether this status means "done" / completed
  sortOrder: number
}

export interface CustomCaptureTemplate {
  id: string
  label: string
  prefix: string
  placeholder: string
  icon: string       // lucide icon name
  hintType: string   // links to a CustomEntryType key
  isDefault: boolean
  sortOrder: number
}

// Legacy alias
export type CaptureTemplate = CustomCaptureTemplate

// === Structured Templates & Snippets ===

/**
 * Field type for structured template forms.
 */
export type TemplateFieldType = 'text' | 'textarea' | 'select' | 'date' | 'mention'

/**
 * A single field definition within a structured template.
 */
export interface TemplateField {
  id: string
  key: string                    // machine-readable identifier (e.g. 'context', 'decision')
  label: string                  // display label (e.g. 'Contexto', 'Decisão tomada')
  type: TemplateFieldType
  placeholder?: string
  required: boolean
  options?: string[]             // for type 'select'
  aiAutoFill?: boolean           // AI attempts to fill this field based on other fields
  sortOrder: number
}

/**
 * Category for structured templates.
 */
export type TemplateCategory = 'meeting' | 'decision' | 'bug' | 'oneOnOne' | 'brainstorm' | 'standup' | 'custom'

/**
 * A structured template with typed fields for guided capture.
 */
export interface StructuredTemplate {
  id: string
  name: string
  description: string
  icon: string                   // lucide icon name
  color: string                  // badge color variant
  category: TemplateCategory
  fields: TemplateField[]
  outputFormat: string           // handlebars-like format string (e.g. '{{subject}}: {{decision}}')
  hintType: string               // suggested entry type key
  hintAction: string             // suggested action status key
  projectId?: string             // optionally lock to a project
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * A capture snippet — a text shortcut triggered by typing /<trigger>.
 */
export interface CaptureSnippet {
  id: string
  triggerKey: string             // shortcut (e.g. 'dec', '1on1', 'bug')
  label: string                  // display name
  content: string                // expanded text (supports {{cursor}} for positioning)
  category: string
  usageCount: number
  isDefault: boolean
  createdAt: string
}

// Default structured templates (seeded on first run)
export const DEFAULT_STRUCTURED_TEMPLATES: Omit<StructuredTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Decisão',
    description: 'Registrar uma decisão tomada com contexto e alternativas',
    icon: 'Gavel',
    color: 'warning',
    category: 'decision',
    fields: [
      { id: 'f1', key: 'subject', label: 'Assunto', type: 'text', required: true, placeholder: 'Sobre o que é a decisão', sortOrder: 0 },
      { id: 'f2', key: 'decision', label: 'Decisão tomada', type: 'textarea', required: true, placeholder: 'O que foi decidido', sortOrder: 1 },
      { id: 'f3', key: 'context', label: 'Contexto', type: 'textarea', required: false, placeholder: 'O que motivou a decisão', aiAutoFill: true, sortOrder: 2 },
      { id: 'f4', key: 'alternatives', label: 'Alternativas consideradas', type: 'textarea', required: false, placeholder: 'Opções descartadas e por quê', aiAutoFill: true, sortOrder: 3 },
      { id: 'f5', key: 'responsible', label: 'Responsável', type: 'mention', required: false, placeholder: 'Quem vai executar', sortOrder: 4 },
      { id: 'f6', key: 'deadline', label: 'Prazo', type: 'date', required: false, sortOrder: 5 },
    ],
    outputFormat: 'Decisão sobre {{subject}}: {{decision}}. Contexto: {{context}}. Alternativas: {{alternatives}}. Responsável: {{responsible}}. Prazo: {{deadline}}.',
    hintType: 'decision',
    hintAction: 'action_needed',
    isDefault: true,
    sortOrder: 0,
  },
  {
    name: '1:1',
    description: 'Notas de reunião individual',
    icon: 'Users',
    color: 'info',
    category: 'oneOnOne',
    fields: [
      { id: 'f1', key: 'person', label: 'Com quem', type: 'text', required: true, placeholder: 'Nome da pessoa', sortOrder: 0 },
      { id: 'f2', key: 'discussed', label: 'O que discutimos', type: 'textarea', required: true, placeholder: 'Temas abordados', sortOrder: 1 },
      { id: 'f3', key: 'actions', label: 'Ações combinadas', type: 'textarea', required: false, placeholder: 'O que ficou acordado', sortOrder: 2 },
      { id: 'f4', key: 'followUp', label: 'Follow-up', type: 'text', required: false, placeholder: 'Próximo passo ou data', aiAutoFill: true, sortOrder: 3 },
    ],
    outputFormat: '1:1 com {{person}}: {{discussed}}. Ações: {{actions}}. Follow-up: {{followUp}}.',
    hintType: 'information',
    hintAction: 'action_needed',
    isDefault: true,
    sortOrder: 1,
  },
  {
    name: 'Bug Report',
    description: 'Registrar um bug encontrado',
    icon: 'Bug',
    color: 'error',
    category: 'bug',
    fields: [
      { id: 'f1', key: 'component', label: 'Componente', type: 'text', required: true, placeholder: 'Onde ocorre o bug', sortOrder: 0 },
      { id: 'f2', key: 'description', label: 'Descrição', type: 'textarea', required: true, placeholder: 'O que acontece de errado', sortOrder: 1 },
      { id: 'f3', key: 'steps', label: 'Passos para reproduzir', type: 'textarea', required: false, placeholder: '1. ...\n2. ...\n3. ...', sortOrder: 2 },
      { id: 'f4', key: 'impact', label: 'Impacto', type: 'select', required: false, options: ['Crítico', 'Alto', 'Médio', 'Baixo'], sortOrder: 3 },
      { id: 'f5', key: 'expected', label: 'Comportamento esperado', type: 'textarea', required: false, placeholder: 'O que deveria acontecer', aiAutoFill: true, sortOrder: 4 },
    ],
    outputFormat: 'Bug em {{component}}: {{description}}. Passos: {{steps}}. Impacto: {{impact}}. Esperado: {{expected}}.',
    hintType: 'blocker',
    hintAction: 'action_needed',
    isDefault: true,
    sortOrder: 2,
  },
  {
    name: 'Brainstorm',
    description: 'Capturar ideias de uma sessão de brainstorm',
    icon: 'Lightbulb',
    color: 'success',
    category: 'brainstorm',
    fields: [
      { id: 'f1', key: 'topic', label: 'Tema', type: 'text', required: true, placeholder: 'Tema do brainstorm', sortOrder: 0 },
      { id: 'f2', key: 'ideas', label: 'Ideias', type: 'textarea', required: true, placeholder: 'Liste as ideias geradas (uma por linha)', sortOrder: 1 },
      { id: 'f3', key: 'nextSteps', label: 'Próximos passos', type: 'textarea', required: false, placeholder: 'O que fazer com essas ideias', aiAutoFill: true, sortOrder: 2 },
    ],
    outputFormat: 'Brainstorm sobre {{topic}}: {{ideas}}. Próximos passos: {{nextSteps}}.',
    hintType: 'idea',
    hintAction: 'none',
    isDefault: true,
    sortOrder: 3,
  },
  {
    name: 'Standup',
    description: 'Nota rápida de daily standup',
    icon: 'Coffee',
    color: 'neutral',
    category: 'standup',
    fields: [
      { id: 'f1', key: 'yesterday', label: 'Ontem', type: 'textarea', required: true, placeholder: 'O que fiz ontem', sortOrder: 0 },
      { id: 'f2', key: 'today', label: 'Hoje', type: 'textarea', required: true, placeholder: 'O que vou fazer hoje', sortOrder: 1 },
      { id: 'f3', key: 'blockers', label: 'Bloqueios', type: 'textarea', required: false, placeholder: 'Impedimentos (se houver)', sortOrder: 2 },
    ],
    outputFormat: 'Standup — Ontem: {{yesterday}}. Hoje: {{today}}. Bloqueios: {{blockers}}.',
    hintType: 'update',
    hintAction: 'none',
    isDefault: true,
    sortOrder: 4,
  },
]

// Default capture snippets (seeded on first run)
export const DEFAULT_CAPTURE_SNIPPETS: Omit<CaptureSnippet, 'id' | 'createdAt'>[] = [
  { triggerKey: 'dec', label: 'Decisão rápida', content: 'Decisão sobre [assunto]: [o que foi decidido]. Contexto: {{cursor}}', category: 'decision', usageCount: 0, isDefault: true },
  { triggerKey: 'dem', label: 'Demanda', content: 'Demanda de [pessoa/área]: [o que foi solicitado]. Prazo: {{cursor}}', category: 'demand', usageCount: 0, isDefault: true },
  { triggerKey: '1on1', label: 'Nota de 1:1', content: '1:1 com [pessoa]: [temas discutidos]. Ações: {{cursor}}', category: 'oneOnOne', usageCount: 0, isDefault: true },
  { triggerKey: 'bug', label: 'Bug report', content: 'Bug em [componente]: [descrição]. Passos: 1. {{cursor}}', category: 'bug', usageCount: 0, isDefault: true },
  { triggerKey: 'upd', label: 'Atualização', content: 'Atualização [projeto]: [progresso feito]. Próximos passos: {{cursor}}', category: 'update', usageCount: 0, isDefault: true },
  { triggerKey: 'blk', label: 'Bloqueio', content: 'Bloqueio em [tarefa]: [impedimento]. Preciso de: {{cursor}}', category: 'blocker', usageCount: 0, isDefault: true },
  { triggerKey: 'idea', label: 'Ideia', content: 'Ideia: [descrição]. Benefício esperado: {{cursor}}', category: 'idea', usageCount: 0, isDefault: true },
]

// Default entry types (seeded on first run)
export const DEFAULT_ENTRY_TYPES: Omit<CustomEntryType, 'id'>[] = [
  { key: 'information', label: 'Informação', icon: 'Info', color: 'info', isDefault: true, sortOrder: 0, allowsAction: false },
  { key: 'decision', label: 'Decisão', icon: 'Gavel', color: 'warning', isDefault: true, sortOrder: 1, allowsAction: true },
  { key: 'demand', label: 'Demanda', icon: 'MessageSquare', color: 'neutral', isDefault: true, sortOrder: 2, allowsAction: true },
  { key: 'idea', label: 'Ideia', icon: 'Lightbulb', color: 'success', isDefault: true, sortOrder: 3, allowsAction: true },
  { key: 'blocker', label: 'Bloqueio', icon: 'AlertTriangle', color: 'error', isDefault: true, sortOrder: 4, allowsAction: true },
  { key: 'update', label: 'Atualização', icon: 'RefreshCw', color: 'info', isDefault: true, sortOrder: 5, allowsAction: false },
]

export const DEFAULT_ACTION_STATUSES: Omit<CustomActionStatus, 'id'>[] = [
  { key: 'none', label: 'Sem ação', icon: 'Minus', color: 'neutral', isDefault: true, isFinal: false, sortOrder: 0 },
  { key: 'action_needed', label: 'Ação necessária', icon: 'AlertCircle', color: 'warning', isDefault: true, isFinal: false, sortOrder: 1 },
  { key: 'waiting_response', label: 'Aguardando resposta', icon: 'Clock', color: 'info', isDefault: true, isFinal: false, sortOrder: 2 },
  { key: 'done', label: 'Concluído', icon: 'CheckCircle2', color: 'success', isDefault: true, isFinal: true, sortOrder: 3 },
]

export const DEFAULT_CAPTURE_TEMPLATES: Omit<CustomCaptureTemplate, 'id'>[] = [
  { label: 'Reunião', prefix: 'Reunião com ', placeholder: '[pessoa/equipe]: [o que foi discutido/decidido]', icon: 'Users', hintType: 'information', isDefault: true, sortOrder: 0 },
  { label: 'Decisão', prefix: 'Decisão sobre ', placeholder: '[assunto]: [o que foi decidido e por quê]', icon: 'Gavel', hintType: 'decision', isDefault: true, sortOrder: 1 },
  { label: 'Bloqueio', prefix: 'Bloqueio em ', placeholder: '[projeto/tarefa]: [descrição do impedimento]', icon: 'AlertTriangle', hintType: 'blocker', isDefault: true, sortOrder: 2 },
  { label: 'Demanda', prefix: 'Demanda de ', placeholder: '[pessoa/área]: [o que foi solicitado e prazo]', icon: 'MessageSquare', hintType: 'demand', isDefault: true, sortOrder: 3 },
  { label: 'Ideia', prefix: 'Ideia: ', placeholder: '[descrição da ideia ou sugestão]', icon: 'Lightbulb', hintType: 'idea', isDefault: true, sortOrder: 4 },
  { label: 'Atualização', prefix: 'Atualização: ', placeholder: '[o que mudou ou progresso feito]', icon: 'RefreshCw', hintType: 'update', isDefault: true, sortOrder: 5 },
]
