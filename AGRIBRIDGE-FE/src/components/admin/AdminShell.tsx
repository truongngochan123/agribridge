import {
  AlertTriangle,
  Bell,
  FileCheck2,
  LayoutGrid,
  LogOut,
  Menu,
  Tags,
  Wallet,
  Users,
  UserCircle2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { NotificationDrawer } from '../site/NotificationDrawer'
import { adminMenuItems } from '../../data/adminDashboardData'
import type { AdminMenuKey } from '../../types/admin'
import { useCurrentUserProfile } from '../../hooks/useCurrentUserProfile'
import { clearAuthSession } from '../../services/authSession'
import { clearCurrentUserProfileCache } from '../../services/currentUserService'
import { fetchNotifications, resolveNotificationRoute, type AppNotification } from '../../services/notificationService'
import { createNotificationRealtimeClient, dispatchNotificationRealtime } from '../../services/notificationRealtimeService'
import { getNotificationSoundEnabled, playNotificationSound, setNotificationSoundEnabled } from '../../services/notificationSoundService'

type AdminShellProps = {
  activeKey: AdminMenuKey
  title: string
  subtitle: string
  children: ReactNode
  actions?: ReactNode
}

const iconByKey = {
  overview:      LayoutGrid,
  users:         Users,
  registrations: FileCheck2,
  categories:    Tags,
  disputes:      AlertTriangle,
  withdrawals:   Wallet,
  profile:       UserCircle2,
}

const notificationModuleByMenuKey: Partial<Record<AdminMenuKey, string[]>> = {
  overview:      ['ADMIN', 'SYSTEM'],
  users:         ['USER'],
  registrations: ['REGISTRATION'],
  categories:    ['CATEGORY'],
  disputes:      ['COMPLAINT', 'INCIDENT', 'DELIVERY'],
  withdrawals:   ['WITHDRAWAL', 'PAYMENT'],
}

function moduleCounts(items: AppNotification[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    if (item.isRead) return counts
    const module = item.module
      || (item.type?.startsWith('REGISTRATION_') ? 'REGISTRATION'
        : item.type?.startsWith('PAYMENT_') ? 'PAYMENT'
          : item.type?.startsWith('ORDER_') ? 'ORDER'
            : item.type?.startsWith('DELIVERY_') ? 'DELIVERY'
              : item.type?.startsWith('COMPLAINT_') ? 'COMPLAINT'
                : item.type === 'SHIPMENT_INCIDENT' || item.type === 'BUYER_COMPLAINT' ? 'INCIDENT'
                  : 'SYSTEM')
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

export function AdminShell({ activeKey, title, subtitle, actions, children }: AdminShellProps) {
  const navigate = useNavigate()
  const [openNotifications, setOpenNotifications] = useState(false)
  const [sidebarOpen, setSidebarOpen]             = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationItems, setNotificationItems] = useState<AppNotification[]>([])
  const [moduleBadgeCounts, setModuleBadgeCounts] = useState<Record<string, number>>({})
  const [slideNotification, setSlideNotification] = useState<AppNotification | null>(null)
  const [hasNewNotificationAnimation, setHasNewNotificationAnimation] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(() => getNotificationSoundEnabled())
  const overlayRef = useRef<HTMLDivElement>(null)
  const maxSeenNotificationIdRef = useRef<number | null>(null)
  const liveNotificationIdsRef = useRef<Set<number>>(new Set())
  const notificationItemsRef = useRef<AppNotification[]>([])
  const bellAnimationTimerRef = useRef<number | undefined>(undefined)
  const slideTimerRef = useRef<number | undefined>(undefined)
  const soundEnabledRef = useRef(soundEnabled)

  const { profile } = useCurrentUserProfile()
  const displayName = profile?.shortName ?? profile?.fullName ?? 'Quản trị viên'
  const roleLabel   = profile?.roleLabel ?? 'Quản trị viên'
  const email       = profile?.email ?? 'admin@agribridge.vn'
  const initials    = profile?.initials ?? 'AD'
  const displayedUnreadCount = Math.max(unreadCount, totalUnreadModuleCount(moduleBadgeCounts))

  soundEnabledRef.current = soundEnabled
  notificationItemsRef.current = notificationItems

  /* Close sidebar when clicking overlay */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /* Close sidebar on route change (any nav click) */
  function closeSidebar() { setSidebarOpen(false) }

  function handleLogout() {
    clearAuthSession()
    clearCurrentUserProfileCache()
    navigate('/admin/login', { replace: true })
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
        const latestUnread = dataItems.find((item) => !item.isRead)
        const maxFetchedId = dataItems.reduce((maxId, item) => Math.max(maxId, item.id || 0), 0)
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

  /* Sidebar content extracted so it can be shared between desktop + mobile */
  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="border-b border-slate-200 px-4 py-5">
          <Link to="/admin/overview" className="flex items-center gap-3" onClick={closeSidebar}>
            <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-emerald-600/10">
              <img src="/images/logo.png" alt="AgriBridge" className="h-8 w-8 object-contain" />
            </span>
            <div>
              <p className="text-xl font-extrabold leading-none text-slate-900">Admin</p>
              <p className="text-xs text-slate-500">Quản trị viên</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1.5">
            {adminMenuItems.map((item) => {
              const Icon = iconByKey[item.key]
              const isActive = item.key === activeKey
              const badgeCount = notificationModuleByMenuKey[item.key]?.reduce(
                (sum, mod) => sum + (moduleBadgeCounts[mod] || 0), 0
              ) || 0
              return (
                <li key={item.key}>
                  <NavLink
                    to={item.path}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/10 text-emerald-800 shadow-sm ring-1 ring-emerald-200/60'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition ${
                      isActive
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm'
                        : 'text-slate-500'
                    }`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {item.label}
                    {badgeCount > 0 && (
                      <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {formatBadgeCount(badgeCount)}
                      </span>
                    )}
                    {isActive && (
                      <span className={badgeCount > 0 ? 'h-1.5 w-1.5 rounded-full bg-emerald-500' : 'ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500'} />
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User card */}
        <div className="shrink-0 border-t border-slate-200 px-4 py-4">
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <Link
              to="/admin/profile"
              onClick={closeSidebar}
              className="flex items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-white"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-bold text-white shadow-sm">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{roleLabel}</p>
              </div>
            </Link>
            <p className="mt-2 truncate px-1 text-xs text-slate-400">{email}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 inline-flex items-center gap-2 px-1 text-xs font-semibold text-red-500 transition hover:text-red-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      {/* ── Mobile: overlay sidebar ─────────────────────────────── */}
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer sidebar (mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transform border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute right-3 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Đóng menu"
        >
          <X className="h-4 w-4" />
        </button>

        <SidebarContent />
      </aside>

      {/* ── Desktop layout: fixed sidebar + main ─────────────────── */}
      <div className="flex h-screen">
        {/* Desktop sidebar (always visible, hidden on mobile) */}
        <aside className="hidden w-[230px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <SidebarContent />
        </aside>

        {/* Main area */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* ── Top header ─────────────────────────────────────── */}
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              {/* Left: hamburger (mobile) + title */}
              <div className="flex min-w-0 items-center gap-3">
                {/* Hamburger — only mobile */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 lg:hidden"
                  aria-label="Mở menu"
                >
                  <Menu className="h-5 w-5" />
                </button>

                {/* Title block */}
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl lg:text-3xl">
                    {title}
                  </h1>
                  <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</p>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {/* Bell */}
                <button
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
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

                {/* User pill — hide name+email on small screens */}
                <Link
                  to="/admin/profile"
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-bold text-white shadow-sm sm:h-8 sm:w-8">
                    {initials}
                  </span>
                  <div className="hidden pr-1 text-left sm:block">
                    <p className="text-xs font-bold text-slate-900">{displayName}</p>
                    <p className="text-xs text-slate-500">{email}</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Subtitle on mobile (shows below header row) */}
            <p className="mt-1.5 truncate text-xs text-slate-500 sm:hidden">{subtitle}</p>

            {actions ? <div className="mt-3">{actions}</div> : null}
          </header>

          {/* ── Page content ───────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
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
