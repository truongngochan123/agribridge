import { ArrowLeft, Building2, MapPin, ShieldCheck, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { supplierMetrics, supplierProducts, trustedSuppliers } from '../../data/site'
import { PublicPageLayout } from '../../components/site/PublicPageLayout'

export function SupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>()
  const supplier = trustedSuppliers.find((item) => item.id === supplierId) ?? trustedSuppliers[0]

  return (
    <PublicPageLayout>
      <div className="mb-4">
        <Link to="/suppliers" className="inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#0F172A]">
          <ArrowLeft className="h-4 w-4" />
          Thông tin nhà cung cấp
        </Link>
      </div>

      <section className="rounded-2xl border border-[#D9E1EA] bg-white p-5 shadow-[0_4px_12px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#10B981] text-base font-bold text-white">
              {supplier.logoText}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-extrabold text-[#0F172A]">{supplier.name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Đã xác minh
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#667085]">
                <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {supplier.location}</span>
                <span className="inline-flex items-center gap-1"><Building2 className="h-4 w-4" /> {supplier.category}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[#475467]">{supplier.description}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-[#344054]">
                <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                <span className="font-semibold">{supplier.rating}</span>
                <span>{supplier.productsCount} sản phẩm</span>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <button className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-white">Gửi RFQ</button>
            <button className="rounded-lg border border-[#D9E1EA] px-4 py-2 text-sm font-semibold text-[#344054]">Liên hệ</button>
            <button className="rounded-lg border border-[#D9E1EA] px-4 py-2 text-sm font-semibold text-[#344054]">Theo dõi</button>
            <button className="rounded-lg border border-[#D9E1EA] px-4 py-2 text-sm font-semibold text-[#344054]">So sánh NCC</button>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {supplierMetrics.map((metric) => (
          <article key={metric.label} className="rounded-xl border border-[#D9E1EA] bg-white p-4">
            <p className="text-sm text-[#667085]">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold text-[#0F172A]">{metric.value}</p>
            <p className="mt-1 text-xs text-[#98A2B3]">{metric.subLabel}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-[#D9E1EA] bg-white p-5">
        <h2 className="text-xl font-bold text-[#0F172A]">Năng lực cung ứng</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
          <p><span className="text-[#667085]">Mặt hàng chính:</span> <span className="font-semibold">Tôm sú</span></p>
          <p><span className="text-[#667085]">Sản lượng trung bình:</span> <span className="font-semibold">20-30 tấn/tháng</span></p>
          <p><span className="text-[#667085]">MOQ:</span> <span className="font-semibold">500 kg</span></p>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#D9E1EA] bg-white p-5">
        <h2 className="text-xl font-bold text-[#0F172A]">Thông tin doanh nghiệp</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
          <p><span className="text-[#667085]">Tên pháp lý</span><br />{supplier.name}</p>
          <p><span className="text-[#667085]">Loại hình</span><br />Nông trại nuôi trồng</p>
          <p><span className="text-[#667085]">Địa chỉ</span><br />123 Đường Nguyễn Văn Linh, TP. Cà Mau</p>
          <p><span className="text-[#667085]">Số điện thoại</span><br />+84 290 3831 234</p>
          <p><span className="text-[#667085]">Email</span><br />contact@agribridge.vn</p>
          <p><span className="text-[#667085]">Website</span><br />www.agribridge.vn</p>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#D9E1EA] bg-white p-5">
        <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-[#344054]">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[#047857]">Lô hàng đang bán (2)</span>
          <span>Đánh giá (5)</span>
          <span>Thống kê</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {supplierProducts.map((product) => (
            <article key={product.id} className="rounded-xl border border-[#D9E1EA] bg-[#F9FBFD] p-4">
              <h3 className="text-lg font-bold text-[#0F172A]">{product.name}</h3>
              <p className="mt-1 text-sm text-[#667085]">Lô: {product.lotId}</p>
              <p className="mt-1 text-sm text-[#667085]">{product.spec}</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-3xl font-extrabold text-[#10B981]">{product.price}</p>
                <p className="text-sm text-[#667085]">Còn: {product.inventory}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.certifications.map((cert) => (
                  <span key={cert} className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">{cert}</span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="rounded-lg bg-[#10B981] py-2 text-sm font-semibold text-white">Đặt hàng ngay</button>
                <button className="rounded-lg border border-[#10B981] py-2 text-sm font-semibold text-[#10B981]">Gửi RFQ</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicPageLayout>
  )
}
