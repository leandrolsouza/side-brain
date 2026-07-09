import { BrowserWindow, Notification } from 'electron'
import { TaskRepository } from '../database/repositories/task-repository'
import { NotificationRepository } from '../database/repositories/notification-repository'
import type { AppNotification, NotificationType } from '../../shared/types'

export class NotificationService {
  private taskRepo: TaskRepository
  private notificationRepo: NotificationRepository
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.taskRepo = new TaskRepository()
    this.notificationRepo = new NotificationRepository()
  }

  start(): void {
    // Check immediately on start
    this.checkDueTasks()

    // Then check every 30 minutes
    this.checkInterval = setInterval(() => {
      this.checkDueTasks()
    }, 30 * 60 * 1000)

    // Cleanup old notifications once a day
    this.cleanupInterval = setInterval(() => {
      this.notificationRepo.cleanup(30)
    }, 24 * 60 * 60 * 1000)
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Cria uma notificação, persiste no banco, e emite para o renderer.
   * Opcionalmente mostra notificação nativa do OS.
   */
  notify(data: {
    type: NotificationType
    title: string
    body: string
    metadata?: Record<string, string>
    showNative?: boolean
  }): AppNotification | null {
    // Evitar duplicatas do mesmo tipo em 60 minutos
    if (this.notificationRepo.hasRecentOfType(data.type, 60)) {
      return null
    }

    // Persistir no banco
    const notification = this.notificationRepo.create({
      type: data.type,
      title: data.title,
      body: data.body,
      metadata: data.metadata,
    })

    // Emitir para o renderer via webContents
    this.emitToRenderer('notification:new', notification)

    // Notificação nativa do OS (opcional)
    if (data.showNative !== false && Notification.isSupported()) {
      const nativeNotification = new Notification({
        title: data.title,
        body: data.body,
        icon: undefined,
      })
      nativeNotification.show()
    }

    return notification
  }

  /**
   * Emite evento de notificação para digest pronto
   */
  notifyDigestReady(): AppNotification | null {
    return this.notify({
      type: 'digest_ready',
      title: 'Digest diário pronto',
      body: 'Seu resumo diário está disponível. Veja o que aconteceu e o que precisa de atenção.',
      showNative: false,
    })
  }

  /**
   * Emite evento de notificação para insights gerados
   */
  notifyInsightsGenerated(count: number): AppNotification | null {
    return this.notify({
      type: 'insight_generated',
      title: 'Novos insights disponíveis',
      body: `${count} insight${count > 1 ? 's' : ''} proativo${count > 1 ? 's' : ''} gerado${count > 1 ? 's' : ''} para você.`,
      showNative: false,
    })
  }

  /**
   * Emite evento para erro de IA
   */
  notifyAIError(errorMessage: string): AppNotification | null {
    return this.notify({
      type: 'ai_error',
      title: 'Erro na IA',
      body: errorMessage,
      showNative: false,
    })
  }

  /**
   * Emite evento para lembrete de reunião
   */
  notifyMeetingReminder(meetingTitle: string): AppNotification | null {
    return this.notify({
      type: 'meeting_reminder',
      title: 'Reunião em andamento',
      body: `"${meetingTitle}" está ativa sem novas anotações há um tempo.`,
      metadata: { meetingTitle },
      showNative: true,
    })
  }

  private checkDueTasks(): void {
    const overdue = this.taskRepo.getOverdue()
    const dueThisWeek = this.taskRepo.getDueThisWeek()

    // Notify overdue tasks
    if (overdue.length > 0) {
      this.notify({
        type: 'task_overdue',
        title: 'Tarefas vencidas',
        body: overdue.length === 1
          ? `"${overdue[0].title}" está vencida!`
          : `Você tem ${overdue.length} tarefas vencidas.`,
        metadata: { count: String(overdue.length) },
        showNative: true,
      })
    }

    // Notify tasks due today
    const today = new Date().toISOString().split('T')[0]
    const dueToday = dueThisWeek.filter((t) => t.dueDate === today)

    if (dueToday.length > 0) {
      this.notify({
        type: 'task_due_today',
        title: 'Tarefas para hoje',
        body: dueToday.length === 1
          ? `"${dueToday[0].title}" vence hoje!`
          : `Você tem ${dueToday.length} tarefas vencendo hoje.`,
        metadata: { count: String(dueToday.length) },
        showNative: true,
      })
    }

    // Notify tasks due tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    const dueTomorrow = dueThisWeek.filter((t) => t.dueDate === tomorrowStr)

    if (dueTomorrow.length > 0 && overdue.length === 0 && dueToday.length === 0) {
      this.notify({
        type: 'task_due_tomorrow',
        title: 'Tarefas para amanhã',
        body: dueTomorrow.length === 1
          ? `"${dueTomorrow[0].title}" vence amanhã.`
          : `Você tem ${dueTomorrow.length} tarefas vencendo amanhã.`,
        metadata: { count: String(dueTomorrow.length) },
        showNative: false,
      })
    }
  }

  private emitToRenderer(channel: string, data: any): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }
}
