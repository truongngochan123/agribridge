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
  const response = await apiClient.post('/api/buyer/shipping/quote', payload)
  return response.data?.data ?? response.data
}
