import { Download } from 'lucide-react'
import { SupplierPanel, SupplierStatCard, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'
import { usePageTitle } from '../../hooks/usePageTitle'

export function SupplierOverviewPage() {
  usePageTitle('Tổng quan')
  const { data, loading, error } = useSupplierDashboardData()
  const cards = data?.overviewCards ?? []
  const revenues = data?.monthlyRevenue ?? []
  const activities = data?.recentActivities ?? []
  const maxValue = Math.max(...revenues.map((item) => item.value), 1)

  return (
    <SupplierShell
      activeKey="overview"
      title="Tổng quan"
      subtitle="Theo dõi hoạt động kinh doanh theo thời gian thực"
      actions={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {['7 ngày', '30 ngày', '3 tháng', '12 tháng'].map((item, idx) => (
              <button
                key={item}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  idx === 1 ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800">
              <option>Tất cả chi nhánh</option>
            </select>
            <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              <Download className="h-4 w-4" />
              Xuất báo cáo
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <SupplierStatCard key={card.label} card={card} />
        ))}
      </div>

      {loading ? <p className="mt-3 text-sm font-semibold text-emerald-700">Đang tải dữ liệu realtime...</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
      {!loading && !error && cards.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-600">Tài khoản này chưa có dữ liệu tổng quan.</p>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <SupplierPanel title="Doanh thu theo tháng">
          <div className="flex h-72 items-end gap-4 rounded-xl bg-emerald-50/50 p-4">
            {revenues.map((item) => (
              <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-md bg-emerald-500/90" style={{ height: `${(item.value / maxValue) * 100}%` }} />
                <span className="text-xs font-bold text-emerald-800">{item.month}</span>
              </div>
            ))}
          </div>

          {cards.length >= 4 ? (
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-extrabold text-emerald-950">{cards[0].value}</p>
                <p className="text-sm text-emerald-800/70">Tháng này</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-emerald-700">{cards[0].trend ?? '-'}</p>
                <p className="text-sm text-emerald-800/70">So tháng trước</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-emerald-900">{cards[3].value}</p>
                <p className="text-sm text-emerald-800/70">Công nợ hiện tại</p>
              </div>
            </div>
          ) : null}
        </SupplierPanel>

        <SupplierPanel title="Hoạt động gần đây">
          <ul className="space-y-3">
            {activities.map((item) => (
              <li key={item.id} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                <p className="text-sm font-semibold text-emerald-900">{item.title}</p>
                <p className="mt-1 text-xs text-emerald-700/70">{item.time}</p>
                <div className="mt-2">
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
