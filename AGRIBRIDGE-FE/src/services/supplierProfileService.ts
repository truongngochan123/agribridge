import { apiClient } from './apiClient'

export type CompanyMediaItem = {
  id: number
  label: string
  imageType: string
  url: string
  uploadedAt?: string | null
}

export type CompanyProfileAssets = {
  logoUrl?: string | null
  farmImages: CompanyMediaItem[]
  certificates: CompanyMediaItem[]
}

export type UpdatePersonalProfilePayload = {
  fullName: string
  phone: string
  email?: string
}

export type UpdateLegalProfilePayload = {
  name: string
  taxCode?: string
  registrationNumber?: string
  establishedYear?: number
  website?: string
  province: string
  district?: string
  ward?: string
  address: string
  description?: string
}

export async function fetchCompanyProfileAssets(companyId: number): Promise<CompanyProfileAssets> {
  const response = await apiClient.get<CompanyProfileAssets>(`/api/companies/${companyId}/profile-assets`)
  return {
    logoUrl: response.data.logoUrl,
    farmImages: response.data.farmImages ?? [],
    certificates: response.data.certificates ?? [],
  }
}

export async function updatePersonalProfile(userId: number, payload: UpdatePersonalProfilePayload): Promise<void> {
  await apiClient.put(`/api/users/${userId}/personal-profile`, payload)
}

export async function updateLegalProfile(companyId: number, payload: UpdateLegalProfilePayload): Promise<void> {
  await apiClient.put(`/api/companies/${companyId}/legal-profile`, payload)
}

export async function saveCompanyLogo(companyId: number, url: string, label?: string): Promise<CompanyProfileAssets> {
  const response = await apiClient.post<CompanyProfileAssets>(`/api/companies/${companyId}/logo`, { url, label })
  return response.data
}

export async function deleteCompanyLogo(companyId: number): Promise<CompanyProfileAssets> {
  const response = await apiClient.delete<CompanyProfileAssets>(`/api/companies/${companyId}/logo`)
  return response.data
}

export async function addFarmImage(companyId: number, url: string, label?: string): Promise<CompanyProfileAssets> {
  const response = await apiClient.post<CompanyProfileAssets>(`/api/companies/${companyId}/farm-images`, { url, label })
  return response.data
}

export async function addCertificate(companyId: number, url: string, label?: string): Promise<CompanyProfileAssets> {
  const response = await apiClient.post<CompanyProfileAssets>(`/api/companies/${companyId}/certificates`, { url, label })
  return response.data
}

export async function deleteCompanyMedia(companyId: number, mediaId: number): Promise<CompanyProfileAssets> {
  const response = await apiClient.delete<CompanyProfileAssets>(`/api/companies/${companyId}/media/${mediaId}`)
  return response.data
}
