import type { BuyerDebtSupplier, BuyerKpiCard } from '../types/buyerDashboard'

export const buyerDebtKpis: BuyerKpiCard[] = [
  { id: 'd1', label: 'Tổng phải trả', value: '1.5 tỷ' },
  { id: 'd2', label: 'Quá hạn', value: '180 tr' },
  { id: 'd3', label: 'Hạn mức còn lại', value: '3.5 tỷ' },
  { id: 'd4', label: 'Đã thanh toán tháng', value: '820 tr' },
]

export const buyerDebtSuppliers: BuyerDebtSupplier[] = [
  {
    id: 'ds1',
    supplier: 'Trang trại Biển Xanh',
    invoiceCount: '5 hóa đơn',
    totalDebt: '650 tr',
    overdue: '120 tr',
    limitUsage: 81,
    status: 'Quá hạn',
  },
  {
    id: 'ds2',
    supplier: 'Công ty TNHH Đồng Tháp',
    invoiceCount: '3 hóa đơn',
    totalDebt: '420 tr',
    overdue: '-',
    limitUsage: 84,
    status: 'Bình thường',
  },
  {
    id: 'ds3',
    supplier: 'HTX Nông Sản Lâm Đồng',
    invoiceCount: '4 hóa đơn',
    totalDebt: '280 tr',
    overdue: '60 tr',
    limitUsage: 70,
    status: 'Cảnh báo',
  },
]
