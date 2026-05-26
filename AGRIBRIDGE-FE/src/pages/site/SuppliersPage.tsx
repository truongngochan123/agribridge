import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Package,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { PublicPageLayout } from '../../components/site/PublicPageLayout'
import { usePageTitle } from '../../hooks/usePageTitle'
import { apiClient } from '../../services/apiClient'
import { trustedSuppliers } from '../../data/site'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompanyItem {
  id: number
  name: string
  province: string
  district?: string
  address?: string
  description?: string
  verifiedStatus: boolean
  verificationStatus?: string
  companyType?: string
  businessType?: string
  trustLevel?: string
  establishedYear?: number
  website?: string
}



// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLogoText(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const LOGO_GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-pink-600',
]

function getGradient(id: number) {
  return LOGO_GRADIENTS[id % LOGO_GRADIENTS.length]
}

const ITEMS_PER_PAGE = 9

// ─── Skeleton Card ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#E4EAF0] bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-12 w-12 rounded-xl bg-gray-200" />
        <div className="h-6 w-24 rounded-full bg-gray-200" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-5 w-3/4 rounded bg-gray-200" />
        <div className="h-4 w-1/2 rounded bg-gray-200" />
      </div>
      <div className="mt-3 h-10 w-full rounded bg-gray-100" />
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-24 rounded-full bg-gray-200" />
        <div className="h-8 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="mt-4 h-10 w-full rounded-xl bg-gray-200" />
    </div>
  )
}

// ─── Supplier Card ──────────────────────────────────────────────────────────

interface SupplierCardProps {
  company: CompanyItem
  index: number
}

