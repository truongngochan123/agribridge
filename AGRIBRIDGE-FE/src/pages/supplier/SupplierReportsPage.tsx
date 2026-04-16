import { Download } from 'lucide-react'
import { SupplierPanel, SupplierStatCard } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'

export function SupplierReportsPage() {
  const { data, loading, error } = useSupplierDashboardData()
  const revenues = data?.monthlyRevenue ?? []
  const cards = data?.overviewCards ?? []
  const maxValue = Math.max(...revenues.map((item) => item.value), 1)

  return (
    <SupplierShell
      activeKey="reports"
      title="Báo cáo"
      subtitle="Báo cáo phân tích doanh thu, công nợ và chất lượng"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {['Doanh thu', 'Công nợ', 'Giao hàng', 'Sản phẩm'].map((tab, idx) => (
            <button
              key={tab}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                idx === 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {tab}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
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
            <select className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800">
              <option>Tất cả khách hàng</option>
            </select>
            <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              <Download className="h-4 w-4" />
              Xuất báo cáo
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {cards.slice(0, 3).map((card) => (
          <SupplierStatCard key={card.label} card={card} />
        ))}
      </div>

      {loading ? <p className="mt-3 text-sm font-semibold text-emerald-700">Đang tải dữ liệu realtime...</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
      {!loading && !error && cards.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-600">Chưa có dữ liệu báo cáo cho tài khoản này.</p>
      ) : null}

      <div className="mt-6">
        <SupplierPanel title="Biểu đồ doanh thu theo tháng">
          <div className="grid h-[360px] grid-cols-7 items-end gap-3 rounded-xl bg-emerald-50/60 p-4">
            {revenues.map((item) => (
              <div key={item.month} className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-emerald-700">{item.value} tr</span>
                <div
                  className="w-full min-w-[70px] rounded-t-xl bg-emerald-500"
                  style={{ height: `${Math.max((item.value / maxValue) * 250, 40)}px` }}
                />
                <span className="text-xs font-semibold text-emerald-800">{item.month}</span>
              </div>
            ))}
          </div>
        </SupplierPanel>
      </div>
    </SupplierShell>
  )
}
