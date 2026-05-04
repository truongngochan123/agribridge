import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getStoredAuthSession } from '../../services/authSession'

type ProtectedAdminRouteProps = {
  children: ReactNode
}

/**
 * Bảo vệ các route Admin — chỉ cho phép tài khoản có companyType là 'admin' hoặc 'system'.
 * Nếu chưa đăng nhập → chuyển về /admin/login.
 * Nếu đăng nhập nhưng không phải admin → chuyển về /admin/login.
 */
export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const location = useLocation()
  const session = getStoredAuthSession()

  if (!session || session.status !== 'SUCCESS') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  const companyType = String(session.companyType ?? '').toLowerCase()
  if (companyType !== 'admin' && companyType !== 'system') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
