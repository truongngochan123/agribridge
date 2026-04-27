import { Award, Bookmark, ExternalLink, Eye, Flame, Layers, MapPin, PackageSearch, Search, ShoppingBag, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useToast } from '../../hooks/useToast'
import {
  createBuyerSourcingRfq,
  fetchBuyerSourcingProduct,
  fetchBuyerSourcingProducts,
  type BuyerBatchPreview,
  type BuyerCertificationPreview,
  type BuyerSourcingProduct,
} from '../../services/buyerSourcingService'
import { fetchCurrentUserProfile } from '../../services/currentUserService'
import { fetchCategories, fetchMetadataProvinces } from '../../services/supplierService'
import { resolveUploadedFileUrl } from '../../services/uploadService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

type PriceFilter = 'all' | 'under-50000' | '50000-100000' | '100000-200000' | 'over-200000'
type BuyerSortBy = 'newest' | 'price-asc' | 'price-desc' | 'stock-desc'

type CategoryOption = {
  id: number
  name: string
}

type RfqFormState = {
  quantity: string
  unit: string
  deliveryDate: string
  province: string
  description: string
  expiredDate: string
}

type BuyerSourcingProductDetail = BuyerSourcingProduct & {
  certifications?: BuyerCertificationPreview[]
  certificationList?: BuyerCertificationPreview[]
  productCertifications?: BuyerCertificationPreview[]
  certificates?: BuyerCertificationPreview[]
  certificationDetails?: BuyerCertificationPreview[]
  imageUrls?: string[]
  batches?: BuyerBatchPreview[]
  batchList?: BuyerBatchPreview[]
  availableBatches?: BuyerBatchPreview[]
}

const priceFilters: Array<{ value: PriceFilter; label: string }> = [
  { value: 'all', label: 'Tất cả mức giá' },
  { value: 'under-50000', label: 'Dưới 50.000đ' },
  { value: '50000-100000', label: '50.000đ - 100.000đ' },
  { value: '100000-200000', label: '100.000đ - 200.000đ' },
  { value: 'over-200000', label: 'Trên 200.000đ' },
]

const sortOptions: Array<{ value: BuyerSortBy; label: string }> = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price-asc', label: 'Giá tăng dần' },
  { value: 'price-desc', label: 'Giá giảm dần' },
  { value: 'stock-desc', label: 'Tồn kho nhiều' },
]
const descriptionSuggestions = ['Loại A', 'Đóng thùng lạnh', 'Cần chứng chỉ', 'Giao buổi sáng', 'Cần mẫu thử']

const placeholderImage = '/images/seafood-market.jpg'

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatQuantity(value?: number | null, unit?: string | null) {
  if (value == null || value <= 0) return '--'
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
}

function compactCurrency(value: number): string {
  if (value >= 1000) {
    const compact = value / 1000
    if (Number.isInteger(compact)) {
      return `${compact}k`
    }
    return `${compact.toFixed(1).replace(/\.0$/, '')}k`
  }
  return value.toLocaleString('vi-VN')
}

function formatPrice(product: BuyerSourcingProduct) {
  const unit = product.unit || ''
  const min = product.minPrice
  const max = product.maxPrice
  if (min == null && max == null) return '--'
  if (min != null && max != null && min !== max) {
    return `${compactCurrency(min)} – ${compactCurrency(max)} /${unit}`
  }
  return `${compactCurrency(min ?? max ?? 0)} /${unit}`
}

function productMatchesPrice(product: BuyerSourcingProduct, filter: PriceFilter) {
  if (filter === 'all') return true
  const productMin = product.minPrice ?? product.maxPrice
  const productMax = product.maxPrice ?? product.minPrice
  if (productMin == null || productMax == null) return false

  const ranges: Record<Exclude<PriceFilter, 'all'>, { min: number; max: number }> = {
    'under-50000': { min: 0, max: 49999 },
    '50000-100000': { min: 50000, max: 100000 },
    '100000-200000': { min: 100000, max: 200000 },
    'over-200000': { min: 200001, max: Number.POSITIVE_INFINITY },
  }
  const range = ranges[filter]
  return productMin <= range.max && productMax >= range.min
}

