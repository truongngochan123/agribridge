import { apiClient } from './apiClient'
import { dispatchStateSync } from './stateSyncService'
import { resolveUploadedFileUrl } from './uploadService'

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
  supplierCompanyId?: number | null
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
  statusLabel?: string | null
  expired?: boolean | null
  warningMessage?: string | null
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
    companyName?: string | null
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
    images?: unknown
  } | null
  thumbnailUrl?: string | null
  productImageUrl?: string | null
  batchImageUrl?: string | null
  lotImageUrl?: string | null
  images?: unknown
  batchImages?: unknown
  lotImages?: unknown
  media?: unknown
  attachments?: unknown
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
  statusLabel?: string | null
  expired?: boolean | null
  warningMessage?: string | null
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
  supplier?: BuyerLotDetail['supplier']
  company?: BuyerLotDetail['supplier']
  qc?: {
    result?: string | null
    documentUrl?: string | null
    notes?: string | null
  } | null
  certifications?: BuyerCertificationPreview[]
  certificates?: unknown
  productCertifications?: unknown
  product_certifications?: unknown
  certificationList?: unknown
  certificateList?: unknown
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

type LooseRecord = Record<string, unknown>

function asRecord(value: unknown): LooseRecord | undefined {
  return value && typeof value === 'object' ? (value as LooseRecord) : undefined
}

function readString(source: unknown, keys: string[]): string | undefined {
  const record = asRecord(source)
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function readNumber(source: unknown, keys: string[]): number | undefined {
  const record = asRecord(source)
  if (!record) return undefined
  for (const key of keys) {
    const value = toNumber(record[key])
    if (value != null) return value
  }
  return undefined
}

function collectImageUrlsFromValue(value: unknown, output: string[]) {
  if (!value) return
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) output.push(resolveUploadedFileUrl(trimmed) || trimmed)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrlsFromValue(item, output))
    return
  }
  const record = asRecord(value)
  if (!record) return
  const direct = readString(record, ['url', 'imageUrl', 'image_url', 'fileUrl', 'file_url', 'path'])
  if (direct) output.push(resolveUploadedFileUrl(direct) || direct)
}

function collectImageUrls(...sources: unknown[]): string[] {
  const urls: string[] = []
  const scalarKeys = [
    'imageUrl',
    'image_url',
    'thumbnailUrl',
    'thumbnail_url',
    'productImageUrl',
    'product_image_url',
    'batchImageUrl',
    'batch_image_url',
    'lotImageUrl',
    'lot_image_url',
  ]
  const listKeys = ['images', 'imageUrls', 'image_urls', 'batchImages', 'batch_images', 'lotImages', 'lot_images', 'media', 'attachments']

  sources.forEach((source) => {
    const record = asRecord(source)
    if (!record) return
    scalarKeys.forEach((key) => collectImageUrlsFromValue(record[key], urls))
    listKeys.forEach((key) => collectImageUrlsFromValue(record[key], urls))
  })

  return Array.from(new Set(urls.filter(Boolean)))
}

function normalizeCertification(value: unknown): BuyerCertificationPreview | null {
  const record = asRecord(value)
  if (!record) return null
  const name = readString(record, ['name', 'certificateName', 'certificationName', 'certificate_name', 'certification_name', 'type', 'standard'])
  if (!name) return null
  return {
    name,
    issuedBy: readString(record, ['issuedBy', 'issuer', 'provider', 'issued_by']) ?? null,
    issuedDate: readString(record, ['issuedDate', 'issued_date']) ?? null,
    expiryDate: readString(record, ['expiryDate', 'expiry_date', 'expiredAt', 'expired_at']) ?? null,
    documentUrl: readString(record, ['documentUrl', 'fileUrl', 'url', 'certificateUrl', 'document_url', 'file_url', 'certificate_url']) ?? null,
  }
}

function collectCertifications(...sources: unknown[]): BuyerCertificationPreview[] {
  const keys = ['certifications', 'certificates', 'productCertifications', 'product_certifications', 'certificationList', 'certificateList']
  const rows: BuyerCertificationPreview[] = []
  sources.forEach((source) => {
    const record = asRecord(source)
    if (!record) return
    keys.forEach((key) => {
      const value = record[key]
      if (Array.isArray(value)) {
        value.forEach((item) => {
          const cert = normalizeCertification(item)
          if (cert) rows.push(cert)
        })
      }
    })
  })
  return rows
}

