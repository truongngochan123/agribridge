import { apiClient } from './apiClient'
import { dispatchStateSync } from './stateSyncService'

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

export type BranchStaffMember = BuyerBranchDetail['staff'][number]

export type BranchEmployeePayload = {
  fullName: string
  email: string
  phone: string
  temporaryPassword: string
  role: string
  status: string
  inviteOnly?: boolean
}

export type BranchEmployeeAssignPayload = {
  userId: number
  role: string
  status: string
}

export type BranchEmployeeAvailability = {
  phoneTaken: boolean
  emailTaken: boolean
}

export async function fetchBuyerBranches(): Promise<BuyerBranchSummary[]> {
  const response = await apiClient.get('/api/buyer/branches')
  return response.data?.data ?? response.data
}

export async function fetchBuyerBranch(id: number): Promise<BuyerBranchDetail> {
  const response = await apiClient.get(`/api/buyer/branches/${id}`)
  return response.data?.data ?? response.data
}

export async function fetchBranchEmployeeCandidates(branchId: number, search = ''): Promise<BranchStaffMember[]> {
  const response = await apiClient.get(`/api/buyer/branches/${branchId}/employees/candidates`, {
    params: { search },
  })
  return response.data?.data ?? response.data
}

export async function checkBranchEmployeeAvailability(email?: string, phone?: string): Promise<BranchEmployeeAvailability> {
  const response = await apiClient.get('/api/buyer/branches/employees/availability', {
    params: { email, phone },
  })
  return response.data?.data ?? response.data
}

export async function createBranchEmployee(branchId: number, payload: BranchEmployeePayload): Promise<BranchStaffMember> {
  const response = await apiClient.post(`/api/buyer/branches/${branchId}/employees`, payload)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['BRANCH', 'ORDER', 'RFQ', 'DELIVERY', 'DASHBOARD'], {
    source: 'buyer-branch:employee-create',
    entityId: branchId,
  })
  return data
}

export async function assignBranchEmployee(branchId: number, payload: BranchEmployeeAssignPayload): Promise<BranchStaffMember> {
  const response = await apiClient.post(`/api/buyer/branches/${branchId}/employees/assign`, payload)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['BRANCH', 'ORDER', 'RFQ', 'DELIVERY', 'DASHBOARD'], {
    source: 'buyer-branch:employee-assign',
    entityId: branchId,
  })
  return data
}

export async function createBuyerBranch(payload: BuyerBranchPayload): Promise<BuyerBranchSummary> {
  const response = await apiClient.post('/api/buyer/branches', payload)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['BRANCH', 'DELIVERY', 'ORDER', 'RFQ', 'DASHBOARD'], {
    source: 'buyer-branch:create',
    entityId: data?.rawId,
  })
  return data
}

export async function updateBuyerBranch(id: number, payload: BuyerBranchPayload): Promise<BuyerBranchSummary> {
  const response = await apiClient.put(`/api/buyer/branches/${id}`, payload)
  const data = response.data?.data ?? response.data
  dispatchStateSync(['BRANCH', 'DELIVERY', 'ORDER', 'RFQ', 'DASHBOARD'], {
    source: 'buyer-branch:update',
    entityId: id,
  })
  return data
}

export async function updateBuyerBranchStatus(id: number, isActive: boolean): Promise<BuyerBranchSummary> {
  const response = await apiClient.patch(`/api/buyer/branches/${id}/status`, { isActive })
  const data = response.data?.data ?? response.data
  dispatchStateSync(['BRANCH', 'DELIVERY', 'ORDER', 'RFQ', 'DASHBOARD'], {
    source: 'buyer-branch:update-status',
    entityId: id,
  })
  return data
}

export async function deleteBuyerBranch(id: number): Promise<void> {
  await apiClient.delete(`/api/buyer/branches/${id}`)
  dispatchStateSync(['BRANCH', 'DELIVERY', 'ORDER', 'RFQ', 'DASHBOARD'], {
    source: 'buyer-branch:delete',
    entityId: id,
  })
}
