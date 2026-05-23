import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { apiClient } from './apiClient'
import { API_BASE_URL } from './config'
import type { RfqMessage, SendRfqMessagePayload } from '../types/rfqChat'

type RfqMessageHandler = (message: RfqMessage) => void
type RfqChatErrorHandler = (error: string) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRfqMessage(value: unknown): value is RfqMessage {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'number'
    && typeof value.rfqId === 'number'
    && typeof value.supplierCompanyId === 'number'
    && typeof value.senderUserId === 'number'
    && typeof value.senderCompanyId === 'number'
    && (value.senderRole === 'BUYER' || value.senderRole === 'SUPPLIER' || value.senderRole === 'ADMIN')
    && typeof value.message === 'string'
    && typeof value.createdAt === 'string'
  )
}

function parseRfqMessage(frame: IMessage): RfqMessage | null {
  try {
    const parsed: unknown = JSON.parse(frame.body)
    return isRfqMessage(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function fetchRfqMessages(rfqId: number, supplierCompanyId?: number | null): Promise<RfqMessage[]> {
  const response = await apiClient.get<RfqMessage[]>(`/api/rfqs/${rfqId}/messages`, {
    params: supplierCompanyId ? { supplierCompanyId } : undefined,
  })
  return response.data
}

export async function sendRfqMessage(rfqId: number, payload: SendRfqMessagePayload): Promise<RfqMessage> {
  const response = await apiClient.post<RfqMessage>(`/api/rfqs/${rfqId}/messages`, payload)
  return response.data
}

export function createRfqChatClient(
  rfqId: number,
  supplierCompanyId: number,
  onMessage: RfqMessageHandler,
  onError?: RfqChatErrorHandler,
  onConnected?: () => void,
): Client {
  let subscription: StompSubscription | null = null

  const client = new Client({
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws-chat`),
    onConnect: () => {
      subscription = client.subscribe(`/topic/rfq.${rfqId}.supplier.${supplierCompanyId}`, (frame) => {
        const message = parseRfqMessage(frame)
        if (message) {
          onMessage(message)
        }
      })
      onConnected?.()
    },
    onStompError: (frame) => {
      onError?.(frame.headers.message ?? 'Không thể kết nối chat realtime.')
    },
    onWebSocketError: () => {
      onError?.('Không thể kết nối chat realtime.')
    },
    onDisconnect: () => {
      subscription = null
    },
  })

  const originalDeactivate = client.deactivate.bind(client)
  client.deactivate = async (...args) => {
    subscription?.unsubscribe()
    subscription = null
    return originalDeactivate(...args)
  }

  return client
}
