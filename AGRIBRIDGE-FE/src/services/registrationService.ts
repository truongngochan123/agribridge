import { apiClient } from './apiClient'
import type { AuthResponse } from './authService'
import type { UploadedFilePayload } from './uploadService'

export type RegistrationResubmitDocument = {
  id: number | string
  type: string
  fileName: string
  uploadedAt: string | null
  fileUrl: string
}

export type RegistrationResubmitDraft = {
  companyId: number
  userId: number
  companyType: 'supplier' | 'buyer'
  businessType: 'business' | 'individual'
  companyName: string
  ownerName: string
  fullName: string
  loginPhone: string
  loginEmail: string | null
  citizenId: string | null
  taxCode: string | null
  registrationNumber: string | null
  companyPhone: string | null
  companyEmail: string | null
  address: string
  province: string
  district: string | null
  description: string | null
  logoUrl: string | null
  documents: RegistrationResubmitDocument[]
  verificationStatus: string
  verificationNote: string | null
}

export type RegistrationResubmitRequest = {
  companyId: number
  userId: number
  companyName: string
  ownerName: string
  fullName: string
  loginPhone: string
  loginEmail?: string
  citizenId?: string
  taxCode?: string
  registrationNumber?: string
  companyPhone?: string
  companyEmail?: string
  address: string
  province: string
  district?: string
  description?: string
  logoUrl?: string
  documentUrls: string[]
}

export async function fetchRegistrationResubmitDraft(companyId: number, userId: number): Promise<RegistrationResubmitDraft> {
  const response = await apiClient.get<RegistrationResubmitDraft>('/api/registration/resubmit-draft', {
    params: { companyId, userId },
  })
  return response.data
}

export async function submitRegistrationResubmission(payload: RegistrationResubmitRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/api/registration/resubmit', payload)
  return response.data
}

export function normalizeUploadedUrls(items: Array<string | UploadedFilePayload | null | undefined>): string[] {
  return items
    .map((item) => (typeof item === 'string' ? item : item?.url))
    .filter((item): item is string => Boolean(item && item.trim()))
}
