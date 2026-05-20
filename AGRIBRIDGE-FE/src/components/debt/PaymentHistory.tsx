import type React from 'react'
import { Banknote, CheckCircle2, Clock3, CreditCard, ReceiptText, RotateCcw, TriangleAlert } from 'lucide-react'

export type PaymentHistoryRole = 'buyer' | 'supplier'
export type PaymentHistoryStatus = 'paid' | 'partial' | 'overdue' | 'refunded' | 'settled' | 'deposit'

export type PaymentHistoryItem = {
  id: string
  role: PaymentHistoryRole
  amount?: number | null
  status?: PaymentHistoryStatus
  paymentMethod?: string | null
  paymentDate?: string | null
  note?: string | null
  invoiceCode?: string | number | null
  orderCode?: string | number | null
  counterpartyName?: string | null
  counterpartyLabel?: string
  description?: string
  invoiceId?: number | null
  paymentId?: number | null
  paymentPlanType?: string | null
}

type PaymentTone = {
  icon: React.ReactNode
  label: string
  dotClass: string
  badgeClass: string
  borderClass: string
  titleClass: string
}

const emptyText = 'Chưa có'

const windows1252ByteMap: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
}

export function normalizeVietnameseText(value?: string | number | null) {
  if (value == null) return ''
  const text = String(value).normalize('NFC')
  if (!/[\u00c2-\u00c4\u00c6-\u00cf\u00e1\u00e2\u00e3\u00e8-\u00ef\u00f2-\u00f5\u00f9-\u00fd\u2018-\u201d\u2022\ufffd]/.test(text)) return text
  if (text.includes('\ufffd')) return text

  const bytes: number[] = []
  for (const char of text) {
    const code = char.charCodeAt(0)
    const byte = code <= 0xff ? code : windows1252ByteMap[code]
    if (byte == null) return text
    bytes.push(byte)
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)).normalize('NFC')
  } catch {
    return text
  }
}

export function formatCurrency(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ`
}

export function formatPaymentMethod(method?: string | null) {
  const clean = normalizeVietnameseText(method).trim()
  const normalized = clean.toUpperCase()
  if (!normalized) return emptyText
  if (normalized.includes('BANK_TRANSFER') || normalized.includes('TRANSFER') || normalized.includes('CHUYỂN KHOẢN')) return 'Chuyển khoản'
  if (normalized.includes('BANK_TRANSFER_DEMO')) return 'Chuyển khoản'
  if (normalized === 'CASH' || normalized.includes('TIỀN MẶT')) return 'Tiền mặt'
  if (normalized === 'CREDIT' || normalized.includes('CÔNG NỢ')) return 'Công nợ'
  if (normalized === 'OTHER' || normalized.includes('KHÁC')) return 'Khác'
  return clean
}

export function formatPaymentDate(value?: string | null) {
  if (!value) return emptyText
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return normalizeVietnameseText(value)
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getGroupLabel(value?: string | null) {
  if (!value) return 'Không rõ ngày'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Không rõ ngày'

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((startOfToday - startOfDate) / 86400000)

  if (dayDiff === 0) return 'Hôm nay'
  if (dayDiff === 1) return 'Hôm qua'
  if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()) return 'Tháng này'
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
}

export function formatPaymentStatus(item: PaymentHistoryItem) {
  const status = item.status || inferPaymentStatus(item)
  if (status === 'deposit') return item.role === 'supplier' ? 'Đã nhận thanh toán cọc 50%' : 'Đã thanh toán cọc 50%'
  if (status === 'settled') return item.role === 'supplier' ? 'Công nợ đã tất toán' : 'Đã thanh toán đầy đủ'
  if (status === 'partial') return item.role === 'supplier' ? 'Đã nhận thanh toán một phần' : 'Thanh toán một phần'
  if (status === 'overdue') return 'Quá hạn'
  if (status === 'refunded') return 'Đã hoàn tiền'
  return item.role === 'supplier' ? 'Đã nhận thanh toán' : 'Đã thanh toán'
}

function inferPaymentStatus(item: PaymentHistoryItem): PaymentHistoryStatus {
  const amount = Number(item.amount || 0)
  const plan = String(item.paymentPlanType || '').toUpperCase()
  const note = normalizeVietnameseText(item.note).toUpperCase()
  if (amount < 0) return 'refunded'
  if (note.includes('QUÁ HẠN')) return 'overdue'
  if (plan === 'DEPOSIT_50' && (note.includes('CỌC') || note.includes('DEPOSIT'))) return 'deposit'
  if (amount <= 0) return 'settled'
  return 'paid'
}

function statusTone(status: PaymentHistoryStatus): PaymentTone {
  const tones: Record<PaymentHistoryStatus, PaymentTone> = {
    paid: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Đã thanh toán',
      dotClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      borderClass: 'border-l-emerald-400',
      titleClass: 'text-emerald-700',
    },
    deposit: {
      icon: <Clock3 className="h-4 w-4" />,
      label: 'Thanh toán cọc',
      dotClass: 'bg-amber-400',
      badgeClass: 'bg-amber-50 text-amber-700 ring-amber-100',
      borderClass: 'border-l-amber-400',
      titleClass: 'text-amber-700',
    },
    partial: {
      icon: <Clock3 className="h-4 w-4" />,
      label: 'Một phần',
      dotClass: 'bg-amber-400',
      badgeClass: 'bg-amber-50 text-amber-700 ring-amber-100',
      borderClass: 'border-l-amber-400',
      titleClass: 'text-amber-700',
    },
    overdue: {
      icon: <TriangleAlert className="h-4 w-4" />,
      label: 'Quá hạn',
      dotClass: 'bg-rose-500',
      badgeClass: 'bg-rose-50 text-rose-700 ring-rose-100',
      borderClass: 'border-l-rose-400',
      titleClass: 'text-rose-700',
    },
    refunded: {
      icon: <RotateCcw className="h-4 w-4" />,
      label: 'Đã hoàn tiền',
      dotClass: 'bg-slate-400',
      badgeClass: 'bg-slate-100 text-slate-700 ring-slate-200',
      borderClass: 'border-l-slate-300',
      titleClass: 'text-slate-700',
    },
    settled: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Tất toán',
      dotClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      borderClass: 'border-l-emerald-400',
      titleClass: 'text-emerald-700',
    },
  }
  return tones[status]
}

export function PaymentStatusBadge({ status }: { status: PaymentHistoryStatus }) {
  const tone = statusTone(status)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone.badgeClass}`}>
      {tone.icon}
      {tone.label}
    </span>
  )
}

