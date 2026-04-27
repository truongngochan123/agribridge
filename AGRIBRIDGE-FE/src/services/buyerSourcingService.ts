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
  imageUrls?: string[]
  certifications?: BuyerCertificationPreview[]
  batches?: BuyerBatchPreview[]
  batchList?: BuyerBatchPreview[]
  availableBatches?: BuyerBatchPreview[]
  lots?: BuyerBatchPreview[]
  productBatches?: BuyerBatchPreview[]
  supplierBatches?: BuyerBatchPreview[]
}

export type BuyerCertificationPreview = {
  id?: number
  name: string
  documentUrl?: string | null
  issuedBy?: string | null
  issuedDate?: string | null
  expiryDate?: string | null
}

export type BuyerBatchPreview = {
  id?: number
  batchId?: number
  batchCode?: string | null
  batchNo?: string | null
  lotCode?: string | null
  code?: string | null
  traceabilityUrl?: string | null
  qrCodeUrl?: string | null
  publicUrl?: string | null
  publicTraceUrl?: string | null
  publicBatchUrl?: string | null
  grade?: string | null
  size?: string | null
  quantity?: number | null
  availableQuantity?: number | null
  price?: number | null
  moq?: number | null
  minMoq?: number | null
  harvestDate?: string | null
  expiryDate?: string | null
  status?: string | null
  imageUrl?: string | null
  imageUrls?: string[]
  qcResult?: string | null
  qcDocumentUrl?: string | null
  qcNotes?: string | null
  videoUrl?: string | null
  storageTemp?: string | null
  notes?: string | null
  description?: string | null
}

export type CreateBuyerRfqRequest = {
  buyerCompanyId: number
  productId: number
  batchId?: number | null
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

type BuyerSourcingPayload =
  | BuyerSourcingProduct
  | {
      data?: BuyerSourcingProduct
      product?: BuyerSourcingProduct
      availableBatches?: BuyerBatchPreview[]
      batches?: BuyerBatchPreview[]
      batchList?: BuyerBatchPreview[]
      lots?: BuyerBatchPreview[]
      productBatches?: BuyerBatchPreview[]
      supplierBatches?: BuyerBatchPreview[]
    }

function isBatchPreviewArray(value: unknown): value is BuyerBatchPreview[] {
  return Array.isArray(value)
}

function isUrl(value?: string | null): boolean {
  if (!value) return false
  return /^https?:\/\//i.test(value.trim())
}

function normalizeBatchPreview(batch: BuyerBatchPreview): BuyerBatchPreview {
  const normalizedCode = batch.code?.trim() || undefined
  const normalizedBatchCode = batch.batchCode?.trim() || undefined

  const inferredTraceabilityUrl =
    batch.traceabilityUrl ||
    batch.qrCodeUrl ||
    batch.publicUrl ||
    batch.publicTraceUrl ||
    batch.publicBatchUrl ||
    (isUrl(normalizedCode) ? normalizedCode : undefined)

  return {
    ...batch,
    batchCode: isUrl(normalizedBatchCode) ? undefined : batch.batchCode,
    code: normalizedCode,
    traceabilityUrl: inferredTraceabilityUrl,
  }
}

function normalizeBatchPreviewRows(rows: BuyerBatchPreview[]): BuyerBatchPreview[] {
  return rows.map(normalizeBatchPreview)
}

function pickBatchRows(value: unknown): BuyerBatchPreview[] {
  if (!value || typeof value !== 'object') return []
  const row = value as {
    batches?: unknown
    batchList?: unknown
    availableBatches?: unknown
    lots?: unknown
    productBatches?: unknown
    supplierBatches?: unknown
  }

  const candidates = [row.batches, row.batchList, row.availableBatches, row.lots, row.productBatches, row.supplierBatches]
  const found = candidates.find(isBatchPreviewArray)
  return found ? normalizeBatchPreviewRows(found) : []
}

function normalizeBuyerSourcingProduct(payload: BuyerSourcingPayload): BuyerSourcingProduct {
  if (payload && typeof payload === 'object' && ('data' in payload || 'product' in payload)) {
    const wrapper = payload as Exclude<BuyerSourcingPayload, BuyerSourcingProduct>
    const nested = wrapper.data ?? wrapper.product ?? ({} as BuyerSourcingProduct)
    const mergedBatches = [
      ...pickBatchRows(nested),
      ...pickBatchRows(wrapper),
    ]
    return {
      ...nested,
      batches: mergedBatches.length > 0 ? mergedBatches : pickBatchRows(nested),
      batchList: nested.batchList ?? wrapper.batchList,
      availableBatches: nested.availableBatches ?? wrapper.availableBatches,
      lots: nested.lots ?? wrapper.lots,
      productBatches: nested.productBatches ?? wrapper.productBatches,
      supplierBatches: nested.supplierBatches ?? wrapper.supplierBatches,
    }
  }

  const direct = payload as BuyerSourcingProduct
  return {
    ...direct,
    batches: pickBatchRows(direct),
  }
}

export async function fetchBuyerSourcingProducts() {
  const response = await apiClient.get<BuyerSourcingProduct[]>('/api/buyer/sourcing/products')
  return response.data
}

export async function fetchBuyerSourcingProduct(productId: number) {
  const response = await apiClient.get<BuyerSourcingPayload>(`/api/buyer/sourcing/products/${productId}`)
  return normalizeBuyerSourcingProduct(response.data)
}

export async function fetchBuyerSourcingProductBatches(productId: number): Promise<BuyerBatchPreview[]> {
  const response = await apiClient.get<unknown>(`/api/buyer/sourcing/products/${productId}/batches`)
  const payload = response.data as {
    data?: unknown
    batches?: unknown
    availableBatches?: unknown
  }

  if (Array.isArray(response.data)) return normalizeBatchPreviewRows(response.data as BuyerBatchPreview[])
  if (Array.isArray(payload?.data)) return normalizeBatchPreviewRows(payload.data as BuyerBatchPreview[])
  if (Array.isArray(payload?.batches)) return normalizeBatchPreviewRows(payload.batches as BuyerBatchPreview[])
  if (Array.isArray(payload?.availableBatches)) return normalizeBatchPreviewRows(payload.availableBatches as BuyerBatchPreview[])

  return []
}

export async function createBuyerSourcingRfq(payload: CreateBuyerRfqRequest) {
  const response = await apiClient.post<CreateBuyerRfqResponse>('/api/buyer/sourcing/rfqs', {
    buyer_company_id: payload.buyerCompanyId,
    product_id: payload.productId,
    batch_id: payload.batchId,
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
