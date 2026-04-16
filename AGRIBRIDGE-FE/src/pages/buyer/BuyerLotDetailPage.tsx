import { ArrowLeft, Award, Bookmark, Building2, CalendarDays, Check, Download, FileText, MapPin, Share2, ShieldCheck, Star, Weight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buyerLotImages, buyerLotInfo } from '../../data/buyerLotDetailData'
import { buyerSourcingLots } from '../../data/buyerSourcingData'

export function BuyerLotDetailPage() {
  const { lotId } = useParams<{ lotId: string }>()
  const lot = useMemo(() => buyerSourcingLots.find((item) => item.id === lotId) ?? buyerSourcingLots[0], [lotId])
  const [activeTab, setActiveTab] = useState<'lot' | 'quality' | 'history' | 'supplier'>('lot')
  const [qty, setQty] = useState(100)

  const certs = [
    { id: 'asc', label: 'ASC', icon: Award, active: false, color: 'text-blue-600' },
    { id: 'globalgap', label: 'GlobalGAP', icon: ShieldCheck, active: true, color: 'text-emerald-600' },
    { id: 'haccp', label: 'HACCP', icon: ShieldCheck, active: false, color: 'text-violet-600' },
    { id: 'iso22000', label: 'ISO 22000', icon: Award, active: false, color: 'text-amber-700' },
  ]

  const qualityRows = [
    { item: 'Kháng sinh', result: 'Âm tính', standard: 'EU/Codex' },
    { item: 'Kim loại nặng', result: '< 0.5 ppm', standard: 'WHO' },
    { item: 'Vi sinh vật', result: 'Đạt chuẩn', standard: 'TCVN' },
    { item: 'Độ tươi', result: '9.2/10', standard: 'Nội bộ' },
  ]

  const tradingHistory = [
    { id: 'h1', buyer: 'Hệ thống siêu thị Metro', date: '10/3/2026', qty: '500 kg', stars: 5 },
    { id: 'h2', buyer: 'Nhà hàng Sài Gòn Xưa', date: '8/3/2026', qty: '200 kg', stars: 5 },
    { id: 'h3', buyer: 'Công ty CP XNK Hải Sản', date: '5/3/2026', qty: '1000 kg', stars: 4 },
  ]

  return (
    <div className="min-h-screen bg-emerald-50/30 text-emerald-950">
      <main className="mx-auto max-w-7xl px-6 py-5">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/buyer/sourcing" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft className="h-4 w-4" /> Quay lại Tìm nguồn hàng</Link>
          <div className="flex gap-2"><button className="rounded-lg border border-emerald-200 p-2"><Bookmark className="h-4 w-4" /></button><button className="rounded-lg border border-emerald-200 p-2"><Share2 className="h-4 w-4" /></button></div>
        </div>

        <p className="mb-3 text-xs text-emerald-700/70">Dashboard &gt; Tìm nguồn hàng &gt; LOT-1</p>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-emerald-200 bg-white p-3">
            <img src={lot.image} alt={lot.name} className="h-[480px] w-full rounded-xl object-cover" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {buyerLotImages.map((img) => (
                <img key={img} src={img} alt="thumb" className="h-24 w-full rounded-lg object-cover" />
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-emerald-200 bg-white p-4">
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">LOT-1</span>
            <h1 className="mt-2 text-3xl font-extrabold">{lot.name}</h1>
            <p className="mt-1 text-sm text-emerald-700/80">Trang trại Biển Xanh</p>
            <p className="inline-flex items-center gap-1 text-sm text-emerald-700/80"><MapPin className="h-4 w-4" /> Cà Mau</p>

            <p className="mt-3 text-[30px] font-extrabold text-emerald-700">{lot.price}<span className="ml-1 text-sm text-emerald-700/70">/kg</span></p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <p>Grade: <span className="font-semibold">A+</span></p>
              <p>Size: <span className="font-semibold">15-20 con/kg</span></p>
              <p>MOQ: <span className="font-semibold">50kg</span></p>
              <p>Tồn kho: <span className="font-semibold text-emerald-700">2500 kg</span></p>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold">Số lượng (Tối thiểu 50kg)</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty((q) => Math.max(50, q - 10))} className="h-10 w-10 rounded-lg border border-emerald-200">-</button>
                <input value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} className="h-10 flex-1 rounded-lg border border-emerald-200 px-3" />
                <button onClick={() => setQty((q) => q + 10)} className="h-10 w-10 rounded-lg border border-emerald-200">+</button>
                <span className="text-sm text-emerald-700/70">kg</span>
              </div>
              <p className="mt-1 text-sm text-emerald-700/70">Tạm tính: NaNđ</p>
            </div>

            <div className="mt-4 space-y-2">
              <button className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white">Đặt hàng ngay</button>
              <button className="w-full rounded-lg border border-emerald-400 py-2.5 text-sm font-semibold text-emerald-700">Gửi yêu cầu báo giá</button>
              <button className="w-full rounded-lg border border-emerald-200 py-2.5 text-sm font-semibold text-emerald-700">Liên hệ nhà cung cấp</button>
            </div>
          </aside>
        </section>

        <section className="mt-4 rounded-2xl border border-emerald-200 bg-white">
          <div className="flex flex-wrap gap-1 border-b border-emerald-100 p-2">
            {[['lot', 'Thông tin lô hàng'], ['quality', 'Chất lượng & Chứng từ'], ['history', 'Lịch sử giao dịch'], ['supplier', 'Thông tin NCC']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as 'lot' | 'quality' | 'history' | 'supplier')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === key ? 'bg-emerald-100 text-emerald-800' : 'text-emerald-700/80'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === 'lot' ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-xl font-bold">Thông tin cơ bản</h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>Mã lô: <span className="font-semibold">{buyerLotInfo.lotCode}</span></p>
                      <p>Ngày thu hoạch: <span className="font-semibold">{buyerLotInfo.harvestDate}</span></p>
                      <p>Ngày đóng gói: <span className="font-semibold">{buyerLotInfo.packingDate}</span></p>
                      <p>Hạn sử dụng: <span className="font-semibold">{buyerLotInfo.expiryDate}</span></p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Nguồn gốc & Bảo quản</h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>Vùng nuôi: <span className="font-semibold">{buyerLotInfo.farmingArea}</span></p>
                      <p>Trang trại: <span className="font-semibold">{buyerLotInfo.farm}</span></p>
                      <p>Quy cách: <span className="font-semibold">{buyerLotInfo.packaging}</span></p>
                      <p>Nhiệt độ: <span className="font-semibold">{buyerLotInfo.storageTemp}</span></p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="font-semibold">Truy xuất nguồn gốc</p>
                  <p className="mt-1 text-sm text-emerald-700/80">Quét mã QR để xem đầy đủ thông tin truy xuất nguồn gốc của lô hàng này</p>
                  <button className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Xem chi tiết truy xuất</button>
                </div>

                <div className="mt-5">
                  <h3 className="text-xl font-bold">Các lô khác của Tôm Sú Cao Cấp</h3>
                  <p className="text-sm text-emerald-700/70">Có 2 lô khác từ cùng nhà cung cấp này</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {[1, 2].map((n) => (
                      <article key={n} className="rounded-xl border border-emerald-100 p-3">
                        <img src="/images/shrimp.jpg" alt="lot" className="h-36 w-full rounded-lg object-cover" />
                        <p className="mt-2 text-xs text-emerald-700">Thu hoạch {n === 1 ? '4' : '2'} ngày trước</p>
                        <p className="mt-1 text-sm font-semibold">LOT-TS-00{n + 1}</p>
                        <p className="text-sm">Size: 18-22 con/kg</p>
                        <p className="text-xl font-extrabold text-emerald-700">{n === 1 ? '295,000đ' : '310,000đ'} <span className="text-xs">/kg</span></p>
                        <p className="text-xs text-emerald-700/70">Tồn kho: {n === 1 ? '1,800 kg' : '1,200 kg'}</p>
                        <button className="mt-2 w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white">Xem lô này</button>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : activeTab === 'quality' ? (
              <>
                <h3 className="text-xl font-extrabold text-emerald-950">Chứng nhận</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  {certs.map((cert) => {
                    const Icon = cert.icon
                    return (
                      <div
                        key={cert.id}
                        className={`rounded-xl border p-4 ${cert.active ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <div className="flex flex-col items-center justify-center gap-2 py-1">
                          <Icon className={`h-6 w-6 ${cert.color}`} />
                          <p className={`text-sm font-semibold ${cert.color}`}>{cert.label}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <h3 className="mt-6 text-xl font-extrabold text-emerald-950">Kết quả kiểm định chất lượng</h3>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">HẠNG MỤC</th>
                        <th className="px-4 py-3 font-semibold">KẾT QUẢ</th>
                        <th className="px-4 py-3 font-semibold">TIÊU CHUẨN</th>
                        <th className="px-4 py-3 font-semibold">TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualityRows.map((row) => (
                        <tr key={row.item} className="border-t border-slate-200">
                          <td className="px-4 py-3 font-semibold text-slate-800">{row.item}</td>
                          <td className="px-4 py-3 text-slate-700">{row.result}</td>
                          <td className="px-4 py-3 text-slate-700">{row.standard}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                              <Check className="h-3.5 w-3.5" /> Đạt chuẩn
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    <Download className="h-4 w-4" /> Tải chứng từ đầy đủ
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    <FileText className="h-4 w-4" /> Giấy kiểm định (PDF)
                  </button>
                </div>
              </>
            ) : activeTab === 'history' ? (
              <>
                <h3 className="text-xl font-extrabold text-emerald-950">Lịch sử giao dịch của lô hàng này</h3>
                <div className="mt-4 space-y-3">
                  {tradingHistory.map((item) => (
                    <article key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">{item.buyer}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {item.date}</span>
                            <span className="inline-flex items-center gap-1"><Weight className="h-3.5 w-3.5" /> {item.qty}</span>
                            <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Đã giao dịch</span>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star key={`${item.id}-${idx}`} className={`h-4 w-4 ${idx < item.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : activeTab === 'supplier' ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-extrabold">Công ty TNHH Thủy sản Miền Tây</h3>
                    <p className="mt-1 inline-flex items-center gap-2 text-sm"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.8 • 48 sản phẩm • <MapPin className="h-4 w-4" /> Cà Mau</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Đã xác minh</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-white p-3"><p className="text-2xl font-extrabold text-emerald-700">98%</p><p className="text-sm text-emerald-700/80">Tỷ lệ phản hồi</p></div>
                  <div className="rounded-lg bg-white p-3"><p className="text-2xl font-extrabold text-emerald-700">96%</p><p className="text-sm text-emerald-700/80">Giao đúng hẹn</p></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link to="/suppliers/mien-tay-seafood" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Xem trang nhà cung cấp</Link>
                  <button className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700">0909 123 456</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-emerald-700/80">Nội dung đang cập nhật.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