function SupplierCard({ company, index }: SupplierCardProps) {
  const gradient = getGradient(company.id)
  const logoText = getLogoText(company.name)
  const isVerified = company.verifiedStatus || company.verificationStatus === 'APPROVED'

  return (
    <article
      className="group relative flex flex-col rounded-2xl border border-[#E4EAF0] bg-white
        shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-all duration-300
        hover:shadow-[0_8px_32px_rgba(15,23,42,0.12)] hover:-translate-y-1"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top gradient accent */}
      <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-sm font-bold text-white shadow-md`}
          >
            {logoText}
          </div>

          {isVerified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Đã xác minh
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">
              <Shield className="h-3.5 w-3.5" />
              Chưa xác minh
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="mt-3.5 text-base font-bold leading-snug text-[#0F172A] line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200">
          {company.name}
        </h3>

        {/* Location */}
        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-[#667085]">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
          <span className="truncate">{company.province}</span>
          {company.companyType && (
            <>
              <span className="text-[#D0D5DD]">·</span>
              <span className="truncate rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                {formatCompanyType(company.companyType)}
              </span>
            </>
          )}
        </div>

        {/* Description */}
        <p className="mt-3 flex-1 text-sm leading-relaxed text-[#667085] line-clamp-2">
          {company.description || 'Nhà cung cấp nông hải sản chất lượng cao trên nền tảng AgriBridge.'}
        </p>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-4 rounded-xl bg-[#F8FAFC] px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-[#344054]">4.8</span>
          </div>
          <div className="h-3.5 w-px bg-[#E4EAF0]" />
          <div className="flex items-center gap-1.5 text-sm text-[#667085]">
            <Package className="h-3.5 w-3.5 text-emerald-500" />
            <span>Đang hoạt động</span>
          </div>
          {company.establishedYear && (
            <>
              <div className="h-3.5 w-px bg-[#E4EAF0]" />
              <div className="flex items-center gap-1 text-xs text-[#667085]">
                <Building2 className="h-3.5 w-3.5 text-blue-400" />
                <span>{company.establishedYear}</span>
              </div>
            </>
          )}
        </div>

        {/* Trust badges */}
        {company.trustLevel && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <Award className="h-3 w-3" />
              {company.trustLevel}
            </span>
          </div>
        )}

        {/* CTA */}
        <Link
          to={`/suppliers/${company.id}`}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600
            py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200
            hover:shadow-[0_4px_16px_rgba(16,185,129,0.4)] hover:brightness-110 active:scale-95"
        >
          Xem nhà cung cấp
        </Link>
      </div>
    </article>
  )
}

function formatCompanyType(type: string): string {
  const map: Record<string, string> = {
    SUPPLIER: 'Nhà cung cấp',
    BUYER: 'Người mua',
    COOPERATIVE: 'HTX',
    FARM: 'Trang trại',
    COMPANY: 'Công ty',
  }
  return map[type] ?? type
}

// ─── Fallback from static data ───────────────────────────────────────────────

function staticToCompanyItem(s: (typeof trustedSuppliers)[0], idx: number): CompanyItem {
  return {
    id: idx + 1,
    name: s.name,
    province: s.location,
    description: s.description,
    verifiedStatus: true,
    verificationStatus: 'APPROVED',
    trustLevel: s.certifications[0],
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function SuppliersPage() {
  usePageTitle('Nhà cung cấp uy tín')

  const [companies, setCompanies] = useState<CompanyItem[]>([])

  const [provinces, setProvinces] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  // ── Fetch data ──────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [companiesRes, provincesRes] = await Promise.allSettled([
        apiClient.get<CompanyItem[]>('/api/companies'),
        apiClient.get<{ items: string[] }>('/api/public/metadata/provinces'),
      ])

      // Companies
      if (companiesRes.status === 'fulfilled') {
        const supplierOnly = companiesRes.value.data.filter(
          (c) => !c.companyType || c.companyType === 'SUPPLIER' || c.verifiedStatus,
        )
        setCompanies(supplierOnly.length > 0 ? supplierOnly : trustedSuppliers.map(staticToCompanyItem))
      } else {
        setCompanies(trustedSuppliers.map(staticToCompanyItem))
      }

      // Provinces
      if (provincesRes.status === 'fulfilled') {
        setProvinces(provincesRes.value.data.items)
      }
    } catch {
      setError('Không thể tải dữ liệu. Hiển thị dữ liệu mẫu.')
      setCompanies(trustedSuppliers.map(staticToCompanyItem))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ── Filter logic ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.province && c.province.toLowerCase().includes(search.toLowerCase())) ||
        (c.description && c.description.toLowerCase().includes(search.toLowerCase()))

      const matchProvince = !selectedProvince || c.province === selectedProvince

      const matchVerified = !verifiedOnly || c.verifiedStatus || c.verificationStatus === 'APPROVED'

      return matchSearch && matchProvince && matchVerified
    })
  }, [companies, search, selectedProvince, verifiedOnly])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedCategory, selectedProvince, verifiedOnly])

  const clearFilters = () => {
    setSearch('')
    setSelectedCategory('')
    setSelectedProvince('')
    setVerifiedOnly(false)
  }

  const hasActiveFilters = search || selectedCategory || selectedProvince || verifiedOnly

  // ── Stats ────────────────────────────────────────────────────────────────

  const verifiedCount = companies.filter((c) => c.verifiedStatus || c.verificationStatus === 'APPROVED').length
  const provinceCount = new Set(companies.map((c) => c.province).filter(Boolean)).size

  return (
    <PublicPageLayout
      title="Nhà cung cấp uy tín"
      subtitle="Kết nối với các nhà cung cấp nông hải sản chất lượng cao trên toàn quốc"
    >
      {/* ── Stats banner ───────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-3 gap-4 sm:grid-cols-3">
        {[
          { label: 'Nhà cung cấp', value: loading ? '—' : companies.length.toString(), icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Đã xác minh', value: loading ? '—' : verifiedCount.toString(), icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Tỉnh / Thành', value: loading ? '—' : provinceCount.toString(), icon: MapPin, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#E4EAF0] bg-white px-4 py-3 shadow-sm">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-[#0F172A]">{value}</p>
              <p className="text-xs text-[#667085]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filter bar ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#E4EAF0] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          {/* Search */}
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm nhà cung cấp, tỉnh thành..."
              className="h-11 w-full rounded-xl border border-[#E4EAF0] bg-[#F8FAFC] pl-10 pr-10 text-sm text-[#0F172A] outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#344054]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          {/* Province select */}
          <select
            value={selectedProvince}
            onChange={(e) => setSelectedProvince(e.target.value)}
            className="h-11 rounded-xl border border-[#E4EAF0] bg-[#F8FAFC] px-3 text-sm text-[#344054] outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 md:w-52"
          >
            <option value="">Tất cả khu vực</option>
            {provinces.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            {/* Fallback from data if provinces empty */}
            {provinces.length === 0 &&
              Array.from(new Set(companies.map((c) => c.province).filter(Boolean))).sort().map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
          </select>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all ${
              showFilters || verifiedOnly
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-[#E4EAF0] bg-[#F8FAFC] text-[#344054] hover:border-emerald-300'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Bộ lọc
            {verifiedOnly && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                1
              </span>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#E4EAF0] bg-[#F8FAFC] text-[#667085] transition-all hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#F0F4F8] pt-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-[#344054]">Chỉ nhà cung cấp đã xác minh</span>
            </label>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-700"
              >
                <X className="h-3.5 w-3.5" />
                Xoá bộ lọc
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Error notice ────────────────────────────────────────────────── */}
      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <RefreshCw className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Result count ────────────────────────────────────────────────── */}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-[#667085]">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Đang tải dữ liệu...
            </span>
          ) : (
            <>
              Hiển thị{' '}
              <span className="font-semibold text-[#344054]">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
              </span>{' '}
              trong{' '}
              <span className="font-semibold text-[#344054]">{filtered.length}</span> nhà cung cấp
            </>
          )}
        </p>

        {totalPages > 1 && !loading && (
          <div className="flex items-center gap-1 text-sm text-[#667085]">
            Trang {currentPage} / {totalPages}
          </div>
        )}
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
          : paginated.length > 0
          ? paginated.map((company, i) => (
              <SupplierCard key={company.id} company={company} index={i} />
            ))
          : null}
      </section>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!loading && paginated.length === 0 && (
        <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#F0FDF4]">
            <Search className="h-10 w-10 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">Không tìm thấy nhà cung cấp</h3>
            <p className="mt-1 text-sm text-[#667085]">Thử thay đổi từ khoá hoặc bộ lọc tìm kiếm</p>
          </div>
          <button
            onClick={clearFilters}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Xoá bộ lọc
          </button>
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {!loading && totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4EAF0] bg-white text-[#667085] transition-all hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let page: number
            if (totalPages <= 5) {
              page = i + 1
            } else if (currentPage <= 3) {
              page = i + 1
            } else if (currentPage >= totalPages - 2) {
              page = totalPages - 4 + i
            } else {
              page = currentPage - 2 + i
            }
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition-all ${
                  page === currentPage
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md'
                    : 'border border-[#E4EAF0] bg-white text-[#667085] hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                {page}
              </button>
            )
          })}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4EAF0] bg-white text-[#667085] transition-all hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      {!loading && (
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Bạn là nhà cung cấp?</h2>
              <p className="mt-1 text-sm text-emerald-100">
                Đăng ký để kết nối với hàng ngàn doanh nghiệp mua hàng trên toàn quốc.
              </p>
            </div>
            <Link
              to="/auth/register"
              className="flex-shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-md transition-all hover:shadow-lg hover:scale-105 active:scale-95"
            >
              Đăng ký ngay
            </Link>
          </div>
        </div>
      )}
    </PublicPageLayout>
  )
}
