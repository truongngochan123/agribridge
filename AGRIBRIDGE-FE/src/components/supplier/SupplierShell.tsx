import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  Package,
  Truck,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { supplierMenuItems } from '../../data/supplierMenu'
import { useCurrentUserProfile } from '../../hooks/useCurrentUserProfile'
import { clearCurrentUserProfileCache } from '../../services/currentUserService'
import { clearSupplierDashboardCache } from '../../services/supplierService'
import { clearAuthSession } from '../../services/authSession'
import { NotificationDrawer } from '../site/NotificationDrawer'
import type { SupplierMenuKey } from '../../types/supplierDashboard'
import { fetchNotifications, resolveNotificationRoute, type AppNotification } from '../../services/notificationService'
import { createNotificationRealtimeClient, dispatchNotificationRealtime } from '../../services/notificationRealtimeService'
import { getNotificationSoundEnabled, playNotificationSound, setNotificationSoundEnabled } from '../../services/notificationSoundService'

type SupplierShellProps = {
  activeKey: SupplierMenuKey
  title: string
  subtitle: string
  children: ReactNode
  actions?: ReactNode
  filterBar?: ReactNode
}

const iconByKey = {
  overview: LayoutGrid,
  products: Boxes,
  rfq: ClipboardList,
  orders: Package,
  delivery: Truck,
  debt: Wallet,
  wallet: Wallet,
  reports: BarChart3,
}

const notificationModuleByMenuKey: Partial<Record<SupplierMenuKey, string[]>> = {
  rfq: ['RFQ', 'QUOTE'],
  orders: ['ORDER', 'PAYMENT', 'DELIVERY'],
  delivery: ['DELIVERY'],
  debt: ['DEBT', 'PAYMENT'],
  wallet: ['PAYMENT'],
}

const SUPPLIER_PAGE_LOAD_DELAY_MS = 650

function moduleCounts(items: AppNotification[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    if (item.isRead) return counts
    const module = item.module || (item.type?.startsWith('PAYMENT_') ? 'PAYMENT' : item.type?.startsWith('ORDER_') ? 'ORDER' : item.type?.startsWith('RFQ_') ? 'RFQ' : item.type?.startsWith('DELIVERY_') ? 'DELIVERY' : item.type?.startsWith('DEBT_') ? 'DEBT' : item.type?.startsWith('COMPLAINT_') ? 'COMPLAINT' : 'SYSTEM')
    counts[module] = (counts[module] || 0) + 1
    return counts
  }, {})
}

function formatBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count)
}

