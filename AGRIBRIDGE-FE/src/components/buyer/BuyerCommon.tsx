import { Eye, Search } from 'lucide-react'
import type { BuyerAlertCard, BuyerKpiCard, BuyerOrderRow } from '../../types/buyerDashboard'

// ─── Shared SearchInput ──────────────────────────────────────────────────────

export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
      />
    </div>
  )
}

// ─── Shared FilterTabBar ─────────────────────────────────────────────────────

export type FilterTab<T extends string = string> = {
  key: T
  label: string
  count?: number
}

export function FilterTabBar<T extends string = string>({
  tabs,
  activeKey,
  onChange,
}: {
  tabs: FilterTab<T>[]
  activeKey: T
  onChange: (key: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
              isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                  isActive ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}


export function BuyerPanel({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {right && <div className="flex items-center gap-2">{right}</div>}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function BuyerKpiCards({ items }: { items: BuyerKpiCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-emerald-200/70 bg-emerald-50/30 p-3.5">
          <p className="text-xs font-semibold text-emerald-900/70">{item.label}</p>
          <p className="mt-1.5 text-[26px] font-extrabold leading-none text-emerald-950">{item.value}</p>
        </article>
      ))}
    </div>
  )
}

const alertToneClass: Record<BuyerAlertCard['tone'], string> = {
  danger: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
}

export function BuyerAlertCards({ items }: { items: BuyerAlertCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.id} className={`rounded-xl border p-3 ${alertToneClass[item.tone]}`}>
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="mt-1.5 text-2xl font-extrabold">{item.value}</p>
        </article>
      ))}
    </div>
  )
}

export function BuyerStatusPill({ status }: { status: BuyerOrderRow['status'] | string }) {
  const styleMap: Record<string, { badge: string; dot: string }> = {
    'Đang giao':      { badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
    'Chờ xác nhận':   { badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
    'Đã hoàn thành':  { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    'Đã hủy':         { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-400' },
  }
  const cls = styleMap[status] ?? { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cls.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
      {status}
    </span>
  )
}

export function BuyerOrdersTable({ rows }: { rows: BuyerOrderRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-emerald-100">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-emerald-50 text-emerald-800">
          <tr>
            <th className="px-4 py-3 font-semibold">Mã đơn</th>
            <th className="px-4 py-3 font-semibold">Nhà cung cấp</th>
            <th className="px-4 py-3 font-semibold">Sản phẩm</th>
            <th className="px-4 py-3 font-semibold">Chi nhánh</th>
            <th className="px-4 py-3 font-semibold">Giá trị</th>
            <th className="px-4 py-3 font-semibold">Trạng thái</th>
            <th className="px-4 py-3 font-semibold">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-emerald-100">
              <td className="px-4 py-3 font-semibold text-emerald-900">{row.id}</td>
              <td className="px-4 py-3 text-emerald-900">{row.supplier}</td>
              <td className="px-4 py-3 text-emerald-900">
                {row.product}
                <div className="text-xs text-emerald-700/70">{row.quantity}</div>
              </td>
              <td className="px-4 py-3 text-emerald-900">{row.branch}</td>
              <td className="px-4 py-3 font-semibold text-emerald-900">{row.value}</td>
              <td className="px-4 py-3"><BuyerStatusPill status={row.status} /></td>
              <td className="px-4 py-3">
                <button className="text-emerald-700 hover:text-emerald-900"><Eye className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
