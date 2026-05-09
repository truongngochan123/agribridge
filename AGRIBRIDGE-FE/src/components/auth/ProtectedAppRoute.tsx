import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getStoredAuthSession, resolveStatusRedirect } from '../../services/authSession'

type ProtectedAppRouteProps = {
  children: ReactNode
  allowedCompanyTypes?: string[]
}

export function ProtectedAppRoute({ children, allowedCompanyTypes }: ProtectedAppRouteProps) {
  const location = useLocation()
  const session = getStoredAuthSession()

  if (!session) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  }

  if (session.status !== 'SUCCESS') {
    return <Navigate to={resolveStatusRedirect(session.status)} replace />
  }

  if (allowedCompanyTypes && allowedCompanyTypes.length > 0) {
    const companyType = String(session.companyType ?? '').toLowerCase()
    const allowed = allowedCompanyTypes.map((item) => item.toLowerCase())
    if (!allowed.includes(companyType)) {
      if (companyType === 'admin' || companyType === 'system') {
        return <Navigate to="/admin/overview" replace />
      }
      if (companyType === 'buyer') {
        return <Navigate to="/buyer/overview" replace />
      }
      return <Navigate to="/supplier/overview" replace />
    }
  }

  return <>{children}</>
}

type VerificationStateRouteProps = {
  children: ReactNode
  allowedStatuses: Array<'PENDING_VERIFICATION' | 'NEED_MORE_INFO' | 'REJECTED'>
}

export function VerificationStateRoute({ children, allowedStatuses }: VerificationStateRouteProps) {
  const session = getStoredAuthSession()
  if (!session) {
    return <Navigate to="/auth/login" replace />
  }
  if (allowedStatuses.includes(session.status as VerificationStateRouteProps['allowedStatuses'][number])) {
    return <>{children}</>
  }
  if (session.status === 'SUCCESS') {
    return <Navigate to={session.redirectPath || '/'} replace />
  }
  return <Navigate to={resolveStatusRedirect(session.status)} replace />
}
