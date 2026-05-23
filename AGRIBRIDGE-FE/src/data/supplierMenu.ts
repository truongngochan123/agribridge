import type { SupplierMenuItem } from '../types/supplierDashboard'

export const supplierMenuItems: SupplierMenuItem[] = [
  { key: 'overview', label: 'Tổng quan', path: '/supplier/overview' },
  { key: 'products', label: 'Sản phẩm & Lô hàng', path: '/supplier/products' },
  { key: 'rfq', label: 'RFQ & Báo giá', path: '/supplier/rfq' },
  { key: 'orders', label: 'Đơn hàng', path: '/supplier/orders' },
  { key: 'delivery', label: 'Quản lý giao hàng', path: '/supplier/delivery' },
  { key: 'debt', label: 'Công nợ', path: '/supplier/debt' },
  { key: 'wallet', label: 'Ví số dư', path: '/supplier/wallet' },
  { key: 'reports', label: 'Báo cáo', path: '/supplier/reports' },
]
