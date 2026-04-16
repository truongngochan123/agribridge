import { Bell, CheckCheck, CircleDot, Package, TrendingUp, X } from 'lucide-react'
import { notificationItems, notificationUnreadCount } from '../../data/notifications'

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
}

export function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/35" onClick={onClose}>
      <aside
        className="absolute right-4 top-16 w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">Thông báo</h3>
            <p className="text-sm text-slate-500">{notificationUnreadCount} chưa đọc</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 p-2">
          <button className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Tất cả</button>
          <button className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Chưa đọc ({notificationUnreadCount})</button>
        </div>

        <div className="max-h-[520px] overflow-y-auto">
          {notificationItems.map((item) => {
            const Icon = iconByColor[item.color]
            return (
              <article key={item.id} className="flex gap-3 border-b border-slate-100 px-4 py-3">
                <span className={`mt-1 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full ${dotClassByColor[item.color]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{item.description}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.time}</p>
                </div>
              </article>
            )
          })}
        </div>

        <div className="border-t border-slate-200 p-3">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-200">
            <CheckCheck className="h-4 w-4" /> Đánh dấu tất cả đã đọc
          </button>
        </div>
      </aside>
    </div>
  )
}
