import { buyerDebtKpis, buyerDebtSuppliers } from '../../data/buyerDebtData'
import { BuyerKpiCards, BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'

export function BuyerDebtPage() {
  return (
    <BuyerShell activeKey="debt" title="Quản lý Công nợ" subtitle="Quản lý công nợ phải trả theo workflow">
      <BuyerKpiCards items={buyerDebtKpis} />

      <div className="mt-5">
        <BuyerPanel
          title="Công nợ theo Nhà cung cấp"
          right={
            <div className="flex gap-2">
              <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Thanh toán</button>
              <button className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700">Xuất báo cáo</button>
            </div>
          }
        >
          <div className="overflow-x-auto rounded-xl border border-emerald-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-emerald-50 text-emerald-800">
                <tr>
                  <th className="px-4 py-3">Nhà cung cấp</th>
                  <th className="px-4 py-3">Tổng nợ</th>
                  <th className="px-4 py-3">Quá hạn</th>
                  <th className="px-4 py-3">Hạn mức</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {buyerDebtSuppliers.map((item) => (
                  <tr key={item.id} className="border-t border-emerald-100">
                    <td className="px-4 py-3 font-semibold text-emerald-900">{item.supplier}<div className="text-xs text-emerald-700/70">{item.invoiceCount}</div></td>
                    <td className="px-4 py-3 font-semibold">{item.totalDebt}</td>
                    <td className="px-4 py-3 text-red-500">{item.overdue}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-24 rounded-full bg-emerald-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${item.limitUsage}%` }} /></div>
                      <p className="mt-1 text-xs text-emerald-700">{item.limitUsage}%</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        item.status === 'Quá hạn'
                          ? 'bg-red-100 text-red-700'
                          : item.status === 'Cảnh báo'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}>{item.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700">Chi tiết  Thanh toán</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BuyerPanel>
      </div>
    </BuyerShell>
  )
}
