import type { QcResult } from './supplierTrace'

export interface CategoryOption {
  id: number
  name: string
}

export interface MetadataListPayload {
  items: string[]
}

export interface CreateProductCertificationPayload {
  name: string
  documentUrl?: string
  issuedBy?: string
  issuedDate?: string
  expiryDate?: string
}

export interface CreateProductPayload {
  name: string
  categoryId: number
  unit: string
  originProvince: string
  description?: string
  imageUrl?: string
  imageUrls?: string[]
  certifications: CreateProductCertificationPayload[]
}

export interface CreateQcPayload {
  result: QcResult
  documentUrl?: string
  notes?: string
}

export interface CreateBatchPayload {
  harvestDate: string
  expiryDate?: string
  grade: 'A' | 'B' | 'C'
  size?: string
  quantity: number
  price: number
  moq?: number
  storageTemp?: string
  videoUrl?: string
  imageUrls?: string[]
  qc: CreateQcPayload
}

export interface CreateProductWithFirstBatchRequest {
  supplierCompanyId: number
  userId: number
  product: CreateProductPayload
  batch: CreateBatchPayload
}

export interface CreateProductOnlyRequest {
  supplierCompanyId: number
  product: CreateProductPayload
}

export interface CreateBatchForProductRequest {
  productId: number
  userId: number
  batch: CreateBatchPayload
}

export interface SupplierProductOption {
  id: number
  name: string
  categoryId: number
  categoryName: string
  unit: string
  originProvince: string
  imageUrl?: string | null
}

export interface SupplierBatchCard {
  id: number
  batchCode: string
  qrCode?: string | null
  grade: string
  size?: string | null
  quantity: number
  moq: number
  price: number
  status: string
  harvestDate?: string | null
  expiryDate?: string | null
  productUnit: string
  productName: string
  imageUrl?: string | null
}

export interface SupplierBatchDetail {
  id: number
  productId: number
  productName: string
  productUnit: string
  batchCode: string
  qrCode?: string | null
  harvestDate: string
  expiryDate?: string | null
  grade: string
  size?: string | null
  quantity: number
  price: number
  moq: number
  storageTemp?: string | null
  videoUrl?: string | null
  status: string
  imageUrls: string[]
  qcResult?: QcResult | null
  qcDocumentUrl?: string | null
  qcNotes?: string | null
}

export interface SupplierProductDetail {
  id: number
  supplierCompanyId: number
  categoryId: number
  categoryName: string
  name: string
  unit: string
  originProvince: string
  description?: string | null
  imageUrls: string[]
  certifications: SupplierCreateFlowResponse['certifications']
  batches: SupplierBatchCard[]
}

export interface UpdateProductRequest {
  product: CreateProductPayload
}

export interface UpdateBatchRequest {
  userId: number
  batch: CreateBatchPayload
}

export interface SupplierCreateFlowResponse {
  product: {
    id: number
    name: string
    unit: string
    categoryId: number
    categoryName: string
    originProvince: string
    description?: string | null
    imageUrl?: string | null
  }
  batch: {
    id: number
    batchCode: string
    qrCode: string
    harvestDate: string
    expiryDate?: string | null
    grade: string
    size?: string | null
    quantity: number
    price: number
    moq: number
    storageTemp?: string | null
    videoUrl?: string | null
    status: string
  }
  qc: {
    id: number
    result: QcResult
    documentUrl?: string | null
    notes?: string | null
  }
  certifications: Array<{
    id: number
    name: string
    documentUrl?: string | null
    issuedBy?: string | null
    issuedDate?: string | null
    expiryDate?: string | null
  }>
}
