import type { BuyerOrderRow } from '../types/buyerDashboard'

export const buyerOrders: BuyerOrderRow[] = [
  {
    id: 'ORD-2024-101',
    supplier: 'Trang trại Biển Xanh',
    product: 'Tôm Sú Hữu Cơ',
    quantity: '150kg',
    branch: 'Chi nhánh Cầu Giấy',
    value: '42,750,000đ',
    status: 'Đang giao',
  },
  {
    id: 'ORD-2024-102',
    supplier: 'Công ty TNHH Đồng Tháp',
    product: 'Cá Tra Phi Lê',
    quantity: '200kg',
    branch: 'Kho trung tâm',
    value: '13,600,000đ',
    status: 'Chờ xác nhận',
  },
  {
    id: 'ORD-2024-103',
    supplier: 'Trang trại Biển Xanh',
    product: 'Tôm Thẻ Chân Trắng',
    quantity: '100kg',
    branch: 'Chi nhánh Quận 1',
    value: '19,500,000đ',
    status: 'Hoàn thành',
  },
  {
    id: 'ORD-2024-104',
    supplier: 'HTX Nông nghiệp Sóc Trăng',
    product: 'Gạo ST25',
    quantity: '1000kg',
    branch: 'Chi nhánh Tân Bình',
    value: '32,000,000đ',
    status: 'Đang giao',
  },
]
