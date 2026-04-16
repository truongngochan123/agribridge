import { Send, X } from 'lucide-react'
import { useState } from 'react'
import { SupplierActionButton, SupplierPanel, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'

export function SupplierRfqQuotesPage() {
  const { data, loading, error } = useSupplierDashboardData()
  const rfqItems = data?.rfqItems ?? []
  const [openQuote, setOpenQuote] = useState(false)
  const [openChat, setOpenChat] = useState(false)
  const [activeRfqId, setActiveRfqId] = useState(rfqItems[0]?.id ?? '')

  const activeRfq = rfqItems.find((item) => item.id === activeRfqId) ?? rfqItems[0]
  const statusCount = {
    pending: rfqItems.filter((item) => item.status === 'Chờ báo giá').length,
    quoted: rfqItems.filter((item) => item.status === 'Đã báo giá').length,
    accepted: rfqItems.filter((item) => item.status === 'Chấp nhận').length,
  }

  return (
    <>
      <SupplierShell
        activeKey="rfq"
        title="RFQ & Báo giá"
        subtitle="Tiếp nhận và xử lý yêu cầu báo giá từ khách hàng"
      >
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { value: String(statusCount.pending), label: 'Chờ báo giá' },
            { value: String(statusCount.quoted), label: 'Đã báo giá' },
            { value: String(statusCount.accepted), label: 'Chấp nhận' },
            { value: '0', label: 'Từ chối' },
          ].map((item) => (
            <article key={item.label} className="rounded-2xl border border-emerald-200 bg-white p-3">
              <p className="text-[30px] font-extrabold text-emerald-950">{item.value}</p>
              <SupplierStatusPill label={item.label} />
            </article>
          ))}
        </div>

        <SupplierPanel>
          {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải dữ liệu realtime...</p> : null}
          {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
          {!loading && !error && rfqItems.length === 0 ? (
            <p className="mb-3 text-sm font-semibold text-slate-600">Chưa có dữ liệu RFQ & báo giá cho tài khoản này.</p>
          ) : null}
          <div className="mb-3 flex items-center gap-2">
            {[
              `Tất cả (${rfqItems.length})`,
              `Chờ báo giá (${statusCount.pending})`,
              `Đã báo giá (${statusCount.quoted})`,
              `Chấp nhận (${statusCount.accepted})`,
              'Từ chối (0)',
            ].map((tab, idx) => (
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

          <div className="space-y-4">
            {rfqItems.map((rfq) => (
              <article key={rfq.id} className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-emerald-950">{rfq.id}</h3>
                    <p className="mt-0.5 text-xs text-emerald-800/80">{rfq.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-700">Hạn chót</p>
                    <p className="text-xs font-bold text-emerald-900">{rfq.dueDate}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 rounded-lg bg-white p-2.5 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-emerald-700">Sản phẩm</p>
                    <p className="font-semibold text-emerald-950">{rfq.product}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700">Số lượng</p>
                    <p className="font-semibold text-emerald-950">{rfq.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700">Giá mục tiêu</p>
                    <p className="font-semibold text-emerald-700">{rfq.targetPrice}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    onClick={() => {
                      setActiveRfqId(rfq.id)
                      setOpenQuote(true)
                    }}
                  >
                    {rfq.status === 'Đã báo giá' ? 'Sửa báo giá' : 'Tạo báo giá'}
                  </button>
                  <SupplierActionButton label={rfq.status === 'Đã báo giá' ? 'Xác nhận chấp nhận' : 'Từ chối'} style="outline" />
                  <button
                    className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                    onClick={() => {
                      setActiveRfqId(rfq.id)
                      setOpenChat(true)
                    }}
                  >
                    Chat
                  </button>
                  <SupplierStatusPill label={rfq.status} />
                </div>
              </article>
            ))}
          </div>
        </SupplierPanel>
      </SupplierShell>

      {openQuote ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4">
          <div className="mx-auto mt-14 w-full max-w-2xl rounded-2xl bg-white">
            <div className="flex items-start justify-between border-b border-slate-200 p-3">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Tạo Báo giá - {activeRfq?.id}</h3>
                <p className="text-xs text-slate-500">{activeRfq?.customer} • {activeRfq?.product} • {activeRfq?.quantity}</p>
              </div>
              <button onClick={() => setOpenQuote(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-3">
              <div className="grid gap-2 rounded-xl bg-slate-50 p-2.5 md:grid-cols-3">
                <div><p className="text-xs text-slate-500">Sản phẩm</p><p className="font-semibold">{activeRfq?.product}</p></div>
                <div><p className="text-xs text-slate-500">Số lượng</p><p className="font-semibold">{activeRfq?.quantity}</p></div>
                <div><p className="text-xs text-slate-500">Giá mục tiêu</p><p className="font-semibold text-emerald-700">{activeRfq?.targetPrice}</p></div>
              </div>

              <div className="rounded-xl border border-slate-200 p-2.5">
                <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Các option báo giá (1/3)</p><button className="text-xs font-semibold text-emerald-700">+ Thêm option</button></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="h-10 rounded-lg border border-slate-300 px-3 text-sm" placeholder="Đơn giá (đ/kg)" />
                  <input className="h-10 rounded-lg border border-slate-300 px-3 text-sm" placeholder="Thời gian giao hàng" />
                  <select className="h-10 rounded-lg border border-slate-300 px-3 text-sm"><option>EXW</option><option>DAP</option></select>
                  <input className="h-10 rounded-lg border border-slate-300 px-3 text-sm" placeholder="Ghi chú option" />
                </div>
              </div>

              <textarea className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Điều kiện thanh toán, yêu cầu đặc biệt..." />
            </div>

            <div className="flex gap-2 border-t border-slate-200 p-4">
              <button className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700" onClick={() => setOpenQuote(false)}>Hủy</button>
              <button className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white" onClick={() => setOpenQuote(false)}>Gửi báo giá</button>
            </div>
          </div>
        </div>
      ) : null}

      {openChat ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4">
          <div className="mx-auto mt-16 w-full max-w-lg overflow-hidden rounded-2xl bg-white">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Chat với {activeRfq?.customer.split(' - ')[0]}</h3>
                <p className="text-xs text-slate-500">{activeRfq?.id} • {activeRfq?.product}</p>
              </div>
              <button onClick={() => setOpenChat(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3 bg-slate-50 p-4">
              <div className="max-w-[75%] rounded-xl bg-white p-3 text-sm">Chào bạn, tôi cần 200kg Tôm Sú. Bạn có thể giao trong tuần này không?<p className="mt-1 text-xs text-slate-400">09:15</p></div>
              <div className="ml-auto max-w-[75%] rounded-xl bg-emerald-600 p-3 text-sm text-white">Chào bạn, chúng tôi có thể giao trong 2-3 ngày làm việc. Xin báo giá ngay hôm nay nhé.<p className="mt-1 text-xs text-emerald-100">09:20</p></div>
              <div className="max-w-[75%] rounded-xl bg-white p-3 text-sm">Ok, vậy giá như thế nào? Tôi cần đảm bảo đạt VietGAP.<p className="mt-1 text-xs text-slate-400">09:25</p></div>
            </div>

            <div className="flex gap-2 border-t border-slate-200 p-3">
              <input className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm" placeholder="Nhập tin nhắn..." />
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
