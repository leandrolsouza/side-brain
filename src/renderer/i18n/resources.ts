import ptBRCommon from '../locales/pt-BR/common.json'
import ptBRDashboard from '../locales/pt-BR/dashboard.json'
import ptBRSettings from '../locales/pt-BR/settings.json'
import ptBRCapture from '../locales/pt-BR/capture.json'
import ptBRProjects from '../locales/pt-BR/projects.json'
import ptBRMeetings from '../locales/pt-BR/meetings.json'
import ptBRReports from '../locales/pt-BR/reports.json'
import ptBRChat from '../locales/pt-BR/chat.json'

import enCommon from '../locales/en/common.json'
import enDashboard from '../locales/en/dashboard.json'
import enSettings from '../locales/en/settings.json'
import enCapture from '../locales/en/capture.json'
import enProjects from '../locales/en/projects.json'
import enMeetings from '../locales/en/meetings.json'
import enReports from '../locales/en/reports.json'
import enChat from '../locales/en/chat.json'

export const resources = {
  'pt-BR': {
    common: ptBRCommon,
    dashboard: ptBRDashboard,
    settings: ptBRSettings,
    capture: ptBRCapture,
    projects: ptBRProjects,
    meetings: ptBRMeetings,
    reports: ptBRReports,
    chat: ptBRChat,
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    settings: enSettings,
    capture: enCapture,
    projects: enProjects,
    meetings: enMeetings,
    reports: enReports,
    chat: enChat,
  },
} as const
