import { Bookmark, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerSourcingLots, sourcingPriceRanges } from '../../data/buyerSourcingData'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'

export function BuyerSourcingPage() {
  const [openRfq, setOpenRfq] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const selectedLot = useMemo(() => buyerSourcingLots[0], [])

  return (
    <BuyerShell activeKey="sourcing" title="Tìm nguồn hàng" subtitle="Tìm kiếm và so sánh nguồn hàng theo lô">
      <div className="space-y-4">
        <BuyerPanel>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              <input className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/40 pl-10 pr-3 text-sm" placeholder="Tìm kiếm sản phẩm, nhà cung cấp..." />
            </label>
            <select className="h-11 rounded-lg border border-emerald-200 bg-white px-3 text-sm"><option>Tất cả</option></select>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Lọc nâng cao</button>
            <button className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">Khu vực</button>
            <button className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">Giá</button>
          </div>
        </BuyerPanel>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <BuyerPanel title="Bộ lọc">
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-2 font-semibold text-emerald-900">Danh mục</p>
                <div className="space-y-1">
                  {['Tất cả', 'Thủy sản', 'Rau củ', 'Trái cây', 'Ngũ cốc'].map((item) => (
                    <label key={item} className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-600" /> {item}</label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-semibold text-emerald-900">Khu vực</p>
                <select className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm"><option>Tất cả khu vực</option></select>
              </div>
              <div>
                <p className="mb-2 font-semibold text-emerald-900">Mức giá</p>
                <div className="space-y-1">
                  {sourcingPriceRanges.map((item) => (
                    <label key={item} className="flex items-center gap-2"><input type="radio" name="price" className="accent-emerald-600" /> {item}</label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-semibold text-emerald-900">Phân loại</p>
                <select className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm"><option>Tất cả</option></select>
              </div>
            </div>
          </BuyerPanel>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {buyerSourcingLots.map((lot) => (
              <article key={lot.id} className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-[0_4px_12px_rgba(16,120,74,0.08)]">
                <div className="relative">
                  <img src={lot.image} alt={lot.name} className="h-40 w-full rounded-xl object-cover" />
                  <button className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-emerald-700"><Bookmark className="h-4 w-4" /></button>
                </div>
                <h3 className="mt-3 text-lg font-bold text-emerald-950">{lot.name}</h3>
                <p className="text-xs text-emerald-700/80">{lot.supplier} • {lot.location}</p>
                <p className="text-xs text-emerald-700/80">{lot.grade} • {lot.lotCode}</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-700">{lot.price}</p>
                <p className="text-xs text-emerald-700/80">Tồn kho: {lot.stock} • MOQ: {lot.moq}</p>
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white">Đặt hàng ngay</button>
                  <button onClick={() => { setOpenRfq(true); setStep(1) }} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700">RFQ</button>
                </div>
                <Link to={`/buyer/lots/${lot.id}`} className="mt-2 block rounded-lg border border-emerald-200 py-2 text-center text-xs font-semibold text-emerald-700">Xem chi tiết lô hàng</Link>
              </article>
            ))}
          </div>
        </div>
      </div>

      {openRfq ? (
        <div className="fixed inset-0 z-50 bg-black/35 p-4">
          <div className="mx-auto mt-10 w-full max-w-3xl rounded-2xl bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-emerald-950">Tạo yêu cầu báo giá mới</h3>
                <p className="text-sm text-emerald-700/70">Bước {step}/3: {step === 1 ? 'Thông tin sản phẩm' : step === 2 ? 'Điều kiện giao hàng' : 'Yêu cầu chất lượng'}</p>
              </div>
              <button onClick={() => setOpenRfq(false)}><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className={`h-2 rounded ${step >= 1 ? 'bg-emerald-500' : 'bg-emerald-100'}`} />
              <div className={`h-2 rounded ${step >= 2 ? 'bg-emerald-500' : 'bg-emerald-100'}`} />
              <div className={`h-2 rounded ${step >= 3 ? 'bg-emerald-500' : 'bg-emerald-100'}`} />
            </div>

            {step === 1 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Sản phẩm *</label>
                  <input className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" defaultValue={selectedLot.name} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Danh mục *</label>
                  <select className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"><option>Chọn danh mục</option></select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Grade mong muốn</label>
                  <select className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"><option>Chọn grade</option></select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Size/Quy cách</label>
                  <input className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="Ví dụ: 20-25 con/kg" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Số lượng *</label>
                  <div className="grid grid-cols-[1fr_78px] gap-2">
                    <input className="h-11 rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="Nhập số lượng" />
                    <select className="h-11 rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"><option>kg</option></select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Giá mục tiêu (đ/kg)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="h-11 rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="Từ" />
                    <input className="h-11 rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="Đến" />
                  </div>
                </div>
              </div>
            ) : step === 2 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold">Chi nhánh nhận hàng *</label>
                  <select className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"><option>Chọn chi nhánh</option></select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold">Địa chỉ giao hàng *</label>
                  <textarea className="h-20 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm" placeholder="Nhập địa chỉ đầy đủ..." />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Thời gian cần hàng *</label>
                  <input type="date" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Hạn chót báo giá *</label>
                  <input type="date" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Điều kiện giao hàng (Incoterms)</label>
                  <select className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"><option>DAP - Giao tại địa chỉ</option></select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Điều kiện thanh toán</label>
                  <select className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"><option>Chọn điều kiện</option></select>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Yêu cầu chất lượng</label>
                  <textarea className="h-20 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm" placeholder="Mô tả chi tiết về chất lượng sản phẩm mong muốn..." />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Chứng nhận yêu cầu</label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {['VietGAP', 'GlobalGAP', 'Organic', 'HACCP', 'ISO 22000', 'Halal'].map((cert) => (
                      <label key={cert} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"><input type="checkbox" className="accent-emerald-600" /> {cert}</label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Ghi chú thêm</label>
                  <textarea className="h-20 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm" placeholder="Các thông tin bổ sung hoặc yêu cầu đặc biệt..." />
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                  <p className="font-semibold text-emerald-900">Tóm tắt yêu cầu báo giá</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-emerald-800">
                    <p>Sản phẩm: {selectedLot.name}</p>
                    <p>Số lượng: -</p>
                    <p>Giá mục tiêu: -</p>
                    <p>Thời gian cần: -</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-between">
              <button onClick={() => (step === 1 ? setOpenRfq(false) : setStep((step - 1) as 1 | 2 | 3))} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">Quay lại</button>
              {step < 3 ? (
                <button onClick={() => setStep((step + 1) as 1 | 2 | 3)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Tiếp theo</button>
              ) : (
                <button onClick={() => setOpenRfq(false)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Gửi yêu cầu báo giá</button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </BuyerShell>
  )
}
