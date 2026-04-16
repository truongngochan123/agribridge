export type QcResult = 'PASS' | 'FAIL'

export interface PublicBatchTraceResponse {
  product: {
    id: number
    name: string
    category: string
    originProvince: string
    description?: string | null
    unit: string
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
  qc?: {
    result: QcResult
    documentUrl?: string | null
    notes?: string | null
  } | null
  certifications: Array<{
    name: string
    documentUrl?: string | null
    issuedBy?: string | null
    issuedDate?: string | null
    expiryDate?: string | null
  }>
}
