import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react'
import { PublicPageLayout } from '../../components/site/PublicPageLayout'
import { usePageTitle } from '../../hooks/usePageTitle'
import { apiClient } from '../../services/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CertificationPreview {
  id: number
  name: string
}

interface BatchPreview {
  id: number
  batchCode: string
  grade?: string
  size?: string
  quantity?: number
  price?: number
  status?: string
}

interface ProductItem {
  productId: number
  productName: string
  description?: string
  supplierCompanyId?: number
  supplierName?: string
  categoryId?: number
  categoryName?: string
  originRegion?: string
  unit?: string
  imageUrl?: string
  imageUrls?: string[]
  minPrice?: number
  maxPrice?: number
  totalAvailableQuantity?: number
  minMoq?: number
  availableBatchCount?: number
  gradeSummary?: string
  sizeSummary?: string
  certificationCount?: number
  hasAvailableStock?: boolean
  certifications?: CertificationPreview[]
  batches?: BatchPreview[]
}

interface CategoryOption {
  id: number
  name: string
}

// ─── Static fallback data ─────────────────────────────────────────────────────

const FALLBACK_PRODUCTS: ProductItem[] = [
  {
    productId: 1,
    productName: 'Tôm sú hữu cơ',
    description: 'Tôm sú nuôi theo tiêu chuẩn hữu cơ, không sử dụng kháng sinh, đạt chuẩn xuất khẩu.',
    supplierName: 'Công ty TNHH Thủy sản Miền Tây',
    categoryName: 'Thủy sản',
    originRegion: 'Cà Mau',
    unit: 'kg',
    minPrice: 320000,
    maxPrice: 385000,
    totalAvailableQuantity: 2500,
    availableBatchCount: 3,
    hasAvailableStock: true,
    certifications: [{ id: 1, name: 'ASC' }, { id: 2, name: 'VietGAP' }],
  },
  {
    productId: 2,
    productName: 'Tôm thẻ chân trắng',
    description: 'Tôm thẻ chân trắng size 40-50, thu hoạch tươi, sơ chế tại chỗ, đóng lạnh ngay.',
    supplierName: 'HTX Nuôi trồng Thủy sản An Giang',
    categoryName: 'Thủy sản',
    originRegion: 'An Giang',
    unit: 'kg',
    minPrice: 200000,
    maxPrice: 245000,
    totalAvailableQuantity: 1800,
    availableBatchCount: 2,
    hasAvailableStock: true,
    certifications: [{ id: 3, name: 'BAP' }, { id: 4, name: 'GlobalGAP' }],
  },
  {
    productId: 3,
    productName: 'Lúa ST25',
    description: 'Lúa ST25 đạt giải gạo ngon nhất thế giới, canh tác theo tiêu chuẩn VietGAP.',
    supplierName: 'Hợp tác xã Nông nghiệp Sóc Trăng',
    categoryName: 'Ngũ cốc',
    originRegion: 'Sóc Trăng',
    unit: 'tấn',
    minPrice: 8500000,
    maxPrice: 9200000,
    totalAvailableQuantity: 50,
    availableBatchCount: 1,
    hasAvailableStock: true,
    certifications: [{ id: 5, name: 'VietGAP' }, { id: 6, name: 'Organic' }],
  },
  {
    productId: 4,
    productName: 'Thanh long ruột đỏ',
    description: 'Thanh long ruột đỏ Bình Thuận, xuất khẩu sang Trung Quốc, Nhật Bản, độ ngọt cao.',
    supplierName: 'Trang trại Trái cây Bình Thuận',
    categoryName: 'Trái cây',
    originRegion: 'Bình Thuận',
    unit: 'kg',
    minPrice: 25000,
    maxPrice: 35000,
    totalAvailableQuantity: 10000,
    availableBatchCount: 4,
    hasAvailableStock: true,
    certifications: [{ id: 7, name: 'VietGAP' }, { id: 8, name: 'GlobalGAP' }],
  },
  {
    productId: 5,
    productName: 'Rau cải hữu cơ',
    description: 'Rau cải hữu cơ đạt tiêu chuẩn EU, không hóa chất, thuốc trừ sâu, thu hoạch mỗi ngày.',
    supplierName: 'Nông trại Organic Đà Lạt',
    categoryName: 'Rau củ',
    originRegion: 'Lâm Đồng',
    unit: 'kg',
    minPrice: 18000,
    maxPrice: 25000,
    totalAvailableQuantity: 5000,
    availableBatchCount: 6,
    hasAvailableStock: true,
    certifications: [{ id: 9, name: 'EU Organic' }, { id: 10, name: 'USDA Organic' }],
  },
  {
    productId: 6,
    productName: 'Xoài cát Hòa Lộc',
    description: 'Xoài cát Hòa Lộc Tiền Giang, thơm ngọt đặc trưng, đạt chứng nhận xuất khẩu.',
    supplierName: 'HTX Trái cây Tiền Giang',
    categoryName: 'Trái cây',
    originRegion: 'Tiền Giang',
    unit: 'kg',
    minPrice: 45000,
    maxPrice: 65000,
    totalAvailableQuantity: 8000,
    availableBatchCount: 3,
    hasAvailableStock: true,
    certifications: [{ id: 11, name: 'VietGAP' }, { id: 12, name: 'GlobalGAP' }],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price?: number): string {
  if (!price) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price)
}