function normalizeBuyerLotDetail(payload: BuyerLotDetailPayload): BuyerLotDetail {
  const wrapper = payload
  const raw = (wrapper.data ?? wrapper.lot ?? wrapper.batch ?? payload) as BuyerLotDetail
  const product = raw.product ?? wrapper.product ?? null
  const productRecord = product as unknown
  const qc = wrapper.qc
  const supplier = raw.supplier ?? wrapper.supplier ?? wrapper.company ?? null
  const company = wrapper.company ?? null
  const imageUrls = collectImageUrls(raw, wrapper, product)
  const certifications = collectCertifications(raw, wrapper, product)

  const lot: BuyerLotDetail = {
    ...raw,
    id: raw.id ?? raw.batchId ?? readNumber(raw, ['batch_id']),
    batchId: raw.batchId ?? raw.id ?? readNumber(raw, ['batch_id']),
    productId: raw.productId ?? product?.id ?? readNumber(raw, ['product_id']),
    productName: raw.productName ?? product?.name ?? readString(raw, ['product_name']),
    categoryName: raw.categoryName ?? product?.categoryName ?? product?.category ?? readString(raw, ['category_name']),
    originProvince: raw.originProvince ?? product?.originProvince ?? readString(raw, ['origin_province']),
    originRegion: raw.originRegion ?? product?.originRegion ?? product?.originProvince ?? readString(raw, ['origin_region', 'origin_province']),
    unit: raw.unit ?? product?.unit,
    imageUrl: imageUrls[0] ?? raw.imageUrl ?? product?.imageUrl,
    imageUrls,
    supplierId: raw.supplierId ?? supplier?.id ?? readNumber(raw, ['supplier_id', 'supplierCompanyId', 'supplier_company_id']),
    supplierName:
      raw.supplierName ??
      supplier?.companyName ??
      supplier?.name ??
      company?.companyName ??
      company?.name ??
      readString(raw, ['supplier_name', 'supplierCompanyName', 'supplier_company_name', 'companyName', 'company_name']),
    supplierPhone: raw.supplierPhone ?? supplier?.phone ?? company?.phone ?? readString(raw, ['supplier_phone', 'phone']),
    supplierEmail: raw.supplierEmail ?? supplier?.email ?? company?.email ?? readString(raw, ['supplier_email', 'email']),
    supplierProvince: raw.supplierProvince ?? supplier?.province ?? company?.province ?? readString(raw, ['supplier_province', 'province']),
    supplier,
    qcResult: raw.qcResult ?? qc?.result ?? readString(raw, ['qc_result', 'qualityResult', 'quality_result']),
    qcDocumentUrl:
      raw.qcDocumentUrl ??
      qc?.documentUrl ??
      readString(raw, ['qc_document_url', 'qualityDocumentUrl', 'quality_document_url', 'inspectionDocumentUrl', 'inspection_document_url']),
    qcNotes: raw.qcNotes ?? qc?.notes ?? readString(raw, ['qc_notes', 'qualityNotes', 'quality_notes']),
    certifications,
    traceabilityUrl:
      raw.traceabilityUrl ??
      raw.qrCodeUrl ??
      raw.publicUrl ??
      raw.publicTraceUrl ??
      raw.publicBatchUrl ??
      readString(raw, ['traceability_url', 'qrCode', 'qr_code', 'public_url', 'public_trace_url', 'public_batch_url']),
  }

  return {
    ...lot,
    product: product ? { ...product, imageUrls: collectImageUrls(productRecord) } : product,
    price: toNumber(lot.price) ?? null,
    quantity: toNumber(lot.quantity) ?? null,
    availableQuantity: toNumber(lot.availableQuantity) ?? null,
    moq: toNumber(lot.moq) ?? null,
    minMoq: toNumber(lot.minMoq) ?? null,
  }
}

function isSameLotBatch(lot: BuyerLotDetail, batch: BuyerBatchPreview): boolean {
  const lotId = lot.batchId ?? lot.id
  if (lotId != null && (batch.id === lotId || batch.batchId === lotId)) return true
  const lotCode = (lot.batchCode || lot.batchNo || lot.lotCode || lot.code || '').trim()
  const batchCode = (batch.batchCode || batch.batchNo || batch.lotCode || batch.code || '').trim()
  return Boolean(lotCode && batchCode && lotCode === batchCode)
}

async function enrichBuyerLotDetail(lot: BuyerLotDetail): Promise<BuyerLotDetail> {
  if (!lot.productId) return lot

  const [productResult, batchResult] = await Promise.allSettled([
    fetchBuyerSourcingProduct(lot.productId),
    fetchBuyerSourcingProductBatches(lot.productId),
  ])

  const product = productResult.status === 'fulfilled' ? productResult.value : undefined
  const batchRows = batchResult.status === 'fulfilled' ? batchResult.value : []
  const matchedBatch = batchRows.find((batch) => isSameLotBatch(lot, batch))
  const batchImageUrls = matchedBatch ? collectImageUrls(matchedBatch) : []
  const lotImageUrls = collectImageUrls(lot)
  const productImageUrls = product ? collectImageUrls(product) : []
  const imageUrls = Array.from(new Set([...batchImageUrls, ...lotImageUrls, ...productImageUrls]))
  const productCertifications = product ? collectCertifications(product) : []
  const certifications = (lot.certifications?.length ? lot.certifications : productCertifications) ?? []

  return {
    ...lot,
    productName: lot.productName ?? product?.productName,
    categoryName: lot.categoryName ?? product?.categoryName,
    supplierCompanyId: product?.supplierCompanyId,
    supplierName: lot.supplierName ?? product?.supplierName,
    supplierProvince: lot.supplierProvince ?? product?.originRegion,
    originRegion: lot.originRegion ?? product?.originRegion,
    unit: lot.unit ?? product?.unit,
    imageUrl: imageUrls[0] ?? lot.imageUrl,
    imageUrls,
    certifications,
    product: {
      ...(lot.product ?? {}),
      id: lot.product?.id ?? product?.productId,
      name: lot.product?.name ?? product?.productName,
      categoryName: lot.product?.categoryName ?? product?.categoryName,
      originRegion: lot.product?.originRegion ?? product?.originRegion,
      unit: lot.product?.unit ?? product?.unit,
      imageUrl: productImageUrls[0] ?? lot.product?.imageUrl,
      imageUrls: productImageUrls.length > 0 ? productImageUrls : lot.product?.imageUrls,
    },
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
    return enrichBuyerLotDetail(normalizeBuyerLotDetail(response.data))
  } catch (error) {
    const response = await apiClient.get<BuyerLotDetailPayload>(`/api/public/batch/${lotId}`)
    return enrichBuyerLotDetail(normalizeBuyerLotDetail(response.data))
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
  dispatchStateSync(['RFQ', 'QUOTE', 'SOURCING', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-sourcing:create-rfq',
    entityId: response.data?.rfqId,
  })
  return response.data
}
