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

export function getBuyerCompanyId(): number {
  const stored = localStorage.getItem('companyId')
  const parsed = stored ? Number(stored) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function buyerHeaders() {
  return {
    'X-Company-Id': String(getBuyerCompanyId()),
  }
}

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
    headers: buyerHeaders(),
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
  const response = await apiClient.get<BuyerRfqDetail>(`/api/buyer/rfqs/${rfqId}`, {
    headers: buyerHeaders(),
  })
  return response.data
}

export async function getBuyerRfqCompare(rfqId: number): Promise<BuyerRfqCompareResponse> {
  const response = await apiClient.get<BuyerRfqCompareResponse>(`/api/buyer/rfqs/${rfqId}/quotes/compare`, {
    headers: buyerHeaders(),
  })
  return response.data
}

export async function createBuyerRfq(payload: CreateBuyerRfqRequest): Promise<BuyerRfqDetail> {
  const response = await apiClient.post<BuyerRfqDetail>('/api/buyer/rfqs', compactPayload(payload), {
    headers: buyerHeaders(),
  })
  return response.data
}

export async function updateBuyerRfq(rfqId: number, payload: UpdateBuyerRfqRequest): Promise<BuyerRfqDetail> {
  const response = await apiClient.put<BuyerRfqDetail>(`/api/buyer/rfqs/${rfqId}`, compactPayload(payload), {
    headers: buyerHeaders(),
  })
  return response.data
}

export async function cancelBuyerRfq(rfqId: number): Promise<void> {
  await apiClient.patch(`/api/buyer/rfqs/${rfqId}/cancel`, undefined, {
    headers: buyerHeaders(),
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
    { headers: buyerHeaders(), timeout: 20000 },
  )
  return response.data
}

export async function getBuyerRfqOrders(rfqId: number): Promise<BuyerRfqOrderItem[]> {
  const response = await apiClient.get<BuyerRfqOrderItem[]>(`/api/buyer/rfqs/${rfqId}/orders`, {
    headers: buyerHeaders(),
  })
  return response.data
}