function normalizeDefaultProvince(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === '--' || trimmed.toUpperCase() === 'N/A') return ''
  return trimmed
}

function getBuyerDefaultDeliveryProvince() {
  return (
    normalizeDefaultProvince(sessionStorage.getItem('agribridge.auth.branchProvince')) ||
    normalizeDefaultProvince(sessionStorage.getItem('agribridge.auth.companyProvince')) ||
    normalizeDefaultProvince(sessionStorage.getItem('agribridge.auth.province')) ||
    ''
  )
}

function createInitialRfqForm(product: BuyerSourcingProduct, defaultDeliveryProvince = getBuyerDefaultDeliveryProvince()): RfqFormState {
  return {
    quantity: '',
    unit: product.unit || '',
    deliveryDate: '',
    province: defaultDeliveryProvince,
    description: '',
    expiredDate: '',
  }
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dateAfterDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDateInput(date)
}

function getProductImages(product: BuyerSourcingProductDetail) {
  const images = [product.imageUrl, ...(product.imageUrls ?? [])]
    .map((url) => {
      const trimmed = url?.trim()
      return trimmed ? resolveUploadedFileUrl(trimmed) || trimmed : undefined
    })
    .filter((url): url is string => Boolean(url))
  return Array.from(new Set(images))
}

function getProductCertifications(product: BuyerSourcingProductDetail): BuyerCertificationPreview[] {
  return (
    product.certifications ??
    product.certificationList ??
    product.productCertifications ??
    product.certificates ??
    product.certificationDetails ??
    []
  )
}

function getProductBatches(product: BuyerSourcingProductDetail): BuyerBatchPreview[] {
  return product.batches ?? product.batchList ?? product.availableBatches ?? []
}

function batchStatusClass(status?: string | null) {
  const normalized = (status || '').toUpperCase()
  if (normalized === 'OUT_OF_STOCK' || normalized === 'SOLD_OUT' || normalized === 'UNAVAILABLE') {
    return 'bg-rose-100 text-rose-700'
  }
  if (normalized === 'AVAILABLE' || normalized === 'ACTIVE') {
    return 'bg-emerald-100 text-emerald-700'
  }
  return 'bg-slate-100 text-slate-600'
}

