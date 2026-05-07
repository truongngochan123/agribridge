import axios from 'axios'
import { apiClient } from './apiClient'

export type UploadedFilePayload = {
  url: string
  secureUrl?: string
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

const UPLOAD_TIMEOUT_MS = 120_000

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
    return 'File vượt quá dung lượng cho phép của hệ thống.'
  }

  if (error.response?.status === 503) {
    return 'Backend chưa cấu hình Cloudinary hoặc thiếu CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET.'
  }

  if (error.response?.status === 502) {
    return 'Upload lên Cloudinary thất bại. Kiểm tra API key, API secret hoặc kết nối mạng backend.'
  }

  if (error.code === 'ECONNABORTED') {
    return 'Upload mất quá nhiều thời gian. Thử file nhỏ hơn hoặc kiểm tra kết nối mạng.'
  }

  return fallbackMessage
}

function normalizeUploadedPayload(payload: UploadedFilePayload): UploadedFilePayload {
  const uploadedUrl = payload.secureUrl || payload.url

  return {
    ...payload,
    url: resolveUploadedFileUrl(uploadedUrl) || uploadedUrl,
    secureUrl: payload.secureUrl ? resolveUploadedFileUrl(payload.secureUrl) || payload.secureUrl : undefined,
  }
}

export async function uploadRegistrationFile(file: File): Promise<UploadedFilePayload> {
  try {
    const response = await apiClient.post<UploadedFilePayload>(
      '/api/uploads/registration-file',
      toFormData(file, 'document'),
      { timeout: UPLOAD_TIMEOUT_MS },
    )

    return normalizeUploadedPayload(response.data)
  } catch (error) {
    throw new Error(extractUploadErrorMessage(error, 'Upload tài liệu đăng ký thất bại.'))
  }
}

export async function uploadSupplierDocument(file: File): Promise<UploadedFilePayload> {
  try {
    const response = await apiClient.post<UploadedFilePayload>(
      '/api/uploads/supplier-document',
      toFormData(file, 'document'),
      { timeout: UPLOAD_TIMEOUT_MS },
    )

    return normalizeUploadedPayload(response.data)
  } catch (error) {
    throw new Error(extractUploadErrorMessage(error, 'Upload tài liệu thất bại.'))
  }
}

export async function uploadBatchVideo(file: File): Promise<UploadedFilePayload> {
  try {
    const response = await apiClient.post<UploadedFilePayload>(
      '/api/uploads/batch-video',
      toFormData(file, 'video'),
      { timeout: UPLOAD_TIMEOUT_MS },
    )

    return normalizeUploadedPayload(response.data)
  } catch (error) {
    throw new Error(extractUploadErrorMessage(error, 'Upload video thất bại.'))
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

  // Filter out old localhost:8081 local upload URLs that no longer work
  if (trimmed.includes('localhost:8081') || trimmed.includes('127.0.0.1:8081')) {
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

  // Dữ liệu cũ trong DB kiểu /api/uploads/local/... hoặc filename local.
  // Không nối sang localhost:8081 nữa, vì BE local upload cũ không còn chạy.
  if (
    trimmed.includes('/api/uploads/local/') ||
    trimmed.startsWith('api/uploads/local/') ||
    /\.(jpg|jpeg|png|webp|gif|mp4|mov|avi)$/i.test(trimmed)
  ) {
    return null
  }

  return null
}

export function canOpenUploadedFile(url?: string | null): boolean {
  return Boolean(resolveUploadedFileUrl(url))
}
