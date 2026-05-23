import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, CircleDot, Hand, MessageSquareWarning, Package, ReceiptText, Truck, Volume2, X } from 'lucide-react'
import { NOTIFICATION_REALTIME_EVENT } from '../../services/notificationRealtimeService'
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  parseNotificationMetadata,
  resolveNotificationRoute,
  type AppNotification,
} from '../../services/notificationService'

const moduleStyle = {
  ORDER:     { label: 'Đơn hàng',  bg: 'bg-blue-100',   text: 'text-blue-700',   accent: 'bg-blue-500',   icon: Package },
  DELIVERY:  { label: 'Giao hàng', bg: 'bg-cyan-100',    text: 'text-cyan-700',   accent: 'bg-cyan-500',   icon: Truck },
  DEBT:      { label: 'Công nợ',   bg: 'bg-amber-100',   text: 'text-amber-700',  accent: 'bg-amber-500',  icon: ReceiptText },
  PAYMENT:   { label: 'Thanh toán',bg: 'bg-emerald-100', text: 'text-emerald-700',accent: 'bg-emerald-500',icon: ReceiptText },
  RFQ:       { label: 'RFQ',       bg: 'bg-violet-100',  text: 'text-violet-700', accent: 'bg-violet-500', icon: Hand },
  QUOTE:     { label: 'Báo giá',   bg: 'bg-violet-100',  text: 'text-violet-700', accent: 'bg-violet-500', icon: Hand },
  COMPLAINT: { label: 'Khiếu nại', bg: 'bg-rose-100',    text: 'text-rose-700',   accent: 'bg-rose-500',   icon: MessageSquareWarning },
  INCIDENT:  { label: 'Sự cố',     bg: 'bg-orange-100',  text: 'text-orange-700', accent: 'bg-orange-500', icon: MessageSquareWarning },
  PRODUCT:   { label: 'Sản phẩm',  bg: 'bg-slate-100',   text: 'text-slate-600',  accent: 'bg-slate-400',  icon: Package },
  SYSTEM:    { label: 'Hệ thống',  bg: 'bg-slate-100',   text: 'text-slate-600',  accent: 'bg-slate-400',  icon: Bell },
} as const

type ModuleKey = keyof typeof moduleStyle

const moduleByType: Record<string, ModuleKey> = {
  DEBT_REMINDER: 'DEBT',
  DEBT_CREDIT_LIMIT_GRANTED: 'DEBT',
  PAYMENT_DUE: 'DEBT',
  DEBT_OVERDUE: 'DEBT',
  DEBT_PAYMENT_CONFIRMED: 'PAYMENT',
  PAYMENT_REMAINING_REQUIRED: 'DEBT',
  PAYMENT_DEPOSIT_PAID_FOR_SUPPLIER: 'PAYMENT',
  PAYMENT_REMAINING_PAID_FOR_SUPPLIER: 'PAYMENT',
  PAYMENT_COMPLETED_FOR_BUYER: 'PAYMENT',
  RFQ_RESPONSE: 'RFQ',
  SHIPMENT_INCIDENT: 'INCIDENT',
  DELIVERY_DISPUTE: 'INCIDENT',
  BUYER_COMPLAINT: 'INCIDENT',
  COMPLAINT_CREATED_FOR_SUPPLIER: 'INCIDENT',
}

const incidentTypes = new Set(['SHIPMENT_INCIDENT', 'DELIVERY_DISPUTE', 'BUYER_COMPLAINT', 'COMPLAINT_CREATED_FOR_SUPPLIER'])

type NotificationDrawerProps = {
  open: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
  onNotificationsChange?: (items: AppNotification[]) => void
  onNotificationClick?: (route: string) => void
  initialItems?: AppNotification[]
  initialUnreadCount?: number
  soundEnabled?: boolean
  onSoundEnabledChange?: (enabled: boolean) => void
}

function formatTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export function NotificationDrawer({
  open,
  onClose,
  onUnreadCountChange,
  onNotificationsChange,
  onNotificationClick,
  initialItems = [],
  initialUnreadCount,
  soundEnabled = false,
  onSoundEnabledChange,
}: NotificationDrawerProps) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'incident' | 'action' | 'unread'>('all')
  const [marking, setMarking] = useState(false)
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(new Set())
  const onUnreadCountChangeRef = useRef(onUnreadCountChange)
  const onNotificationsChangeRef = useRef(onNotificationsChange)

  onUnreadCountChangeRef.current = onUnreadCountChange
  onNotificationsChangeRef.current = onNotificationsChange

  const applyList = (data: { items: AppNotification[]; unreadCount: number }, preserveCurrentIfEmpty = false) => {
    const dataItems = data.items || []
    if (preserveCurrentIfEmpty && dataItems.length === 0) {
      setItems((current) => {
        if (current.length === 0) {
          onNotificationsChange?.([])
          setUnreadCount(0)
          onUnreadCountChange?.(0)
        } else {
          const nextUnread = current.filter((item) => !item.isRead).length
          setUnreadCount(nextUnread)
          onUnreadCountChange?.(nextUnread)
        }
        return current
      })
      return
    }
    setItems(dataItems)
    onNotificationsChange?.(dataItems)
    const nextUnread = data.unreadCount || 0
    setUnreadCount(nextUnread)
    onUnreadCountChange?.(nextUnread)
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    if (initialItems.length > 0) {
      setItems(initialItems)
      setUnreadCount(initialUnreadCount ?? initialItems.filter((item) => !item.isRead).length)
      onNotificationsChange?.(initialItems)
      setLoaded(true)
    }
    fetchNotifications()
      .then((data) => {
        if (cancelled) return
        applyList(data, initialItems.length > 0)
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    const highlightTimers: number[] = []
    const handleRealtime = (event: Event) => {
      const notification = (event as CustomEvent<AppNotification>).detail
      if (!notification?.id) return
      setItems((current) => {
        if (current.some((item) => item.id === notification.id)) return current
        const next = [notification, ...current]
        onNotificationsChangeRef.current?.(next)
        return next
      })
      setHighlightedIds((current) => new Set(current).add(notification.id))
      const timerId = window.setTimeout(() => {
        setHighlightedIds((current) => {
          const next = new Set(current)
          next.delete(notification.id)
          return next
        })
      }, 3500)
      highlightTimers.push(timerId)
      if (!notification.isRead) {
        setUnreadCount((count) => {
          const next = count + 1
          onUnreadCountChangeRef.current?.(next)
          return next
        })
      }
      void fetchNotifications().then(applyList).catch(() => undefined)
    }
    window.addEventListener(NOTIFICATION_REALTIME_EVENT, handleRealtime)
    return () => {
      window.removeEventListener(NOTIFICATION_REALTIME_EVENT, handleRealtime)
      highlightTimers.forEach((timerId) => window.clearTimeout(timerId))
    }
  }, [open])

  if (!open) return null

  const needsAction = (item: AppNotification) => {
    if (item.actionRequired) return true
    const metadata = parseNotificationMetadata(item.metadata)
    return Boolean(metadata?.actionRequired)
  }

  const isIncidentNotification = (item: AppNotification) => {
    const metadata = parseNotificationMetadata(item.metadata)
    return Boolean(
      (item.type && incidentTypes.has(item.type)) ||
      item.entityType === 'SHIPMENT_INCIDENT' ||
      metadata.incidentId ||
      metadata.targetModal === 'incident',
    )
  }

  const prioritizedItems = [...items].sort((a, b) => {
    const aUrgent = isIncidentNotification(a) && needsAction(a) ? 1 : 0
    const bUrgent = isIncidentNotification(b) && needsAction(b) ? 1 : 0
    if (aUrgent !== bUrgent) return bUrgent - aUrgent
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })

  const visibleItems = loaded
    ? activeTab === 'unread'
      ? prioritizedItems.filter((item) => !item.isRead)
      : activeTab === 'incident'
        ? prioritizedItems.filter(isIncidentNotification)
        : activeTab === 'action'
          ? prioritizedItems.filter(needsAction)
          : prioritizedItems
    : []

  const actionCount = items.filter(needsAction).length
  const incidentCount = items.filter(isIncidentNotification).length

  const tabs = [
    { key: 'all' as const,      label: 'Tất cả',    count: items.length,   activeColor: 'bg-emerald-600 text-white shadow-sm' },
    { key: 'incident' as const, label: 'Sự cố',     count: incidentCount,  activeColor: 'bg-orange-500 text-white shadow-sm' },
    { key: 'action' as const,   label: 'Cần xử lý', count: actionCount,    activeColor: 'bg-rose-500 text-white shadow-sm' },
    { key: 'unread' as const,   label: 'Chưa đọc',  count: unreadCount,    activeColor: 'bg-blue-600 text-white shadow-sm' },
  ]

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        className="absolute right-4 top-16 flex w-full max-w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.2)]"
        style={{ maxHeight: 'calc(100vh - 5rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600 px-4 py-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(ellipse at 80% 0%, rgba(255,255,255,0.8) 0%, transparent 55%)' }}
          />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/20">
                <Bell className="h-5 w-5 text-white" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-slate-700">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </div>
              <div>
                <h3 className="text-base font-black text-white">Thông báo</h3>
                <p className="text-[11px] text-white/60">
                  {unreadCount > 0 ? (
                    <span className="font-semibold text-emerald-300">{unreadCount} chưa đọc</span>
                  ) : (
                    'Tất cả đã đọc ✓'
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-white/70 transition hover:bg-white/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition-all ${
                  activeTab === tab.key
                    ? tab.activeColor
                    : 'text-slate-500 hover:bg-white hover:text-slate-700'
                }`}
              >
                <span className="truncate">{tab.label}</span>
                {tab.count > 0 ? (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                    activeTab === tab.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* ── Notification list ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!loaded ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <p className="text-xs font-semibold text-slate-400">Đang tải thông báo...</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Bell className="h-7 w-7 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500">Không có thông báo</p>
                <p className="mt-0.5 text-xs text-slate-400">Hiện chưa có thông báo phù hợp</p>
              </div>
            </div>
          ) : (
            visibleItems.map((item) => {
              const moduleKey = ((item.module || (item.type ? moduleByType[item.type] : '') || 'SYSTEM') as ModuleKey)
              const isIncident = isIncidentNotification(item)
              const style = isIncident ? moduleStyle.INCIDENT : (moduleStyle[moduleKey] ?? moduleStyle.SYSTEM)
              const Icon = style.icon || CircleDot
              const metadata = parseNotificationMetadata(item.metadata)
              const shipmentId = metadata.shipmentId || metadata.rawShipmentId
              const buyerName = metadata.buyerName
              const issueSummary = metadata.issueSummary
              const isHighlighted = highlightedIds.has(item.id)
              const isUnread = !item.isRead

              return (
                <button
                  key={item.id}
                  className={`group relative flex w-full gap-3 border-b px-4 py-3.5 text-left transition-all duration-150 hover:bg-slate-50 ${
                    isHighlighted
                      ? 'bg-amber-50/80 border-amber-100'
                      : isIncident
                        ? isUnread ? 'bg-orange-50/60 border-orange-100' : 'bg-orange-50/25 border-orange-50'
                        : isUnread
                          ? 'bg-blue-50/40 border-slate-100'
                          : 'bg-white border-slate-100'
                  }`}
                  onClick={async () => {
                    let optimisticUnread = unreadCount
                    if (!item.isRead) {
                      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)))
                      optimisticUnread = Math.max(unreadCount - 1, 0)
                      setUnreadCount(optimisticUnread)
                      onUnreadCountChange?.(optimisticUnread)
                      try {
                        const data = await markNotificationAsRead(item.id)
                        applyList(data)
                      } catch {
                        const data = await fetchNotifications()
                        applyList(data)
                      }
                    }
                    const route = resolveNotificationRoute(item)
                    onNotificationClick?.(route)
                    onClose()
                  }}
                >
                  {/* Left accent bar for unread */}
                  {isUnread ? (
                    <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${style.accent}`} />
                  ) : null}

                  {/* Module icon */}
                  <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.text} ring-1 ring-black/5`}>
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      {isIncident ? (
                        <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-black text-white">SỰ CỐ</span>
                      ) : null}
                      {needsAction(item) ? (
                        <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black text-white">CẦN XỬ LÝ</span>
                      ) : null}
                      {isUnread ? (
                        <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                      ) : null}
                    </div>

                    {/* Title */}
                    <p className={`mt-1.5 text-[13px] leading-snug ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                      {item.title}
                    </p>

                    {/* Body */}
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 leading-relaxed">{item.body}</p>

                    {/* Incident extra info */}
                    {isIncident && (shipmentId || buyerName || issueSummary) ? (
                      <div className="mt-2 rounded-lg border border-orange-100 bg-orange-50/60 px-2.5 py-2 text-[11px] text-slate-600 space-y-0.5">
                        {shipmentId ? <p><span className="font-bold text-slate-700">Vận đơn:</span> {String(shipmentId)}</p> : null}
                        {buyerName ? <p><span className="font-bold text-slate-700">Bên mua:</span> {String(buyerName)}</p> : null}
                        {issueSummary ? <p className="line-clamp-2"><span className="font-bold text-slate-700">Tóm tắt:</span> {String(issueSummary)}</p> : null}
                      </div>
                    ) : null}

                    {/* Time */}
                    <p className="mt-1.5 text-[10px] font-medium text-slate-400">{formatTime(item.createdAt)}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 p-3 space-y-2">
          {/* Sound toggle */}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Volume2 className="h-4 w-4 text-slate-400" />
              Âm thanh thông báo
            </span>
            {/* Custom toggle switch */}
            <div className={`relative h-5 w-9 rounded-full transition-colors ${soundEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={soundEnabled}
                onChange={(e) => onSoundEnabledChange?.(e.target.checked)}
              />
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${soundEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </label>

          {/* Mark all read */}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={marking || unreadCount <= 0}
            onClick={async () => {
              setMarking(true)
              const previousItems = items
              const previousUnread = unreadCount
              setItems((current) => current.map((item) => ({ ...item, isRead: true })))
              setUnreadCount(0)
              onUnreadCountChange?.(0)
              try {
                const data = await markAllNotificationsAsRead()
                applyList(data)
                setActiveTab('all')
              } catch {
                try {
                  const data = await fetchNotifications()
                  applyList(data)
                } catch {
                  setItems(previousItems)
                  setUnreadCount(previousUnread)
                  onUnreadCountChange?.(previousUnread)
                }
              } finally {
                setMarking(false)
              }
            }}
          >
            {marking ? (
              <><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Đang xử lý...</>
            ) : (
              <><CheckCheck className="h-3.5 w-3.5" />Đánh dấu tất cả đã đọc</>
            )}
          </button>
        </div>
      </aside>
    </div>
  )
}
