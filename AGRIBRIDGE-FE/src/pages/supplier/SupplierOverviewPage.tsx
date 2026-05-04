import { AlertTriangle, Download, TrendingUp } from 'lucide-react'
import { SupplierPanel, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'
import { usePageTitle } from '../../hooks/usePageTitle'

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
  }
  return `${value.toLocaleString('vi-VN')}đ`
}

// Color accent per card index
export const CARD_ACCENTS = [
  'from-emerald-400 to-teal-500',
  'from-blue-400 to-indigo-500',
  'from-amber-400 to-orange-500',
  'from-violet-400 to-purple-500',
]

export function SupplierOverviewPage() {
  usePageTitle('Tổng quan')
  const { data, loading, error } = useSupplierDashboardData()
  const cards = data?.overviewCards ?? []
  const revenues = data?.monthlyRevenue ?? []
  const activities = data?.recentActivities ?? []
  const maxValue = Math.max(...revenues.map((item) => item.value), 1)
  const hasRevenueData = revenues.some((item) => item.value > 0)
  const currentMonthRevenue = revenues[revenues.length - 1]?.value ?? 0
  const receivableCard = cards.find((card) => card.label.includes('Công nợ'))

  return (
    <SupplierShell
      activeKey="overview"
      title="Tổng quan"
      subtitle="Theo dõi hoạt động kinh doanh theo thời gian thực"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {['7 ngày', '30 ngày', '3 tháng', '12 tháng'].map((item, idx) => (
              <button
                key={item}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  idx === 1 ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none">
            <option>Tất cả chi nhánh</option>
          </select>
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all">
            <Download className="h-3.5 w-3.5" />
            Xuất báo cáo
          </button>
        </div>
      }
    >
      {/* Loading / Error banners */}
      {loading && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          Đang tải dữ liệu realtime...
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Charts + Activities */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_0.5fr]">
        {/* Revenue Chart */}
        <SupplierPanel title="Doanh thu theo tháng">
          {revenues.length > 0 && hasRevenueData && (
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" />
              Biểu đồ 7 tháng gần nhất
            </div>
          )}
          <div className="flex h-52 items-stretch gap-1.5 rounded-xl bg-gradient-to-b from-slate-50 to-white p-3">
            {revenues.map((item, i) => {
              const isLast = i === revenues.length - 1
              const heightPct = item.value > 0 ? Math.max((item.value / maxValue) * 100, 8) : 2
              return (
                <div key={item.month} className="group flex h-full flex-1 flex-col items-center gap-1">
                  <span className={`text-[9px] font-bold ${item.value > 0 ? 'text-slate-500' : 'text-transparent'}`}>
                    {formatCompactCurrency(item.value)}
                  </span>
                  <div className="flex min-h-0 w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        isLast
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-sm'
                          : 'bg-slate-200 group-hover:bg-emerald-300'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className={`text-[9px] font-bold ${isLast ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {item.month}
                  </span>
                </div>
              )
            })}
            {!loading && !error && revenues.length === 0 && (
              <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-400">
                Chưa có dữ liệu doanh thu.
              </div>
            )}
          </div>

          {!loading && !error && revenues.length > 0 && !hasRevenueData && (
            <p className="mt-2 text-xs text-slate-400">Chưa phát sinh doanh thu trong 7 tháng gần nhất.</p>
          )}

          {revenues.length > 0 || receivableCard ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { value: formatCompactCurrency(currentMonthRevenue), label: 'Tháng này' },
                { value: cards[0]?.trend ?? '-', label: 'So tháng trước' },
                { value: receivableCard?.value ?? '-', label: 'Công nợ' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center">
                  <p className="text-base font-extrabold text-slate-900">{item.value}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          ) : null}
        </SupplierPanel>

        {/* Recent Activity */}
        <SupplierPanel title="Hoạt động gần đây">
          {activities.length === 0 && !loading ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              Chưa có hoạt động.
            </p>
          ) : null}
          <ul className="space-y-2">
            {activities.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30">
                <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">{item.time}</p>
                <div className="mt-1.5">
                  <SupplierStatusPill label="Mới cập nhật" />
                </div>
              </li>
            ))}
          </ul>
        </SupplierPanel>
      </div>
    </SupplierShell>
  )
}
