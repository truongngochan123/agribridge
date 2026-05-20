import { BellRing, CheckCircle2, Clock3, ExternalLink, TimerReset } from 'lucide-react'

export type DebtReminderRole = 'buyer' | 'supplier'
export type DebtReminderSeverity = 'overdue' | 'dueSoon' | 'paid' | 'normal'

export type DebtReminderCardItem = {
  reminderId: number
  invoiceId?: number | null
  invoiceNumber?: string | null
  orderId?: number | null
  orderCode?: string | null
  productName?: string | null
  quantity?: number | null
  unit?: string | null
  dueDate?: string | null
  dueLabel?: string | null
  amount?: number | null
  message?: string | null
  status?: string | null
  senderName?: string | null
  sentAt?: string | null
  createdAt?: string | null
  invoiceStatus?: string | null
  overdueDays?: number | null
  outstandingAmount?: number | null
}

type DebtReminderCardProps = {
  item: DebtReminderCardItem
  role: DebtReminderRole
  counterpartyName?: string | null
  onOpen?: (item: DebtReminderCardItem) => void
}

type ReminderGroup = {
  label: string
  items: DebtReminderCardItem[]
}

const severityConfig: Record<DebtReminderSeverity, { label: string; classes: string; icon: React.ReactElement }> = {
  overdue: {
    label: 'Quá hạn',
    classes: 'border-rose-200 bg-rose-50/40 text-rose-700',
    icon: <BellRing className="h-4 w-4" />,
  },
  dueSoon: {
    label: 'Sắp đến hạn',
    classes: 'border-amber-200 bg-amber-50/40 text-amber-700',
    icon: <TimerReset className="h-4 w-4" />,
  },
  paid: {
    label: 'Đã thanh toán',
    classes: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  normal: {
    label: 'Cần theo dõi',
    classes: 'border-slate-200 bg-slate-50 text-slate-600',
    icon: <Clock3 className="h-4 w-4" />,
  },
}

export function DebtReminderList({
  items,
  role,
  counterpartyName,
  empty,
  onOpen,
}: {
  items: DebtReminderCardItem[]
  role: DebtReminderRole
  counterpartyName?: string | null
  empty: string
  onOpen?: (item: DebtReminderCardItem) => void
}) {
  const groups = groupRemindersByDate(items)
  if (!items.length) {
    return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">{empty}</p>
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label} className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">{group.label}</h4>
          <div className="space-y-3">
            {group.items.map((item) => (
              <DebtReminderCard
                key={item.reminderId}
                item={item}
                role={role}
                counterpartyName={counterpartyName}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function DebtReminderCard({ item, role, counterpartyName, onOpen }: DebtReminderCardProps) {
  const severity = getReminderSeverity(item)
  const status = formatReminderStatus(item.status, role)
  const canOpen = Boolean(onOpen && item.invoiceId)
  const orderCode = formatReminderOrderCode(item)

  return (
    <article
      className={`group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${severityBorderClass(severity)} ${canOpen ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (canOpen) onOpen?.(item)
      }}
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onKeyDown={(event) => {
        if (!canOpen) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen?.(item)
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ReminderSeverityIcon severity={severity} />
            <h3 className="text-sm font-semibold leading-6 text-slate-900">
              {formatReminderTitle(item, role, severity)}
            </h3>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {formatReminderDescription(item, role, counterpartyName)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ReminderStatusBadge status={status} severity={severity} />
          {canOpen ? <ExternalLink className="h-4 w-4 text-slate-300 transition group-hover:text-slate-500" /> : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-400">{role === 'buyer' ? 'Còn nợ' : 'Số tiền còn nợ'}</dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-900">{formatReminderAmount(item.amount)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-400">Hạn thanh toán</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-700">{formatReminderDate(item.dueDate, item.dueLabel)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{formatReminderTimestamp(item.sentAt || item.createdAt)}</span>
        <span className="h-1 w-1 rounded-full bg-slate-300" />
        <span>{orderCode}</span>
      </div>
    </article>
  )
}

export function ReminderStatusBadge({ status, severity }: { status: string; severity: DebtReminderSeverity }) {
  const cls = severity === 'overdue'
    ? 'bg-rose-50 text-rose-700 ring-rose-100'
    : severity === 'dueSoon'
      ? 'bg-amber-50 text-amber-700 ring-amber-100'
      : severity === 'paid'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
        : 'bg-slate-50 text-slate-600 ring-slate-100'
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cls}`}>{status}</span>
}

export function ReminderSeverityIcon({ severity }: { severity: DebtReminderSeverity }) {
  const config = severityConfig[severity]
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${config.classes}`} title={config.label}>
      {config.icon}
    </span>
  )
}

export function formatReminderTitle(item: DebtReminderCardItem, role: DebtReminderRole, severity?: DebtReminderSeverity) {
  const orderCode = formatReminderOrderCode(item)
  const currentSeverity = severity ?? getReminderSeverity(item)
  if (currentSeverity === 'paid') return `Đã thanh toán đơn ${orderCode}`
  if (currentSeverity === 'overdue') return role === 'buyer' ? `Quá hạn thanh toán đơn ${orderCode}` : `Đã gửi nhắc quá hạn đơn ${orderCode}`
  if (currentSeverity === 'dueSoon') return role === 'buyer' ? `Sắp đến hạn thanh toán đơn ${orderCode}` : `Đã gửi nhắc sắp đến hạn đơn ${orderCode}`
  return role === 'buyer' ? `Nhắc thanh toán đơn ${orderCode}` : `Đã gửi nhắc thanh toán đơn ${orderCode}`
}

export function formatReminderAmount(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ`
}

export function formatReminderDate(value?: string | null, fallback?: string | null) {
  if (fallback) return fallback
  if (!value) return 'Đang cập nhật'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function formatReminderTimestamp(value?: string | null) {
  if (!value) return 'Đang cập nhật'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${date.toLocaleDateString('vi-VN')}`
}

function formatReminderStatus(status?: string | null, role?: DebtReminderRole) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'READ' || normalized === 'SEEN') return role === 'buyer' ? 'Đã đọc' : 'Đã xem'
  if (normalized === 'SENT' || normalized === 'UNREAD' || normalized === 'NEW') return role === 'buyer' ? 'Chưa đọc' : 'Mới'
  if (normalized === 'PAID' || normalized === 'RESOLVED') return 'Đã thanh toán'
  return 'Mới'
}

function formatReminderDescription(item: DebtReminderCardItem, role: DebtReminderRole, counterpartyName?: string | null) {
  const product = formatReminderProduct(item)
  if (role === 'buyer') {
    if (item.message) return item.message
    const supplierName = counterpartyName || item.senderName || 'Nhà cung cấp'
    return `${supplierName} nhắc bạn thanh toán phần còn lại của đơn ${product}.`
  }
  const buyerName = counterpartyName || 'khách hàng'
  return `Đã gửi nhắc thanh toán cho ${buyerName} về khoản nợ còn lại của đơn ${product}.`
}

function formatReminderProduct(item: DebtReminderCardItem) {
  const productName = item.productName || 'hàng hóa'
  const quantity = item.quantity == null ? '' : ` ${Number(item.quantity).toLocaleString('vi-VN')}${item.unit || ''}`
  return `${productName}${quantity}`
}

function formatReminderOrderCode(item: DebtReminderCardItem) {
  return item.orderCode || (item.orderId ? `ORD-${item.orderId}` : item.invoiceNumber || `#${item.reminderId}`)
}

function getReminderSeverity(item: DebtReminderCardItem): DebtReminderSeverity {
  const status = String(item.invoiceStatus || '').toUpperCase()
  const outstanding = Number(item.outstandingAmount ?? item.amount ?? 0)
  if (status === 'PAID' || outstanding <= 0) return 'paid'
  if (status === 'OVERDUE' || Number(item.overdueDays || 0) > 0) return 'overdue'

  const due = parseReminderDate(item.dueDate)
  if (due) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
    if (diffDays < 0) return 'overdue'
    if (diffDays <= 3) return 'dueSoon'
  }

  return 'normal'
}

function groupRemindersByDate(items: DebtReminderCardItem[]): ReminderGroup[] {
  const sortedItems = [...items].sort((a, b) => {
    const aTime = new Date(a.sentAt || a.createdAt || 0).getTime()
    const bTime = new Date(b.sentAt || b.createdAt || 0).getTime()
    return bTime - aTime
  })
  const groups = new Map<string, DebtReminderCardItem[]>()

  sortedItems.forEach((item) => {
    const label = formatReminderGroupLabel(item.sentAt || item.createdAt)
    groups.set(label, [...(groups.get(label) || []), item])
  })

  return Array.from(groups.entries()).map(([label, groupItems]) => ({ label, items: groupItems }))
}

function formatReminderGroupLabel(value?: string | null) {
  const date = parseReminderDate(value)
  if (!date) return 'Khác'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Hôm nay'
  if (diffDays === 1) return 'Hôm qua'
  return target.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function parseReminderDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function severityBorderClass(severity: DebtReminderSeverity) {
  if (severity === 'overdue') return 'border-l-4 border-l-rose-500 border-y-slate-200 border-r-slate-200'
  if (severity === 'dueSoon') return 'border-l-4 border-l-amber-400 border-y-slate-200 border-r-slate-200'
  if (severity === 'paid') return 'border-l-4 border-l-emerald-500 border-y-slate-200 border-r-slate-200'
  return 'border-slate-200'
}
