export type BuyerMenuKey =
  | 'overview'
  | 'sourcing'
  | 'rfq'
  | 'orders'
  | 'branches'
  | 'delivery'
  | 'debt'
  | 'wallet'
  | 'market'

export type BuyerMenuItem = {
  key: BuyerMenuKey
  label: string
  path: string
}

export type BuyerKpiCard = {
  id: string
  label: string
  value: string
}

export type BuyerAlertCard = {
  id: string
  title: string
  value: string
  tone: 'danger' | 'warning' | 'amber' | 'info'
}

// ─── Order status mirrors OrderStatusEnum ─────────────────────────────────────
export type OrderStatus =
  | 'PENDING_SUPPLIER_CONFIRMATION'
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'PENDING_DEPOSIT'
  | 'DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM'
  | 'PAID_WAITING_SUPPLIER_CONFIRM'
  | 'SUPPLIER_CONFIRMED'
  | 'PREPARING'
  | 'READY_TO_SHIP'
  | 'CONFIRMED'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'WAITING_FINAL_PAYMENT'
  | 'WAITING_BUYER_CONFIRM'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'

export type OrderItemRow = {
  batchId: number
  batchCode: string
  productId: number
  productName: string
  grade?: string
  size?: string
  harvestDate?: string
  quantity: number
  unit: string
  price: number
  subtotal: number
}

export type BuyerOrderRow = {
  // ─── Identifiers ──────────────────────────────────────────────────────────
  id: string            // display code, e.g. ORD-2024-101
  orderId?: number      // DB numeric id

  // ─── Parties ──────────────────────────────────────────────────────────────
  supplier: string
  supplierCompanyId?: number
  buyerCompanyId?: number
  branch: string
  branchId?: number

  // ─── Reference ────────────────────────────────────────────────────────────
  quoteId?: number
  rfqCode?: string      // e.g. RFQ-2024-025

  // ─── Status ───────────────────────────────────────────────────────────────
  status: OrderStatus

  // ─── Items ────────────────────────────────────────────────────────────────
  /** Summary fields kept for backward compat */
  product: string
  quantity: string
  items?: OrderItemRow[]

  // ─── Financials ───────────────────────────────────────────────────────────
  subtotal: number
  shippingFee?: number
  totalAmount: number
  /** Display-ready string, e.g. "42,750,000đ" */
  value: string

  // ─── Payment ──────────────────────────────────────────────────────────────
  paymentMethod?: 'ESCROW_TRANSFER' | 'DEPOSIT_50' | 'CREDIT'
  depositRate?: number
  depositAmount?: number
  balanceAmount?: number

  // ─── Delivery address ─────────────────────────────────────────────────────
  deliveryName?: string
  deliveryPhone?: string
  deliveryProvince?: string
  deliveryDistrict?: string
  deliveryWard?: string
  deliveryAddress?: string

  // ─── Shipping provider ────────────────────────────────────────────────────
  shippingProviderCode?: string
  shippingProviderName?: string
  shippingServiceName?: string
  shippingPayer?: 'BUYER' | 'SUPPLIER' | 'NEGOTIATED'
  estimatedDeliveryTime?: string

  // ─── Tracking ─────────────────────────────────────────────────────────────
  trackingEvents?: { title: string; time: string; done: boolean }[]

  // ─── Invoice ──────────────────────────────────────────────────────────────
  invoiceCode?: string
  invoicePaidAmount?: number
  invoiceDueDate?: string
  invoiceStatus?: 'UNPAID' | 'PARTIAL' | 'PAID'

  // ─── Note ─────────────────────────────────────────────────────────────────
  note?: string

  // ─── Timestamps ───────────────────────────────────────────────────────────
  createdAt: string
}

export type BuyerProductLot = {
  id: string
  name: string
  supplier: string
  location: string
  grade: string
  lotCode: string
  price: string
  stock: string
  moq: string
  image: string
}

export type BuyerRfqCard = {
  id: string
  status: 'Đang nhận báo giá' | 'Đang so sánh'
  quoteCount: number
  createdAt: string
  deadline: string
  product: string
  quantity: string
  targetPrice: string
}

export type BuyerBranchCard = {
  id: string
  name: string
  address: string
  manager: string
  phone: string
  activeOrders: string
  monthlyVolume: string
}

export type BuyerShipment = {
  id: string
  status: 'Đang giao' | 'Đã giao' | 'Chuẩn bị'
  orderRef: string
  supplier: string
  product: string
  destination: string
  eta: string
  driver: string
  plate: string
  progress: number
}

export type BuyerDebtSupplier = {
  id: string
  supplier: string
  invoiceCount: string
  totalDebt: string
  overdue: string
  limitUsage: number
  status: 'Quá hạn' | 'Bình thường' | 'Cảnh báo'
}

export type BuyerMarketRow = {
  id: string
  product: string
  gradeSize: string
  currentPrice: string
  change: string
  changeType: 'up' | 'down'
  region: string
  source: string
  updatedAt: string
}

export type BuyerLotInfo = {
  lotCode: string
  harvestDate: string
  packingDate: string
  expiryDate: string
  farmingArea: string
  farm: string
  packaging: string
  storageTemp: string
}
