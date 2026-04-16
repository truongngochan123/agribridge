import { Eye } from 'lucide-react'
import type { BuyerAlertCard, BuyerKpiCard, BuyerOrderRow } from '../../types/buyerDashboard'

export function BuyerPanel({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-emerald-200/60 bg-white p-4 shadow-[0_4px_14px_rgba(16,120,74,0.08)]">
      {title ? (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-emerald-950">{title}</h3>
          {right}
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
  const style =
    status === 'Đang giao'
      ? 'bg-blue-100 text-blue-700'
      : status === 'Chờ xác nhận'
        ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-100 text-emerald-700'

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{status}</span>
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
