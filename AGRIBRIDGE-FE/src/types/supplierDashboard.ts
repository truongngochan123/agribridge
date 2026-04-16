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
  quantity: string
  targetPrice: string
  dueDate: string
  status: 'Chờ báo giá' | 'Đã báo giá' | 'Chấp nhận'
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
  status: 'Chuẩn bị' | 'Đã lấy hàng' | 'Đang vận chuyển' | 'Đã giao' | 'Sự cố'
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
