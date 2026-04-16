import type { CtaSummary } from '../types/home'
import { Link } from 'react-router-dom'

type DualCTASectionProps = {
  summary: CtaSummary
}

export function DualCTASection({ summary }: DualCTASectionProps) {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-0 overflow-hidden rounded-3xl px-4 shadow-xl md:px-8 lg:grid-cols-2">
        <article className="relative overflow-hidden bg-emerald-700 p-8 text-white md:p-10">
          <img
            src="/images/packing-warehouse.jpg"
            alt="Khu đóng gói nông sản"
            className="absolute inset-0 h-full w-full object-cover opacity-15"
          />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-100">Dành cho Nhà cung cấp</p>
            <h3 className="mt-3 text-4xl font-bold leading-tight">{summary.supplier.title}</h3>
            <p className="mt-4 max-w-md text-emerald-50">{summary.supplier.subtitle}</p>
            <Link
              to="/onboarding/supplier/business-info"
              className="mt-6 inline-block rounded-full bg-white px-6 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              {summary.supplier.ctaText}
            </Link>
            <div className="mt-8 flex flex-wrap gap-5 text-sm font-semibold">
              {summary.supplier.stats.map((stat) => (
                <span key={stat}>{stat}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="relative overflow-hidden bg-slate-900 p-8 text-white md:p-10">
          <img
            src="/images/seafood-market.jpg"
            alt="Giao dịch tại vựa thủy sản"
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Dành cho Nhà mua sỉ</p>
            <h3 className="mt-3 text-4xl font-bold leading-tight">{summary.buyer.title}</h3>
            <p className="mt-4 max-w-md text-slate-100">{summary.buyer.subtitle}</p>
            <Link
              to="/onboarding/buyer/business-info"
              className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
            >
              {summary.buyer.ctaText}
            </Link>
            <div className="mt-8 flex flex-wrap gap-5 text-sm font-semibold">
              {summary.buyer.stats.map((stat) => (
                <span key={stat}>{stat}</span>
              ))}
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
