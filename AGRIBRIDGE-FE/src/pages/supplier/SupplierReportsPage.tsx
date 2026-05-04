import { AlertTriangle, Download } from 'lucide-react'
import { useState } from 'react'
import { SearchInput, SupplierPanel } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
  }
  return `${value.toLocaleString('vi-VN')}đ`
}

export const CARD_ACCENTS = [
  'from-emerald-400 to-teal-500',
  'from-blue-400 to-indigo-500',
  'from-amber-400 to-orange-500',
]

export function SupplierReportsPage() {
  const { data, loading, error } = useSupplierDashboardData()
  const revenues = data?.monthlyRevenue ?? []
  const cards = data?.overviewCards ?? []
  const maxValue = Math.max(...revenues.map((item) => item.value), 1)
  const [searchKeyword, setSearchKeyword] = useState('')
  void searchKeyword // reserved for future product/customer filter

  return (
    <SupplierShell
      activeKey="reports"
      title="Báo cáo"
      subtitle="Phân tích doanh thu, công nợ và chất lượng"
      filterBar={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={searchKeyword}
            onChange={setSearchKeyword}
            placeholder="Tìm theo sản phẩm, khách hàng..."
            className="min-w-[200px] max-w-xs"
          />
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {['Doanh thu', 'Công nợ', 'Giao hàng', 'Sản phẩm'].map((tab, idx) => (
              <button
                key={tab}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  idx === 0 ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
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
          <button className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all">
            <Download className="h-3.5 w-3.5" />
            Xuất báo cáo
          </button>
        </div>
      }
    >
      {/* Loading / Error */}
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
      {!loading && !error && cards.length === 0 && (
        <p className="mb-4 text-xs text-slate-400">Chưa có dữ liệu báo cáo cho tài khoản này.</p>
      )}

      {/* Revenue Chart */}
      <div className="mt-4">
        <SupplierPanel title="Biểu đồ doanh thu theo tháng">
          <div className="flex h-56 items-end gap-2 rounded-xl bg-gradient-to-b from-slate-50 to-white p-4">
            {revenues.map((item, i) => {
              const isLast = i === revenues.length - 1
              const heightPx = Math.max((item.value / maxValue) * 180, 16)
              return (
                <div key={item.month} className="group flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-slate-400">{formatCompactCurrency(item.value)}</span>
                  <div
                    className={`w-full min-w-[40px] rounded-t-lg transition-all duration-500 ${
                      isLast
                        ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-sm'
                        : 'bg-slate-200 group-hover:bg-emerald-300'
                    }`}
                    style={{ height: `${heightPx}px` }}
                  />
                  <span className={`text-[9px] font-bold ${isLast ? 'text-emerald-700' : 'text-slate-400'}`}>{item.month}</span>
                </div>
              )
            })}
            {revenues.length === 0 && !loading && (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                Chưa có dữ liệu doanh thu.
              </div>
            )}
          </div>
        </SupplierPanel>
      </div>
    </SupplierShell>
  )
}
