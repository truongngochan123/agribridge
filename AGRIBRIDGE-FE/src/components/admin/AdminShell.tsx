import {
  AlertTriangle,
  Bell,
  FileCheck2,
  LayoutGrid,
  LogOut,
  Tags,
  Wallet,
  Users,
  UserCircle2,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { NotificationDrawer } from '../site/NotificationDrawer'
import { adminMenuItems } from '../../data/adminDashboardData'
import type { AdminMenuKey } from '../../types/admin'
import { useCurrentUserProfile } from '../../hooks/useCurrentUserProfile'
import { clearAuthSession } from '../../services/authSession'
import { clearCurrentUserProfileCache } from '../../services/currentUserService'

type AdminShellProps = {
  activeKey: AdminMenuKey
  title: string
  subtitle: string
  children: ReactNode
  actions?: ReactNode
}

const iconByKey = {
  overview: LayoutGrid,
  users: Users,
  registrations: FileCheck2,
  categories: Tags,
  disputes: AlertTriangle,
  withdrawals: Wallet,
  profile: UserCircle2,
}

export function AdminShell({ activeKey, title, subtitle, actions, children }: AdminShellProps) {
  const navigate = useNavigate()
  const [openNotifications, setOpenNotifications] = useState(false)
  const { profile } = useCurrentUserProfile()
  const displayName = profile?.shortName ?? profile?.fullName ?? 'Quản trị viên'
  const roleLabel = profile?.roleLabel ?? 'Quản trị viên'
  const email = profile?.email ?? 'admin@agribridge.vn'
  const initials = profile?.initials ?? 'AD'

  const handleLogout = () => {
    clearAuthSession()
    clearCurrentUserProfileCache()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="grid h-screen grid-cols-[230px_1fr]">
        <aside className="flex h-screen flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-5">
            <Link to="/admin/overview" className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-emerald-600/10">
                <img src="/images/logo.png" alt="AgriBridge" className="h-8 w-8 object-contain" />
              </span>
              <div>
                <p className="text-xl font-extrabold leading-none text-slate-900">Admin</p>
                <p className="text-xs text-slate-500">Quản trị viên</p>
              </div>
            </Link>
          </div>

          <nav className="px-3 py-4">
            <ul className="space-y-2">
              {adminMenuItems.map((item) => {
                const Icon = iconByKey[item.key]
                const isActive = item.key === activeKey

                return (
                  <li key={item.key}>
                    <NavLink
                      to={item.path}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                        isActive ? 'bg-emerald-100 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="mt-auto border-t border-slate-200 px-4 py-4">
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <Link to="/admin/profile" className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-white">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                  <p className="truncate text-xs text-slate-500">{roleLabel}</p>
                </div>
              </Link>
              <p className="mt-2 truncate text-xs text-slate-500">{email}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-red-500 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold leading-tight text-slate-900">{title}</h1>
                <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
                  onClick={() => setOpenNotifications(true)}
                  aria-label="Thông báo"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 rounded-full bg-red-500" />
                </button>

                <Link to="/admin/profile" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-1.5 py-1">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    {initials}
                  </span>
                  <div className="pr-1 text-left">
                    <p className="text-xs font-bold text-slate-900">{displayName}</p>
                    <p className="text-xs text-slate-500">{email}</p>
                  </div>
                </Link>
              </div>
            </div>
            {actions ? <div className="mt-3">{actions}</div> : null}
          </header>

          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </main>
      </div>

      <NotificationDrawer open={openNotifications} onClose={() => setOpenNotifications(false)} />
    </div>
  )
}
