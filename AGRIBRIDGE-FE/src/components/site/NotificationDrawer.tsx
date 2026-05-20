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
  ORDER: { label: 'Đơn hàng', className: 'bg-blue-100 text-blue-700', icon: Package },
  DELIVERY: { label: 'Giao hàng', className: 'bg-cyan-100 text-cyan-700', icon: Truck },
  DEBT: { label: 'Công nợ', className: 'bg-amber-100 text-amber-700', icon: ReceiptText },
  PAYMENT: { label: 'Thanh toán', className: 'bg-emerald-100 text-emerald-700', icon: ReceiptText },
  RFQ: { label: 'RFQ', className: 'bg-violet-100 text-violet-700', icon: Hand },
  QUOTE: { label: 'Báo giá', className: 'bg-violet-100 text-violet-700', icon: Hand },
  COMPLAINT: { label: 'Khiếu nại', className: 'bg-rose-100 text-rose-700', icon: MessageSquareWarning },
  INCIDENT: { label: 'Sự cố', className: 'bg-orange-100 text-orange-800', icon: MessageSquareWarning },
  PRODUCT: { label: 'Sản phẩm', className: 'bg-slate-100 text-slate-700', icon: Package },
  SYSTEM: { label: 'Hệ thống', className: 'bg-slate-100 text-slate-700', icon: Bell },
}

const moduleByType: Record<string, keyof typeof moduleStyle> = {
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
    return () => {
      cancelled = true
    }
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

  return (
    <div className="fixed inset-0 z-[70] bg-black/35" onClick={onClose}>
      <aside
        className="absolute right-4 top-16 w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">Thông báo</h3>
            <p className="text-sm text-slate-500">{unreadCount} chưa đọc</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 border-b border-slate-200 p-2">
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setActiveTab('all')}
          >
            Tất cả
          </button>
          <button
            className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${activeTab === 'incident' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setActiveTab('incident')}
          >
            Sự cố ({incidentCount})
          </button>
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'action' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setActiveTab('action')}
          >
            Cần xử lý ({actionCount})
          </button>
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'unread' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setActiveTab('unread')}
          >
            Chưa đọc ({unreadCount})
          </button>
        </div>

        <div className="max-h-[520px] overflow-y-auto">
          {visibleItems.map((item) => {
            const moduleKey = ((item.module || (item.type ? moduleByType[item.type] : '') || 'SYSTEM') as keyof typeof moduleStyle)
            const incidentNotification = isIncidentNotification(item)
            const style = incidentNotification ? moduleStyle.INCIDENT : moduleStyle[moduleKey] || moduleStyle.SYSTEM
            const Icon = style.icon || CircleDot
            const metadata = parseNotificationMetadata(item.metadata)
            const shipmentId = metadata.shipmentId || metadata.rawShipmentId
            const buyerName = metadata.buyerName
            const issueSummary = metadata.issueSummary
            return (
              <button
                key={item.id}
                className={`flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                  incidentNotification
                    ? `border-orange-100 ${highlightedIds.has(item.id) ? 'bg-orange-100' : item.isRead ? 'bg-orange-50/40' : 'bg-orange-50'}`
                    : `border-slate-100 ${highlightedIds.has(item.id) ? 'bg-amber-50' : item.isRead ? '' : 'bg-blue-50/40'}`
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
                <span className={`mt-1 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full ${style.className}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${style.className}`}>{style.label}</span>
                    {incidentNotification ? <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold text-white">Sự cố</span> : null}
                    {needsAction(item) ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Cần xử lý</span> : null}
                    {!item.isRead ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{item.body}</p>
                  {incidentNotification ? (
                    <div className="mt-2 grid gap-1 rounded-lg border border-orange-100 bg-white/80 px-2.5 py-2 text-xs text-slate-600">
                      {shipmentId ? <span><strong className="text-slate-800">Vận đơn:</strong> {String(shipmentId)}</span> : null}
                      {buyerName ? <span><strong className="text-slate-800">Bên mua:</strong> {String(buyerName)}</span> : null}
                      {issueSummary ? <span className="line-clamp-2"><strong className="text-slate-800">Tóm tắt:</strong> {String(issueSummary)}</span> : null}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-400">{formatTime(item.createdAt)}</p>
                </div>
              </button>
            )
          })}
          {loaded && visibleItems.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Hiện chưa có thông báo phù hợp.</p>
          ) : null}
        </div>

        <div className="border-t border-slate-200 p-3">
          <label className="mb-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-slate-500" />
              Âm thanh thông báo
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
              checked={soundEnabled}
              onChange={(event) => onSoundEnabledChange?.(event.target.checked)}
            />
          </label>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
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
            <CheckCheck className="h-4 w-4" /> Đánh dấu tất cả đã đọc
          </button>
        </div>
      </aside>
    </div>
  )
}
