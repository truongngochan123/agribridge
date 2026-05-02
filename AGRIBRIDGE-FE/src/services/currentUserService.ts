import { apiClient } from './apiClient'

type UserApiModel = {
  id: number
  companyId: number
  fullName: string
  phone: string
  email?: string | null
  role?: string
  createdAt?: string
}

type CompanyApiModel = {
  id: number
  name: string
  companyType?: string
  businessType?: string
  ownerName?: string
  taxCode?: string | null
  registrationNumber?: string | null
  establishedYear?: number | null
  website?: string | null
  phone?: string
  email?: string | null
  address?: string
  province?: string
  district?: string
  ward?: string | null
  description?: string
  createdAt?: string
  verifiedStatus?: boolean
}

export type CurrentUserProfile = {
  userId?: number
  companyId?: number
  fullName: string
  shortName: string
  email: string
  phone: string
  roleLabel: string
  companyName: string
  taxCode: string
  address: string
  ownerName: string
  companyTypeLabel: string
  businessTypeLabel: string
  accountCode: string
  joinedAt: string
  statusLabel: string
  initials: string
  registrationNumber: string
  establishedYear: string
  website: string
  province: string
  district: string
  ward?: string | null
  description: string
}

let cachedProfile: CurrentUserProfile | null = null

export async function fetchCurrentUserProfile(forceRefresh = false): Promise<CurrentUserProfile | null> {
  if (!forceRefresh && cachedProfile) {
    return cachedProfile
  }

  const companyTypeRaw = (sessionStorage.getItem('agribridge.auth.companyType') ?? '').trim()
  const normalizedCompanyType = companyTypeRaw.toLowerCase()
  if (normalizedCompanyType === 'admin' || normalizedCompanyType === 'system') {
    let userIdRaw = sessionStorage.getItem('agribridge.auth.userId')
    let userId = userIdRaw ? Number(userIdRaw) : undefined
    if (!userId) {
      hydrateSessionFromAuthPayload()
      userIdRaw = sessionStorage.getItem('agribridge.auth.userId')
      userId = userIdRaw ? Number(userIdRaw) : undefined
    }

    const emailFromSession = (sessionStorage.getItem('agribridge.auth.email') ?? '').trim()
    const nameFromSession = (sessionStorage.getItem('agribridge.auth.name') ?? '').trim()

    let user: UserApiModel | undefined
    if (userId) {
      try {
        const userResponse = await apiClient.get<UserApiModel>(`/api/users/${userId}`)
        user = userResponse.data
      } catch (error) {
        console.error('GET /api/users/:id failed', error)
        user = undefined
      }
    }

    const fullName = user?.fullName || nameFromSession || 'Quản trị viên'
    const email = user?.email || emailFromSession || 'admin@agribridge.vn'
    const phone = user?.phone || 'N/A'
    const joinedAtSource = user?.createdAt
    const resolvedUserId = user?.id ?? userId
    const profile: CurrentUserProfile = {
      userId: resolvedUserId,
      companyId: undefined,
      fullName,
      shortName: abbreviateVietnameseName(fullName),
      email,
      phone,
      roleLabel: mapRoleLabel(companyTypeRaw),
      companyName: 'AgriBridge',
      taxCode: 'N/A',
      address: 'N/A',
      ownerName: fullName,
      companyTypeLabel: mapCompanyTypeLabel(companyTypeRaw),
      businessTypeLabel: 'N/A',
      accountCode: resolvedUserId ? `ADM-${String(resolvedUserId).padStart(6, '0')}` : 'ADM-000000',
      joinedAt: formatDate(joinedAtSource),
      statusLabel: 'Đang hoạt động',
      initials: makeInitials(fullName),
      registrationNumber: 'N/A',
      establishedYear: 'N/A',
      website: 'N/A',
      province: 'N/A',
      district: 'N/A',
      ward: null,
      description: 'N/A',
    }

    cachedProfile = profile
    return profile
  }

  const companyIdRaw = sessionStorage.getItem('agribridge.auth.companyId')
  let companyId = companyIdRaw ? Number(companyIdRaw) : undefined
  const phoneFromSession = (sessionStorage.getItem('agribridge.auth.phone') ?? '').trim()
  const userIdRaw = sessionStorage.getItem('agribridge.auth.userId')
  let userId = userIdRaw ? Number(userIdRaw) : undefined

  if ((!phoneFromSession || !companyId || !userId) && !hydrateSessionFromAuthPayload()) {
    // Keep going with whatever session keys currently exist.
  }

  let user: UserApiModel | undefined
  if (userId) {
    try {
      const userResponse = await apiClient.get<UserApiModel>(`/api/users/${userId}`)
      user = userResponse.data
    } catch(error){
      console.error('GET /api/users/:id failed', error)
      user = undefined
    }

    if (user?.companyId && (!companyId || companyId !== user.companyId)) {
      companyId = user.companyId
      sessionStorage.setItem('agribridge.auth.companyId', String(user.companyId))
    }
  }

  if (!user) {
    const usersResponse = await apiClient.get<UserApiModel[]>('/api/users')
    const allUsers = usersResponse.data

    if (companyId) {
      user = allUsers.find((item) => item.companyId === companyId)
    }
    if (!user && phoneFromSession) {
      user = allUsers.find((item) => normalizePhone(item.phone) === normalizePhone(phoneFromSession))
    }
    if (!user) {
      user = allUsers.find((item) => (item.role ?? '').toUpperCase() === 'OWNER') ?? allUsers[0]
    }

    if (user?.id) {
      userId = user.id
      sessionStorage.setItem('agribridge.auth.userId', String(user.id))
    }
    if (user?.companyId && (!companyId || companyId !== user.companyId)) {
      companyId = user.companyId
      sessionStorage.setItem('agribridge.auth.companyId', String(user.companyId))
    }
  }

  if (!companyId) {
    return null
  }

  const companyResponse = await apiClient.get<CompanyApiModel>(`/api/companies/${companyId}`)
  const company = companyResponse.data

  const fullName = user?.fullName || company.ownerName || sessionStorage.getItem('agribridge.auth.name') || 'Người dùng'
  const phone = user?.phone || company.phone || sessionStorage.getItem('agribridge.auth.phone') || 'N/A'
  const email = user?.email || company.email || 'N/A'
  const joinedAtSource = user?.createdAt || company.createdAt

  const profile: CurrentUserProfile = {
    userId,
    companyId,
    fullName,
    shortName: abbreviateVietnameseName(fullName),
    email,
    phone,
    roleLabel: mapRoleLabel(company.companyType),
    companyName: company.name || 'N/A',
    taxCode: readUnknown(company.taxCode),
    address: company.address || 'N/A',
    ownerName: company.ownerName || fullName,
    companyTypeLabel: mapCompanyTypeLabel(company.companyType),
    businessTypeLabel: mapBusinessTypeLabel(company.businessType),
    accountCode: `SUP-${String(companyId).padStart(6, '0')}`,
    joinedAt: formatDate(joinedAtSource),
    statusLabel: company.verifiedStatus ? 'Đã xác minh' : 'Chờ xác minh',
    initials: makeInitials(fullName),
    registrationNumber: readUnknown(company.registrationNumber),
    establishedYear: company.establishedYear ? String(company.establishedYear) : 'N/A',
    website: readUnknown(company.website),
    province: readUnknown(company.province),
    district: readUnknown(company.district),
    ward: readNullable(company.ward),
    description: readUnknown(company.description),
  }

  cachedProfile = profile
  return profile
}