function formatQuantity(qty?: number, unit?: string): string {
  if (!qty) return '—'
  return `${qty.toLocaleString('vi-VN')} ${unit ?? ''}`
}

const PRODUCT_GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-pink-600',
]

function getGradient(id: number) {
  return PRODUCT_GRADIENTS[id % PRODUCT_GRADIENTS.length]
}

const ITEMS_PER_PAGE = 9

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#E4EAF0] bg-white p-5 shadow-sm">
      <div className="h-36 w-full rounded-xl bg-gray-200" />
      <div className="mt-4 space-y-2">
        <div className="h-5 w-3/4 rounded bg-gray-200" />
        <div className="h-4 w-1/2 rounded bg-gray-200" />
      </div>
      <div className="mt-3 h-4 w-full rounded bg-gray-100" />
      <div className="mt-4 h-10 w-full rounded-xl bg-gray-200" />
    </div>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, index }: { product: ProductItem; index: number }) {
  const gradient = getGradient(product.productId)
  const initials = product.productName.slice(0, 2).toUpperCase()
  const inStock = product.hasAvailableStock !== false

  return (
    <article
      className="group flex flex-col rounded-2xl border border-[#E4EAF0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]
        transition-all duration-300 hover:shadow-[0_8px_32px_rgba(15,23,42,0.12)] hover:-translate-y-1"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Image / gradient placeholder */}
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.productName}
          className="h-40 w-full rounded-t-2xl object-cover"
        />
      ) : (
        <div
          className={`flex h-40 w-full items-center justify-center rounded-t-2xl bg-gradient-to-br ${gradient} relative overflow-hidden`}
        >
          <span className="text-5xl font-extrabold text-white/20 select-none">{initials}</span>
          <span className="absolute bottom-3 right-3 text-xs font-medium text-white/70">
            {product.categoryName ?? 'Nông sản'}
          </span>
          {/* Top hover accent */}
          <div className="absolute inset-0 bg-black/0 transition-all duration-300 group-hover:bg-black/5" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* Stock badge */}
        <div className="flex items-start justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              inStock
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-gray-200 bg-gray-50 text-gray-500'
            }`}
          >
            <Package className="h-3 w-3" />
            {inStock ? 'Còn hàng' : 'Hết hàng'}
          </span>
          {(product.availableBatchCount ?? 0) > 0 && (
            <span className="text-xs text-[#98A2B3]">{product.availableBatchCount} lô</span>
          )}
        </div>

        {/* Name */}
        <h3 className="mt-2.5 text-base font-bold leading-snug text-[#0F172A] line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200">
          {product.productName}
        </h3>

        {/* Origin & category */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#667085]">
          {product.originRegion && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-emerald-500" />
              {product.originRegion}
            </span>
          )}
          {product.categoryName && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600">
              <Tag className="h-3 w-3" />
              {product.categoryName}
            </span>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="mt-2 text-sm leading-relaxed text-[#667085] line-clamp-2 flex-1">
            {product.description}
          </p>
        )}

        {/* Price */}
        <div className="mt-3 rounded-xl bg-[#F8FAFC] px-3 py-2">
          <p className="text-xs text-[#98A2B3]">Giá tham khảo</p>
          <p className="mt-0.5 text-base font-bold text-emerald-600">
            {product.minPrice && product.maxPrice && product.minPrice !== product.maxPrice
              ? `${formatPrice(product.minPrice)} – ${formatPrice(product.maxPrice)}`
              : formatPrice(product.minPrice ?? product.maxPrice)}
            {product.unit && <span className="text-xs font-normal text-[#98A2B3]"> / {product.unit}</span>}
          </p>
          {product.totalAvailableQuantity && (
            <p className="mt-0.5 text-xs text-[#667085]">
              Sẵn có: {formatQuantity(product.totalAvailableQuantity, product.unit)}
            </p>
          )}
        </div>

        {/* Supplier */}
        {product.supplierName && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#667085]">
            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
            <span className="truncate">{product.supplierName}</span>
          </div>
        )}

        {/* Certifications */}
        {product.certifications && product.certifications.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {product.certifications.slice(0, 3).map((cert) => (
              <span
                key={cert.id}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
              >
                <Award className="h-2.5 w-2.5" />
                {cert.name}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {product.supplierCompanyId ? (
            <Link
              to={`/suppliers/${product.supplierCompanyId}`}
              className="flex items-center justify-center rounded-xl border border-emerald-300 py-2.5 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-50"
            >
              Xem NCC
            </Link>
          ) : (
            <button className="flex items-center justify-center rounded-xl border border-[#E4EAF0] py-2.5 text-sm font-semibold text-[#667085]">
              Xem NCC
            </button>
          )}
          <button className="flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-[0_4px_16px_rgba(16,185,129,0.4)] hover:brightness-110 active:scale-95">
            Gửi RFQ
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ProductsPage() {
  usePageTitle('Sản phẩm nông hải sản')

  const [products, setProducts] = useState<ProductItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [productsRes, categoriesRes] = await Promise.allSettled([
        apiClient.get<ProductItem[]>('/api/buyer/sourcing/products'),
        apiClient.get<CategoryOption[]>('/api/public/metadata/categories'),
      ])

      if (productsRes.status === 'fulfilled' && productsRes.value.data.length > 0) {
        setProducts(productsRes.value.data)
      } else {
        setProducts(FALLBACK_PRODUCTS)
        if (productsRes.status === 'rejected') {
          setError('Không thể tải dữ liệu sản phẩm. Đang hiển thị dữ liệu mẫu.')
        }
      }

      if (categoriesRes.status === 'fulfilled') {
        setCategories(categoriesRes.value.data)
      }
    } catch {
      setProducts(FALLBACK_PRODUCTS)
      setError('Không thể tải dữ liệu sản phẩm. Đang hiển thị dữ liệu mẫu.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ── Filter ─────────────────────────────────────────────────────────────────

  const allCategories = useMemo(() => {
    if (categories.length > 0) return categories.map((c) => c.name)
    return Array.from(new Set(products.map((p) => p.categoryName).filter(Boolean) as string[])).sort()
  }, [categories, products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.productName.toLowerCase().includes(search.toLowerCase()) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(search.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.originRegion && p.originRegion.toLowerCase().includes(search.toLowerCase()))

      const matchCategory = !selectedCategory || p.categoryName === selectedCategory
      const matchStock = !inStockOnly || p.hasAvailableStock !== false

      return matchSearch && matchCategory && matchStock
    })
  }, [products, search, selectedCategory, inStockOnly])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedCategory, inStockOnly])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const hasActiveFilters = search || selectedCategory || inStockOnly

  const clearFilters = () => {
    setSearch('')
    setSelectedCategory('')
    setInStockOnly(false)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const inStockCount = products.filter((p) => p.hasAvailableStock !== false).length
  const categoryCount = new Set(products.map((p) => p.categoryName).filter(Boolean)).size

  return (
    <PublicPageLayout
      title="Sản phẩm nông hải sản"
      subtitle="Khám phá hàng ngàn sản phẩm chất lượng từ các nhà cung cấp uy tín trên toàn quốc"
    >
      {/* ── Stats banner ─────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Sản phẩm', value: loading ? '—' : products.length.toString(), icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Còn hàng', value: loading ? '—' : inStockCount.toString(), icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Danh mục', value: loading ? '—' : categoryCount.toString(), icon: Layers, color: 'text-violet-600', bg: 'bg-violet-50' },
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

      {/* ── Category chips ─────────────────────────────────────────────────── */}
      {allCategories.length > 0 && !loading && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              !selectedCategory
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'border border-[#E4EAF0] bg-white text-[#667085] hover:border-emerald-300'
            }`}
          >
            Tất cả
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'border border-[#E4EAF0] bg-white text-[#667085] hover:border-emerald-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Search & filter bar ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#E4EAF0] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          {/* Search */}
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm sản phẩm, nhà cung cấp, vùng nguyên liệu..."
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

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all ${
              showFilters || inStockOnly
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-[#E4EAF0] bg-[#F8FAFC] text-[#344054] hover:border-emerald-300'
            }`}
          >
            <Filter className="h-4 w-4" />
            Bộ lọc
            {inStockOnly && (
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
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#F0F4F8] pt-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              <Package className="h-4 w-4 text-emerald-600" />
              <span className="text-[#344054]">Chỉ sản phẩm còn hàng</span>
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

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <RefreshCw className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Result count ──────────────────────────────────────────────────── */}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-[#667085]">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Đang tải sản phẩm...
            </span>
          ) : (
            <>
              Hiển thị{' '}
              <span className="font-semibold text-[#344054]">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
              </span>{' '}
              trong{' '}
              <span className="font-semibold text-[#344054]">{filtered.length}</span> sản phẩm
            </>
          )}
        </p>
        {totalPages > 1 && !loading && (
          <p className="text-sm text-[#667085]">Trang {currentPage} / {totalPages}</p>
        )}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
          : paginated.map((product, i) => (
              <ProductCard key={product.productId} product={product} index={i} />
            ))}
      </section>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && paginated.length === 0 && (
        <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#F0FDF4]">
            <Search className="h-10 w-10 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">Không tìm thấy sản phẩm</h3>
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

      {/* ── Pagination ────────────────────────────────────────────────────── */}
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
            if (totalPages <= 5) page = i + 1
            else if (currentPage <= 3) page = i + 1
            else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
            else page = currentPage - 2 + i
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

      {/* ── CTA bottom ────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Muốn tìm nhà cung cấp phù hợp?</h2>
              <p className="mt-1 text-sm text-emerald-100">
                Xem danh sách nhà cung cấp đã xác minh và gửi RFQ ngay hôm nay.
              </p>
            </div>
            <Link
              to="/suppliers"
              className="flex-shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-md transition-all hover:shadow-lg hover:scale-105 active:scale-95"
            >
              Xem nhà cung cấp
            </Link>
          </div>
        </div>
      )}
    </PublicPageLayout>
  )
}