function totalUnreadModuleCount(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

export function SupplierShell({ activeKey, title, subtitle, children, actions, filterBar }: SupplierShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [showPageContent, setShowPageContent] = useState(false)
  const [openNotifications, setOpenNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationItems, setNotificationItems] = useState<AppNotification[]>([])
  const [moduleBadgeCounts, setModuleBadgeCounts] = useState<Record<string, number>>({})
  const [slideNotification, setSlideNotification] = useState<AppNotification | null>(null)
  const [hasNewNotificationAnimation, setHasNewNotificationAnimation] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(() => getNotificationSoundEnabled())
  const maxSeenNotificationIdRef = useRef<number | null>(null)
  const liveNotificationIdsRef = useRef<Set<number>>(new Set())
  const notificationItemsRef = useRef<AppNotification[]>([])
  const bellAnimationTimerRef = useRef<number | undefined>(undefined)
  const slideTimerRef = useRef<number | undefined>(undefined)
  const soundEnabledRef = useRef(soundEnabled)
  const { profile } = useCurrentUserProfile()
  const displayName = profile?.shortName ?? profile?.fullName ?? 'Người dùng'
  const roleLabel = profile?.roleLabel ?? 'Nhà cung cấp'
  const initials = profile?.initials ?? 'U'
  const displayedUnreadCount = Math.max(unreadCount, totalUnreadModuleCount(moduleBadgeCounts))

  soundEnabledRef.current = soundEnabled
  notificationItemsRef.current = notificationItems

  useEffect(() => {
    setShowPageContent(false)
    const timerId = window.setTimeout(() => {
      setShowPageContent(true)
    }, SUPPLIER_PAGE_LOAD_DELAY_MS)

    return () => window.clearTimeout(timerId)
  }, [location.pathname])

  // Close sidebar on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function closeSidebar() { setSidebarOpen(false) }

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
    clearSupplierDashboardCache()
    navigate('/auth/login', { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    let timerId: number | undefined
    const showNewNotification = (notification: AppNotification) => {
      if (bellAnimationTimerRef.current) window.clearTimeout(bellAnimationTimerRef.current)
      if (slideTimerRef.current) window.clearTimeout(slideTimerRef.current)
      setHasNewNotificationAnimation(true)
      bellAnimationTimerRef.current = window.setTimeout(() => setHasNewNotificationAnimation(false), 800)
      setSlideNotification(notification)
      slideTimerRef.current = window.setTimeout(() => setSlideNotification(null), 5000)
    }
    const realtimeClient = createNotificationRealtimeClient((notification) => {
      if (liveNotificationIdsRef.current.has(notification.id)) return
      liveNotificationIdsRef.current.add(notification.id)
      maxSeenNotificationIdRef.current = Math.max(maxSeenNotificationIdRef.current || 0, notification.id)
      if (!notification.isRead) setUnreadCount((count) => count + 1)
      const nextItems = notificationItemsRef.current.some((item) => item.id === notification.id)
        ? notificationItemsRef.current
        : [notification, ...notificationItemsRef.current]
      notificationItemsRef.current = nextItems
      setNotificationItems(nextItems)
      if (!notification.isRead && notification.module) {
        setModuleBadgeCounts((counts) => ({ ...counts, [notification.module || 'SYSTEM']: (counts[notification.module || 'SYSTEM'] || 0) + 1 }))
      }
      showNewNotification(notification)
      playNotificationSound(notification, soundEnabledRef.current)
      void loadNotifications()
    })

    const loadNotifications = async () => {
      try {
        const data = await fetchNotifications()
        if (cancelled) return
        const dataItems = data.items || []
        const nextItems = dataItems.length > 0 || notificationItemsRef.current.length === 0 ? dataItems : notificationItemsRef.current
        notificationItemsRef.current = nextItems
        setNotificationItems(nextItems)
        setUnreadCount(dataItems.length > 0 || nextItems.length === 0 ? data.unreadCount || 0 : nextItems.filter((item) => !item.isRead).length)
        setModuleBadgeCounts(moduleCounts(nextItems))
        const latestUnread = (data.items || []).find((item) => !item.isRead)
        const maxFetchedId = (data.items || []).reduce((maxId, item) => Math.max(maxId, item.id || 0), 0)
        if (latestUnread && maxSeenNotificationIdRef.current !== null && latestUnread.id > maxSeenNotificationIdRef.current) {
          liveNotificationIdsRef.current.add(latestUnread.id)
          dispatchNotificationRealtime(latestUnread)
          showNewNotification(latestUnread)
        }
        if (maxFetchedId > 0) {
          maxSeenNotificationIdRef.current = Math.max(maxSeenNotificationIdRef.current || 0, maxFetchedId)
        }
      } catch {
        if (!cancelled) {
          setUnreadCount(notificationItemsRef.current.filter((item) => !item.isRead).length)
        }
      }
    }

    void loadNotifications()
    realtimeClient?.activate()
    timerId = window.setInterval(() => {
      void loadNotifications()
    }, 15000)

    return () => {
      cancelled = true
      void realtimeClient?.deactivate()
      if (timerId) window.clearInterval(timerId)
      if (bellAnimationTimerRef.current) window.clearTimeout(bellAnimationTimerRef.current)
      if (slideTimerRef.current) window.clearTimeout(slideTimerRef.current)
    }
  }, [])

  /* ── Sidebar inner content (shared between desktop + mobile drawer) ── */
  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="border-b border-white/20 px-4 py-5">
          <Link to="/supplier/overview" className="flex items-center gap-3" onClick={closeSidebar}>
            <img src="/images/logo.png" alt="AgriBridge" className="h-8 w-8 rounded-lg" />
            <div>
              <p className="text-[22px] font-extrabold leading-none">AgriBridge</p>
              <p className="text-xs text-emerald-100">Nhà cung cấp</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-1.5">
            {supplierMenuItems.map((item) => {
              const Icon = iconByKey[item.key]
              const isActive = activeKey === item.key
              const badgeCount = notificationModuleByMenuKey[item.key]?.reduce(
                (sum, mod) => sum + (moduleBadgeCounts[mod] || 0), 0
              ) || 0
              return (
                <li key={item.key}>
                  <NavLink
                    to={item.path}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-emerald-800 shadow-[0_2px_8px_rgba(16,120,74,0.25)]'
                        : 'text-emerald-50 hover:bg-emerald-600/40'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {badgeCount > 0 && (
                      <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {badgeCount}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User card */}
        <div className="shrink-0 border-t border-white/15 px-4 py-4">
          <div className="rounded-xl bg-white/10 px-3 py-3">
            <Link to="/supplier/profile" onClick={closeSidebar} className="block">
              <p className="text-sm font-bold text-white">{displayName}</p>
              <p className="text-xs text-emerald-100">{roleLabel}</p>
            </Link>
            <button
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white/90 transition hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-emerald-50/30 text-emerald-950">

      {/* ── Mobile: overlay backdrop ───────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile: slide-in drawer sidebar ───────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transform bg-gradient-to-b from-emerald-700 to-emerald-900 text-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute right-3 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-emerald-200 transition hover:bg-white/20 hover:text-white"
          aria-label="Đóng menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* ── Desktop + mobile layout ────────────────────────────── */}
      <div className="flex h-screen">
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="hidden w-[230px] shrink-0 flex-col border-r border-emerald-700/40 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white lg:flex">
          <SidebarContent />
        </aside>

        {/* Main area */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* ── Top header ───────────────────────────────────── */}
          <header className="shrink-0 sticky top-0 z-30 border-b border-emerald-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              {/* Left: hamburger (mobile) + title */}
              <div className="flex min-w-0 items-center gap-3">
                {/* Hamburger — mobile only */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100 lg:hidden"
                  aria-label="Mở menu"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div className="min-w-0">
                  <h1 className="truncate text-lg font-extrabold leading-tight text-emerald-950 sm:text-xl lg:text-[22px]">
                    {title}
                  </h1>
                  <p className="hidden truncate text-xs text-emerald-900/60 sm:block">{subtitle}</p>
                </div>
              </div>

              {/* Right actions */}
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {/* Bell */}
                <button
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                  onClick={() => setOpenNotifications(true)}
                  aria-label="Thông báo"
                >
                  <Bell className={`h-4 w-4 ${hasNewNotificationAnimation ? 'animate-bell' : ''}`} />
                  {displayedUnreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                      {formatBadgeCount(displayedUnreadCount)}
                    </span>
                  )}
                </button>

                {/* User pill */}
                <Link
                  to="/supplier/profile"
                  className="flex items-center gap-2 rounded-full bg-emerald-50 px-2 py-1.5 transition hover:bg-emerald-100 sm:px-3"
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-sm font-bold text-emerald-800">
                    {initials}
                  </span>
                  <div className="hidden sm:block">
                    <p className="text-sm font-bold text-emerald-900">{displayName}</p>
                    <p className="text-xs text-emerald-700/70">{roleLabel}</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Subtitle on mobile */}
            <p className="mt-1 truncate text-xs text-emerald-900/60 sm:hidden">{subtitle}</p>

            {actions ? <div className="mt-2">{actions}</div> : null}
          </header>

          {filterBar ? (
            <div className="shrink-0 sticky top-[var(--shell-header-h,60px)] z-20 border-b border-slate-100 bg-white/95 px-4 py-2 shadow-sm backdrop-blur-sm">
              {filterBar}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-4">
            {showPageContent ? children : <SupplierPageLoadPlaceholder title={title} />}
          </div>
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
        onNotificationsChange={(nextItems) => {
          notificationItemsRef.current = nextItems
          setNotificationItems(nextItems)
          setModuleBadgeCounts(moduleCounts(nextItems))
        }}
        onNotificationClick={(route) => navigate(route)}
        initialItems={notificationItems}
        initialUnreadCount={displayedUnreadCount}
        soundEnabled={soundEnabled}
        onSoundEnabledChange={(enabled) => {
          setSoundEnabled(enabled)
          setNotificationSoundEnabled(enabled)
        }}
      />
    </div>
  )
}

function SupplierPageLoadPlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-emerald-950">Đang tải {title.toLowerCase()}...</p>
            <p className="text-xs text-emerald-900/60">Đang chuẩn bị dữ liệu nhà cung cấp.</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-8 w-32 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-2 w-full animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-2 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid grid-cols-4 gap-3">
              <div className="h-3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
