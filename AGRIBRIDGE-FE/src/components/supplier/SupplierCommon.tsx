import type { ReactNode } from 'react'
import type { HeaderSummaryCard } from '../../types/supplierDashboard'

export function SupplierPanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-emerald-200/60 bg-white p-4 shadow-[0_4px_14px_rgba(16,120,74,0.08)]">
      {title ? <h3 className="mb-3 text-2xl font-bold text-emerald-950">{title}</h3> : null}
      {children}
    </section>
  )
}

export function SupplierStatCard({ card }: { card: HeaderSummaryCard }) {
  return (
    <article className="rounded-2xl border border-emerald-200/70 bg-emerald-50/30 p-3.5">
      <p className="text-sm font-semibold text-emerald-900/70">{card.label}</p>
      <p className="mt-1.5 text-[26px] font-extrabold leading-none text-emerald-950">{card.value}</p>
      {card.subLabel ? <p className="mt-1 text-xs text-emerald-900/60">{card.subLabel}</p> : null}
      {card.trend ? (
        <p className="mt-1 text-xs font-semibold text-emerald-700">{card.trend} so kỳ trước</p>
      ) : null}
    </article>
  )
}

export function SupplierStatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
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
      <button className="rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
        {label}
      </button>
    )
  }

  if (style === 'ghost') {
    return (
      <button className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
        {label}
      </button>
    )
  }

  return (
    <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
      {label}
    </button>
  )
}
