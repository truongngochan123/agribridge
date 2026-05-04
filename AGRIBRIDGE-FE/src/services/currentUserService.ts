import { apiClient } from './apiClient'

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
  companyType: string
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

type CurrentUserProfileResponse = Omit<CurrentUserProfile, 'shortName'> & {
  shortName?: string
}

let cachedProfile: CurrentUserProfile | null = null

export async function fetchCurrentUserProfile(forceRefresh = false): Promise<CurrentUserProfile | null> {
  if (!forceRefresh && cachedProfile) {
    return cachedProfile
  }

  const response = await apiClient.get<CurrentUserProfileResponse>('/api/current-user/profile')
  const value = response.data
  const profile: CurrentUserProfile = {
    ...value,
    shortName: value.shortName ?? abbreviateVietnameseName(value.fullName),
    ward: value.ward ?? null,
  }

  cachedProfile = profile
  return profile
}

export function clearCurrentUserProfileCache(): void {
  cachedProfile = null
}

function abbreviateVietnameseName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'Người dùng'
  if (parts.length === 1) return parts[0]
  const initials = parts.slice(0, -1).map((part) => part.slice(0, 1).toUpperCase())
  return `${initials.join('.')}.${parts[parts.length - 1]}`
}
