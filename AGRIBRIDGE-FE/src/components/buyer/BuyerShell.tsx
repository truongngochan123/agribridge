import {
  Bell,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Package,
  Store,
  Truck,
  Wallet,
  Search,
  LineChart,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { buyerMenuItems } from '../../data/buyerDashboardData'
import { NotificationDrawer } from '../site/NotificationDrawer'
import type { BuyerMenuKey } from '../../types/buyerDashboard'
import { useCurrentUserProfile } from '../../hooks/useCurrentUserProfile'
import { clearCurrentUserProfileCache } from '../../services/currentUserService'
import { clearAuthSession } from '../../services/authSession'
import { fetchNotifications, resolveNotificationRoute, type AppNotification } from '../../services/notificationService'

type BuyerShellProps = {
  activeKey: BuyerMenuKey
  title: string
  subtitle: string
  actions?: ReactNode
  filterBar?: ReactNode
  children: ReactNode
}

const iconByKey = {
  overview: LayoutGrid,
  sourcing: Search,
  rfq: ClipboardList,
  orders: Package,
  branches: Store,
  delivery: Truck,
  debt: Wallet,
  market: LineChart,
}

export function BuyerShell({ activeKey, title, subtitle, actions, filterBar, children }: BuyerShellProps) {
  const navigate = useNavigate()
  const [openNotifications, setOpenNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [slideNotification, setSlideNotification] = useState<AppNotification | null>(null)
  const prevLatestIdRef = useRef<number | null>(null)
  const { profile } = useCurrentUserProfile()
  const buyerName = profile?.fullName && profile.fullName !== 'N/A' ? profile.fullName : 'Buyer'
  const buyerRole = profile?.companyTypeLabel && profile.companyTypeLabel !== 'N/A' ? profile.companyTypeLabel : 'Nhà buôn'
  const buyerInitials = profile?.initials && profile.initials !== 'N/A' ? profile.initials : buyerName.charAt(0).toUpperCase()

  const handleLogout = () => {
    clearAuthSession()

    const sessionKeysToDelete: string[] = []
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (key?.startsWith('agribridge.')) {
        sessionKeysToDelete.push(key)
      }
    }
    sessionKeysToDelete.forEach((key) => sessionStorage.removeItem(key))

    clearCurrentUserProfileCache()
    navigate('/auth/login', { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    let timerId: number | undefined

    const loadNotifications = async () => {
      try {
        const data = await fetchNotifications()
        if (cancelled) return
        setUnreadCount(data.unreadCount || 0)
        const latestUnread = (data.items || []).find((item) => !item.isRead)
        if (latestUnread) {
          if (prevLatestIdRef.current !== null && prevLatestIdRef.current !== latestUnread.id) {
            setSlideNotification(latestUnread)
            window.setTimeout(() => setSlideNotification(null), 5000)
          }
          prevLatestIdRef.current = latestUnread.id
        }
      } catch {
        if (!cancelled) setUnreadCount(0)
      }
    }

    void loadNotifications()
    timerId = window.setInterval(() => {
      void loadNotifications()
    }, 15000)

    return () => {
      cancelled = true
      if (timerId) window.clearInterval(timerId)
    }
  }, [])

  return (
    <div className="h-screen overflow-hidden bg-emerald-50/30 text-emerald-950">
      <div className="grid h-screen grid-cols-[230px_1fr]">
        <aside className="flex h-screen flex-col border-r border-emerald-700/35 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white">
          <div className="border-b border-white/15 px-4 py-5">
            <Link to="/buyer/overview" className="flex items-center gap-3">
              <img src="/images/logo.png" alt="AgriBridge" className="h-8 w-8 rounded-lg" />
              <div>
                <p className="text-[24px] font-extrabold leading-none">AgriBridge</p>
                <p className="text-xs text-emerald-100">Nhà buôn</p>
              </div>
            </Link>
          </div>

          <nav className="px-2 py-3">
            <ul className="space-y-2">
              {buyerMenuItems.map((item) => {
                const Icon = iconByKey[item.key]
                const isActive = activeKey === item.key
                return (
                  <li key={item.key}>
                    <NavLink
                      to={item.path}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-white text-emerald-800 shadow-[0_2px_8px_rgba(16,120,74,0.25)]'
                          : 'text-emerald-50 hover:bg-emerald-600/35'
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

          <div className="mt-auto border-t border-white/15 px-4 py-4">
            <div className="rounded-xl bg-white/10 px-3 py-3">
              <p className="text-sm font-bold">{buyerName}</p>
              <p className="text-xs text-emerald-100">{buyerRole}</p>
              <button
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col overflow-hidden">
          <header className="shrink-0 sticky top-0 z-30 border-b border-emerald-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[22px] font-extrabold leading-tight text-emerald-950">{title}</h1>
                <p className="mt-0.5 text-xs text-emerald-900/60">{subtitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
                  onClick={() => setOpenNotifications(true)}
                  aria-label="Thông báo"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                </button>

                <Link to="/buyer/profile" className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-200 text-sm font-bold text-emerald-800">
                    {buyerInitials}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">{buyerName}</p>
                    <p className="text-xs text-emerald-700/70">{buyerRole}</p>
                  </div>
                </Link>
              </div>
            </div>
            {actions ? <div className="mt-2">{actions}</div> : null}
          </header>

          {filterBar ? (
            <div className="shrink-0 sticky top-[var(--shell-header-h,73px)] z-20 border-b border-slate-100 bg-white/95 backdrop-blur-sm px-4 py-2 shadow-sm">
              {filterBar}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </main>
      </div>
      {slideNotification ? (
        <button
          className="fixed right-4 top-4 z-[85] w-[min(420px,calc(100%-2rem))] rounded-xl border border-emerald-200 bg-white p-3 text-left shadow-lg"
          onClick={() => navigate(resolveNotificationRoute(slideNotification))}
        >
          <p className="text-sm font-bold text-slate-900">{slideNotification.title}</p>
          <p className="mt-1 text-sm text-slate-600">{slideNotification.body}</p>
        </button>
      ) : null}
      <NotificationDrawer
        open={openNotifications}
        onClose={() => setOpenNotifications(false)}
        onUnreadCountChange={setUnreadCount}
        onNotificationClick={(route) => navigate(route)}
      />
    </div>
  )
}
