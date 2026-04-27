import { apiClient } from './apiClient'
import { API_BASE_URL } from './config'
import axios from 'axios'

export type UploadedFilePayload = {
  url: string
  publicId?: string
  format?: string
  resourceType?: string
  originalFilename?: string
}

type UploadErrorPayload = {
  message?: string
  errors?: Record<string, string>
}

type UploadFieldName = 'file' | 'document' | 'video'

function toFormData(file: File, fieldName: UploadFieldName = 'file'): FormData {
  const formData = new FormData()
  formData.append(fieldName, file, file.name)
  return formData
}

function extractUploadErrorMessage(error: unknown, fallbackMessage: string): string {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.message) {
      return error.message
    }
    return fallbackMessage
  }

  const responseData = error.response?.data as UploadErrorPayload | undefined
  if (responseData?.message?.trim()) {
    return responseData.message.trim()
  }

  const errors = responseData?.errors ?? {}
  const firstFieldError = Object.values(errors).find((value) => value?.trim())
  if (firstFieldError) {
    return firstFieldError
  }

  if (error.response?.status === 413) {
    return 'Video vượt quá dung lượng cho phép của hệ thống.'
  }

  return fallbackMessage
}

function normalizeUploadedPayload(payload: UploadedFilePayload): UploadedFilePayload {
  return {
    ...payload,
    url: resolveUploadedFileUrl(payload.url) || payload.url,
  }
}

export async function uploadRegistrationFile(file: File): Promise<UploadedFilePayload> {
  try {
    const response = await apiClient.post<UploadedFilePayload>(
      '/api/uploads/registration-file',
      toFormData(file, 'document'),
    )
    return normalizeUploadedPayload(response.data)
  } catch (error) {
    throw new Error(extractUploadErrorMessage(error, 'Upload tài liệu thất bại.'))
  }
}

export async function uploadSupplierDocument(file: File): Promise<UploadedFilePayload> {
  try {
    const response = await apiClient.post<UploadedFilePayload>(
      '/api/uploads/supplier-document',
      toFormData(file, 'document'),
    )
    return normalizeUploadedPayload(response.data)
  } catch (error) {
    try {
      const fallbackResponse = await apiClient.post<UploadedFilePayload>(
        '/api/uploads/registration-file',
        toFormData(file, 'document'),
      )
      return normalizeUploadedPayload(fallbackResponse.data)
    } catch (fallbackError) {
      throw new Error(extractUploadErrorMessage(fallbackError, extractUploadErrorMessage(error, 'Upload tài liệu thất bại.')))
    }
  }
}

export async function uploadBatchVideo(file: File): Promise<UploadedFilePayload> {
  try {
    const response = await apiClient.post<UploadedFilePayload>('/api/uploads/batch-video', toFormData(file, 'video'))
    return normalizeUploadedPayload(response.data)
  } catch (error) {
    try {
      const fallbackResponse = await apiClient.post<UploadedFilePayload>(
        '/api/uploads/registration-file',
        toFormData(file, 'video'),
      )
      return normalizeUploadedPayload(fallbackResponse.data)
    } catch (fallbackError) {
      throw new Error(extractUploadErrorMessage(fallbackError, extractUploadErrorMessage(error, 'Upload video thất bại.')))
    }
  }
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
