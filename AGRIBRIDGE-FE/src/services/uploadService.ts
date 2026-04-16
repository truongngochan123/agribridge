import { apiClient } from './apiClient'
import { API_BASE_URL } from './config'

export type UploadedFilePayload = {
  url: string
  publicId?: string
  format?: string
  resourceType?: string
  originalFilename?: string
}

export async function uploadRegistrationFile(file: File): Promise<UploadedFilePayload> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<UploadedFilePayload>('/api/uploads/registration-file', formData)
  return response.data
}

export async function uploadSupplierDocument(file: File): Promise<UploadedFilePayload> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<UploadedFilePayload>('/api/uploads/supplier-document', formData)
  return response.data
}

export async function uploadBatchVideo(file: File): Promise<UploadedFilePayload> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<UploadedFilePayload>('/api/uploads/batch-video', formData)

  return response.data
}

export function resolveUploadedFileUrl(url?: string | null): string | null {
  const trimmed = url?.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('upload://')) {
    return null
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return `${API_BASE_URL}${trimmed}`
  }

  return `${API_BASE_URL}/${trimmed.replace(/^\/+/, '')}`
}

export function canOpenUploadedFile(url?: string | null): boolean {
  return Boolean(resolveUploadedFileUrl(url))
}
