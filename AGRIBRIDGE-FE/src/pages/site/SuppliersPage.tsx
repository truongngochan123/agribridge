import { MapPin, Search, ShieldCheck, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { trustedSuppliers } from '../../data/site'
import { PublicPageLayout } from '../../components/site/PublicPageLayout'

export function SuppliersPage() {
  return (
    <PublicPageLayout title="Nhà cung cấp uy tín" subtitle="Kết nối với các nhà cung cấp nông hải sản chất lượng cao trên toàn quốc">
      <section className="rounded-2xl border border-[#D9E1EA] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              placeholder="Tìm kiếm nhà cung cấp..."
              className="h-11 w-full rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] pl-10 pr-3 text-sm text-[#0F172A] outline-none"
            />
          </label>
          <select className="h-11 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 text-sm text-[#344054]">
            <option>Tất cả danh mục</option>
          </select>
          <select className="h-11 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 text-sm text-[#344054]">
            <option>Tất cả khu vực</option>
          </select>
        </div>
      </section>

      <p className="mt-5 text-sm text-[#667085]">Hiển thị 10 nhà cung cấp</p>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trustedSuppliers.map((supplier) => (
          <article key={supplier.id} className="rounded-2xl border border-[#D9E1EA] bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#10B981] text-sm font-bold text-white">
                {supplier.logoText}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Đã xác minh
              </span>
            </div>

            <h3 className="mt-3 text-xl font-bold text-[#0F172A]">{supplier.name}</h3>
            <div className="mt-1 flex items-center gap-2 text-sm text-[#667085]">
              <MapPin className="h-4 w-4" />
              <span>{supplier.location}</span>
              <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-xs text-[#4F46E5]">{supplier.category}</span>
            </div>

            <p className="mt-3 min-h-[52px] text-sm leading-6 text-[#667085]">{supplier.description}</p>

            <div className="mt-3 flex items-center gap-2 text-sm text-[#344054]">
              <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
              <span className="font-semibold">{supplier.rating}</span>
              <span>{supplier.productsCount} sản phẩm</span>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Link
                to={`/suppliers/${supplier.id}`}
                className="flex-1 rounded-lg bg-[#10B981] py-2.5 text-center text-sm font-semibold text-white hover:bg-[#0E9F6E]"
              >
                Xem sản phẩm
              </Link>
              <button className="rounded-lg border border-[#D9E1EA] px-3 py-2.5 text-sm text-[#667085]">◻</button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {supplier.certifications.map((item) => (
                <span key={item} className="rounded-full bg-[#F0FDF4] px-2 py-1 text-xs text-[#15803D]">
                  {item}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </PublicPageLayout>
  )
}
