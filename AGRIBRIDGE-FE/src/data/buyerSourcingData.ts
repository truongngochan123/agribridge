import type { BuyerProductLot } from '../types/buyerDashboard'

export const buyerSourcingLots: BuyerProductLot[] = [
  {
    id: 'lot-1',
    name: 'Tôm Sú Hữu Cơ',
    supplier: 'Trang trại Biển Xanh',
    location: 'Cà Mau',
    grade: 'A+',
    lotCode: 'LOT-1',
    price: '285,000đ',
    stock: '2,500 kg',
    moq: '50kg',
    image: '/images/shrimp.jpg',
  },
  {
    id: 'lot-2',
    name: 'Cá Tra Phi Lê',
    supplier: 'Công ty TNHH Đồng Tháp',
    location: 'Đồng Tháp',
    grade: 'A',
    lotCode: 'LOT-2',
    price: '68,000đ',
    stock: '1,800 kg',
    moq: '100kg',
    image: '/images/fish-fillet.jpg',
  },
  {
    id: 'lot-3',
    name: 'Gạo ST25',
    supplier: 'HTX Nông nghiệp Sóc Trăng',
    location: 'Sóc Trăng',
    grade: 'Premium',
    lotCode: 'LOT-3',
    price: '32,000đ',
    stock: '5,000 kg',
    moq: '500kg',
    image: '/images/rice.jpg',
  },
]

export const sourcingPriceRanges = ['Dưới 50.000đ', '50.000 - 100.000đ', '100.000 - 200.000đ', 'Trên 200.000đ']
