import { isAxiosError } from 'axios'

export function readApiErrorMessage(error: unknown): string | null {
  if (!isAxiosError(error)) {
    return null
  }

  const data = error.response?.data
  if (!data || typeof data !== 'object') {
    return null
  }

  const maybeMessage = (data as { message?: unknown }).message
  return typeof maybeMessage === 'string' && maybeMessage.trim() ? maybeMessage.trim() : null
}
