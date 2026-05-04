import { apiClient } from './apiClient'

export type DeliveryStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'SHIPPED'
  | 'SHIPPING'
  | 'IN_TRANSIT'
  | 'WAITING_CONFIRMATION'
  | 'DELIVERED'
  | 'INCIDENT'
  | 'FAILED'
  | 'CANCELLED'

export type BuyerDeliveryItem = {
  shipmentId: number
  id: string
  trackingCode?: string | null
  orderRef?: string | null
  supplierName: string
  productsText: string
  destination?: string | null
  branchId?: number | null
  branchName?: string | null
  driverName?: string | null
  driverPhone?: string | null
  vehicleInfo?: string | null
  carrierName?: string | null
  shippingFee?: number | null
  estimatedDeliveryAt?: string | null
  estimatedDeliveryTime?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
  confirmedReceivedAt?: string | null
  currentLocation?: string | null
  currentLat?: number | null
  currentLng?: number | null
  status: DeliveryStatus
  statusLabel: string
  progress: number
}

export type DeliveryTimelineEvent = {
  id: number
  status: string
  statusLabel: string
  location?: string | null
  description?: string | null
  eventTime: string
}

export type BuyerDeliveryDetail = {
  shipment: BuyerDeliveryItem
  products: Array<{
    productId: number
    productName: string
    batchId: number
    batchCode: string
    grade?: string | null
    size?: string | null
    quantity: number
    unit?: string | null
    price?: number | null
    subtotal?: number | null
  }>
  timeline: DeliveryTimelineEvent[]
  incidents: Array<{
    id: number
    incidentType: string
    description: string
    imageUrl?: string | null
    status: string
    createdAt: string
    resolvedAt?: string | null
    resolutionNote?: string | null
  }>
  complaints: Array<{
    id: number
    title?: string | null
    description: string
    status?: string | null
    severity?: string | null
    createdAt: string
    resolvedAt?: string | null
  }>
}

export type DeliveryFilters = {
  branchId?: string
  status?: string
  keyword?: string
  fromDate?: string
  toDate?: string
}

export async function fetchBuyerDeliveries(filters: DeliveryFilters): Promise<BuyerDeliveryItem[]> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
  const response = await apiClient.get('/api/buyer/deliveries', { params })
  return response.data?.data ?? response.data
}

export async function fetchBuyerDelivery(shipmentId: number): Promise<BuyerDeliveryDetail> {
  const response = await apiClient.get(`/api/buyer/deliveries/${shipmentId}`)
  return response.data?.data ?? response.data
}

export async function fetchBuyerDeliveryTimeline(shipmentId: number): Promise<DeliveryTimelineEvent[]> {
  const response = await apiClient.get(`/api/buyer/deliveries/${shipmentId}/timeline`)
  return response.data?.data ?? response.data
}

export async function confirmBuyerDeliveryReceived(
  shipmentId: number,
  payload: { condition: string; note?: string; evidenceImage?: string; confirmed: boolean },
): Promise<BuyerDeliveryDetail> {
  const response = await apiClient.post(`/api/buyer/deliveries/${shipmentId}/confirm-received`, payload)
  return response.data?.data ?? response.data
}

export async function createBuyerDeliveryIncident(
  shipmentId: number,
  payload: { incidentType: string; description: string; imageUrl?: string },
) {
  const response = await apiClient.post(`/api/buyer/deliveries/${shipmentId}/incidents`, payload)
  return response.data?.data ?? response.data
}
