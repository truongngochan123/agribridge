import { AlertTriangle, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FilterTabBar, SearchInput, SupplierPanel } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'
import { usePageTitle } from '../../hooks/usePageTitle'

type DebtTabKey = 'all' | 'overdue' | 'warning'

function DebtStatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase()
  let cls = 'bg-emerald-100 text-emerald-800'
  if (lower.includes('quá hạn') || lower.includes('nguy')) cls = 'bg-rose-100 text-rose-700'
  else if (lower.includes('cảnh báo') || lower.includes('sắp')) cls = 'bg-amber-100 text-amber-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

export function SupplierDebtPage() {
  usePageTitle('Quản lý Công nợ')
  const { data, loading, error } = useSupplierDashboardData()
  const customers = data?.debtCustomers ?? []
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<DebtTabKey>('all')

  const filtered = useMemo(() => {
    let items = customers
    if (activeTab === 'overdue') items = items.filter((c) => c.status.toLowerCase().includes('quá hạn'))
    else if (activeTab === 'warning') items = items.filter((c) => c.status.toLowerCase().includes('cảnh báo'))
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase()
      items = items.filter((c) => c.customer.toLowerCase().includes(kw))
    }
    return items
  }, [customers, activeTab, searchKeyword])

  const overdueCount = customers.filter((c) => c.status.toLowerCase().includes('quá hạn')).length
  const warningCount = customers.filter((c) => c.status.toLowerCase().includes('cảnh báo')).length

  const tabs = [
    { key: 'all' as DebtTabKey, label: 'Tất cả', count: customers.length },
    { key: 'overdue' as DebtTabKey, label: 'Quá hạn', count: overdueCount },
    { key: 'warning' as DebtTabKey, label: 'Cảnh báo', count: warningCount },
  ]

  return (
    <SupplierShell
      activeKey="debt"
      title="Quản lý Công nợ"
      subtitle="Quản lý công nợ, kỳ thanh toán và nhắc nợ khách hàng"
      filterBar={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={searchKeyword}
            onChange={setSearchKeyword}
            placeholder="Tìm khách hàng..."
            className="min-w-[200px] max-w-xs"
          />
          <FilterTabBar tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
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

      {/* Table panel */}
      <SupplierPanel>
        {!loading && !error && customers.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-semibold text-slate-600">Chưa có dữ liệu công nợ.</p>
          </div>
        )}

        {!loading && !error && customers.length > 0 && filtered.length === 0 && (
          <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
            Không tìm thấy khách hàng phù hợp.
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Kỳ thanh toán</th>
                <th className="px-4 py-3">Tổng nợ</th>
                <th className="px-4 py-3">Quá hạn</th>
                <th className="px-4 py-3">Hạn mức còn</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((item) => (
                <tr key={item.customer} className="bg-white text-sm transition-colors hover:bg-emerald-50/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{item.customer}</p>
                    <p className="text-xs text-slate-400">{item.cycle}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.terms}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{item.totalDebt}</td>
                  <td className="px-4 py-3 font-bold text-rose-600">{item.overdueDebt}</td>
                  <td className="px-4 py-3 text-slate-700">{item.creditLimit}</td>
                  <td className="px-4 py-3"><DebtStatusBadge status={item.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors">
                        Chi tiết
                      </button>
                      <button className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                        Nhắc nợ
                      </button>
                    </div>
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
