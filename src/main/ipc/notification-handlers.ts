import { safeHandle } from './safe-handle'
import { getContainer } from '../services/container'

export function registerNotificationHandlers(): void {
  const { notificationRepo } = getContainer()

  safeHandle('notification:getAll', async () => {
    return notificationRepo.getAll()
  })

  safeHandle('notification:getUnreadCount', async () => {
    return notificationRepo.getUnreadCount()
  })

  safeHandle('notification:markRead', async (_event, id: string) => {
    return notificationRepo.markRead(id)
  })

  safeHandle('notification:markAllRead', async () => {
    return notificationRepo.markAllRead()
  })

  safeHandle('notification:dismiss', async (_event, id: string) => {
    return notificationRepo.dismiss(id)
  })

  safeHandle('notification:dismissAll', async () => {
    return notificationRepo.dismissAll()
  })
}
