export type AdminMenuKey = 'overview' | 'users' | 'registrations' | 'disputes'

export type AdminTimeFilter = '7d' | '30d' | '3m' | '12m'

export type AdminMenuItem = {
  key: AdminMenuKey
  label: string
  path: string
}

export type AdminStat = {
  title: string
  value: string
  change: string
  changeTone: 'up' | 'down'
  color: 'emerald' | 'blue' | 'violet' | 'amber'
}

export type AdminRiskMetric = {
  key: 'outstandingDebt' | 'overdueInvoices' | 'openDisputes'
  label: string
  value: string
  hint: string
  critical: boolean
}

export type AdminGmvPoint = {
  label: string
  value: number
}

export type AdminOverviewPayload = {
  kpis: AdminStat[]
  gmvSeries: AdminGmvPoint[]
  risks: AdminRiskMetric[]
  activities: AdminActivityItem[]
  quickStats: AdminQuickStat[]
}

export type AdminActivityItem = {
  id?: number
  title: string
  description: string
  time: string
  color: 'emerald' | 'blue' | 'red' | 'violet'
}

export type AdminQuickStat = {
  id?: number
  label: string
  subLabel: string
  value: string
  color: 'emerald' | 'blue' | 'violet' | 'amber'
}

export type AdminActivityUpsertRequest = {
  title: string
  description: string
  time: string
  color: 'emerald' | 'blue' | 'red' | 'violet'
}

export type AdminQuickStatUpsertRequest = {
  label: string
  subLabel: string
  value: string
  color: 'emerald' | 'blue' | 'violet' | 'amber'
}

export type AdminUserCompanyType = 'SUPPLIER' | 'BUYER'
export type AdminUserStatus = 'ACTIVE' | 'BLOCKED' | 'LOCKED'
export type AdminRegistrationStatus = 'PENDING' | 'NEED_MORE_INFO' | 'REJECTED' | 'APPROVED'
export type AdminDisputeStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED'
export type AdminDisputeSeverity = 'HIGH' | 'MEDIUM'

export type AdminUserRow = {
  userId: number
  companyId: number
  companyName: string
  email: string | null
  phone: string
  companyType: AdminUserCompanyType
  companyTypeLabel: string
  userStatus: AdminUserStatus
  userStatusLabel: string
  orderCount: number
  rating: string
  joinedAt: string | null
  ownerName?: string | null
  address?: string | null
  province?: string | null
  taxCode?: string | null
}

export type AdminLotApprovalItem = {
  id: string
  productName: string
  supplierName: string
  harvestDate: string
  quantity: string
  price: string
  grade: string
  certificates: string[]
  submittedAt: string
}

export type AdminDisputeItem = {
  id: number
  disputeCode: string
  orderId: number
  batchId: number | null
  createdByUserId: number
  assignedToUserId: number | null
  status: AdminDisputeStatus
  statusLabel: string
  severity: AdminDisputeSeverity
  severityLabel: string
  title: string
  description: string
  resolution?: string | null
  buyerName: string
  supplierName: string
  product: string
  amount: string
  createdByName: string
  assignedToName: string
  createdAt: string
  resolvedAt?: string | null
}

export type AdminDisputeUpsertRequest = {
  orderId: number
  batchId?: number | null
  createdByUserId?: number | null
  assignedToUserId?: number | null
  status?: AdminDisputeStatus
  severity?: AdminDisputeSeverity
  title: string
  description: string
  resolution?: string
}

export type AdminDisputeStatusUpdateRequest = {
  assignedToUserId?: number | null
  status: AdminDisputeStatus
  resolution?: string
}

export type UploadedDocument = {
  id: string | number
  type: string
  fileName: string
  uploadedAt: string | null
  fileUrl: string
}

export type AdminRegistrationActionRequest = {
  adminUserId?: number
  reasonCodes?: string[]
  note?: string
  sendEmail?: boolean
  sendNotification?: boolean
}

export type AdminRegistrationProfile = {
  id: string
  userId: number | null
  companyId: number
  companyType: 'supplier' | 'buyer'
  businessType: 'business' | 'individual'
  companyName: string
  ownerName: string
  fullName: string
  role: string
  phone: string
  email: string | null
  address: string
  province: string
  district?: string | null
  taxCode?: string | null
  registrationNumber?: string | null
  citizenId?: string | null
  description: string | null
  createdAt: string | null
  verificationStatus: AdminRegistrationStatus
  verificationStatusLabel: string
  verificationNote?: string | null
  reasonCodes: string[]
  lastProcessedAt?: string | null
  lastProcessedByUserId?: number | null
  lastProcessedByName?: string | null
  documents: UploadedDocument[]
  companyImages: string[]
}
