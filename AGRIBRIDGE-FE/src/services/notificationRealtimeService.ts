import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { API_BASE_URL } from './config'
import { getStoredAuthSession } from './authSession'
import type { AppNotification } from './notificationService'
import { dispatchStateSync, type StateSyncModule } from './stateSyncService'

export const NOTIFICATION_REALTIME_EVENT = 'agribridge:notification-realtime'
export const NOTIFICATION_MODULE_EVENT = 'agribridge:notification-module-change'

type NotificationHandler = (notification: AppNotification) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseNotification(frame: IMessage): AppNotification | null {
  try {
    const parsed: unknown = JSON.parse(frame.body)
    if (!isRecord(parsed) || typeof parsed.id !== 'number' || typeof parsed.title !== 'string') return null
    return parsed as AppNotification
  } catch {
    return null
  }
}

export function dispatchNotificationRealtime(notification: AppNotification) {
  window.dispatchEvent(new CustomEvent<AppNotification>(NOTIFICATION_REALTIME_EVENT, { detail: notification }))
  window.dispatchEvent(new CustomEvent<AppNotification>(NOTIFICATION_MODULE_EVENT, { detail: notification }))
  const module = notification.module as StateSyncModule | undefined
  dispatchStateSync(['NOTIFICATION', ...(module ? [module] : [])], {
    source: 'notification-realtime',
    entityId: notification.id,
  })
}

export function createNotificationRealtimeClient(onNotification: NotificationHandler): Client | null {
  const session = getStoredAuthSession()
  const companyId = session?.companyId || Number(localStorage.getItem('agribridge.auth.companyId') || '')
  const userId = session?.userId || Number(localStorage.getItem('agribridge.auth.userId') || '')

  if (!companyId && !userId) return null

  const subscriptions: StompSubscription[] = []
  const client = new Client({
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws-chat`),
    onConnect: () => {
      if (companyId) {
        subscriptions.push(client.subscribe(`/topic/notifications.company.${companyId}`, handleFrame))
      } else if (userId) {
        subscriptions.push(client.subscribe(`/topic/notifications.user.${userId}`, handleFrame))
      }
    },
    onDisconnect: () => {
      subscriptions.splice(0).forEach((subscription) => subscription.unsubscribe())
    },
  })

  function handleFrame(frame: IMessage) {
    const notification = parseNotification(frame)
    if (!notification) return
    onNotification(notification)
    dispatchNotificationRealtime(notification)
  }

  const originalDeactivate = client.deactivate.bind(client)
  client.deactivate = async (...args) => {
    subscriptions.splice(0).forEach((subscription) => subscription.unsubscribe())
    return originalDeactivate(...args)
  }

  return client
}