function openDocumentUrl(url?: string | null) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function BuyerSourcingPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [products, setProducts] = useState<BuyerSourcingProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [region, setRegion] = useState('all')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<BuyerSortBy>('newest')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [provinces, setProvinces] = useState<string[]>([])
  const [buyerDefaultProvince, setBuyerDefaultProvince] = useState(getBuyerDefaultDeliveryProvince)
  const [savedIds, setSavedIds] = useState<Set<number>>(() => new Set())
  const [detailProduct, setDetailProduct] = useState<BuyerSourcingProduct | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rfqProduct, setRfqProduct] = useState<BuyerSourcingProduct | null>(null)
  const [rfqForm, setRfqForm] = useState<RfqFormState | null>(null)
  const [submittingRfq, setSubmittingRfq] = useState(false)
  const [certPreviewProduct, setCertPreviewProduct] = useState<{
    name: string
    certifications: BuyerCertificationPreview[]
  } | null>(null)

  useEffect(() => {
    let ignore = false
    async function loadProducts() {
      setLoading(true)
      setError(null)
      try {
        const [rows, categoryRows, provinceRows] = await Promise.all([
          fetchBuyerSourcingProducts(),
          fetchCategories(),
          fetchMetadataProvinces(),
        ])
        if (!ignore) {
          setProducts(rows)
          setCategories(categoryRows)
          setProvinces(provinceRows)
          setSavedIds(new Set(rows.filter((item) => item.isSaved).map((item) => item.productId)))
        }
      } catch (requestError) {
        if (!ignore) setError(readApiErrorMessage(requestError) || 'Không thể tải danh sách sản phẩm.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadProducts()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    async function loadBuyerDefaultProvince() {
      const branchProvince = normalizeDefaultProvince(sessionStorage.getItem('agribridge.auth.branchProvince'))
      const sessionProvince = getBuyerDefaultDeliveryProvince()
      if (sessionProvince) {
        setBuyerDefaultProvince(sessionProvince)
      }

      try {
        const profile = await fetchCurrentUserProfile()
        const profileProvince = normalizeDefaultProvince(profile?.province) || normalizeDefaultProvince(profile?.address)
        if (!ignore && profileProvince && !branchProvince) {
          sessionStorage.setItem('agribridge.auth.companyProvince', profileProvince)
          setBuyerDefaultProvince(profileProvince)
        }
      } catch {
        // Keep the RFQ form usable even if profile lookup is unavailable.
      }
    }

    void loadBuyerDefaultProvince()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!buyerDefaultProvince) return
    setRfqForm((current) => {
      if (!current || current.province.trim()) return current
      return { ...current, province: buyerDefaultProvince }
    })
  }, [buyerDefaultProvince])

  const categoryOptions = useMemo(() => {
    return categories
  }, [categories])

  const regionOptions = useMemo(() => {
    return provinces
  }, [provinces])

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>()
    products.forEach((product) => {
      product.gradeSummary
        ?.split(/[,\-]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => grades.add(item))
    })
    return Array.from(grades).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    const next = products.filter((product) => {
      const searchable = [product.productName, product.supplierName, product.originRegion].join(' ').toLowerCase()
      const matchSearch = !keyword || searchable.includes(keyword)
      const matchCategory = categoryId === 'all' || String(product.categoryId) === categoryId
      const matchRegion = region === 'all' || product.originRegion === region
      const matchPrice = productMatchesPrice(product, priceFilter)
      const matchGrade = gradeFilter === 'all' || (product.gradeSummary || '').toLowerCase().includes(gradeFilter.toLowerCase())
      return matchSearch && matchCategory && matchRegion && matchPrice && matchGrade
    })
    if (sortBy === 'newest') {
      next.sort((a, b) => b.productId - a.productId)
    }
    if (sortBy === 'price-asc') {
      next.sort((a, b) => (a.minPrice ?? a.maxPrice ?? Number.MAX_SAFE_INTEGER) - (b.minPrice ?? b.maxPrice ?? Number.MAX_SAFE_INTEGER))
    }
    if (sortBy === 'price-desc') {
      next.sort((a, b) => (b.maxPrice ?? b.minPrice ?? 0) - (a.maxPrice ?? a.minPrice ?? 0))
    }
    if (sortBy === 'stock-desc') {
      next.sort((a, b) => (b.totalAvailableQuantity ?? 0) - (a.totalAvailableQuantity ?? 0))
    }
    return next
  }, [categoryId, gradeFilter, priceFilter, products, region, searchTerm, sortBy])

  const availableProductCount = useMemo(() => {
    return products.filter((product) => product.hasAvailableStock).length
  }, [products])

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    categoryId !== 'all' ||
    region !== 'all' ||
    priceFilter !== 'all' ||
    gradeFilter !== 'all'
  const isRfqProvinceAutoFilled =
    Boolean(rfqForm?.province.trim()) &&
    Boolean(buyerDefaultProvince) &&
    rfqForm?.province.trim() === buyerDefaultProvince.trim()

  const resetFilters = () => {
    setSearchTerm('')
    setCategoryId('all')
    setRegion('all')
    setPriceFilter('all')
    setGradeFilter('all')
  }

  const openRfqModal = (product: BuyerSourcingProduct) => {
    setRfqProduct(product)
    setRfqForm(createInitialRfqForm(product, buyerDefaultProvince || getBuyerDefaultDeliveryProvince()))
  }

  const openDetail = async (product: BuyerSourcingProduct) => {
    setDetailProduct(product)
    setDetailLoading(true)
    try {
      setDetailProduct(await fetchBuyerSourcingProduct(product.productId))
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải chi tiết sản phẩm.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const openCertificationPreview = async (product: BuyerSourcingProduct) => {
    try {
      const detail = (await fetchBuyerSourcingProduct(product.productId)) as BuyerSourcingProductDetail
      const certifications = getProductCertifications(detail)
      if (certifications.length === 0 && product.certificationCount > 0) {
        showToast('API chi tiết sản phẩm chưa trả danh sách chứng chỉ, chỉ trả số lượng chứng chỉ.', 'info')
      }
      setCertPreviewProduct({
        name: detail.productName,
        certifications,
      })
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải chứng chỉ sản phẩm.', 'error')
    }
  }

  const handleOrderNow = (product: BuyerSourcingProduct) => {
    if (!product.hasAvailableStock) {
      showToast('Sản phẩm hiện chưa có lô khả dụng.', 'info')
      return
    }
    navigate(`/buyer/sourcing/products/${product.productId}/batches`)
  }

  const toggleSaved = (productId: number) => {
    setSavedIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const submitRfq = async () => {
    if (!rfqProduct || !rfqForm) return
    const quantity = Number(rfqForm.quantity)
    const buyerCompanyId = Number(sessionStorage.getItem('agribridge.auth.companyId'))
    if (!buyerCompanyId) {
      showToast('Thiếu thông tin công ty buyer, vui lòng đăng nhập lại.', 'error')
      return
    }
    if (!quantity || quantity <= 0) {
      showToast('Số lượng RFQ phải lớn hơn 0.', 'error')
      return
    }
    if (!rfqForm.unit.trim()) {
      showToast('Đơn vị là bắt buộc.', 'error')
      return
    }
    if (!rfqForm.deliveryDate || !rfqForm.expiredDate) {
      showToast('Vui lòng nhập ngày giao dự kiến và hạn báo giá.', 'error')
      return
    }
    if (!rfqForm.province.trim()) {
      showToast('Tỉnh/khu vực giao hàng là bắt buộc.', 'error')
      return
    }
    const today = formatDateInput(new Date())
    if (rfqForm.expiredDate < today) {
      showToast('Hạn báo giá không được trước hôm nay.', 'error')
      return
    }
    if (rfqForm.deliveryDate < today) {
      showToast('Ngày giao dự kiến không được trước hôm nay.', 'error')
      return
    }
    if (rfqForm.deliveryDate < rfqForm.expiredDate) {
      showToast('Ngày giao dự kiến nên sau hoặc bằng hạn báo giá.', 'info')
      return
    }

    setSubmittingRfq(true)
    try {
      await createBuyerSourcingRfq({
        buyerCompanyId,
        productId: rfqProduct.productId,
        categoryId: rfqProduct.categoryId,
        quantity,
        unit: rfqForm.unit.trim(),
        deliveryDate: rfqForm.deliveryDate,
        province: rfqForm.province.trim(),
        description: rfqForm.description.trim(),
        expiredAt: `${rfqForm.expiredDate}T23:59:59`,
      })
      showToast('Đã tạo RFQ cho sản phẩm.', 'success')
      setRfqProduct(null)
      setRfqForm(null)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tạo RFQ.', 'error')
    } finally {
      setSubmittingRfq(false)
    }
  }

  return (
    <BuyerShell activeKey="sourcing" title="Tìm nguồn hàng" subtitle="Tìm kiếm sản phẩm và nguồn cung theo nhu cầu mua hàng">
      <div className="flex h-full flex-col gap-3">
        <div className="shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
              <PackageSearch className="h-3.5 w-3.5" />
              <span>{filteredProducts.length}</span>
              <span className="text-emerald-500">sản phẩm phù hợp</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
              <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
              <span>{products.length}</span>
              <span className="text-slate-400">tổng sản phẩm</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
              <Flame className="h-3.5 w-3.5" />
              <span>{availableProductCount}</span>
              <span className="text-emerald-500">còn hàng</span>
            </div>
          </div>

          <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 backdrop-blur-sm md:grid-cols-7">
            <label className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                placeholder="Tìm sản phẩm, nhà cung cấp, khu vực..."
              />
            </label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
            >
              <option value="all">Tất cả danh mục</option>
              {categoryOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select value={region} onChange={(event) => setRegion(event.target.value)} className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white">
              <option value="all">Tất cả khu vực</option>
              {regionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value as PriceFilter)} className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white">
              {priceFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white">
              <option value="all">Tất cả phân loại</option>
              {gradeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as BuyerSortBy)} className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white">
              {sortOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
              >
                Xóa bộ lọc
              </button>
            ) : null}
          </div>
        </div>

        <div>

          <div>
            {loading ? (
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                <span>Đang tải...</span>
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
            ) : null}
            {!loading && !error && filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-white p-8 text-center text-sm text-emerald-700">
                <PackageSearch className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                Chưa có sản phẩm phù hợp với bộ lọc hiện tại.
              </div>
            ) : null}
            <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredProducts.map((product) => (
                <article key={product.productId} className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)]">
                  <div className="relative h-28 shrink-0 overflow-hidden bg-slate-100">
                    <img
                      src={resolveUploadedFileUrl(product.imageUrl || '') || placeholderImage}
                      alt={product.productName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                      {product.availableBatchCount} lô
                    </span>
                    <span className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold backdrop-blur-sm ${product.hasAvailableStock ? 'border border-emerald-300/50 bg-emerald-500/15 text-emerald-700' : 'border border-rose-300/50 bg-rose-500/15 text-rose-700'}`}>
                      {product.hasAvailableStock ? 'Còn hàng' : 'Hết hàng'}
                    </span>
                    {product.certificationCount > 0 ? (
                      <button
                        className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-emerald-700 shadow backdrop-blur-sm transition hover:bg-white"
                        onClick={(event) => {
                          event.stopPropagation()
                          void openCertificationPreview(product)
                        }}
                      >
                        <Award className="h-3 w-3" />
                        {product.certificationCount} chứng chỉ
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div>
                      <h3 className="truncate text-[15px] font-bold text-slate-900">{product.productName}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">{product.supplierName || 'Nhà cung cấp'}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{product.originRegion || '--'} · {product.categoryName || '--'}</p>
                    </div>

                    <div className="flex flex-1 flex-col gap-2">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <BuyerInfoChip label="Grade" value={product.gradeSummary || '--'} />
                        <BuyerInfoChip label="Size" value={product.sizeSummary || '--'} />
                        <BuyerInfoChip label="Tồn kho" value={formatQuantity(product.totalAvailableQuantity, product.unit)} highlight />
                        <BuyerInfoChip label="MOQ" value={formatQuantity(product.minMoq, product.unit)} />
                      </div>
                      <div className="mt-auto rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Giá bán</p>
                        <p className="text-lg font-black text-emerald-700">{formatPrice(product)}</p>
                      </div>
                    </div>

                    <div className="mt-auto grid grid-cols-[1fr_auto_auto] gap-1.5 border-t border-slate-100 pt-2">
                      <button
                        onClick={() => handleOrderNow(product)}
                        disabled={!product.hasAvailableStock}
                        className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 px-2 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:opacity-80"
                      >
                        Đặt hàng ngay
                      </button>
                      <button onClick={() => openRfqModal(product)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95">RFQ</button>
                      <button title="Xem chi tiết sản phẩm" onClick={() => openDetail(product)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 active:scale-95">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-1.5">
                      <Link to={`/buyer/sourcing/products/${product.productId}/batches`} className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-center text-xs font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-95">
                        Xem lô hàng
                      </Link>
                      <button
                        title="Lưu sản phẩm"
                        onClick={() => toggleSaved(product.productId)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition active:scale-95 ${savedIds.has(product.productId) ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                      >
                        <Bookmark className={`h-3.5 w-3.5 ${savedIds.has(product.productId) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      {detailProduct ? (
        <ProductDetailModal
          product={detailProduct}
          loading={detailLoading}
          onClose={() => setDetailProduct(null)}
          onOpenRfq={() => {
            openRfqModal(detailProduct)
            setDetailProduct(null)
          }}
        />
      ) : null}

      {certPreviewProduct ? (
        <CertificationPreviewModal
          productName={certPreviewProduct.name}
          certifications={certPreviewProduct.certifications}
          onClose={() => setCertPreviewProduct(null)}
        />
      ) : null}

      {rfqProduct && rfqForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h3 className="text-xl font-extrabold text-emerald-950">Tạo RFQ theo sản phẩm</h3>
                <p className="text-sm text-emerald-700/70">{rfqProduct.productName} · {rfqProduct.categoryName || '--'}</p>
              </div>
              <button onClick={() => setRfqProduct(null)} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-50"><X className="h-5 w-5" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start gap-3">
                <img
                  src={resolveUploadedFileUrl(rfqProduct.imageUrl || '') || placeholderImage}
                  alt={rfqProduct.productName}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-base font-black text-slate-900">{rfqProduct.productName}</h4>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">{rfqProduct.supplierName || 'Nhà cung cấp'}</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                    <BuyerInfoChip label="Giá tham khảo" value={formatPrice(rfqProduct)} highlight />
                    <BuyerInfoChip label="MOQ" value={formatQuantity(rfqProduct.minMoq, rfqProduct.unit)} />
                    <BuyerInfoChip label="Tồn kho" value={formatQuantity(rfqProduct.totalAvailableQuantity, rfqProduct.unit)} />
                    <BuyerInfoChip label="Xuất xứ" value={rfqProduct.originRegion || '--'} />
                    <BuyerInfoChip label="Danh mục" value={rfqProduct.categoryName || '--'} />
                    <BuyerInfoChip label="Đơn vị" value={rfqProduct.unit || '--'} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Số lượng *</label>
                <input
                  value={rfqForm.quantity}
                  onChange={(event) => setRfqForm({ ...rfqForm, quantity: event.target.value })}
                  type="number"
                  min="0"
                  className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"
                  placeholder={`Tối thiểu ${formatQuantity(rfqProduct.minMoq, rfqProduct.unit)}`}
                />
                {rfqProduct.minMoq != null && Number(rfqForm.quantity) > 0 && Number(rfqForm.quantity) < rfqProduct.minMoq ? (
                  <p className="mt-1 text-xs font-semibold text-amber-600">
                    Số lượng đang thấp hơn MOQ {formatQuantity(rfqProduct.minMoq, rfqProduct.unit)}. Nhà cung cấp có thể không chấp nhận.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Đơn vị *</label>
                <input value={rfqForm.unit} onChange={(event) => setRfqForm({ ...rfqForm, unit: event.target.value })} className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="kg, thùng, tấn..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Ngày giao dự kiến *</label>
                <input value={rfqForm.deliveryDate} onChange={(event) => setRfqForm({ ...rfqForm, deliveryDate: event.target.value })} type="date" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[3, 7, 14].map((days) => (
                    <button key={days} type="button" onClick={() => setRfqForm({ ...rfqForm, deliveryDate: dateAfterDays(days) })} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">
                      {days} ngày
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Hạn báo giá *</label>
                <input value={rfqForm.expiredDate} onChange={(event) => setRfqForm({ ...rfqForm, expiredDate: event.target.value })} type="date" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setRfqForm({ ...rfqForm, expiredDate: dateAfterDays(0) })} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">Hôm nay</button>
                  {[3, 7].map((days) => (
                    <button key={days} type="button" onClick={() => setRfqForm({ ...rfqForm, expiredDate: dateAfterDays(days) })} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">
                      {days} ngày
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Tỉnh/khu vực giao hàng *</label>
                <input
                  value={rfqForm.province}
                  onChange={(event) => setRfqForm({ ...rfqForm, province: event.target.value })}
                  className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"
                  placeholder="Nhập tỉnh/khu vực nhận hàng, ví dụ: TP. Hồ Chí Minh"
                />
                {isRfqProvinceAutoFilled ? (
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Mặc định lấy từ địa chỉ/chi nhánh của bạn, có thể chỉnh nếu muốn giao nơi khác.
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Mô tả nhu cầu</label>
                <textarea
                  value={rfqForm.description}
                  onChange={(event) => setRfqForm({ ...rfqForm, description: event.target.value })}
                  className="h-24 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm"
                  placeholder="Ví dụ: cần loại A, đóng thùng xốp 20kg, giao trước 8h sáng, ưu tiên có chứng chỉ VietGAP/QC."
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {descriptionSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        const current = rfqForm.description.trim()
                        setRfqForm({ ...rfqForm, description: current ? `${current}; ${suggestion}` : suggestion })
                      }}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 text-sm text-emerald-900">
              Bạn sắp gửi RFQ: Cần mua <span className="font-bold">{rfqForm.quantity || '--'} {rfqForm.unit || rfqProduct.unit || ''}</span> {rfqProduct.productName}, giao tại <span className="font-bold">{rfqForm.province || '--'}</span>, hạn báo giá <span className="font-bold">{rfqForm.expiredDate || '--'}</span>, ngày giao <span className="font-bold">{rfqForm.deliveryDate || '--'}</span>.
            </div>

            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
              <button onClick={() => setRfqProduct(null)} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">Hủy</button>
              <button disabled={submittingRfq} onClick={submitRfq} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:bg-emerald-300">
                {submittingRfq ? 'Đang gửi...' : 'Gửi RFQ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </BuyerShell>
  )
}

function BuyerInfoChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`truncate text-xs font-bold ${highlight ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{value}</p>
    </div>
  )
}

function CertificationPreviewModal({
  productName,
  certifications,
  onClose,
}: {
  productName: string
  certifications: BuyerCertificationPreview[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-white">Chứng chỉ sản phẩm</h3>
            <p className="text-xs text-white/70">{productName}</p>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {certifications.length === 0 ? (
            <p className="text-center text-sm text-slate-500">Chưa có chứng chỉ</p>
          ) : (
            <div className="space-y-2.5">
              {certifications.map((cert, index) => (
                <div key={cert.id ?? `${cert.name}-${index}`} className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Award className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <p className="truncate font-bold text-emerald-900">{cert.name}</p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-emerald-700">
                        {cert.issuedBy ? <span><span className="font-semibold text-emerald-500">Cấp bởi:</span> {cert.issuedBy}</span> : null}
                        {cert.issuedDate ? <span><span className="font-semibold text-emerald-500">Ngày cấp:</span> {cert.issuedDate}</span> : null}
                        {cert.expiryDate ? <span><span className="font-semibold text-emerald-500">Hết hạn:</span> {cert.expiryDate}</span> : null}
                      </div>
                    </div>
                    {cert.documentUrl ? (
                      <button
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        onClick={() => openDocumentUrl(cert.documentUrl)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Xem
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProductDetailModal({
  product,
  loading,
  onClose,
  onOpenRfq,
}: {
  product: BuyerSourcingProduct
  loading: boolean
  onClose: () => void
  onOpenRfq: () => void
}) {
  const detail = product as BuyerSourcingProductDetail
  const images = getProductImages(detail)
  const certifications = getProductCertifications(detail)
  const batches = getProductBatches(detail)
  const batchRows: BuyerBatchPreview[] = batches.length > 0
    ? batches
    : [{
        batchCode: 'Tổng hợp',
        grade: product.gradeSummary || '--',
        quantity: product.totalAvailableQuantity,
        price: product.minPrice ?? product.maxPrice,
        status: product.hasAvailableStock ? 'AVAILABLE' : 'OUT_OF_STOCK',
      }]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 px-5 py-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.7) 0%, transparent 55%)' }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-white/30 shadow-lg">
                <img
                  src={images[0] || placeholderImage}
                  alt={product.productName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-white drop-shadow">{product.productName}</h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-white/70">
                  <MapPin className="h-3 w-3" />
                  {product.originRegion || 'N/A'}
                  <span className="opacity-50">·</span>
                  {product.categoryName || 'N/A'}
                  {loading ? <span className="text-white/60">Đang tải...</span> : null}
                </p>
              </div>
            </div>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
              <Layers className="h-3 w-3" />
              {product.availableBatchCount} lô hàng
            </span>
            {product.certificationCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                <Award className="h-3 w-3" />
                {product.certificationCount} chứng chỉ
              </span>
            ) : null}
            {images.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                <ShoppingBag className="h-3 w-3" />
                {images.length} ảnh
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {images.length > 0 ? (
            <div className="border-b border-slate-100 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Hình ảnh sản phẩm</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((url, index) => (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={`product-${index}`}
                    className="h-24 w-24 shrink-0 rounded-xl border border-slate-200 object-cover shadow-sm transition hover:scale-105"
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 sm:grid-cols-4">
            <SummaryCell label="Danh mục" value={product.categoryName || '--'} />
            <SummaryCell label="Đơn vị" value={product.unit || '--'} />
            <SummaryCell label="Xuất xứ" value={product.originRegion || '--'} />
            <SummaryCell label="Số lô hàng" value={`${product.availableBatchCount} lô`} />
          </div>

          <div className="border-b border-slate-100 p-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Mô tả sản phẩm</p>
            <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              {product.description || '--'}
            </p>
          </div>

          <div className="border-b border-slate-100 p-4">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Chứng chỉ & Chứng nhận</p>
            {certifications.length > 0 ? (
              <div className="space-y-2">
                {certifications.map((cert, index) => (
                  <div key={cert.id ?? `${cert.name}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Award className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <p className="truncate text-sm font-bold text-emerald-900">{cert.name}</p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-emerald-700">
                        {cert.issuedBy ? <span><span className="font-semibold text-emerald-500">Cấp bởi:</span> {cert.issuedBy}</span> : null}
                        {cert.issuedDate ? <span><span className="font-semibold text-emerald-500">Ngày cấp:</span> {cert.issuedDate}</span> : null}
                        {cert.expiryDate ? <span><span className="font-semibold text-emerald-500">Hết hạn:</span> {cert.expiryDate}</span> : null}
                      </div>
                    </div>
                    {cert.documentUrl ? (
                      <button
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                        onClick={() => openDocumentUrl(cert.documentUrl)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Xem
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-400">Chưa có chứng chỉ</p>
            )}
          </div>


          <div className="p-4">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tóm tắt lô hàng</p>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left font-bold text-slate-500">Mã lô</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-500">Grade</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-500">Tồn kho</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-500">Giá</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-500">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((batch, index) => (
                    <tr key={batch.id ?? `${batch.batchCode}-${index}`} className={`border-b border-slate-100 transition hover:bg-emerald-50/40 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="px-3 py-2 font-bold text-slate-800">{batch.batchCode || `#${batch.id ?? index + 1}`}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{batch.grade || '--'}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{formatQuantity(batch.quantity, product.unit)}</td>
                      <td className="px-3 py-2 font-bold text-emerald-700">{batches.length > 0 ? (batch.price ? `${compactCurrency(batch.price)} /${product.unit || ''}` : '--') : formatPrice(product)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${batchStatusClass(batch.status)}`}>
                          {batch.status || '--'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
            Đóng
          </button>
          <Link to={`/buyer/sourcing/products/${product.productId}/batches`} className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
            Xem lô hàng
          </Link>
          <button onClick={onOpenRfq} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-95">
            RFQ
          </button>
        </div>
      </div>
    </div>
  )
}
