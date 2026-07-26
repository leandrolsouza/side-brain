import type React from 'react'
import { BarChart3, Bot, ClipboardCheck, Lightbulb, PenTool, Users } from 'lucide-react'

// === Icon mapping ===

export const ICON_MAP: Record<string, React.ReactNode> = {
  ClipboardCheck: <ClipboardCheck size={20} />,
  PenTool: <PenTool size={20} />,
  BarChart3: <BarChart3 size={20} />,
  Lightbulb: <Lightbulb size={20} />,
  Users: <Users size={20} />,
  Bot: <Bot size={20} />,
}

export const COLOR_MAP: Record<string, string> = {
  blue: '#4fc1ff',
  purple: '#c586c0',
  green: '#6abf69',
  yellow: '#e8a63b',
  orange: '#f48771',
  red: '#f44747',
  cyan: '#75beff',
}

export function getAgentIcon(icon: string): React.ReactNode {
  return ICON_MAP[icon] || <Bot size={20} />
}

export function getAgentColor(color: string): string {
  return COLOR_MAP[color] || COLOR_MAP.blue
}
