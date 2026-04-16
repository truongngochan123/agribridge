export type BuyerMenuKey =
  | 'overview'
  | 'sourcing'
  | 'rfq'
  | 'orders'
  | 'branches'
  | 'delivery'
  | 'debt'
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

export type BuyerOrderRow = {
  id: string
  supplier: string
  product: string
  quantity: string
  branch: string
  value: string
  status: 'Đang giao' | 'Chờ xác nhận' | 'Hoàn thành'
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
