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

export type BuyerLotDetail = {
  id?: number
  batchId?: number
  batchCode?: string | null
  batchNo?: string | null
  lotCode?: string | null
  code?: string | null
  productId?: number | null
  productName?: string | null
  categoryName?: string | null
  supplierId?: number | null
  supplierName?: string | null
  supplierPhone?: string | null
  supplierEmail?: string | null
  supplierProvince?: string | null
  originRegion?: string | null
  originProvince?: string | null
  unit?: string | null
  price?: number | null
  grade?: string | null
  size?: string | null
  quantity?: number | null
  availableQuantity?: number | null
  moq?: number | null
  minMoq?: number | null
  harvestDate?: string | null
  packingDate?: string | null
  expiryDate?: string | null
  status?: string | null
  storageTemp?: string | null
  imageUrl?: string | null
  imageUrls?: string[]
  videoUrl?: string | null
  qcResult?: string | null
  qcDocumentUrl?: string | null
  qcNotes?: string | null
  traceabilityUrl?: string | null
  qrCodeUrl?: string | null
  publicUrl?: string | null
  publicTraceUrl?: string | null
  publicBatchUrl?: string | null
  certifications?: BuyerCertificationPreview[]
  supplier?: {
    id?: number
    name?: string | null
    phone?: string | null
    email?: string | null
    province?: string | null
    verified?: boolean | null
    responseRate?: number | null
    deliveryRate?: number | null
  } | null
  product?: {
    id?: number
    name?: string | null
    categoryName?: string | null
    category?: string | null
    originProvince?: string | null
    originRegion?: string | null
    description?: string | null
    unit?: string | null
    imageUrl?: string | null
    imageUrls?: string[]
  } | null
  transactionHistory?: Array<{
    id?: number | string
    buyer?: string | null
    buyerName?: string | null
    date?: string | null
    quantity?: number | string | null
    unit?: string | null
    status?: string | null
  }>
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

type BuyerLotDetailPayload = Partial<BuyerLotDetail> & {
  data?: BuyerLotDetail
  lot?: BuyerLotDetail
  batch?: BuyerLotDetail
  product?: BuyerLotDetail['product']
  qc?: {
    result?: string | null
    documentUrl?: string | null
    notes?: string | null
  } | null
  certifications?: BuyerCertificationPreview[]
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

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function normalizeBuyerLotDetail(payload: BuyerLotDetailPayload): BuyerLotDetail {
  const wrapper = payload
  const raw = (wrapper.data ?? wrapper.lot ?? wrapper.batch ?? payload) as BuyerLotDetail
  const product = raw.product ?? wrapper.product ?? null
  const qc = wrapper.qc
  const supplier = raw.supplier ?? null

  const lot: BuyerLotDetail = {
    ...raw,
    id: raw.id ?? raw.batchId,
    batchId: raw.batchId ?? raw.id,
    productId: raw.productId ?? product?.id,
    productName: raw.productName ?? product?.name,
    categoryName: raw.categoryName ?? product?.categoryName ?? product?.category,
    originProvince: raw.originProvince ?? product?.originProvince,
    originRegion: raw.originRegion ?? product?.originRegion ?? product?.originProvince,
    unit: raw.unit ?? product?.unit,
    imageUrl: raw.imageUrl ?? product?.imageUrl,
    imageUrls: raw.imageUrls ?? product?.imageUrls ?? [],
    supplierId: raw.supplierId ?? supplier?.id,
    supplierName: raw.supplierName ?? supplier?.name,
    supplierPhone: raw.supplierPhone ?? supplier?.phone,
    supplierEmail: raw.supplierEmail ?? supplier?.email,
    supplierProvince: raw.supplierProvince ?? supplier?.province,
    qcResult: raw.qcResult ?? qc?.result,
    qcDocumentUrl: raw.qcDocumentUrl ?? qc?.documentUrl,
    qcNotes: raw.qcNotes ?? qc?.notes,
    certifications: raw.certifications ?? wrapper.certifications ?? [],
    traceabilityUrl: raw.traceabilityUrl ?? raw.qrCodeUrl ?? raw.publicUrl ?? raw.publicTraceUrl ?? raw.publicBatchUrl,
  }

  return {
    ...lot,
    price: toNumber(lot.price) ?? null,
    quantity: toNumber(lot.quantity) ?? null,
    availableQuantity: toNumber(lot.availableQuantity) ?? null,
    moq: toNumber(lot.moq) ?? null,
    minMoq: toNumber(lot.minMoq) ?? null,
  }
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

export async function fetchBuyerLotDetail(lotId: number): Promise<BuyerLotDetail> {
  try {
    const response = await apiClient.get<BuyerLotDetailPayload>(`/api/buyer/lots/${lotId}`)
    return normalizeBuyerLotDetail(response.data)
  } catch (error) {
    const response = await apiClient.get<BuyerLotDetailPayload>(`/api/public/batch/${lotId}`)
    return normalizeBuyerLotDetail(response.data)
  }
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
