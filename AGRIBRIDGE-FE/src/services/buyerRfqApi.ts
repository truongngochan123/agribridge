import { apiClient } from './apiClient'
import type {
  BuyerRfqCompareResponse,
  BuyerRfqDetail,
  BuyerRfqOrderItem,
  BuyerRfqPageResponse,
  ConvertQuoteToOrderRequest,
  ConvertQuoteToOrderResponse,
  CreateBuyerRfqRequest,
  UpdateBuyerRfqRequest,
} from '../types/buyerRfq'
import { dispatchStateSync } from './stateSyncService'

function compactPayload<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

export async function getBuyerRfqs(params: {
  page?: number
  size?: number
  status?: string
  keyword?: string
} = {}): Promise<BuyerRfqPageResponse> {
  const response = await apiClient.get<BuyerRfqPageResponse>('/api/buyer/rfqs', {
    params: compactPayload({
      page: params.page ?? 0,
      size: params.size ?? 20,
      status: params.status,
      keyword: params.keyword,
    }),
  })
  return response.data
}

export async function getBuyerRfqDetail(rfqId: number): Promise<BuyerRfqDetail> {
  const response = await apiClient.get<BuyerRfqDetail>(`/api/buyer/rfqs/${rfqId}`)
  return response.data
}

export async function getBuyerRfqCompare(rfqId: number): Promise<BuyerRfqCompareResponse> {
  const response = await apiClient.get<BuyerRfqCompareResponse>(`/api/buyer/rfqs/${rfqId}/quotes/compare`)
  return response.data
}

export async function createBuyerRfq(payload: CreateBuyerRfqRequest): Promise<BuyerRfqDetail> {
  const response = await apiClient.post<BuyerRfqDetail>('/api/buyer/rfqs', compactPayload(payload))
  dispatchStateSync(['RFQ', 'QUOTE', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-rfq:create',
    entityId: response.data?.id,
  })
  return response.data
}

export async function createMarketplaceBuyerRfq(payload: CreateBuyerRfqRequest): Promise<BuyerRfqDetail> {
  const response = await apiClient.post<BuyerRfqDetail>('/api/buyer/rfqs/marketplace', compactPayload({ ...payload, type: 'MARKETPLACE' }))
  dispatchStateSync(['RFQ', 'QUOTE', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-rfq:create-marketplace',
    entityId: response.data?.id,
  })
  return response.data
}

export async function createDirectBuyerRfq(payload: CreateBuyerRfqRequest): Promise<BuyerRfqDetail> {
  const response = await apiClient.post<BuyerRfqDetail>('/api/buyer/rfqs/direct', compactPayload({ ...payload, type: 'DIRECT' }))
  dispatchStateSync(['RFQ', 'QUOTE', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-rfq:create-direct',
    entityId: response.data?.id,
  })
  return response.data
}

export async function updateBuyerRfq(rfqId: number, payload: UpdateBuyerRfqRequest): Promise<BuyerRfqDetail> {
  const response = await apiClient.put<BuyerRfqDetail>(`/api/buyer/rfqs/${rfqId}`, compactPayload(payload))
  dispatchStateSync(['RFQ', 'QUOTE', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-rfq:update',
    entityId: rfqId,
  })
  return response.data
}

export async function cancelBuyerRfq(rfqId: number): Promise<void> {
  await apiClient.patch(`/api/buyer/rfqs/${rfqId}/cancel`)
  dispatchStateSync(['RFQ', 'QUOTE', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-rfq:cancel',
    entityId: rfqId,
  })
}

export async function convertQuoteToOrder(
  rfqId: number,
  quoteId: number,
  payload: ConvertQuoteToOrderRequest,
): Promise<ConvertQuoteToOrderResponse> {
  const response = await apiClient.post<ConvertQuoteToOrderResponse>(
    `/api/buyer/rfqs/${rfqId}/quotes/${quoteId}/convert-to-order`,
    payload,
    { timeout: 20000 },
  )
  dispatchStateSync(['RFQ', 'QUOTE', 'ORDER', 'PAYMENT', 'DELIVERY', 'INVENTORY', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-rfq:convert-to-order',
    entityId: rfqId,
  })
  return response.data
}

export async function acceptBuyerRfqQuote(
  rfqId: number,
  quoteId: number,
  payload: ConvertQuoteToOrderRequest,
): Promise<ConvertQuoteToOrderResponse> {
  const response = await apiClient.post<ConvertQuoteToOrderResponse>(
    `/api/buyer/rfqs/${rfqId}/quotes/${quoteId}/accept`,
    payload,
    { timeout: 20000 },
  )
  dispatchStateSync(['RFQ', 'QUOTE', 'ORDER', 'PAYMENT', 'DELIVERY', 'INVENTORY', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-rfq:accept-quote',
    entityId: rfqId,
  })
  return response.data
}

export async function getBuyerRfqOrders(rfqId: number): Promise<BuyerRfqOrderItem[]> {
  const response = await apiClient.get<BuyerRfqOrderItem[]>(`/api/buyer/rfqs/${rfqId}/orders`)
  return response.data
}
