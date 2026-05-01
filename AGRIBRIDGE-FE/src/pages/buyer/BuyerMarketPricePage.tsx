import { buyerMarketPrices } from '../../data/buyerMarketPriceData'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { usePageTitle } from '../../hooks/usePageTitle'

export function BuyerMarketPricePage() {
  usePageTitle('Giá thị trường')
  return (
    <BuyerShell activeKey="market" title="Giá thị trường" subtitle="Theo dõi giá thị trường theo lô">
      <BuyerPanel
        title="Giá tham khảo thị trường"
        right={
          <div className="flex gap-2">
            <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"><option>Tất cả khu vực</option></select>
            <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"><option>7 ngày qua</option></select>
            <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"><option>Tất cả Grade</option></select>
          </div>
        }
      >
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nguồn dữ liệu: Giá tổng hợp từ giao dịch thực tế trên AgriBridge, được cập nhật theo ngày. Giá áp dụng theo sản phẩm + grade + size cụ thể.
        </div>

        <div className="overflow-x-auto rounded-xl border border-emerald-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-emerald-50 text-emerald-800">
              <tr>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Grade/Size</th>
                <th className="px-4 py-3">Giá hiện tại</th>
                <th className="px-4 py-3">Thay đổi</th>
                <th className="px-4 py-3">Khu vực</th>
                <th className="px-4 py-3">Nguồn</th>
                <th className="px-4 py-3">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {buyerMarketPrices.map((row) => (
                <tr key={row.id} className="border-t border-emerald-100">
                  <td className="px-4 py-3 font-semibold text-emerald-900">{row.product}</td>
                  <td className="px-4 py-3 text-emerald-900">{row.gradeSize}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-900">{row.currentPrice}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${row.changeType === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {row.change}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.region}</td>
                  <td className="px-4 py-3">{row.source}</td>
                  <td className="px-4 py-3">{row.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BuyerPanel>
    </BuyerShell>
  )
}
