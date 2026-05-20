import { apiClient } from './apiClient'
import { dispatchStateSync } from './stateSyncService'

export type DeliveryStatus =
  | 'PENDING'
  | 'WAITING_PICKUP'
  | 'PICKED_UP'
  | 'PREPARING'
  | 'SHIPPED'
  | 'SHIPPING'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
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
  receiverName?: string | null
  receiverPhone?: string | null
  deliveryAddress?: string | null
  buyerName?: string | null
  buyerPhone?: string | null
  branchContactName?: string | null
  branchPhone?: string | null
  branchAddress?: string | null
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
    batchUrl?: string | null
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
    missingQuantity?: number | null
    damagedQuantity?: number | null
    updateNote?: string | null
    evidenceUrls?: string[] | null
    updatedAt?: string | null
    supplierResponse?: string | null
    supplierEvidenceUrls?: string[] | null
    proposedResolution?: string | null
    resolutionType?: string | null
    buyerActionRequiredAt?: string | null
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
  paymentDue?: {
    invoiceId: number
    invoiceCode?: string | null
    displayInvoiceCode?: string | null
    orderId: number
    orderCode?: string | null
    supplierName?: string | null
    productName?: string | null
    quantity?: number | null
    unit?: string | null
    totalAmount?: number | null
    paidAmount?: number | null
    remainingAmount: number
    dueDate?: string | null
    transferContent?: string | null
    paymentMethod?: 'DEPOSIT_50' | 'CREDIT' | 'ESCROW_TRANSFER' | string | null
  } | null
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
  const data = response.data?.data ?? response.data
  dispatchStateSync(['DELIVERY', 'ORDER', 'PAYMENT', 'DEBT', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-delivery:confirm-received',
    entityId: shipmentId,
  })
  return data
}

export async function createBuyerDeliveryIncident(
  shipmentId: number,
  payload: {
    incidentType: string
    description: string
    imageUrl?: string
    evidenceUrls?: string[]
    missingQuantity?: number
    damagedQuantity?: number
  },
) {
  const response = await apiClient.post(`/api/buyer/deliveries/${shipmentId}/incidents`, payload)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['DELIVERY', 'ORDER', 'COMPLAINT', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-delivery:create-incident',
    entityId: shipmentId,
  })
  return data
}

export async function updateBuyerDeliveryIncident(
  shipmentId: number,
  incidentId: number,
  payload: {
    action?: 'ACCEPT_RESOLUTION' | 'REJECT_RESOLUTION' | 'REQUEST_CONTINUE' | 'ESCALATE'
    note?: string
    missingQuantity?: number
    damagedQuantity?: number
    imageUrl?: string
    evidenceUrls?: string[]
  },
) {
  const response = await apiClient.patch(`/api/buyer/deliveries/${shipmentId}/incidents/${incidentId}`, payload)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['DELIVERY', 'ORDER', 'COMPLAINT', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-delivery:update-incident',
    entityId: shipmentId,
  })
  return data
}
