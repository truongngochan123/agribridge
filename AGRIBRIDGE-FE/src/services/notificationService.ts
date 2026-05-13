import { apiClient } from './apiClient'

export type AppNotification = {
  id: number
  type?: string | null
  title: string
  body?: string | null
  metadata?: string | null
  isRead?: boolean | null
  createdAt?: string | null
}

export type NotificationListResponse = {
  items: AppNotification[]
  unreadCount: number
}

export async function fetchNotifications(): Promise<NotificationListResponse> {
  const response = await apiClient.get('/api/notifications')
  return response.data?.data ?? response.data
}

export async function markNotificationAsRead(notificationId: number): Promise<NotificationListResponse> {
  const response = await apiClient.post(`/api/notifications/${notificationId}/read`)
  return response.data?.data ?? response.data
}

export async function markAllNotificationsAsRead(): Promise<NotificationListResponse> {
  const response = await apiClient.post('/api/notifications/read-all')
  return response.data?.data ?? response.data
}

export function parseNotificationMetadata(metadata?: string | null): Record<string, unknown> {
  if (!metadata) return {}
  try {
    const parsed = JSON.parse(metadata)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

export function resolveNotificationRoute(item: AppNotification): string {
  const metadata = parseNotificationMetadata(item.metadata)
  const role = String(metadata.role || '').toLowerCase()
  const route = metadata.route
  const asPositiveInt = (value: unknown) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0
  }
  if (typeof route === 'string' && route.startsWith('/')) return route

  if (item.type === 'DEBT_PAYMENT_CONFIRMED') {
    const invoiceId = asPositiveInt(metadata.invoiceId)
    const buyerId = asPositiveInt(metadata.buyerCompanyId)
    const supplierId = asPositiveInt(metadata.supplierCompanyId)
    if (role === 'buyer') {
      return `/buyer/debt?supplierId=${supplierId}&invoiceId=${invoiceId}`
    }
    return `/supplier/debt?buyerId=${buyerId}&invoiceId=${invoiceId}`
  }
  if (item.type === 'DEBT_REMINDER') {
    const invoiceId = asPositiveInt(metadata.invoiceId)
    const supplierId = asPositiveInt(metadata.supplierCompanyId)
    const buyerId = asPositiveInt(metadata.buyerCompanyId)
    if (role === 'supplier') return `/supplier/debt?buyerId=${buyerId}&invoiceId=${invoiceId}`
    return `/buyer/debt?supplierId=${supplierId}&invoiceId=${invoiceId}`
  }
  return role === 'supplier' ? '/supplier/overview' : '/buyer/overview'
}
