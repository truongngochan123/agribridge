import { isAxiosError } from 'axios'

export function readApiErrorMessage(error: unknown): string | null {
  if (!isAxiosError(error)) {
    return null
  }

  const data = error.response?.data
  if (!data || typeof data !== 'object') {
    return null
  }

  const maybeErrors = (data as { errors?: unknown }).errors
  if (maybeErrors && typeof maybeErrors === 'object') {
    const firstError = Object.values(maybeErrors).find(
      (value) => typeof value === 'string' && value.trim(),
    )
    if (typeof firstError === 'string') {
      return firstError.trim()
    }
  }

  const maybeMessage = (data as { message?: unknown }).message
  return typeof maybeMessage === 'string' && maybeMessage.trim() ? maybeMessage.trim() : null
}
