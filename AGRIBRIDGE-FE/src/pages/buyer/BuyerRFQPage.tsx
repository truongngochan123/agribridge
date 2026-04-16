import { useState } from 'react'
import { buyerRfqCards } from '../../data/buyerRfqData'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'

export function BuyerRFQPage() {
  const [openCompare, setOpenCompare] = useState(false)
  const [activeRfqId, setActiveRfqId] = useState(buyerRfqCards[0]?.id ?? '')

  const activeRfq = buyerRfqCards.find((item) => item.id === activeRfqId) ?? buyerRfqCards[0]

  const compareCards = [
    {
      supplier: 'Trang trại Biển Xanh',
      rating: '4.8 (156 đơn)',
      tags: ['Giá tốt nhất', 'Uy tín cao', 'Có công nợ'],
      price: '285.000đ',
      total: '85.500.000đ',
      lot: 'LOT-TS-240115',
      gradeSize: 'A+ / 20-25 con/kg',
      harvest: '2024-01-10',
      delivery: '2024-01-17',
      eta: '2 ngày',
      incoterms: 'DAP - Giao tại địa chỉ',
      shipping: 'Miễn phí',
      payment: 'Công nợ 7 ngày',
    },
    {
      supplier: 'HTX Thủy Sản Sóc Trăng',
      rating: '4.6 (89 đơn)',
      tags: ['Giao nhanh'],
      price: '280.000đ',
      total: '84.000.000đ',
      lot: 'LOT-TS-240112',
      gradeSize: 'A+ / 18-22 con/kg',
      harvest: '2024-01-12',
      delivery: '2024-01-19',
      eta: '4 ngày',
      incoterms: 'EXW - Lấy tại kho',
      shipping: '2,500,000đ',
      payment: 'Thanh toán 70% trước',
    },
    {
      supplier: 'Công ty TNHH Miền Tây',
      rating: '4.9 (234 đơn)',
      tags: ['Công nợ dài hạn', 'Rating cao nhất'],
      price: '275.000đ',
      total: '82.500.000đ',
      lot: 'LOT-TS-240110',
      gradeSize: 'A / 25-30 con/kg',
      harvest: '2024-01-09',
      delivery: '2024-01-18',
      eta: '3 ngày',
      incoterms: 'DAP - Giao tại địa chỉ',
      shipping: 'Miễn phí',
      payment: 'Công nợ 14 ngày',
    },
  ]

  return (
    <>
      <BuyerShell
        activeKey="rfq"
        title="RFQ & Báo giá"
        subtitle="Quản lý yêu cầu báo giá và so sánh"
        actions={<div className="flex justify-end"><button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">+ Tạo RFQ mới</button></div>}
      >
        <BuyerPanel title="Yêu cầu Báo giá của tôi" right={<p className="text-xs text-emerald-700/70">Quản lý các yêu cầu báo giá và so sánh nhà cung cấp</p>}>
          <div className="space-y-3">
            {buyerRfqCards.map((item) => (
              <article key={item.id} className="rounded-xl border border-emerald-100 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xl font-extrabold text-emerald-950">{item.id}</h4>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">{item.status}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">{item.quoteCount} báo giá</span>
                    </div>
                    <p className="mt-1 text-xs text-emerald-700/70">Tạo ngày: {item.createdAt}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-700/70">Hạn chót</p>
                    <p className="text-xs font-semibold text-emerald-900">{item.deadline}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg bg-emerald-50 p-2.5"><p className="text-xs text-emerald-700/70">Sản phẩm</p><p className="text-sm font-semibold">{item.product}</p></div>
                  <div className="rounded-lg bg-emerald-50 p-2.5"><p className="text-xs text-emerald-700/70">Số lượng</p><p className="text-sm font-semibold">{item.quantity}</p></div>
                  <div className="rounded-lg bg-emerald-50 p-2.5"><p className="text-xs text-emerald-700/70">Giá mục tiêu</p><p className="text-sm font-semibold">{item.targetPrice}</p></div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => {
                      setActiveRfqId(item.id)
                      setOpenCompare(true)
                    }}
                  >
                    So sánh báo giá ({item.quoteCount})
                  </button>
                  <button className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700">Xem chi tiết</button>
                </div>
              </article>
            ))}
          </div>
        </BuyerPanel>
      </BuyerShell>

      {openCompare ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={() => setOpenCompare(false)}>
          <div className="mx-auto mt-3 w-[96vw] max-w-[1180px] overflow-hidden rounded-2xl bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-200 p-3">
              <div>
                <h3 className="text-2xl font-extrabold text-slate-900">So sánh báo giá - {activeRfq?.id}</h3>
                <p className="mt-0.5 text-xs text-slate-600">{activeRfq?.product} - {activeRfq?.quantity}</p>
              </div>
              <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={() => setOpenCompare(false)}>x</button>
            </div>

            <div className="grid gap-2 border-b border-slate-200 p-3 text-xs md:grid-cols-4">
              <p>Giá mục tiêu: <span className="font-bold">{activeRfq?.targetPrice}</span></p>
              <p>Hạn chót: <span className="font-bold">{activeRfq?.deadline}</span></p>
              <p>Địa chỉ giao: <span className="font-bold">Chi nhánh Cầu Giấy, 123 Đường Cầu Giấy, Hà Nội</span></p>
              <p>Nhận: <span className="font-bold text-emerald-700">3 báo giá</span></p>
            </div>

            <div className="grid gap-2 p-3 lg:grid-cols-3">
              {compareCards.map((card) => (
                <article key={card.supplier} className="rounded-xl border border-slate-200 p-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">{card.supplier}</p>
                      <p className="text-xs text-slate-500">⭐ {card.rating}</p>
                    </div>
                    <input type="radio" name="selectedQuote" className="mt-1.5 h-4 w-4 accent-emerald-600" />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {card.tags.map((tag) => (
                      <span key={tag} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">{tag}</span>
                    ))}
                  </div>

                  <div className="mt-2 rounded-lg bg-blue-50 p-2 text-center">
                    <p className="text-[28px] font-extrabold text-blue-600">{card.price}</p>
                    <p className="text-xs">per kg</p>
                    <p className="text-xs text-slate-500">Tổng: {card.total}</p>
                  </div>

                  <div className="mt-2 space-y-1 text-xs">
                    <InfoRow label="Mã lô" value={card.lot} />
                    <InfoRow label="Grade/Size" value={card.gradeSize} />
                    <InfoRow label="Thu hoạch" value={card.harvest} />
                    <InfoRow label="Giao hàng" value={card.delivery} />
                    <InfoRow label="Thời gian" value={card.eta} />
                    <InfoRow label="Incoterms" value={card.incoterms} />
                    <InfoRow label="Phí ship" value={card.shipping} />
                    <InfoRow label="Thanh toán" value={card.payment} />
                  </div>
                </article>
              ))}
            </div>

            <div className="flex justify-between border-t border-slate-200 p-3">
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700" onClick={() => setOpenCompare(false)}>Đóng</button>
              <button className="rounded-lg bg-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500">Chuyển thành đơn hàng</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="grid grid-cols-[82px_1fr] gap-1 border-b border-slate-100 pb-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </p>
  )
}
