import { AlertCircle, Eye, FileText, MapPin, Phone, Printer, Receipt, Truck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buyerOrders } from '../../data/buyerOrdersData'
import { BuyerPanel, BuyerStatusPill } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'

export function BuyerOrdersPage() {
  const [openDetail, setOpenDetail] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState(buyerOrders[0]?.id ?? '')
  const [activeTab, setActiveTab] = useState<'info' | 'shipping' | 'invoice' | 'complaint'>('info')

  const selectedOrder = useMemo(
    () => buyerOrders.find((item) => item.id === selectedOrderId) ?? buyerOrders[0],
    [selectedOrderId],
  )

  const tabClass = (tab: typeof activeTab) =>
    `inline-flex items-center gap-1.5 rounded-t-lg border px-3 py-2 text-xs font-semibold ${
      activeTab === tab
        ? 'border-slate-300 border-b-white bg-white text-blue-600'
        : 'border-transparent bg-transparent text-slate-600 hover:text-slate-900'
    }`

  return (
    <>
      <BuyerShell activeKey="orders" title="Quản lý Đơn hàng" subtitle="Theo dõi đơn hàng theo chi nhánh">
        <BuyerPanel title="Đơn hàng gần đây">
          <div className="overflow-x-auto rounded-xl border border-emerald-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-emerald-50 text-emerald-800">
                <tr>
                  <th className="px-3 py-2 font-semibold">MÃ ĐƠN</th>
                  <th className="px-3 py-2 font-semibold">NHÀ CUNG CẤP</th>
                  <th className="px-3 py-2 font-semibold">SẢN PHẨM</th>
                  <th className="px-3 py-2 font-semibold">CHI NHÁNH</th>
                  <th className="px-3 py-2 font-semibold">GIÁ TRỊ</th>
                  <th className="px-3 py-2 font-semibold">TRẠNG THÁI</th>
                  <th className="px-3 py-2 font-semibold">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {buyerOrders.map((row) => (
                  <tr key={row.id} className="border-t border-emerald-100">
                    <td className="px-3 py-2 font-semibold text-emerald-900">{row.id}</td>
                    <td className="px-3 py-2 text-emerald-900">{row.supplier}</td>
                    <td className="px-3 py-2 text-emerald-900">
                      {row.product}
                      <div className="text-xs text-emerald-700/70">{row.quantity}</div>
                    </td>
                    <td className="px-3 py-2 text-emerald-900">{row.branch}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-900">{row.value}</td>
                    <td className="px-3 py-2"><BuyerStatusPill status={row.status} /></td>
                    <td className="px-3 py-2">
                      <button
                        className="rounded-md border border-emerald-200 p-1.5 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => {
                          setSelectedOrderId(row.id)
                          setActiveTab('info')
                          setOpenDetail(true)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BuyerPanel>
      </BuyerShell>

      {openDetail ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={() => setOpenDetail(false)}>
          <div
            className="mx-auto mt-8 w-full max-w-5xl overflow-hidden rounded-2xl bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-3xl font-extrabold text-slate-900">Chi tiết đơn hàng {selectedOrder.id}</h3>
                <p className="text-xs text-slate-500">Tạo từ RFQ-2024-025 - Quote QUOTE-2024-025-1</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600">Đang giao</span>
                <button className="text-slate-500" onClick={() => setOpenDetail(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 px-4 pt-3">
              <div className="flex flex-wrap gap-1">
                <button className={tabClass('info')} onClick={() => setActiveTab('info')}><FileText className="h-3.5 w-3.5" /> Thông tin đơn</button>
                <button className={tabClass('shipping')} onClick={() => setActiveTab('shipping')}><Truck className="h-3.5 w-3.5" /> Theo dõi giao hàng</button>
                <button className={tabClass('invoice')} onClick={() => setActiveTab('invoice')}><Receipt className="h-3.5 w-3.5" /> Hóa đơn & Thanh toán</button>
                <button className={tabClass('complaint')} onClick={() => setActiveTab('complaint')}><AlertCircle className="h-3.5 w-3.5" /> Khiếu nại</button>
              </div>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-4">
              {activeTab === 'info' ? (
                <div className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Nhà cung cấp</p><p className="text-sm font-semibold">{selectedOrder.supplier}</p></div>
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Chi nhánh nhận hàng</p><p className="text-sm font-semibold">{selectedOrder.branch}</p></div>
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Ngày tạo</p><p className="text-sm font-semibold">2024-01-15</p></div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-bold">Sản phẩm trong đơn</h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left">Mã lô</th>
                            <th className="px-3 py-2 text-left">Sản phẩm</th>
                            <th className="px-3 py-2 text-left">Grade/Size</th>
                            <th className="px-3 py-2 text-left">Ngày thu hoạch</th>
                            <th className="px-3 py-2 text-left">SL</th>
                            <th className="px-3 py-2 text-left">Đơn giá</th>
                            <th className="px-3 py-2 text-left">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-slate-200">
                            <td className="px-3 py-2 text-blue-600">LOT-TS-240115</td>
                            <td className="px-3 py-2">{selectedOrder.product}</td>
                            <td className="px-3 py-2">A+ / 20-25 con/kg</td>
                            <td className="px-3 py-2">2024-01-10</td>
                            <td className="px-3 py-2">150 kg</td>
                            <td className="px-3 py-2">285.000đ</td>
                            <td className="px-3 py-2 font-semibold">42.750.000đ</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-right text-sm font-bold">Tổng cộng: <span className="text-blue-600">42.750.000đ</span></p>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-bold">Lịch giao hàng</h4>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-semibold">Đợt 1 - 150kg</p>
                      <p className="text-xs text-slate-500">Dự kiến giao: 2024-01-16</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-bold">Ghi chú nội bộ</h4>
                    <textarea className="h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Thêm ghi chú cho đơn hàng này..." />
                    <button className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Lưu ghi chú</button>
                  </div>
                </div>
              ) : activeTab === 'shipping' ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {[
                      ['Đơn hàng được tạo', '15/01 08:00'],
                      ['NCC xác nhận đơn', '15/01 14:30'],
                      ['Hàng đã được đóng gói', '16/01 06:00'],
                      ['Đang vận chuyển', '16/01 08:30'],
                    ].map(([title, time]) => (
                      <div key={title} className="flex items-start gap-2">
                        <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">•</span>
                        <div>
                          <p className="text-sm font-semibold">{title}</p>
                          <p className="text-xs text-slate-500">{time}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <h4 className="mb-2 text-sm font-bold">Thông tin vận chuyển</h4>
                    <div className="grid gap-2 md:grid-cols-3 text-sm">
                      <p><span className="text-slate-500">Tài xế:</span> Nguyễn Văn C</p>
                      <p><span className="text-slate-500">Số điện thoại:</span> 0901234567</p>
                      <p><span className="text-slate-500">Biển số xe:</span> 59A-12345</p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white inline-flex items-center justify-center gap-1"><MapPin className="h-3.5 w-3.5" /> Xem bản đồ theo dõi</button>
                      <button className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1"><Phone className="h-3.5 w-3.5" /> Gọi tài xế</button>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'invoice' ? (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Thanh toán</button>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-lg font-extrabold">INV-2024-001</p>
                      <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-600">Chưa thanh toán</span>
                    </div>
                    <p className="text-xs text-slate-500">Ngày phát hành: 2024-01-15</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <div className="rounded-md bg-slate-50 p-2"><p className="text-xs text-slate-500">Tổng tiền</p><p className="font-bold">42.750.000đ</p></div>
                      <div className="rounded-md bg-slate-50 p-2"><p className="text-xs text-slate-500">Đã thanh toán</p><p className="font-bold text-emerald-600">0đ</p></div>
                      <div className="rounded-md bg-slate-50 p-2"><p className="text-xs text-slate-500">Còn lại</p><p className="font-bold text-red-600">42.750.000đ</p></div>
                    </div>
                    <p className="mt-3 text-xs text-slate-600">Hạn thanh toán: <span className="font-semibold">2024-01-22</span></p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Tạo khiếu nại</button>
                  </div>
                  <div className="flex h-40 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-500">
                    Chưa có khiếu nại nào cho đơn hàng này
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-3">
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700" onClick={() => setOpenDetail(false)}>
                Đóng
              </button>
              <div className="flex gap-2">
                <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700"><Printer className="h-3.5 w-3.5" /> In đơn hàng</button>
                <button className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white"><AlertCircle className="h-3.5 w-3.5" /> Hủy đơn</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
