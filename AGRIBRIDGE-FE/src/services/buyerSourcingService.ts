import { apiClient } from './apiClient'

export type BuyerSourcingProduct = {
  productId: number
  productName: string
  description?: string | null
  supplierCompanyId?: number | null
  supplierName?: string | null
  categoryId?: number | null
  categoryName?: string | null
  originRegion?: string | null
  unit?: string | null
  imageUrl?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  totalAvailableQuantity?: number | null
  minMoq?: number | null
  availableBatchCount: number
  gradeSummary?: string | null
  sizeSummary?: string | null
  certificationCount: number
  hasAvailableStock: boolean
  isSaved: boolean
}

export type CreateBuyerRfqRequest = {
  buyerCompanyId: number
  productId: number
  categoryId?: number | null
  quantity: number
  unit: string
  deliveryDate: string
  province: string
  description?: string
  expiredAt: string
}

type CreateBuyerRfqResponse = {
  rfqId: number
}

export async function fetchBuyerSourcingProducts() {
  const response = await apiClient.get<BuyerSourcingProduct[]>('/api/buyer/sourcing/products')
  return response.data
}

export async function fetchBuyerSourcingProduct(productId: number) {
  const response = await apiClient.get<BuyerSourcingProduct>(`/api/buyer/sourcing/products/${productId}`)
  return response.data
}

export async function createBuyerSourcingRfq(payload: CreateBuyerRfqRequest) {
  const response = await apiClient.post<CreateBuyerRfqResponse>('/api/buyer/sourcing/rfqs', {
    buyer_company_id: payload.buyerCompanyId,
    product_id: payload.productId,
    category_id: payload.categoryId,
    quantity: payload.quantity,
    unit: payload.unit,
    delivery_date: payload.deliveryDate,
    province: payload.province,
    description: payload.description,
    expired_at: payload.expiredAt,
  })
  return response.data
}
