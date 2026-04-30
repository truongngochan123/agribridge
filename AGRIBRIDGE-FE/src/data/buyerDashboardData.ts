import type { BuyerAlertCard, BuyerKpiCard, BuyerMenuItem, BuyerOrderRow } from '../types/buyerDashboard'

export const buyerMenuItems: BuyerMenuItem[] = [
  { key: 'overview', label: 'Tổng quan', path: '/buyer/overview' },
  { key: 'sourcing', label: 'Tìm nguồn hàng', path: '/buyer/sourcing' },
  { key: 'rfq', label: 'RFQ & Báo giá', path: '/buyer/rfq' },
  { key: 'orders', label: 'Đơn hàng', path: '/buyer/orders' },
  { key: 'branches', label: 'Chi nhánh', path: '/buyer/branches' },
  { key: 'delivery', label: 'Theo dõi Giao hàng', path: '/buyer/delivery' },
  { key: 'debt', label: 'Công nợ', path: '/buyer/debt' },
  { key: 'market', label: 'Giá thị trường', path: '/buyer/market-price' },
]

export const buyerDashboardKpis: BuyerKpiCard[] = [
  { id: 'k1', label: 'Tổng đơn hàng', value: '156' },
  { id: 'k2', label: 'Đơn chờ xử lý', value: '12' },
  { id: 'k3', label: 'Công nợ phải trả', value: '580,000,000đ' },
  { id: 'k4', label: 'Sản phẩm theo dõi', value: '24' },
]

export const buyerDashboardAlerts: BuyerAlertCard[] = [
  { id: 'a1', title: 'Công nợ sắp đến hạn', value: '3 hóa đơn', tone: 'danger' },
  { id: 'a2', title: 'RFQ sắp hết hạn', value: '2 RFQ', tone: 'warning' },
  { id: 'a3', title: 'Shipment giao trễ', value: '1 đơn', tone: 'amber' },
  { id: 'a4', title: 'Giá giảm theo dõi', value: 'Cá Tra -2.1%', tone: 'info' },
]

export const buyerRecentOrders: BuyerOrderRow[] = [
  {
    id: 'ORD-2024-101',
    supplier: 'Trang trại Biển Xanh',
    product: 'Tôm Sú Hữu Cơ',
    quantity: '150kg',
    branch: 'Chi nhánh Cầu Giấy',
    value: '42,750,000đ',
    status: 'SHIPPING',
    subtotal: 42750000,
    totalAmount: 42750000,
    createdAt: '2024-01-15T08:00:00',
  },
  {
    id: 'ORD-2024-102',
    supplier: 'Công ty TNHH Đồng Tháp',
    product: 'Cá Tra Phi Lê',
    quantity: '200kg',
    branch: 'Kho trung tâm',
    value: '13,600,000đ',
    status: 'PENDING',
    subtotal: 13600000,
    totalAmount: 13600000,
    createdAt: '2024-01-16T10:15:00',
  },
  {
    id: 'ORD-2024-103',
    supplier: 'Trang trại Biển Xanh',
    product: 'Tôm Thẻ Chân Trắng',
    quantity: '100kg',
    branch: 'Chi nhánh Quận 1',
    value: '19,500,000đ',
    status: 'DELIVERED',
    subtotal: 19500000,
    totalAmount: 19500000,
    createdAt: '2024-01-12T09:00:00',
  },
  {
    id: 'ORD-2024-104',
    supplier: 'HTX Nông nghiệp Sóc Trăng',
    product: 'Gạo ST25',
    quantity: '1000kg',
    branch: 'Chi nhánh Tân Bình',
    value: '32,000,000đ',
    status: 'SHIPPING',
    subtotal: 32000000,
    totalAmount: 32000000,
    createdAt: '2024-01-18T07:30:00',
  },
]
