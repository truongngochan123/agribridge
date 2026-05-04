import { apiClient } from './apiClient'

export type BuyerBranchSummary = {
  rawId: number
  id: string
  name: string
  province: string
  district?: string | null
  ward?: string | null
  address: string
  deliveryAddress?: string | null
  managerName?: string | null
  phone?: string | null
  isActive: boolean
  activeOrders: string
  activeOrderCount: number
  monthlyOrderCount: number
  monthlyTotalAmount: number
  monthlyVolume: string
  staffCount: number
  openRfqCount: number
  createdAt: string
  updatedAt?: string | null
}

export type BuyerBranchPayload = {
  name: string
  province: string
  district?: string
  ward?: string
  address: string
  deliveryAddress?: string
  managerName?: string
  phone?: string
  isActive: boolean
}

export type BuyerBranchDetail = {
  branch: BuyerBranchSummary
  recentOrders: Array<{
    rawId: number
    id: string
    status: string
    totalAmount: number
    createdAt: string
  }>
  recentRfqs: Array<{
    rawId: number
    id: string
    title: string
    status: string
    quantity: number
    unit: string
    deliveryDate?: string | null
    createdAt: string
  }>
  staff: Array<{
    id: number
    fullName: string
    phone: string
    email?: string | null
    role: string
    status: string
    createdAt: string
  }>
}

export async function fetchBuyerBranches(): Promise<BuyerBranchSummary[]> {
  const response = await apiClient.get('/api/buyer/branches')
  return response.data?.data ?? response.data
}

export async function fetchBuyerBranch(id: number): Promise<BuyerBranchDetail> {
  const response = await apiClient.get(`/api/buyer/branches/${id}`)
  return response.data?.data ?? response.data
}

export async function createBuyerBranch(payload: BuyerBranchPayload): Promise<BuyerBranchSummary> {
  const response = await apiClient.post('/api/buyer/branches', payload)
  return response.data?.data ?? response.data
}

export async function updateBuyerBranch(id: number, payload: BuyerBranchPayload): Promise<BuyerBranchSummary> {
  const response = await apiClient.put(`/api/buyer/branches/${id}`, payload)
  return response.data?.data ?? response.data
}

export async function updateBuyerBranchStatus(id: number, isActive: boolean): Promise<BuyerBranchSummary> {
  const response = await apiClient.patch(`/api/buyer/branches/${id}/status`, { isActive })
  return response.data?.data ?? response.data
}

export async function deleteBuyerBranch(id: number): Promise<void> {
  await apiClient.delete(`/api/buyer/branches/${id}`)
}
