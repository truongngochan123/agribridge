import type { BuyerBranchCard } from '../types/buyerDashboard'

export const buyerBranches: BuyerBranchCard[] = [
  {
    id: 'b1',
    name: 'Chi nhánh Cầu Giấy',
    address: '123 Đường Cầu Giấy, Hà Nội',
    manager: 'Nguyễn Văn A',
    phone: '0912345678',
    activeOrders: '5 đơn đang xử lý',
    monthlyVolume: '450,000,000đ',
  },
  {
    id: 'b2',
    name: 'Chi nhánh Quận 1',
    address: '456 Đường Nguyễn Huệ, TP.HCM',
    manager: 'Trần Thị B',
    phone: '0987654321',
    activeOrders: '8 đơn đang xử lý',
    monthlyVolume: '680,000,000đ',
  },
  {
    id: 'b3',
    name: 'Chi nhánh Tân Bình',
    address: '789 Đường Cộng Hòa, TP.HCM',
    manager: 'Lê Văn C',
    phone: '0901234567',
    activeOrders: '3 đơn đang xử lý',
    monthlyVolume: '320,000,000đ',
  },
]
