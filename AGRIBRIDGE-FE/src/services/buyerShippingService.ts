import axios from 'axios'
import { apiClient } from './apiClient'

export type BuyerShippingQuoteRequest = {
  buyerCompanyId?: number | null
  supplierId?: number | null
  productId: number
  batchId?: number | null
  quantity: number
  unit: string
  fromProvince?: string | null
  fromWard?: string | null
  fromAddress?: string | null
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
  serviceName: string
  estimatedShippingFee: number | null
  estimatedDeliveryTime?: string | null
  estimatedDaysMin?: number | null
  estimatedDaysMax?: number | null
  shippingPayer: 'BUYER' | 'SUPPLIER' | 'NEGOTIATED'
  quoteOnly: boolean
}

export async function quoteBuyerShipping(
  payload: BuyerShippingQuoteRequest,
): Promise<BuyerShippingQuote> {
  try {
    const response = await apiClient.post('/api/buyer/shipping/quote', payload)
    return response.data?.data ?? response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message
      if (typeof message === 'string' && message.trim()) {
        throw new Error(message)
      }
    }
    throw error
  }
}
