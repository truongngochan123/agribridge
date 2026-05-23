import { apiClient } from './apiClient'
import { dispatchStateSync } from './stateSyncService'

export type WalletSummary = {
  companyId: number
  availableBalance?: number | null
  pendingBalance?: number | null
  totalEarned?: number | null
  totalWithdrawn?: number | null
  buyerEscrowHeld?: number | null
  buyerOutstanding?: number | null
  withdrawals?: WithdrawalItem[]
}

export type WalletLedgerItem = {
  id: number
  entryType: string
  amount: number
  balanceAfter: number
  orderId?: number | null
  paymentId?: number | null
  withdrawalRequestId?: number | null
  description?: string | null
  createdAt: string
}

export type WithdrawalItem = {
  id: number
  supplierCompanyId: number
  supplierName?: string | null
  amount: number
  feeAmount?: number | null
  payoutAmount?: number | null
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  note?: string | null
  status: string
  requestedAt: string
  reviewedAt?: string | null
  paidAt?: string | null
  adminNote?: string | null
}

export type WithdrawalRequest = {
  amount: number
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
  note?: string
}

export async function fetchSupplierWallet(): Promise<WalletSummary> {
  const response = await apiClient.get('/api/supplier/wallet')
  return response.data?.data ?? response.data
}

export async function fetchSupplierWalletLedger(): Promise<WalletLedgerItem[]> {
  const response = await apiClient.get('/api/supplier/wallet/ledger')
  return response.data?.data ?? response.data
}

export async function createSupplierWithdrawal(payload: WithdrawalRequest): Promise<WithdrawalItem> {
  const response = await apiClient.post('/api/supplier/wallet/withdrawals', payload)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['PAYMENT', 'DEBT', 'DASHBOARD'], { source: 'supplier-wallet:withdrawal-create', entityId: data?.id })
  return data
}

export async function fetchAdminWithdrawals(): Promise<WithdrawalItem[]> {
  const response = await apiClient.get('/api/admin/withdrawals')
  return response.data?.data ?? response.data
}

export async function approveAdminWithdrawal(id: number, note?: string): Promise<WithdrawalItem> {
  const response = await apiClient.post(`/api/admin/withdrawals/${id}/approve`, { note })
  return response.data?.data ?? response.data
}

export async function rejectAdminWithdrawal(id: number, note?: string): Promise<WithdrawalItem> {
  const response = await apiClient.post(`/api/admin/withdrawals/${id}/reject`, { note })
  return response.data?.data ?? response.data
}

export async function markAdminWithdrawalPaid(id: number, note?: string): Promise<WithdrawalItem> {
  const response = await apiClient.post(`/api/admin/withdrawals/${id}/mark-paid`, { note })
  return response.data?.data ?? response.data
}
