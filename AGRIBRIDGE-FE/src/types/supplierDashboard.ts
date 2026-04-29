export type SupplierMenuKey =
  | 'overview'
  | 'products'
  | 'rfq'
  | 'orders'
  | 'delivery'
  | 'debt'
  | 'reports'

export interface SupplierMenuItem {
  key: SupplierMenuKey
  label: string
  path: string
}

export interface HeaderSummaryCard {
  label: string
  value: string
  subLabel?: string
  trend?: string
}

export interface AlertBanner {
  id: string
  message: string
}

export interface MonthlyRevenueBar {
  month: string
  value: number
}

export interface ActivityItem {
  id: string
  title: string
  meta: string
  time: string
}

export interface ProductLotCard {
  id: string
  name: string
  lotCode: string
  grade: string
  size: string
  stock: string
  moq: string
  price: string
  status: 'Con hàng' | 'Sắp hết'
  image: string
}

export interface RfqItem {
  id: string
  customer: string
  product: string
  category: string
  quantity: string
  unit: string
  targetPrice: string
  supplierQuotedPrice: string
  supplierQuotedQuantity: string
  dueDate: string
  deliveryDate: string
  province: string
  description: string
  quoteCount: number
  supplierQuoteStatus: 'Chờ báo giá' | 'Đã báo giá' | 'Chấp nhận' | 'Từ chối' | 'Đã hủy'
  supplierDeliveryDays: number | null
  supplierQuoteNote: string
  hasExistingQuote: boolean
  quoteId?: number | null
  quoteStatus?: 'PENDING' | 'ACCEPTED' | 'APPROVED' | 'REJECTED' | 'SENT' | 'DRAFT' | string | null
  orderId?: number | null
  status: 'Chờ báo giá' | 'Đã báo giá' | 'Chấp nhận' | 'Từ chối' | 'Đã hủy'
}

export interface OrderItem {
  id: string
  customer: string
  branch: string
  product: string
  quantity: string
  value: string
  status: 'Chờ xác nhận' | 'Đã xác nhận' | 'Đang giao' | 'Hoàn thành' | 'Đã hủy'
  orderDate: string
}

export interface ShipmentItem {
  id: string
  orderRef: string
  route: string
  driver: string
  phone: string
  eta: string
  cargo: string
  progress: number
  status: 'Chuẩn bị' | 'Đã rời kho' | 'Đang vận chuyển' | 'Chờ buyer xác nhận' | 'Đã giao' | 'Đã hủy' | 'Sự cố' | string
  // Extended real-data fields (no more hard-code)
  shippingFee?: string
  receiverName?: string
  receiverPhone?: string
  receiverAddress?: string
  providerName?: string
  serviceName?: string
  estimatedDeliveryTime?: string
  createdAt?: string
  rawOrderId?: number | null
}

export interface DebtCustomerItem {
  customer: string
  cycle: string
  terms: string
  totalDebt: string
  overdueDebt: string
  creditLimit: string
  status: 'Tốt' | 'Cảnh báo' | 'Quá hạn'
}

export interface SupplierDashboardPayload {
  overviewCards: HeaderSummaryCard[]
  monthlyRevenue: MonthlyRevenueBar[]
  recentActivities: ActivityItem[]
  productLots: ProductLotCard[]
  rfqItems: RfqItem[]
  orders: OrderItem[]
  shipments: ShipmentItem[]
  debtSummaryCards: HeaderSummaryCard[]
  debtCustomers: DebtCustomerItem[]
}
