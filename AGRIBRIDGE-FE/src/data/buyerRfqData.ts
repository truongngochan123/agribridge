import type { BuyerRfqCard } from '../types/buyerDashboard'

export const buyerRfqCards: BuyerRfqCard[] = [
  {
    id: 'RFQ-2024-025',
    status: 'Đang nhận báo giá',
    quoteCount: 5,
    createdAt: '2024-01-15',
    deadline: '2024-01-20',
    product: 'Tôm Sú Hữu Cơ',
    quantity: '300kg',
    targetPrice: '270,000 - 290,000đ',
  },
  {
    id: 'RFQ-2024-026',
    status: 'Đang so sánh',
    quoteCount: 8,
    createdAt: '2024-01-14',
    deadline: '2024-01-18',
    product: 'Gạo ST25',
    quantity: '2000kg',
    targetPrice: '30,000 - 33,000đ',
  },
  {
    id: 'RFQ-2024-027',
    status: 'Đang nhận báo giá',
    quoteCount: 3,
    createdAt: '2024-01-15',
    deadline: '2024-01-22',
    product: 'Thanh Long Ruột Đỏ',
    quantity: '500kg',
    targetPrice: '16,000 - 19,000đ',
  },
]
