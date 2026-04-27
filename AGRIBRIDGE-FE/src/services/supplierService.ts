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

export interface CreateSupplierQuoteRequest {
  supplierCompanyId: number
  batchId?: number | null
  price: number
  quantity: number
  deliveryDays?: number
  note?: string
  status?: 'PENDING'
}

export interface SupplierQuoteContextBatch {
  id: number
  productId: number
  quantity: number
  unit: string | null
  price: number
  grade: string | null
  size: string | null
  harvestDate: string | null
  expiryDate: string | null
  storageTemp: string | null
  status: string | null
}

export interface SupplierQuoteContext {
  rfq: {
    id: number
    buyerCompanyId: number
    productId: number | null
    categoryId: number | null
    quantity: number
    unit: string | null
    deliveryDate: string | null
    province: string | null
    description: string | null
    expiredAt: string | null
    status: string | null
  }
  product: {
    id: number
    name: string
    categoryId: number | null
    unit: string | null
  } | null
  batches: SupplierQuoteContextBatch[]
}

export interface RejectSupplierRfqRequest {
  supplierCompanyId: number
  note?: string
}

export type SupplierOrderStatusCode = 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED'
export type SupplierShipmentStatusCode =
  | 'PENDING'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'WAITING_CONFIRMATION'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED'
  | 'PREPARING'
  | 'SHIPPING'

export type SupplierOrderAction =
  | 'VIEW_DETAIL'
  | 'CONFIRM_ORDER'
  | 'CANCEL_ORDER'
  | 'CREATE_SHIPMENT'
  | 'START_SHIPPING'
  | 'MARK_IN_TRANSIT'
  | 'MARK_ARRIVED'
  | 'REPORT_INCIDENT'
  | 'VIEW_SHIPMENT'

export interface SupplierOrderRow {
  id: string
  rawId: number
  customer: string
  branch: string
  product: string
  items: SupplierOrderItemSummary[]
  quantity: string
  value: string
  status: string
  statusCode: SupplierOrderStatusCode
  shipment: SupplierShipmentSummary | null
  shipmentStatus: string
  shipmentStatusCode: SupplierShipmentStatusCode | null
  availableActions: SupplierOrderAction[]
  orderDate: string
}

export interface SupplierOrderItemSummary {
  id: number
  batchId: number | null
  batchCode: string
  product: string
  quantity: string
  unit: string
  grade: string
  size: string
  price: string
  harvestDate: string
  expiryDate: string
}

export interface SupplierShipmentSummary {
  id: number
  status: string
  statusCode: SupplierShipmentStatusCode
  trackingCode: string
  carrierName: string
  shippingMethod: string
  driverName: string
  driverPhone: string
  vehicleInfo: string
  shippingFee: string
  shippedAt: string
  deliveredAt: string
}

export interface SupplierOrderDetailItem {
  id: number
  batchId: number | null
  batchCode: string
  product: string
  quantity: string
  unit: string
  grade: string
  size: string
  harvestDate: string
  expiryDate: string
  price: string
  lineTotal: string
}

export interface SupplierShipmentEvent {
  id: number
  status: string
  description: string
  location: string
  eventTime: string
}

export interface SupplierOrderDetail extends SupplierOrderRow {
  customerPhone: string
  customerEmail: string
  deliveryAddress: string
  deliveryProvince: string
  note: string
  shipmentEvents: SupplierShipmentEvent[]
  items: SupplierOrderDetailItem[]
}

export interface CreateSupplierShipmentRequest {
  carrierName?: string
  shippingMethod?: string
  driverName?: string
  driverPhone?: string
  vehicleInfo?: string
  shippingFee?: number
  trackingCode?: string
  note?: string
}

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

export async function createSupplierQuote(rfqId: number, payload: CreateSupplierQuoteRequest): Promise<void> {
  await apiClient.post(`/api/supplier/rfqs/${rfqId}/quote`, payload)
  clearSupplierDashboardCache()
}

export async function fetchSupplierQuoteContext(rfqId: number): Promise<SupplierQuoteContext> {
  const response = await apiClient.get<SupplierQuoteContext>(`/api/supplier/rfqs/${rfqId}/quote-context`)
  return response.data
}

export async function rejectSupplierRfq(rfqId: number, payload: RejectSupplierRfqRequest): Promise<void> {
  await apiClient.post(`/api/supplier/rfqs/${rfqId}/reject`, payload)
  clearSupplierDashboardCache()
}

export async function fetchSupplierOrders(companyId: number): Promise<SupplierOrderRow[]> {
  const response = await apiClient.get<SupplierOrderRow[]>('/api/supplier/orders', {
    params: { companyId },
  })
  return response.data
}

export async function getSupplierOrderDetail(companyId: number, orderId: number): Promise<SupplierOrderDetail> {
  const response = await apiClient.get<SupplierOrderDetail>(`/api/supplier/orders/${orderId}`, {
    params: { companyId },
  })
  return response.data
}

export async function updateSupplierOrderStatus(
  companyId: number,
  orderId: number,
  status: SupplierOrderStatusCode,
): Promise<SupplierOrderRow> {
  const response = await apiClient.patch<SupplierOrderRow>(
    `/api/supplier/orders/${orderId}/status`,
    { status },
    { params: { companyId } },
  )
  clearSupplierDashboardCache()
  return response.data
}

export async function createSupplierShipment(
  companyId: number,
  orderId: number,
  payload: CreateSupplierShipmentRequest,
): Promise<SupplierOrderRow> {
  const response = await apiClient.post<SupplierOrderRow>(
    `/api/supplier/orders/${orderId}/shipments`,
    payload,
    { params: { companyId } },
  )
  clearSupplierDashboardCache()
  return response.data
}

export async function updateSupplierShipmentStatus(
  companyId: number,
  orderId: number,
  status: SupplierShipmentStatusCode,
): Promise<SupplierOrderRow> {
  const response = await apiClient.patch<SupplierOrderRow>(
    `/api/supplier/orders/${orderId}/shipment/status`,
    { status },
    { params: { companyId } },
  )
  clearSupplierDashboardCache()
  return response.data
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
