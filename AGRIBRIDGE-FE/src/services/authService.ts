import { apiClient } from './apiClient'

export type RegistrationDraft = {
  role: 'supplier' | 'buyer'
  companyName: string
  businessType?: 'BUSINESS' | 'INDIVIDUAL'
  ownerName: string
  taxCode: string
  registrationNumber?: string
  companyPhone: string
  companyEmail: string
  province: string
  ward: string
  address: string
  description?: string
  logoUrl?: string
}

export type ContactVerificationPayload = {
  fullName: string
  loginPhone: string
  loginEmail: string
  emailOtp: string
  citizenId: string
  password: string
  confirmPassword: string
  identityDocumentUrl: string
  businessDocumentUrl: string
  agreedTerms: boolean
}

export type AvailabilityRequest = {
  role: 'supplier' | 'buyer'
  phone?: string
  email?: string
  taxCode?: string
  citizenId?: string
}

export type AvailabilityResponse = {
  phoneTaken: boolean
  emailTaken: boolean
  taxCodeTaken: boolean
  citizenIdTaken: boolean
  normalizedPhone?: string
  normalizedEmail?: string
  normalizedTaxCode?: string
  businessTypeHint?: 'BUSINESS' | 'INDIVIDUAL'
  taxCodeValid: boolean
  citizenIdValid: boolean
}

export type AuthResponse = {
  status: 'SUCCESS' | 'PENDING_VERIFICATION' | 'NEED_MORE_INFO' | 'REJECTED'
  message: string
  redirectPath: string
  userId?: number
  companyId?: number
  companyType?: string
  userStatus?: string
  verificationStatus?:
    | 'PENDING'
    | 'PENDING_REVIEW'
    | 'DRAFT'
    | 'AUTO_APPROVED'
    | 'MANUAL_APPROVED'
    | 'APPROVED'
    | 'NEED_MORE_INFO'
    | 'NEEDS_MORE_INFO'
    | 'REJECTED'
  verificationNote?: string | null
  verificationScore?: number | null
  trustLevel?: string
  creditLimit?: number
  canUseCredit?: boolean
  accessToken?: string
  tokenExpiresAt?: string
}

export type TaxCodeLookupResponse = {
  found: boolean
  provider?: 'VIETQR' | 'XINVOICE' | 'CASSO'
  taxCode?: string
  companyName?: string
  address?: string
  province?: string
  ward?: string
  status?: string
  message?: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type RegistrationOtpResponse = {
  success: boolean
  verified: boolean
  email: string
  message: string
  expiresInSeconds: number
}

export async function registerAccount(draft: RegistrationDraft, contact: ContactVerificationPayload): Promise<AuthResponse> {
  const resolvedOwnerName = draft.ownerName?.trim() || contact.fullName.trim()
  const normalizedTaxCode = normalizeDigitsOnly(draft.taxCode)
  const businessType = draft.role === 'supplier' ? 'BUSINESS' : normalizedTaxCode ? 'BUSINESS' : 'INDIVIDUAL'
  const normalizedIdentityDoc = normalizeMediaRef(contact.identityDocumentUrl)
  const normalizedBusinessDoc = normalizeMediaRef(contact.businessDocumentUrl)

  if (draft.role === 'supplier') {
    const documentUrls = [normalizedIdentityDoc, normalizedBusinessDoc].filter((item) => item && item.trim().length > 0)

    const response = await apiClient.post<AuthResponse>('/api/auth/register/supplier', {
      companyName: draft.companyName,
      businessType,
      ownerName: resolvedOwnerName,
      taxCode: normalizedTaxCode,
      companyPhone: draft.companyPhone || undefined,
      companyEmail: draft.companyEmail || undefined,
      address: draft.address,
      province: draft.province,
      ward: draft.ward,
      description: buildDescription(draft),
      logoUrl: normalizeMediaRef(draft.logoUrl),
      documentUrls,
      fullName: contact.fullName,
      loginPhone: contact.loginPhone,
      loginEmail: contact.loginEmail,
      password: contact.password,
      citizenId: contact.citizenId || undefined,
    })

    return response.data
  }

  const response = await apiClient.post<AuthResponse>('/api/auth/register/buyer', {
    companyName: draft.companyName,
    businessType,
    ownerName: resolvedOwnerName,
    taxCode: businessType === 'BUSINESS' ? normalizedTaxCode : undefined,
    companyPhone: draft.companyPhone || undefined,
    companyEmail: draft.companyEmail || undefined,
    address: draft.address,
    province: draft.province,
    ward: draft.ward,
    description: buildDescription(draft),
    logoUrl: normalizeMediaRef(draft.logoUrl),
    fullName: contact.fullName,
    loginPhone: contact.loginPhone,
    loginEmail: contact.loginEmail,
    password: contact.password,
    citizenId: contact.citizenId || undefined,
  })

  return response.data
}

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/api/auth/login', request)
  return response.data
}

export async function sendRegistrationOtp(email: string): Promise<RegistrationOtpResponse> {
  const response = await apiClient.post<RegistrationOtpResponse>('/api/auth/register/otp/send', { email })
  return response.data
}

export async function verifyRegistrationOtp(email: string, otp: string): Promise<RegistrationOtpResponse> {
  const response = await apiClient.post<RegistrationOtpResponse>('/api/auth/register/otp/verify', { email, otp })
  return response.data
}

export async function checkRegistrationStatusByEmail(email: string): Promise<AuthResponse> {
  const response = await apiClient.get<AuthResponse>('/api/auth/register/status', { params: { email } })
  return response.data
}

export async function checkRegistrationAvailability(payload: AvailabilityRequest): Promise<AvailabilityResponse> {
  const response = await apiClient.post<AvailabilityResponse>('/api/auth/register/check', payload)
  return response.data
}

export async function lookupCompanyByTaxCode(taxCode: string): Promise<TaxCodeLookupResponse> {
  const response = await apiClient.get<TaxCodeLookupResponse>('/api/tax-code/lookup', {
    params: { taxCode },
  })
  return response.data
}

function buildDescription(draft: RegistrationDraft): string {
  const chunks: string[] = []

  if ((draft.description ?? '').trim()) {
    chunks.push((draft.description ?? '').trim())
  }

  if ((draft.registrationNumber ?? '').trim()) {
    chunks.push(`registrationNo=${(draft.registrationNumber ?? '').trim()}`)
  }

  if ((draft.ward ?? '').trim()) {
    chunks.push(`ward=${(draft.ward ?? '').trim()}`)
  }

  return chunks.join(' | ')
}

function normalizeMediaRef(value?: string): string | undefined {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith('data:') || trimmed.startsWith('upload://')) {
    return undefined
  }

  if (trimmed.length > 240) {
    return trimmed.slice(0, 240)
  }

  return trimmed
}

function normalizeDigitsOnly(value?: string): string | undefined {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return undefined
  return trimmed.replace(/\D/g, '')
}
