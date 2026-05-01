import { MoreVertical, Store } from 'lucide-react'
import { buyerBranches } from '../../data/buyerBranchesData'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { usePageTitle } from '../../hooks/usePageTitle'

export function BuyerBranchesPage() {
  usePageTitle('Quản lý Chi nhánh')
  return (
    <BuyerShell
      activeKey="branches"
      title="Quản lý Chi nhánh"
      subtitle="Quản lý nhiều chi nhánh"
      actions={<div className="flex justify-end"><button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">+ Thêm chi nhánh</button></div>}
    >
      <BuyerPanel title="Quản lý Chi nhánh" right={<p className="text-sm text-emerald-700/70">Theo dõi và quản lý các chi nhánh của bạn</p>}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {buyerBranches.map((branch) => (
            <article key={branch.id} className="rounded-xl border border-emerald-100 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Store className="h-5 w-5" /></div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">{branch.activeOrders}</span>
              </div>
              <h3 className="mt-3 text-xl font-bold text-emerald-950">{branch.name}</h3>
              <p className="mt-1 text-sm text-emerald-700/80">{branch.address}</p>
              <p className="text-sm text-emerald-700/80">{branch.manager}</p>
              <p className="text-sm text-emerald-700/80">{branch.phone}</p>
              <div className="mt-4 border-t border-emerald-100 pt-3">
                <p className="text-sm text-emerald-700/70">Khối lượng tháng này</p>
                <p className="text-2xl font-extrabold text-emerald-900">{branch.monthlyVolume}</p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button className="flex-1 rounded-lg bg-emerald-100 py-2 text-sm font-semibold text-emerald-700">Xem chi tiết</button>
                <button className="rounded-lg border border-emerald-200 p-2 text-emerald-700"><MoreVertical className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      </BuyerPanel>
    </BuyerShell>
  )
}
