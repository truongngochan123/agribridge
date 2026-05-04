import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import type { HeaderSummaryCard } from '../../types/supplierDashboard'

export function SupplierPanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-base font-bold text-slate-800">{title}</h3> : null}
      {children}
    </section>
  )
}

export function SupplierStatCard({ card }: { card: HeaderSummaryCard }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* accent top stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
      <div className="px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
        <p className="mt-1.5 text-2xl font-extrabold leading-none text-slate-900">{card.value}</p>
        {card.subLabel ? <p className="mt-1 text-xs text-slate-400">{card.subLabel}</p> : null}
        {card.trend ? (
          <p className="mt-1 text-xs font-semibold text-emerald-600">{card.trend} so kỳ trước</p>
        ) : null}
      </div>
    </article>
  )
}

export function SupplierStatusPill({ label }: { label: string }) {
  const lower = label.toLowerCase()
  let cls = 'bg-emerald-100 text-emerald-800'
  if (lower.includes('từ chối') || lower.includes('hủy') || lower.includes('quá hạn') || lower.includes('failed')) {
    cls = 'bg-rose-100 text-rose-700'
  } else if (lower.includes('chờ') || lower.includes('pending') || lower.includes('cảnh báo')) {
    cls = 'bg-amber-100 text-amber-800'
  } else if (lower.includes('đang giao') || lower.includes('shipping') || lower.includes('transit') || lower.includes('vận chuyển')) {
    cls = 'bg-blue-100 text-blue-800'
  } else if (lower.includes('hoàn thành') || lower.includes('delivered') || lower.includes('chấp nhận') || lower.includes('đã xác nhận')) {
    cls = 'bg-emerald-100 text-emerald-800'
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

export function SupplierActionButton({
  label,
  style = 'primary',
}: {
  label: string
  style?: 'primary' | 'outline' | 'ghost'
}) {
  if (style === 'outline') {
    return (
      <button className="rounded-xl border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors">
        {label}
      </button>
    )
  }

  if (style === 'ghost') {
    return (
      <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
        {label}
      </button>
    )
  }

  return (
    <button className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 active:scale-95 transition-all">
      {label}
    </button>
  )
}

// ─── Shared SearchInput ───────────────────────────────────────────────────────

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

// ─── Shared FilterTabBar ──────────────────────────────────────────────────────

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
