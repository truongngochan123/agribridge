import type { AuthResponse } from './authService'

type AuthStatus = AuthResponse['status']

const PAYLOAD_KEY = 'agribridge.auth.payload'

export function getStoredAuthSession(): AuthResponse | null {
  const raw = sessionStorage.getItem(PAYLOAD_KEY)
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

  sessionStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload))
  if (payload.companyId) {
    sessionStorage.setItem('agribridge.auth.companyId', String(payload.companyId))
  }
  if (payload.userId) {
    sessionStorage.setItem('agribridge.auth.userId', String(payload.userId))
  }
  if (payload.companyType) {
    sessionStorage.setItem('agribridge.auth.companyType', payload.companyType)
  }
  if (fallbackPhone) {
    sessionStorage.setItem('agribridge.auth.phone', fallbackPhone)
  }
  if (fallbackEmail) {
    sessionStorage.setItem('agribridge.auth.email', fallbackEmail)
  }
}

export function clearAuthSession() {
  const keysToDelete: string[] = []
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith('agribridge.')) {
      keysToDelete.push(key)
    }
  }
  keysToDelete.forEach((key) => sessionStorage.removeItem(key))
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