function hydrateSessionFromAuthPayload(): boolean {
  const raw = sessionStorage.getItem('agribridge.auth.payload')
  if (!raw) {
    return false
  }

  try {
    const parsed = JSON.parse(raw) as { userId?: number; companyId?: number; companyType?: string }
    if (parsed.userId) {
      sessionStorage.setItem('agribridge.auth.userId', String(parsed.userId))
    }
    if (parsed.companyId) {
      sessionStorage.setItem('agribridge.auth.companyId', String(parsed.companyId))
    }
    if (parsed.companyType) {
      sessionStorage.setItem('agribridge.auth.companyType', parsed.companyType)
    }
    return true
  } catch {
    return false
  }
}

export function clearCurrentUserProfileCache(): void {
  cachedProfile = null
}

function makeInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) {
    return 'U'
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase()
  }
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase()
}

function mapRoleLabel(companyType?: string): string {
  const normalizedCompanyType = (companyType ?? '').toLowerCase()
  if (normalizedCompanyType === 'admin' || normalizedCompanyType === 'system') {
    return 'Quản trị viên'
  }
  if (normalizedCompanyType === 'supplier') {
    return 'Nhà cung cấp'
  }
  if (normalizedCompanyType === 'buyer') {
    return 'Nhà buôn'
  }
  return 'Người dùng'
}

function mapCompanyTypeLabel(companyType?: string): string {
  const normalizedCompanyType = (companyType ?? '').toLowerCase()
  if (normalizedCompanyType === 'admin' || normalizedCompanyType === 'system') {
    return 'Quản trị viên / Admin'
  }
  if (normalizedCompanyType === 'supplier') {
    return 'Nhà cung cấp / Supplier'
  }
  if (normalizedCompanyType === 'buyer') {
    return 'Nhà buôn / Buyer'
  }
  return 'N/A'
}

function mapBusinessTypeLabel(businessType?: string): string {
  if ((businessType ?? '').toLowerCase() === 'business') {
    return 'Doanh nghiệp'
  }
  if ((businessType ?? '').toLowerCase() === 'individual') {
    return 'Cá nhân'
  }
  return 'N/A'
}

function formatDate(value?: string): string {
  if (!value) {
    return 'N/A'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString('vi-VN')
}

function normalizePhone(value?: string): string {
  return String(value ?? '').replace(/\D/g, '')
}

function readUnknown(value: unknown): string {
  const text = String(value ?? '').trim()
  return text || 'N/A'
}

function readNullable(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text && text !== 'N/A' ? text : null
}

function abbreviateVietnameseName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) {
    return 'Người dùng'
  }
  if (parts.length === 1) {
    return parts[0]
  }
  const initials = parts.slice(0, -1).map((part) => part.slice(0, 1).toUpperCase())
  return `${initials.join('.')}.${parts[parts.length - 1]}`
}
