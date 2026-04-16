import { PhoneCall, Plus } from 'lucide-react'
import { useState } from 'react'
import { SupplierPanel, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'

export function SupplierDeliveryPage() {
  const { data, loading, error } = useSupplierDashboardData()
  const shipmentRows = data?.shipments ?? []
  const [openShipmentDetail, setOpenShipmentDetail] = useState(false)
  const [activeShipmentId, setActiveShipmentId] = useState(shipmentRows[0]?.id ?? '')
  const activeShipment = shipmentRows.find((item) => item.id === activeShipmentId) ?? shipmentRows[0]

  return (
    <>
      <SupplierShell
        activeKey="delivery"
        title="Quản lý Giao hàng"
        subtitle="Theo dõi vận chuyển và giao hàng real-time"
        actions={
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {['Tất cả (4)', 'Chuẩn bị', 'Đã lấy hàng', 'Đang vận chuyển', 'Đã giao', 'Sự cố'].map((tab, idx) => (
                <button
                  key={tab}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    idx === 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Tạo Shipment
            </button>
          </div>
        }
      >
        {loading ? <p className="text-sm font-semibold text-emerald-700">Đang tải dữ liệu realtime...</p> : null}
        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        {!loading && !error && shipmentRows.length === 0 ? (
          <p className="text-sm font-semibold text-slate-600">Chưa có dữ liệu giao hàng cho tài khoản này.</p>
        ) : null}
        <div className="space-y-3">
          {shipmentRows.map((ship) => (
            <SupplierPanel key={ship.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-extrabold text-emerald-950">{ship.id}</h3>
                    <SupplierStatusPill label={ship.status} />
                  </div>
                  <p className="mt-1 text-xs text-emerald-900/80">
                    {ship.orderRef} • {ship.route}
                  </p>
                  <p className="text-xs text-emerald-900/70">
                    {ship.driver} {ship.phone}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-900">ETA: {ship.eta}</p>
                  <p className="text-xs text-emerald-700/70">{ship.cargo}</p>
                </div>
              </div>

              <div className="mt-3 h-2 rounded-full bg-emerald-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${ship.progress}%` }} />
              </div>
              <p className="mt-1 text-right text-xs font-semibold text-emerald-700">{ship.progress}%</p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  onClick={() => {
                    setActiveShipmentId(ship.id)
                    setOpenShipmentDetail(true)
                  }}
                >
                  Chi tiết & Cập nhật
                </button>
                <button className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
                  <PhoneCall className="h-4 w-4" />
                  Gọi tài xế
                </button>
              </div>
            </SupplierPanel>
          ))}
        </div>
      </SupplierShell>

      {openShipmentDetail ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={() => setOpenShipmentDetail(false)}>
          <div className="mx-auto mt-14 w-full max-w-2xl overflow-hidden rounded-2xl bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-extrabold text-slate-900">{activeShipment?.id}</h3>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Đang vận chuyển</span>
                </div>
                <p className="text-xs text-slate-500">{activeShipment?.route}</p>
              </div>
              <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={() => setOpenShipmentDetail(false)}>×</button>
            </div>

            <div className="space-y-3 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Khách hàng</p><p className="font-semibold">{activeShipment?.route?.split(' - ')[0] ?? 'N/A'}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Địa chỉ giao</p><p className="font-semibold">{activeShipment?.route ?? 'N/A'}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Tài xế</p><p className="font-semibold">{activeShipment?.driver} — {activeShipment?.phone}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Phí vận chuyển</p><p className="font-semibold text-emerald-700">1,200,000đ</p></div>
              </div>

              <div>
                <p className="mb-1 text-sm font-semibold text-slate-700">Tiến độ giao hàng</p>
                <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${activeShipment?.progress ?? 0}%` }} /></div>
                <p className="mt-1 text-right text-sm text-slate-500">{activeShipment?.progress}% - ETA: {activeShipment?.eta}</p>
              </div>

              <div>
                <p className="mb-1 text-base font-bold text-slate-900">Timeline giao hàng</p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 08:00 Đơn hàng được tạo</li>
                  <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 09:30 Tài xế lấy hàng tại kho</li>
                  <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 11:00 Đang vận chuyển</li>
                  <li className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full border border-slate-400" /> 16:00 Dự kiến giao hàng</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-200 p-3">
              <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Tiếp theo: Đã giao</button>
              <button className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600">Báo cáo sự cố</button>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Gọi tài xế</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
