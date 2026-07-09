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
