import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { API_BASE_URL } from './config'
import { getStoredAuthSession } from './authSession'
import type { AppNotification } from './notificationService'
import { dispatchStateSync, type StateSyncModule } from './stateSyncService'

export const NOTIFICATION_REALTIME_EVENT = 'agribridge:notification-realtime'
export const NOTIFICATION_MODULE_EVENT = 'agribridge:notification-module-change'

type NotificationHandler = (notification: AppNotification) => void

const DEBUG_PREFIX = '[notification-realtime]'

function debugLog(message: string, details?: unknown) {
  if (details === undefined) {
    console.debug(DEBUG_PREFIX, message)
    return
  }
  console.debug(DEBUG_PREFIX, message, details)
}

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

  if (!companyId && !userId) {
    debugLog('skip websocket: missing companyId and userId')
    return null
  }

  const subscriptions: StompSubscription[] = []
  const receivedNotificationIds = new Set<number>()
  const client = new Client({
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: (message) => debugLog(message),
    webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws-chat`),
    onConnect: () => {
      debugLog('websocket connected', { companyId, userId })
      if (companyId) {
        const destination = `/topic/notifications.company.${companyId}`
        debugLog('subscribing destination', destination)
        subscriptions.push(client.subscribe(destination, handleFrame))
      }
      if (userId) {
        const destination = `/topic/notifications.user.${userId}`
        debugLog('subscribing destination', destination)
        subscriptions.push(client.subscribe(destination, handleFrame))
      }
    },
    onDisconnect: () => {
      debugLog('websocket disconnected')
      subscriptions.splice(0).forEach((subscription) => subscription.unsubscribe())
    },
    onStompError: (frame) => {
      debugLog('stomp error', { headers: frame.headers, body: frame.body })
    },
    onWebSocketError: (event) => {
      debugLog('websocket error', event)
    },
    onWebSocketClose: (event) => {
      debugLog('websocket closed', { code: event.code, reason: event.reason })
    },
  })

  function handleFrame(frame: IMessage) {
    const notification = parseNotification(frame)
    if (!notification) {
      debugLog('websocket message received but ignored', frame.body)
      return
    }
    debugLog('websocket message received', {
      id: notification.id,
      module: notification.module,
      type: notification.type,
      title: notification.title,
    })
    if (receivedNotificationIds.has(notification.id)) {
      debugLog('duplicate websocket message ignored', { id: notification.id })
      return
    }
    receivedNotificationIds.add(notification.id)
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
