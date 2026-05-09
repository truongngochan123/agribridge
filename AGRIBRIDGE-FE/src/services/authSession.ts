import type { AuthResponse } from './authService'

type AuthStatus = AuthResponse['status']

const PAYLOAD_KEY = 'agribridge.auth.payload'

export function getStoredAuthSession(): AuthResponse | null {
  const raw = localStorage.getItem(PAYLOAD_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthResponse
  } catch {
    return null
  }
}

export function storeAuthSession(payload: AuthResponse, fallback?: string | { phone?: string; email?: string }) {
  const fallbackPhone = typeof fallback === 'string' ? fallback : fallback?.phone
  const fallbackEmail = typeof fallback === 'string' ? undefined : fallback?.email

  localStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload))
  if (payload.companyId) {
    localStorage.setItem('agribridge.auth.companyId', String(payload.companyId))
  }
  if (payload.userId) {
    localStorage.setItem('agribridge.auth.userId', String(payload.userId))
  }
  if (payload.companyType) {
    localStorage.setItem('agribridge.auth.companyType', payload.companyType)
  }
  if (payload.accessToken) {
    localStorage.setItem('agribridge.auth.accessToken', payload.accessToken)
  }
  if (fallbackPhone) {
    localStorage.setItem('agribridge.auth.phone', fallbackPhone)
  }
  if (fallbackEmail) {
    localStorage.setItem('agribridge.auth.email', fallbackEmail)
  }
}

export function clearAuthSession() {
  const keysToDelete: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key?.startsWith('agribridge.')) {
      keysToDelete.push(key)
    }
  }
  keysToDelete.forEach((key) => localStorage.removeItem(key))
}

export function resolveStatusRedirect(status?: AuthStatus | null): string {
  if (status === 'PENDING_VERIFICATION') return '/onboarding/verification/pending'
  if (status === 'NEED_MORE_INFO') return '/onboarding/registration/complete'
  if (status === 'REJECTED') return '/onboarding/verification/rejected'
  return '/auth/login'
}

export function isAuthenticated(): boolean {
  return getStoredAuthSession() !== null
}
