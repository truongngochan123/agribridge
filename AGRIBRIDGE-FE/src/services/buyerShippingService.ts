import axios from 'axios'
import { apiClient } from './apiClient'

export type BuyerShippingQuoteRequest = {
  buyerCompanyId?: number | null
  supplierId?: number | null
  productId: number
  batchId?: number | null
  quantity: number
  unit: string
  toProvince?: string | null
  toWard?: string | null
  toAddress?: string | null
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  insuranceValue?: number | null
}

export type BuyerShippingQuote = {
  providerCode: string
  providerName: string
  serviceName: string | null
  estimatedShippingFee: number | null
  estimatedDeliveryTime?: string | null
  estimatedDaysMin?: number | null
  estimatedDaysMax?: number | null
  shippingPayer: 'BUYER' | 'SUPPLIER' | 'NEGOTIATED'
  quoteOnly: boolean
  /** True when the supplier/sender address could not be resolved. Buyer can still place order. */
  isPendingQuote?: boolean
  /** Human-readable reason the quote is pending (sender address issue). */
  pendingReason?: string | null
}

export async function quoteBuyerShipping(
  payload: BuyerShippingQuoteRequest,
): Promise<BuyerShippingQuote> {
  try {
    const response = await apiClient.post('/api/buyer/shipping/quote', payload, {
      timeout: 20000,
    })
    const data: BuyerShippingQuote = response.data?.data ?? response.data

    // Backend returned PENDING_QUOTE fallback (sender address unresolvable)
    if (data.providerCode === 'PENDING_QUOTE') {
      return {
        ...data,
        isPendingQuote: true,
        pendingReason: data.providerName ?? 'Địa chỉ kho/nhà cung cấp chưa hỗ trợ tính phí tự động.',
      }
    }

    return data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message
      if (typeof message === 'string' && message.trim()) {
        throw new Error(message)
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('GHN phản hồi quá lâu. Vui lòng thử lại hoặc kiểm tra địa chỉ.')
      }
    }
    throw error
  }
}
