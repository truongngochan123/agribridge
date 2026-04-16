import { apiClient } from './apiClient'
import type { SupplierDashboardPayload } from '../types/supplierDashboard'
import type {
  CategoryOption,
  CreateProductOnlyRequest,
  CreateBatchForProductRequest,
  CreateProductWithFirstBatchRequest,
  MetadataListPayload,
  SupplierBatchCard,
  SupplierBatchDetail,
  SupplierCreateFlowResponse,
  SupplierProductDetail,
  SupplierProductOption,
  UpdateBatchRequest,
  UpdateProductRequest,
} from '../types/supplierCreateFlow'
import type { PublicBatchTraceResponse } from '../types/supplierTrace'

let dashboardCache: SupplierDashboardPayload | null = null

const EMPTY_DASHBOARD: SupplierDashboardPayload = {
  overviewCards: [],
  monthlyRevenue: [],
  recentActivities: [],
  productLots: [],
  rfqItems: [],
  orders: [],
  shipments: [],
  debtSummaryCards: [],
  debtCustomers: [],
}

export async function fetchSupplierDashboard(forceRefresh = false): Promise<SupplierDashboardPayload> {
  if (!forceRefresh && dashboardCache) {
    return dashboardCache
  }

  const companyId = sessionStorage.getItem('agribridge.auth.companyId')
  if (!companyId) {
    dashboardCache = EMPTY_DASHBOARD
    return dashboardCache
  }

  const response = await apiClient.get<SupplierDashboardPayload>('/api/supplier/dashboard', {
    params: { companyId: Number(companyId) },
  })

  dashboardCache = response.data
  return response.data
}

export function clearSupplierDashboardCache(): void {
  dashboardCache = null
}

export async function fetchSupplierProducts(companyId: number): Promise<SupplierProductOption[]> {
  const response = await apiClient.get<SupplierProductOption[]>('/api/supplier/products', {
    params: { companyId },
  })
  return response.data
}

export async function createProductWithFirstBatch(
  payload: CreateProductWithFirstBatchRequest,
): Promise<SupplierCreateFlowResponse> {
  const response = await apiClient.post<SupplierCreateFlowResponse>('/api/supplier/products/with-first-batch', payload)
  clearSupplierDashboardCache()
  return response.data
}

export async function createProductOnly(payload: CreateProductOnlyRequest): Promise<SupplierCreateFlowResponse> {
  const response = await apiClient.post<SupplierCreateFlowResponse>('/api/supplier/products', payload)
  clearSupplierDashboardCache()
  return response.data
}

export async function createBatchForExistingProduct(
  payload: CreateBatchForProductRequest,
): Promise<SupplierCreateFlowResponse> {
  const response = await apiClient.post<SupplierCreateFlowResponse>('/api/supplier/batches', payload)
  clearSupplierDashboardCache()
  return response.data
}

export async function getSupplierProductDetail(productId: number): Promise<SupplierProductDetail> {
  const response = await apiClient.get<SupplierProductDetail>(`/api/supplier/products/${productId}`)
  return response.data
}

export async function updateSupplierProduct(
  productId: number,
  payload: UpdateProductRequest,
): Promise<SupplierCreateFlowResponse> {
  const response = await apiClient.put<SupplierCreateFlowResponse>(`/api/supplier/products/${productId}`, payload)
  clearSupplierDashboardCache()
  return response.data
}

export async function deleteSupplierProduct(productId: number): Promise<void> {
  await apiClient.delete(`/api/supplier/products/${productId}`)
  clearSupplierDashboardCache()
}

export async function getProductBatches(productId: number): Promise<SupplierBatchCard[]> {
  const response = await apiClient.get<SupplierBatchCard[]>(`/api/supplier/products/${productId}/batches`)
  return response.data
}

export async function getSupplierBatchDetail(batchId: number): Promise<SupplierBatchDetail> {
  const response = await apiClient.get<SupplierBatchDetail>(`/api/supplier/batches/${batchId}`)
  return response.data
}

export async function updateSupplierBatch(
  batchId: number,
  payload: UpdateBatchRequest,
): Promise<SupplierCreateFlowResponse> {
  const response = await apiClient.put<SupplierCreateFlowResponse>(`/api/supplier/batches/${batchId}`, payload)
  clearSupplierDashboardCache()
  return response.data
}

export async function deleteSupplierBatch(batchId: number): Promise<void> {
  await apiClient.delete(`/api/supplier/batches/${batchId}`)
  clearSupplierDashboardCache()
}

export async function fetchMetadataUnits(): Promise<string[]> {
  const response = await apiClient.get<MetadataListPayload>('/api/public/metadata/units')
  return response.data.items
}

export async function fetchMetadataProvinces(): Promise<string[]> {
  const response = await apiClient.get<MetadataListPayload>('/api/public/metadata/provinces')
  return response.data.items
}

export async function fetchCertificationNames(): Promise<string[]> {
  const response = await apiClient.get<MetadataListPayload>('/api/public/metadata/certification-names')
  return response.data.items
}

export async function fetchCategories(): Promise<CategoryOption[]> {
  const response = await apiClient.get<CategoryOption[]>('/api/public/metadata/categories')
  return response.data
}

export async function fetchPublicBatchTrace(batchId: number): Promise<PublicBatchTraceResponse> {
  const response = await apiClient.get<PublicBatchTraceResponse>(`/api/public/batch/${batchId}`)
  return response.data
}
