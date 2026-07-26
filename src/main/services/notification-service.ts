import { BrowserWindow, Notification } from 'electron'
import { TaskRepository } from '../database/repositories/task-repository'
import { NotificationRepository } from '../database/repositories/notification-repository'
import { SettingsRepository } from '../database/repositories/settings-repository'
import type { AppNotification, NotificationType } from '../../shared/types'
import { t, tp } from '../i18n'

export class NotificationService {
  private taskRepo: TaskRepository
  private notificationRepo: NotificationRepository
  private settingsRepo: SettingsRepository
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.taskRepo = new TaskRepository()
    this.notificationRepo = new NotificationRepository()
    this.settingsRepo = new SettingsRepository()
  }

  start(): void {
    // Check immediately on start
    this.checkDueTasks()

    // Read interval from settings
    this.scheduleTaskCheck()

    // Cleanup old dismissed notifications on startup
    this.notificationRepo.cleanup(30)

    // Cleanup old notifications once a day
    this.cleanupInterval = setInterval(
      () => {
        this.notificationRepo.cleanup(30)
      },
      24 * 60 * 60 * 1000
    )
  }

  /**
   * Reagenda a verificação de tarefas baseado nas configurações atuais.
   */
  scheduleTaskCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    const settings = this.settingsRepo.get()
    const interval = settings.taskCheckInterval

    if (interval === 'disabled') return

    const ms = Number(interval) * 60 * 1000
    this.checkInterval = setInterval(() => {
      this.checkDueTasks()
    }, ms)
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

    // Notificação nativa do OS (respeita configuração do usuário)
    const settings = this.settingsRepo.get()
    const nativeEnabled = settings.nativeNotifications !== 'false'

    if (data.showNative !== false && nativeEnabled && Notification.isSupported()) {
      const groupId = this.getGroupId(data.type)
      const nativeNotification = new Notification({
        title: data.title,
        body: data.body,
        icon: undefined,
        // Electron 43: use id for deduplication and groupId to visually group related notifications
        id: notification.id,
        groupId,
        groupTitle: this.getGroupTitle(data.type),
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
      title: t('notifications.digest_ready.title'),
      body: t('notifications.digest_ready.body'),
      showNative: false,
    })
  }

  /**
   * Emite evento de notificação para insights gerados
   */
  notifyInsightsGenerated(count: number): AppNotification | null {
    return this.notify({
      type: 'insight_generated',
      title: t('notifications.insight_generated.title'),
      body: tp('notifications.insight_generated.body', { count }),
      showNative: false,
    })
  }

  /**
   * Emite evento para erro de IA
   */
  notifyAIError(errorMessage: string): AppNotification | null {
    return this.notify({
      type: 'ai_error',
      title: t('notifications.ai_error.title'),
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
      title: t('notifications.meeting_reminder.title'),
      body: t('notifications.meeting_reminder.body', { meetingTitle }),
      metadata: { meetingTitle },
      showNative: true,
    })
  }

  /**
   * Dismisses all delivered native notifications for a given type (macOS/Windows).
   * Useful when the user addresses the notification source (e.g., marks task as done).
   */
  dismissByType(type: NotificationType): void {
    try {
      const groupId = this.getGroupId(type)
      // Electron 43: remove all notifications in a group from Notification Center
      if (process.platform === 'darwin') {
        Notification.removeGroup(groupId)
      }
    } catch {
      // removeGroup may not be available on all platforms — fail silently
    }
  }

  /**
   * Maps notification types to group IDs for visual grouping in the OS notification center.
   */
  private getGroupId(type: NotificationType): string {
    switch (type) {
      case 'task_overdue':
      case 'task_due_today':
      case 'task_due_tomorrow':
        return 'com.sidebrain.tasks'
      case 'meeting_reminder':
        return 'com.sidebrain.meetings'
      case 'ai_error':
        return 'com.sidebrain.ai'
      case 'digest_ready':
      case 'insight_generated':
        return 'com.sidebrain.insights'
      default:
        return 'com.sidebrain.general'
    }
  }

  /**
   * Returns a human-readable group title for Windows notification headers.
   */
  private getGroupTitle(type: NotificationType): string {
    switch (type) {
      case 'task_overdue':
      case 'task_due_today':
      case 'task_due_tomorrow':
        return t('notifications.group_title.tasks')
      case 'meeting_reminder':
        return t('notifications.group_title.meetings')
      case 'ai_error':
        return t('notifications.group_title.ai')
      case 'digest_ready':
      case 'insight_generated':
        return t('notifications.group_title.insights')
      default:
        return 'SideBrain'
    }
  }

  private checkDueTasks(): void {
    const overdue = this.taskRepo.getOverdue()
    const dueThisWeek = this.taskRepo.getDueThisWeek()

    // Notify overdue tasks
    if (overdue.length > 0) {
      this.notify({
        type: 'task_overdue',
        title: t('notifications.task_overdue.title'),
        body:
          overdue.length === 1
            ? t('notifications.task_overdue.body_one', { count: 1, title: overdue[0].title })
            : t('notifications.task_overdue.body_other', { count: overdue.length }),
        metadata: { count: String(overdue.length) },
        showNative: true,
      })
    }

    // Notify tasks due today
    const today = new Date().toISOString().split('T')[0]
    const dueToday = dueThisWeek.filter((task) => task.dueDate === today)

    if (dueToday.length > 0) {
      this.notify({
        type: 'task_due_today',
        title: t('notifications.task_due_today.title'),
        body:
          dueToday.length === 1
            ? t('notifications.task_due_today.body_one', { count: 1, title: dueToday[0].title })
            : t('notifications.task_due_today.body_other', { count: dueToday.length }),
        metadata: { count: String(dueToday.length) },
        showNative: true,
      })
    }

    // Notify tasks due tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    const dueTomorrow = dueThisWeek.filter((task) => task.dueDate === tomorrowStr)

    if (dueTomorrow.length > 0 && overdue.length === 0 && dueToday.length === 0) {
      this.notify({
        type: 'task_due_tomorrow',
        title: t('notifications.task_due_tomorrow.title'),
        body:
          dueTomorrow.length === 1
            ? t('notifications.task_due_tomorrow.body_one', { count: 1, title: dueTomorrow[0].title })
            : t('notifications.task_due_tomorrow.body_other', { count: dueTomorrow.length }),
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
