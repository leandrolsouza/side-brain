import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Clock,
  Calendar,
  Brain,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { AppNotification, NotificationType } from '../../shared/types'

interface ToastNotification {
  id: string
  notification: AppNotification
  exiting: boolean
}

export function NotificationCenter() {
  const { t } = useTranslation('common')
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  // Load notifications on mount
  useEffect(() => {
    loadNotifications()
    loadUnreadCount()
  }, [])

  // Listen for new notifications from main process
  useEffect(() => {
    window.electronAPI.onNewNotification((notification) => {
      setNotifications((prev) => [notification, ...prev])
      setUnreadCount((prev) => prev + 1)
      showToast(notification)
    })
  }, [])

  // Close panel on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const loadNotifications = async () => {
    try {
      const data = await window.electronAPI.getNotifications()
      setNotifications(data)
    } catch {
      // ignore
    }
  }

  const loadUnreadCount = async () => {
    try {
      const count = await window.electronAPI.getUnreadNotificationCount()
      setUnreadCount(count)
    } catch {
      // ignore
    }
  }

  const showToast = (notification: AppNotification) => {
    const toastId = `toast-${notification.id}`
    setToasts((prev) => [...prev, { id: toastId, notification, exiting: false }])

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === toastId ? { ...t, exiting: true } : t)))
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId))
      }, 300)
    }, 5000)
  }

  const dismissToast = (toastId: string) => {
    setToasts((prev) => prev.map((t) => (t.id === toastId ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId))
    }, 300)
  }

  const handleTogglePanel = () => {
    setIsOpen(!isOpen)
  }

  const handleMarkRead = async (id: string) => {
    await window.electronAPI.markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleMarkAllRead = async () => {
    await window.electronAPI.markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const handleDismiss = async (id: string) => {
    await window.electronAPI.dismissNotification(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    // Recalculate unread
    setUnreadCount((prev) => {
      const wasDismissedUnread = notifications.find((n) => n.id === id && !n.read)
      return wasDismissedUnread ? Math.max(0, prev - 1) : prev
    })
  }

  const handleDismissAll = async () => {
    await window.electronAPI.dismissAllNotifications()
    setNotifications([])
    setUnreadCount(0)
  }

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'task_overdue':
        return <AlertTriangle size={16} className="notification-icon notification-icon--danger" />
      case 'task_due_today':
        return <Clock size={16} className="notification-icon notification-icon--warning" />
      case 'task_due_tomorrow':
        return <Calendar size={16} className="notification-icon notification-icon--info" />
      case 'review_pending':
        return <MessageSquare size={16} className="notification-icon notification-icon--info" />
      case 'meeting_reminder':
        return <Zap size={16} className="notification-icon notification-icon--warning" />
      case 'insight_generated':
        return <Sparkles size={16} className="notification-icon notification-icon--success" />
      case 'digest_ready':
        return <Brain size={16} className="notification-icon notification-icon--success" />
      case 'ai_error':
        return <AlertTriangle size={16} className="notification-icon notification-icon--danger" />
      default:
        return <Bell size={16} className="notification-icon" />
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMin < 1) return t('timeNow')
    if (diffMin < 60) return t('timeMinutes', { count: diffMin })
    if (diffHours < 24) return t('timeHours', { count: diffHours })
    if (diffDays < 7) return t('timeDays', { count: diffDays })
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <>
      {/* Bell Button (status bar item) */}
      <div
        className="status-bar-item clickable notification-bell"
        onClick={handleTogglePanel}
        title={t('notifications.title')}
      >
        <Bell size={14} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </div>

      {/* Notification Panel */}
      {isOpen && (
        <div className="notification-panel" ref={panelRef}>
          <div className="notification-panel-header">
            <h3>{t('notifications.title')}</h3>
            <div className="notification-panel-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-action-btn"
                  onClick={handleMarkAllRead}
                  title={t('notifications.markAllRead')}
                >
                  <CheckCheck size={14} />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="notification-action-btn"
                  onClick={handleDismissAll}
                  title={t('notifications.clearAll')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="notification-panel-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={24} strokeWidth={1.5} />
                <p>{t('notifications.noNotifications')}</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'notification-item--unread' : ''}`}
                >
                  <div className="notification-item-icon">{getNotificationIcon(notification.type)}</div>
                  <div className="notification-item-content">
                    <div className="notification-item-title">{notification.title}</div>
                    <div className="notification-item-body">{notification.body}</div>
                    <div className="notification-item-time">{formatTime(notification.createdAt)}</div>
                  </div>
                  <div className="notification-item-actions">
                    {!notification.read && (
                      <button
                        type="button"
                        className="notification-item-btn"
                        onClick={() => handleMarkRead(notification.id)}
                        title={t('notifications.markRead')}
                      >
                        <Check size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="notification-item-btn"
                      onClick={() => handleDismiss(notification.id)}
                      title={t('notifications.dismiss')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="notification-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`notification-toast ${toast.exiting ? 'notification-toast--exit' : ''}`}>
            <div className="notification-toast-icon">{getNotificationIcon(toast.notification.type)}</div>
            <div className="notification-toast-content">
              <div className="notification-toast-title">{toast.notification.title}</div>
              <div className="notification-toast-body">{toast.notification.body}</div>
            </div>
            <button type="button" className="notification-toast-close" onClick={() => dismissToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
