import { Notification } from 'electron'
import { TaskRepository } from '../database/repositories/task-repository'
import { Task } from '../../shared/types'

export class NotificationService {
  private taskRepo: TaskRepository
  private checkInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.taskRepo = new TaskRepository()
  }

  start(): void {
    // Check immediately on start
    this.checkDueTasks()

    // Then check every 30 minutes
    this.checkInterval = setInterval(() => {
      this.checkDueTasks()
    }, 30 * 60 * 1000)
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private checkDueTasks(): void {
    if (!Notification.isSupported()) return

    const overdue = this.taskRepo.getOverdue()
    const dueThisWeek = this.taskRepo.getDueThisWeek()

    // Notify overdue tasks
    if (overdue.length > 0) {
      this.showNotification(
        'Tarefas vencidas',
        overdue.length === 1
          ? `"${overdue[0].title}" está vencida!`
          : `Você tem ${overdue.length} tarefas vencidas.`,
      )
    }

    // Notify tasks due today
    const today = new Date().toISOString().split('T')[0]
    const dueToday = dueThisWeek.filter((t) => t.dueDate === today)

    if (dueToday.length > 0) {
      this.showNotification(
        'Tarefas para hoje',
        dueToday.length === 1
          ? `"${dueToday[0].title}" vence hoje!`
          : `Você tem ${dueToday.length} tarefas vencendo hoje.`,
      )
    }

    // Notify tasks due tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    const dueTomorrow = dueThisWeek.filter((t) => t.dueDate === tomorrowStr)

    if (dueTomorrow.length > 0 && overdue.length === 0 && dueToday.length === 0) {
      this.showNotification(
        'Tarefas para amanhã',
        dueTomorrow.length === 1
          ? `"${dueTomorrow[0].title}" vence amanhã.`
          : `Você tem ${dueTomorrow.length} tarefas vencendo amanhã.`,
      )
    }
  }

  private showNotification(title: string, body: string): void {
    const notification = new Notification({
      title,
      body,
      icon: undefined,
    })
    notification.show()
  }
}
