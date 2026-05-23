import { apiClient } from './apiClient'

export type AdminCategoryItem = {
  id: number
  name: string
  description?: string | null
  userId?: number | null
  scopeLabel: string
  productCount: number
  createdAt?: string | null
}

export type AdminCategoryPayload = {
  name: string
  description?: string
}

export async function fetchAdminCategories(): Promise<AdminCategoryItem[]> {
  const response = await apiClient.get('/api/admin/categories')
  return response.data?.data ?? response.data
}

export async function createAdminCategory(payload: AdminCategoryPayload): Promise<AdminCategoryItem> {
  const response = await apiClient.post('/api/admin/categories', payload)
  return response.data?.data ?? response.data
}

export async function updateAdminCategory(id: number, payload: AdminCategoryPayload): Promise<AdminCategoryItem> {
  const response = await apiClient.put(`/api/admin/categories/${id}`, payload)
  return response.data?.data ?? response.data
}

export async function deleteAdminCategory(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/categories/${id}`)
}
