import { Phone } from 'lucide-react'
import { buyerShipments } from '../../data/buyerDeliveryData'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { usePageTitle } from '../../hooks/usePageTitle'

export function BuyerDeliveryPage() {
  usePageTitle('Theo dõi Giao hàng')
  return (
    <BuyerShell activeKey="delivery" title="Theo dõi Giao hàng" subtitle="Theo dõi vận chuyển realtime">
      <BuyerPanel
        title="Theo dõi Giao hàng"
        right={
          <div className="flex gap-2">
            <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"><option>Tất cả chi nhánh</option></select>
            <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"><option>Tất cả trạng thái</option></select>
          </div>
        }
      >
        <div className="space-y-4">
          {buyerShipments.map((item) => (
            <article key={item.id} className="rounded-xl border border-emerald-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xl font-extrabold text-emerald-950">{item.id}</h4>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">{item.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-emerald-700/80">Đơn hàng: {item.orderRef}</p>
                  <p className="text-sm text-emerald-700/80">NCC: {item.supplier}</p>
                  <p className="text-sm text-emerald-700/80">Sản phẩm: {item.product}</p>
                  <p className="text-sm text-emerald-700/80">Giao đến: {item.destination}</p>
                </div>
                <div className="text-right text-sm text-emerald-700/80">
                  <p className="font-semibold text-emerald-900">ETA: {item.eta}</p>
                  <p>Tài xế: {item.driver}</p>
                  <p>Biển số: {item.plate}</p>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs text-emerald-700/70">Tiến độ giao hàng</p>
                <div className="mt-1 h-2 rounded-full bg-emerald-100">
                  <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${item.progress}%` }} />
                </div>
                <p className="mt-1 text-right text-xs font-semibold text-emerald-700">{item.progress}%</p>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <button className="rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-semibold text-emerald-700">Timeline chi tiết</button>
                <button className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white">Xem bản đồ</button>
                <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 py-2 text-sm font-semibold text-emerald-700"><Phone className="h-4 w-4" /> Gọi tài xế</button>
                {item.status === 'Đã giao' ? (
                  <button className="rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white">Xác nhận nhận hàng</button>
                ) : (
                  <button className="rounded-lg border border-transparent py-2 text-sm"> </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </BuyerPanel>
    </BuyerShell>
  )
}
