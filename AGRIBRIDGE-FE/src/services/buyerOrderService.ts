import type { BuyerQuickOrderPayload } from '../components/buyer/buyerQuickOrderTypes'
import type { BuyerOrderRow } from '../types/buyerDashboard'
import { apiClient } from './apiClient'

export type BuyerOrderComplaint = {
  id: number
  batchId?: number | null
  title?: string | null
  description: string
  status?: string | null
  severity?: string | null
  resolution?: string | null
  createdAt: string
  resolvedAt?: string | null
}

export type BuyerOrderPayment = {
  id: number
  amount?: number | null
  paidAmount?: number | null
  paymentMethod?: string | null
  paymentType?: string | null
  status?: string | null
  escrowStatus?: string | null
  dueDate?: string | null
  paymentDate?: string | null
  note?: string | null
}

export type BuyerOrder = BuyerOrderRow & {
  driverName?: string | null
  driverPhone?: string | null
  vehicleInfo?: string | null
  trackingCode?: string | null
  payments?: BuyerOrderPayment[]
  complaints?: BuyerOrderComplaint[]
}

export type BuyerQuickOrderResponse = {
  orderId: number
  orderCode: string
  invoiceId?: number | null
  shipmentId?: number | null
  paymentId?: number | null
  debtId?: number | null
  orderStatus?: string | null
  invoiceStatus?: string | null
  paymentStatus?: string | null
  escrowStatus?: string | null
  transferContent?: string | null
  payableAmount?: number | null
  depositAmount?: number | null
  remainingAmount?: number | null
  shippingStatus?: string | null
  grandTotal?: number | null
  message?: string | null
}

export async function createQuickOrder(payload: BuyerQuickOrderPayload): Promise<BuyerQuickOrderResponse> {
  const response = await apiClient.post('/api/buyer/orders/quick-order', payload, {
    timeout: 20000,
  })
  return response.data?.data ?? response.data
}

export async function fetchBuyerOrders(): Promise<BuyerOrder[]> {
  const response = await apiClient.get('/api/buyer/orders')
  return response.data?.data ?? response.data
}

export async function fetchBuyerOrder(orderId: number): Promise<BuyerOrder> {
  const response = await apiClient.get(`/api/buyer/orders/${orderId}`)
  return response.data?.data ?? response.data
}

export async function confirmBuyerOrderReceived(orderId: number): Promise<void> {
  await apiClient.post(`/api/buyer/orders/${orderId}/confirm-received`)
}

export async function demoConfirmBuyerOrderPayment(orderId: number): Promise<BuyerOrder> {
  const response = await apiClient.post(`/api/buyer/orders/${orderId}/demo-confirm-payment`)
  return response.data?.data ?? response.data
}

export async function demoPayBuyerOrderRemaining(orderId: number): Promise<BuyerOrder> {
  const response = await apiClient.post(`/api/buyer/orders/${orderId}/demo-pay-remaining`)
  return response.data?.data ?? response.data
}

export async function createBuyerOrderComplaint(
  orderId: number,
  payload: { batchId?: number | null; title: string; description: string; severity?: string },
): Promise<BuyerOrderComplaint> {
  const response = await apiClient.post(`/api/buyer/orders/${orderId}/complaints`, payload)
  return response.data?.data ?? response.data
}
