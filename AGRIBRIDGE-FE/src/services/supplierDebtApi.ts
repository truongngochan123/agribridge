import { apiClient } from './apiClient'

export type DebtStatus = 'NORMAL' | 'DUE_SOON' | 'OVERDUE' | 'OVER_LIMIT' | 'BLOCKED'

export type SupplierDebtKpi = {
  id: string
  label: string
  value: number
  displayValue: string
}

export type SupplierDebtBuyer = {
  buyerId: number
  buyerName: string
  invoiceCount: number
  unpaidInvoiceCount: number
  overdueInvoiceCount: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  overdueAmount: number
  dueSoonAmount: number
  creditLimit: number
  usedCredit: number
  remainingCredit: number
  paymentTermDays?: number | null
  creditStatus?: string | null
  status: DebtStatus
  statusLabel: string
}

export type SupplierDebtInvoice = {
  invoiceId: number
  invoiceCode?: string | null
  displayInvoiceCode?: string | null
  invoiceNumber: string
  orderId: number
  orderCode?: string | null
  orderRef: string
  productName?: string | null
  quantity?: number | null
  unit?: string | null
  batchCode?: string | null
  createdAt?: string | null
  confirmedReceivedAt?: string | null
  dueDate?: string | null
  expectedDueDate?: string | null
  dueLabel?: string | null
  totalAmount: number
  adjustmentAmount?: number | null
  outstandingAmount?: number | null
  adjustedAmount: number
  paidAmount: number
  remainingAmount: number
  paymentPlanType?: 'DEPOSIT_50' | 'CREDIT_TERM' | 'PREPAID' | string | null
  paymentTermDays?: number | null
  status?: string | null
  statusLabel: string
  overdueDays: number
}

export type SupplierDebtPayment = {
  paymentId: number
  invoiceId?: number | null
  amount: number
  paymentDate?: string | null
  paymentMethod?: string | null
  note?: string | null
  confirmedBy?: string | null
}

export type SupplierDebtAdjustment = {
  adjustmentId: number
  invoiceId: number
  amount: number
  adjustmentType?: string | null
  description?: string | null
  createdAt?: string | null
}

export type SupplierDebtReminder = {
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

export type SupplierCreditLimit = {
  id?: number | null
  buyerId: number
  creditLimit: number
  paymentTermDays?: number | null
  status?: string | null
  note?: string | null
}

export type SupplierDebtOverview = {
  kpis: SupplierDebtKpi[]
  buyers: SupplierDebtBuyer[]
}

export type SupplierDebtBuyerDetail = {
  summary: SupplierDebtBuyer
  invoices: SupplierDebtInvoice[]
  payments: SupplierDebtPayment[]
  adjustments: SupplierDebtAdjustment[]
  reminders: SupplierDebtReminder[]
  creditLimit: SupplierCreditLimit
}

export async function fetchSupplierDebts(): Promise<SupplierDebtOverview> {
  const response = await apiClient.get('/api/supplier/debts')
  return response.data?.data ?? response.data
}

export async function fetchSupplierDebtBuyerDetail(buyerId: number): Promise<SupplierDebtBuyerDetail> {
  const response = await apiClient.get(`/api/supplier/debts/buyers/${buyerId}`)
  return response.data?.data ?? response.data
}

export async function saveSupplierCreditLimit(payload: {
  buyerId: number
  creditLimit: number
  paymentTermDays: number
  status: string
  note?: string
}): Promise<SupplierCreditLimit> {
  const response = await apiClient.put('/api/supplier/debts/credit-limits', payload)
  return response.data?.data ?? response.data
}

export async function createSupplierDebtPayment(payload: {
  buyerId: number
  amount: number
  paymentMethod: string
  paymentDate: string
  note?: string
  allocations: Array<{ invoiceId: number; amount: number }>
}): Promise<SupplierDebtBuyerDetail> {
  const response = await apiClient.post('/api/supplier/debts/payments', payload)
  return response.data?.data ?? response.data
}

export async function createSupplierDebtAdjustment(payload: {
  invoiceId: number
  amount: number
  adjustmentType: string
  description?: string
}): Promise<SupplierDebtBuyerDetail> {
  const response = await apiClient.post('/api/supplier/debts/adjustments', payload)
  return response.data?.data ?? response.data
}

export async function createSupplierDebtReminder(payload: {
  buyerId: number
  invoiceId: number
  amount?: number
  message?: string
  channel?: string
  sendSystemNotification?: boolean
  markOnBuyerDebtPage?: boolean
}): Promise<SupplierDebtBuyerDetail> {
  const response = await apiClient.post('/api/supplier/debts/reminders', payload)
  return response.data?.data ?? response.data
}
