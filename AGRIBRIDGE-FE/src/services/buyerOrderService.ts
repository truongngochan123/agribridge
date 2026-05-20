import type { BuyerQuickOrderPayload } from '../components/buyer/buyerQuickOrderTypes'
import type { BuyerOrderRow } from '../types/buyerDashboard'
import { apiClient } from './apiClient'
import { dispatchStateSync } from './stateSyncService'

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
  transferContent?: string | null
  dueDate?: string | null
  paymentDate?: string | null
  paidAt?: string | null
  verifiedAt?: string | null
  note?: string | null
}

export type BuyerOrderShipment = {
  id?: number | null
  provider?: string | null
  trackingCode?: string | null
  shipmentStatus?: string | null
  receiverName?: string | null
  receiverPhone?: string | null
  receiverAddress?: string | null
  expectedDeliveryDate?: string | null
  shippingFee?: number | null
  deliveredAt?: string | null
}

export type BuyerOrder = BuyerOrderRow & {
  paymentOption?: string | null
  paymentStatus?: string | null
  escrowStatus?: string | null
  remainingAmount?: number | null
  expectedDeliveryDate?: string | null
  driverName?: string | null
  driverPhone?: string | null
  vehicleInfo?: string | null
  trackingCode?: string | null
  shipment?: BuyerOrderShipment | null
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
  const data = response.data?.data ?? response.data
  dispatchStateSync(['ORDER', 'PAYMENT', 'DELIVERY', 'DEBT', 'INVENTORY', 'DASHBOARD'], {
    source: 'buyer-order:create-quick',
    entityId: data?.orderId,
  })
  return data
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
  dispatchStateSync(['ORDER', 'DELIVERY', 'PAYMENT', 'DEBT', 'DASHBOARD'], {
    source: 'buyer-order:confirm-received',
    entityId: orderId,
  })
}

export async function demoConfirmBuyerOrderPayment(orderId: number): Promise<BuyerOrder> {
  const response = await apiClient.post(`/api/buyer/orders/${orderId}/demo-confirm-payment`)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['ORDER', 'PAYMENT', 'DEBT', 'DELIVERY', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-order:confirm-payment',
    entityId: orderId,
  })
  return data
}

export async function demoPayBuyerOrderRemaining(orderId: number): Promise<BuyerOrder> {
  const response = await apiClient.post(`/api/buyer/orders/${orderId}/demo-pay-remaining`)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['ORDER', 'PAYMENT', 'DEBT', 'DELIVERY', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-order:pay-remaining',
    entityId: orderId,
  })
  return data
}

export async function createBuyerOrderComplaint(
  orderId: number,
  payload: { batchId?: number | null; title: string; description: string; severity?: string },
): Promise<BuyerOrderComplaint> {
  const response = await apiClient.post(`/api/buyer/orders/${orderId}/complaints`, payload)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['ORDER', 'COMPLAINT', 'DELIVERY', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-order:create-complaint',
    entityId: orderId,
  })
  return data
}
