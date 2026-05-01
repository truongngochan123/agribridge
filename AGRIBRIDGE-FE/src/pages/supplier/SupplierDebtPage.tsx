import { Download } from 'lucide-react'
import { SupplierPanel, SupplierStatCard, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'
import { usePageTitle } from '../../hooks/usePageTitle'

export function SupplierDebtPage() {
  usePageTitle('Quản lý Công nợ')
  const { data, loading, error } = useSupplierDashboardData()
  const summaryCards = data?.debtSummaryCards ?? []
  const customers = data?.debtCustomers ?? []

  return (
    <SupplierShell activeKey="debt" title="Quản lý Công nợ" subtitle="Quản lý công nợ, kỳ thanh toán và nhắc nợ khách hàng">
      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <SupplierStatCard key={card.label} card={card} />
        ))}
      </div>

      <SupplierPanel>
        {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải dữ liệu realtime...</p> : null}
        {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
        {!loading && !error && customers.length === 0 ? (
          <p className="mb-3 text-sm font-semibold text-slate-600">Chưa có dữ liệu công nợ cho tài khoản này.</p>
        ) : null}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            placeholder="Tìm khách hàng..."
            className="h-11 min-w-[260px] flex-1 rounded-lg border border-emerald-200 px-4 text-sm outline-none focus:border-emerald-500"
          />
          {['Tất cả', 'Quá hạn', 'Cảnh báo'].map((tab, idx) => (
            <button
              key={tab}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                idx === 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {tab}
            </button>
          ))}
          <button className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <Download className="h-4 w-4" />
            Xuất báo cáo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-emerald-700/70">
                <th className="px-3">Khách hàng</th>
                <th className="px-3">Kỳ thanh toán</th>
                <th className="px-3">Tổng nợ</th>
                <th className="px-3">Quá hạn</th>
                <th className="px-3">Hạn mức còn</th>
                <th className="px-3">Trạng thái</th>
                <th className="px-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((item) => (
                <tr key={item.customer} className="bg-emerald-50/40 text-sm">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-emerald-900">{item.customer}</p>
                    <p className="text-xs text-emerald-700/70">{item.cycle}</p>
                  </td>
                  <td className="px-3 py-3 font-semibold text-emerald-900">{item.terms}</td>
                  <td className="px-3 py-3 font-bold text-emerald-900">{item.totalDebt}</td>
                  <td className="px-3 py-3 font-bold text-emerald-700">{item.overdueDebt}</td>
                  <td className="px-3 py-3 font-semibold text-emerald-900">{item.creditLimit}</td>
                  <td className="px-3 py-3">
                    <SupplierStatusPill label={item.status} />
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-emerald-700">
                    <button className="mr-3">Chi tiết</button>
                    <button>Nhắc nợ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SupplierPanel>
    </SupplierShell>
  )
}
