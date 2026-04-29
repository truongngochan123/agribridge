import type { BuyerQuickOrderPayload } from '../components/buyer/buyerQuickOrderTypes'
import { apiClient } from './apiClient'

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
