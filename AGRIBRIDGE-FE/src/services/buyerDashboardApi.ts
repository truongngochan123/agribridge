import { apiClient } from './apiClient'

export type BuyerDashboardKpi = {
  id: string
  label: string
  value: number
  displayValue: string
}

export type BuyerDashboardAlert = {
  id: string
  title: string
  value: string
  tone: 'danger' | 'warning' | 'amber' | 'info'
  targetPath?: string | null
}

export type BuyerDashboardDeliveryOrder = {
  orderId: number
  orderCode: string
  productText: string
  status?: string | null
  statusLabel?: string | null
  totalAmount: number
  displayAmount: string
  shipmentId?: number | null
  trackingCode?: string | null
  estimatedDeliveryAt?: string | null
}

export type BuyerDashboardPendingRfq = {
  rfqId: number
  rfqCode: string
  title: string
  productText: string
  quantity: number
  unit?: string | null
  status?: string | null
  quoteCount: number
  expiredAt?: string | null
  deliveryDate?: string | null
  province?: string | null
}

export type BuyerDashboardPayload = {
  kpis: BuyerDashboardKpi[]
  alerts: BuyerDashboardAlert[]
  deliveryOrders: BuyerDashboardDeliveryOrder[]
  pendingRfqs: BuyerDashboardPendingRfq[]
}

export async function fetchBuyerDashboard(): Promise<BuyerDashboardPayload> {
  const response = await apiClient.get('/api/buyer/dashboard')
  return response.data?.data ?? response.data
}
