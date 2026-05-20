import { useEffect, useState } from 'react'
import { Bell, CheckCheck, CircleDot, Package, TrendingUp, X } from 'lucide-react'
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  resolveNotificationRoute,
  type AppNotification,
} from '../../services/notificationService'

const dotClassByColor = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  teal: 'bg-teal-100 text-teal-600',
}

const iconByColor = {
  blue: Bell,
  green: Package,
  amber: CircleDot,
  teal: TrendingUp,
}

type NotificationDrawerProps = {
  open: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
  onNotificationClick?: (route: string) => void
}

function formatTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export function NotificationDrawer({ open, onClose, onUnreadCountChange, onNotificationClick }: NotificationDrawerProps) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const [marking, setMarking] = useState(false)

  const applyList = (data: { items: AppNotification[]; unreadCount: number }) => {
    setItems(data.items || [])
    const nextUnread = data.unreadCount || 0
    setUnreadCount(nextUnread)
    onUnreadCountChange?.(nextUnread)
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchNotifications()
      .then((data) => {
        if (cancelled) return
        applyList(data)
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null
  const visibleItems = loaded ? (activeTab === 'unread' ? items.filter((item) => !item.isRead) : items) : []

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

        <div className="flex border-b border-slate-200 p-2">
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setActiveTab('all')}
          >
            Tất cả
          </button>
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'unread' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setActiveTab('unread')}
          >
            Chưa đọc ({unreadCount})
          </button>
        </div>

        <div className="max-h-[520px] overflow-y-auto">
          {visibleItems.map((item, index) => {
            const palette = ['blue', 'green', 'amber', 'teal'] as const
            const color = item.type === 'DEBT_PAYMENT_CONFIRMED' ? 'green' : palette[index % palette.length]
            const Icon = iconByColor[color]
            return (
              <button
                key={item.id}
                className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${item.isRead ? '' : 'bg-blue-50/40'}`}
                onClick={async () => {
                  if (!item.isRead) {
                    const data = await markNotificationAsRead(item.id)
                    applyList(data)
                  }
                  const route = resolveNotificationRoute(item)
                  onNotificationClick?.(route)
                  onClose()
                }}
              >
                <span className={`mt-1 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full ${dotClassByColor[color]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{item.body}</p>
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
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={marking || unreadCount <= 0}
            onClick={async () => {
              setMarking(true)
              try {
                const data = await markAllNotificationsAsRead()
                applyList(data)
                setActiveTab('all')
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
