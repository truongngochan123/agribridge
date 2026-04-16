import type { MarketPrice } from '../types/home'

export const fallbackMarketPrices: MarketPrice[] = [
  {
    id: 1,
    name: 'Tôm Sú Hữu Cơ',
    image: '/images/shrimp.jpg',
    price: '285,000',
    unit: 'kg',
    region: 'Cà Mau',
    trend: '+3.2%',
  },
  {
    id: 2,
    name: 'Cá Tra Phi Lê',
    image: '/images/fish-fillet.jpg',
    price: '68,000',
    unit: 'kg',
    region: 'Đồng Tháp',
    trend: '+1.4%',
  },
  {
    id: 3,
    name: 'Gạo ST25',
    image: '/images/rice.jpg',
    price: '32,000',
    unit: 'kg',
    region: 'Sóc Trăng',
    trend: '+0.8%',
  },
  {
    id: 4,
    name: 'Thanh Long Ruột Đỏ',
    image: '/images/dragon-fruit.jpg',
    price: '18,000',
    unit: 'kg',
    region: 'Bình Thuận',
    trend: '-1.1%',
  },
]
