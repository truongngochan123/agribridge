import { apiClient } from './apiClient'
import { dispatchStateSync } from './stateSyncService'

export type BuyerDebtKpi = {
  id: string
  label: string
  value: number
  displayValue: string
}

export type BuyerDebtSupplier = {
  supplierId: number
  supplierName: string
  invoiceCount: number
  unpaidInvoiceCount: number
  overdueInvoiceCount: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  overdueAmount: number
  dueSoonAmount: number
  dueSoonInvoiceCount: number
  creditLimit: number
  paymentTermDays?: number | null
  limitUsage: number
  isBlocked: boolean
  blockedReason?: string | null
  creditStatus?: string | null
  status: 'OVERDUE' | 'WARNING' | 'BLOCKED' | 'NORMAL'
  statusLabel: string
}

export type BuyerDebtInvoice = {
  invoiceId: number
  invoiceNumber: string
  orderId: number
  orderRef: string
  branchId?: number | null
  branchName?: string | null
  productName?: string | null
  quantity?: number | null
  unit?: string | null
  createdAt: string
  confirmedReceivedAt?: string | null
  dueDate?: string | null
  dueLabel?: string | null
  totalAmount: number
  adjustedAmount: number
  paidAmount: number
  remainingAmount: number
  paymentPlanType?: 'DEPOSIT_50' | 'CREDIT_TERM' | 'PREPAID' | string | null
  paymentTermDays?: number | null
  status?: string | null
  statusLabel: string
  overdueDays: number
}

export type BuyerDebtPayment = {
  paymentId: number
  invoiceId: number
  amount: number
  paymentDate: string
  paymentMethod?: string | null
  note?: string | null
  confirmedBy?: string | null
}

export type BuyerDebtAdjustment = {
  adjustmentId: number
  invoiceId: number
  amount: number
  adjustmentType?: string | null
  description?: string | null
  createdAt: string
}

export type BuyerDebtReminder = {
  reminderId: number
  invoiceId?: number | null
  invoiceNumber?: string | null
  orderId?: number | null
  orderCode?: string | null
  productName?: string | null
  quantity?: number | null
  unit?: string | null
  dueLabel?: string | null
  amount: number
  message?: string | null
  channel?: string | null
  status?: string | null
  senderName?: string | null
  sentAt?: string | null
  createdAt?: string | null
}

export type BuyerDebtOverview = {
  kpis: BuyerDebtKpi[]
  suppliers: BuyerDebtSupplier[]
}

export type BuyerDebtSupplierDetail = {
  summary: BuyerDebtSupplier
  invoices: BuyerDebtInvoice[]
  payments: BuyerDebtPayment[]
  adjustments: BuyerDebtAdjustment[]
  reminders: BuyerDebtReminder[]
}

export type BuyerDebtPaymentPayload = {
  invoiceId: number
  amount: number
  paymentMethod: string
  paymentDate: string
  note?: string
}

export async function fetchBuyerDebts(): Promise<BuyerDebtOverview> {
  const response = await apiClient.get('/api/buyer/debts')
  return response.data?.data ?? response.data
}

export async function fetchBuyerDebtSupplierDetail(supplierId: number): Promise<BuyerDebtSupplierDetail> {
  const response = await apiClient.get(`/api/buyer/debts/suppliers/${supplierId}`)
  return response.data?.data ?? response.data
}

export async function createBuyerDebtPayment(payload: BuyerDebtPaymentPayload) {
  const response = await apiClient.post('/api/buyer/debts/payments', payload)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['DEBT', 'PAYMENT', 'ORDER', 'DELIVERY', 'DASHBOARD', 'NOTIFICATION'], {
    source: 'buyer-debt:create-payment',
    entityId: payload.invoiceId,
  })
  return data
}

export async function exportBuyerDebts(params: { supplierId?: number; status?: string; fromDate?: string; toDate?: string } = {}) {
  const response = await apiClient.get('/api/buyer/debts/export', {
    params: Object.fromEntries(Object.entries(params).filter(([, value]) => value && value !== 'all')),
    responseType: 'blob',
  })
  return response.data as Blob
}