export function PaymentMethodBadge({ method }: { method?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      <CreditCard className="h-3.5 w-3.5" />
      {formatPaymentMethod(method)}
    </span>
  )
}

export function PaymentAmount({ amount }: { amount?: number | null }) {
  const numeric = Number(amount || 0)
  if (numeric <= 0) return null
  return <span className="font-extrabold text-slate-950">{formatCurrency(numeric)}</span>
}

export function PaymentHistoryCard({ item, onOpen }: { item: PaymentHistoryItem; onOpen?: (item: PaymentHistoryItem) => void }) {
  const status = item.status || inferPaymentStatus(item)
  const tone = statusTone(status)
  const amount = Number(item.amount || 0)
  const note = normalizeVietnameseText(item.note).trim()
  const invoiceCode = normalizeVietnameseText(item.invoiceCode).trim()
  const orderCode = normalizeVietnameseText(item.orderCode).trim()
  const counterparty = normalizeVietnameseText(item.counterpartyName).trim()
  const counterpartyLabel = item.counterpartyLabel || (item.role === 'supplier' ? 'Khách hàng' : 'Nhà cung cấp')
  const title = formatPaymentStatus({ ...item, status })
  const description = item.description
    ? normalizeVietnameseText(item.description)
    : item.role === 'supplier' && orderCode
      ? `Buyer đã thanh toán cho đơn ${orderCode}.`
      : ''

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className={`group w-full rounded-lg border border-l-4 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${tone.borderClass}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${tone.dotClass}`} />
            <h4 className={`text-base font-extrabold leading-snug ${tone.titleClass}`}>
              {title}
              {amount > 0 ? (
                <>
                  {' '}
                  <PaymentAmount amount={amount} />
                </>
              ) : null}
            </h4>
          </div>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        <PaymentStatusBadge status={status} />
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <PaymentMeta label="Đơn hàng" value={orderCode || emptyText} strong />
        <PaymentMeta label="Hóa đơn" value={invoiceCode || emptyText} strong />
        {counterparty ? <PaymentMeta label={counterpartyLabel} value={counterparty} /> : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phương thức</p>
          <div className="mt-1">
            <PaymentMethodBadge method={item.paymentMethod} />
          </div>
        </div>
      </div>

      {note ? (
        <div className="mt-4 rounded-md bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ghi chú</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{note}</p>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
        <ReceiptText className="h-3.5 w-3.5" />
        <span>{formatPaymentDate(item.paymentDate)}</span>
        {onOpen ? <span className="ml-auto text-emerald-700 opacity-0 transition group-hover:opacity-100">Xem hóa đơn</span> : null}
      </div>
    </button>
  )
}

function PaymentMeta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 break-words leading-6 ${strong ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{value}</p>
    </div>
  )
}

export function PaymentTimelineGroup({
  items,
  empty,
  onOpen,
}: {
  items: PaymentHistoryItem[]
  empty: string
  onOpen?: (item: PaymentHistoryItem) => void
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <Banknote className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-semibold text-slate-500">{empty}</p>
      </div>
    )
  }

  const sorted = [...items].sort((a, b) => new Date(b.paymentDate || 0).getTime() - new Date(a.paymentDate || 0).getTime())
  const groups = sorted.reduce<Array<{ label: string; items: PaymentHistoryItem[] }>>((acc, item) => {
    const label = getGroupLabel(item.paymentDate)
    const existing = acc.find((group) => group.label === label)
    if (existing) existing.items.push(item)
    else acc.push({ label, items: [item] })
    return acc
  }, [])

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label}>
          <div className="mb-3 flex items-center gap-3">
            <h4 className="text-sm font-extrabold text-slate-900">{group.label}</h4>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="space-y-3">
            {group.items.map((item) => (
              <PaymentHistoryCard key={item.id} item={item} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
