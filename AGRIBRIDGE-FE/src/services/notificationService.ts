import { apiClient } from './apiClient'
import { dispatchStateSync } from './stateSyncService'

export type AppNotification = {
  id: number
  module?: string | null
  type?: string | null
  title: string
  body?: string | null
  metadata?: string | null
  actionUrl?: string | null
  entityType?: string | null
  entityId?: number | null
  actionRequired?: boolean | null
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
  const data = response.data?.data ?? response.data
  dispatchStateSync(['NOTIFICATION'], { source: 'notification:mark-read', entityId: notificationId })
  return data
}

export async function markAllNotificationsAsRead(): Promise<NotificationListResponse> {
  const response = await apiClient.post('/api/notifications/read-all')
  const data = response.data?.data ?? response.data
  dispatchStateSync(['NOTIFICATION'], { source: 'notification:mark-all-read' })
  return data
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
  const route = item.actionUrl || metadata.actionUrl || metadata.route
  const targetModal = typeof metadata.targetModal === 'string' ? metadata.targetModal : ''
  const asPositiveInt = (value: unknown) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0
  }
  const withTargetModal = (path: string) => {
    if (!targetModal) return path
    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}targetModal=${encodeURIComponent(targetModal)}`
  }
  if (typeof route === 'string' && route.startsWith('/')) return withTargetModal(route)

  const orderId = asPositiveInt(metadata.orderId || item.entityId)
  const rfqId = asPositiveInt(metadata.rfqId || item.entityId)
  const quoteId = asPositiveInt(metadata.quoteId || item.entityId)
  const shipmentId = metadata.shipmentId || metadata.rawShipmentId || (item.entityType === 'SHIPMENT_INCIDENT' ? item.entityId : '')
  const incidentId = asPositiveInt(metadata.incidentId || (item.entityType === 'SHIPMENT_INCIDENT' ? item.entityId : 0))

  if (item.type === 'SHIPMENT_INCIDENT' || item.type === 'DELIVERY_DISPUTE' || item.type === 'BUYER_COMPLAINT' || item.entityType === 'SHIPMENT_INCIDENT') {
    const encodedShipmentId = shipmentId ? encodeURIComponent(String(shipmentId)) : ''
    if (role === 'supplier') {
      return `/supplier/delivery${encodedShipmentId ? `?shipmentId=${encodedShipmentId}&incident=true${incidentId ? `&incidentId=${incidentId}` : ''}` : '?incident=true'}`
    }
    return `/buyer/delivery${encodedShipmentId ? `?shipmentId=${encodedShipmentId}&incident=true${incidentId ? `&incidentId=${incidentId}` : ''}` : '?incident=true'}`
  }

  if (item.type?.startsWith('ORDER_')) {
    return role === 'supplier' ? `/supplier/orders?orderId=${orderId}` : `/buyer/orders?orderId=${orderId}`
  }
  if (item.type?.startsWith('DELIVERY_')) {
    return role === 'supplier' ? `/supplier/delivery${shipmentId ? `?shipmentId=${encodeURIComponent(String(shipmentId))}` : orderId ? `?orderId=${orderId}` : ''}` : `/buyer/delivery?orderId=${orderId}`
  }
  if (item.type?.startsWith('RFQ_')) {
    return role === 'supplier' ? `/supplier/rfq?rfqId=${rfqId}` : `/buyer/rfq?rfqId=${rfqId}${quoteId ? `&quoteId=${quoteId}` : ''}`
  }
  if (item.type?.startsWith('COMPLAINT_')) {
    return role === 'supplier' ? `/supplier/complaints?orderId=${orderId}` : `/buyer/orders?orderId=${orderId}`
  }

  if (item.type === 'DEBT_PAYMENT_CONFIRMED' || item.type === 'PAYMENT_REMAINING_PAID_FOR_SUPPLIER') {
    const invoiceId = asPositiveInt(metadata.invoiceId)
    const buyerId = asPositiveInt(metadata.buyerCompanyId)
    const supplierId = asPositiveInt(metadata.supplierCompanyId)
    if (role === 'buyer') {
      return `/buyer/debt?supplierId=${supplierId}&invoiceId=${invoiceId}`
    }
    return `/supplier/debt?buyerId=${buyerId}&invoiceId=${invoiceId}`
  }
  if (item.type === 'DEBT_CREDIT_LIMIT_GRANTED' || item.type === 'DEBT_CREDIT_LIMIT_SUSPENDED' || item.type === 'DEBT_CREDIT_LIMIT_CLOSED') {
    const supplierId = asPositiveInt(metadata.supplierCompanyId)
    return supplierId ? `/buyer/debt?supplierId=${supplierId}` : '/buyer/debt'
  }
  if (item.type === 'DEBT_REMINDER' || item.type === 'PAYMENT_DUE' || item.type === 'PAYMENT_REMAINING_REQUIRED' || item.type === 'DEBT_OVERDUE') {
    const invoiceId = asPositiveInt(metadata.invoiceId)
    const supplierId = asPositiveInt(metadata.supplierCompanyId)
    const buyerId = asPositiveInt(metadata.buyerCompanyId)
    if (item.type === 'PAYMENT_DUE' || item.type === 'PAYMENT_REMAINING_REQUIRED') return withTargetModal(`/buyer/debt?supplierId=${supplierId}&invoiceId=${invoiceId}&pay=1`)
    if (item.type === 'DEBT_OVERDUE') return `/supplier/debt?buyerId=${buyerId}&invoiceId=${invoiceId}`
    if (role === 'supplier') return `/supplier/debt?buyerId=${buyerId}&invoiceId=${invoiceId}`
    return withTargetModal(`/buyer/debt?supplierId=${supplierId}&invoiceId=${invoiceId}`)
  }
  return role === 'supplier' ? '/supplier/overview' : '/buyer/overview'
}
