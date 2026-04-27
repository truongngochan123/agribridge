import { Award, Bookmark, Eye, Flame, PackageSearch, Search, ShoppingBag, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useToast } from '../../hooks/useToast'
import {
  createBuyerSourcingRfq,
  fetchBuyerSourcingProduct,
  fetchBuyerSourcingProducts,
  type BuyerSourcingProduct,
} from '../../services/buyerSourcingService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

type PriceFilter = 'all' | 'under-50000' | '50000-100000' | '100000-200000' | 'over-200000'

type RfqFormState = {
  quantity: string
  unit: string
  deliveryDate: string
  province: string
  description: string
  expiredDate: string
}

const priceFilters: Array<{ value: PriceFilter; label: string }> = [
  { value: 'all', label: 'Tất cả mức giá' },
  { value: 'under-50000', label: 'Dưới 50.000đ' },
  { value: '50000-100000', label: '50.000đ - 100.000đ' },
  { value: '100000-200000', label: '100.000đ - 200.000đ' },
  { value: 'over-200000', label: 'Trên 200.000đ' },
]

const placeholderImage = '/images/seafood-market.jpg'

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatQuantity(value?: number | null, unit?: string | null) {
  if (value == null || value <= 0) return '--'
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
}

function formatPrice(product: BuyerSourcingProduct) {
  const unit = product.unit ? `/${product.unit}` : ''
  const min = product.minPrice
  const max = product.maxPrice
  if (min == null && max == null) return '--'
  if (min != null && max != null && min !== max) {
    return `${formatNumber(min)}đ - ${formatNumber(max)}đ${unit}`
  }
  return `${formatNumber(min ?? max)}đ${unit}`
}

function productMatchesPrice(product: BuyerSourcingProduct, filter: PriceFilter) {
  if (filter === 'all') return true
  const minPrice = product.minPrice ?? product.maxPrice ?? 0
  if (filter === 'under-50000') return minPrice < 50000
  if (filter === '50000-100000') return minPrice >= 50000 && minPrice <= 100000
  if (filter === '100000-200000') return minPrice >= 100000 && minPrice <= 200000
  return minPrice > 200000
}

function createInitialRfqForm(product: BuyerSourcingProduct): RfqFormState {
  return {
    quantity: '',
    unit: product.unit || '',
    deliveryDate: '',
    province: product.originRegion || '',
    description: '',
    expiredDate: '',
  }
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
  const [savedIds, setSavedIds] = useState<Set<number>>(() => new Set())
  const [detailProduct, setDetailProduct] = useState<BuyerSourcingProduct | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rfqProduct, setRfqProduct] = useState<BuyerSourcingProduct | null>(null)
  const [rfqForm, setRfqForm] = useState<RfqFormState | null>(null)
  const [submittingRfq, setSubmittingRfq] = useState(false)

  useEffect(() => {
    let ignore = false
    async function loadProducts() {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchBuyerSourcingProducts()
        if (!ignore) {
          setProducts(rows)
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

  const categoryOptions = useMemo(() => {
    const map = new Map<number, string>()
    products.forEach((product) => {
      if (product.categoryId && product.categoryName) map.set(product.categoryId, product.categoryName)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [products])

  const regionOptions = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.originRegion).filter(Boolean) as string[])).sort()
  }, [products])

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
    return products.filter((product) => {
      const searchable = [product.productName, product.supplierName, product.originRegion].join(' ').toLowerCase()
      const matchSearch = !keyword || searchable.includes(keyword)
      const matchCategory = categoryId === 'all' || String(product.categoryId) === categoryId
      const matchRegion = region === 'all' || product.originRegion === region
      const matchPrice = productMatchesPrice(product, priceFilter)
      const matchGrade = gradeFilter === 'all' || (product.gradeSummary || '').toLowerCase().includes(gradeFilter.toLowerCase())
      return matchSearch && matchCategory && matchRegion && matchPrice && matchGrade
    })
  }, [categoryId, gradeFilter, priceFilter, products, region, searchTerm])

  const availableProductCount = useMemo(() => {
    return products.filter((product) => product.hasAvailableStock).length
  }, [products])

  const openRfqModal = (product: BuyerSourcingProduct) => {
    setRfqProduct(product)
    setRfqForm(createInitialRfqForm(product))
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

          <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 backdrop-blur-sm md:grid-cols-6">
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
                      src={product.imageUrl || placeholderImage}
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
                      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-emerald-700 shadow backdrop-blur-sm">
                        <Award className="h-3 w-3" />
                        {product.certificationCount} chứng chỉ
                      </span>
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

      {rfqProduct && rfqForm ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/35 p-4">
          <div className="mx-auto mt-10 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-emerald-950">Tạo RFQ theo sản phẩm</h3>
                <p className="text-sm text-emerald-700/70">{rfqProduct.productName} · {rfqProduct.categoryName || '--'}</p>
              </div>
              <button onClick={() => setRfqProduct(null)} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Số lượng *</label>
                <input value={rfqForm.quantity} onChange={(event) => setRfqForm({ ...rfqForm, quantity: event.target.value })} type="number" min="0" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="Nhập số lượng cần mua" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Đơn vị *</label>
                <input value={rfqForm.unit} onChange={(event) => setRfqForm({ ...rfqForm, unit: event.target.value })} className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="kg, thùng, tấn..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Ngày giao dự kiến *</label>
                <input value={rfqForm.deliveryDate} onChange={(event) => setRfqForm({ ...rfqForm, deliveryDate: event.target.value })} type="date" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Hạn báo giá *</label>
                <input value={rfqForm.expiredDate} onChange={(event) => setRfqForm({ ...rfqForm, expiredDate: event.target.value })} type="date" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Tỉnh/khu vực giao hàng *</label>
                <input value={rfqForm.province} onChange={(event) => setRfqForm({ ...rfqForm, province: event.target.value })} className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="Ví dụ: TP. Hồ Chí Minh" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-emerald-950">Mô tả nhu cầu</label>
                <textarea value={rfqForm.description} onChange={(event) => setRfqForm({ ...rfqForm, description: event.target.value })} className="h-24 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm" placeholder="Mô tả yêu cầu chất lượng, đóng gói, giao nhận..." />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
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
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/70">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-emerald-950">{value}</p>
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
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/35 p-4">
      <div className="mx-auto mt-10 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-emerald-950">Chi tiết sản phẩm</h3>
            <p className="text-sm text-emerald-700/70">{loading ? 'Đang tải dữ liệu mới nhất...' : product.supplierName || 'Nhà cung cấp'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
          <img src={product.imageUrl || placeholderImage} alt={product.productName} className="h-56 w-full rounded-xl object-cover" />
          <div>
            <h4 className="text-2xl font-extrabold text-emerald-950">{product.productName}</h4>
            <p className="mt-1 text-sm text-emerald-700/80">{product.description || 'Chưa có mô tả sản phẩm.'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <SummaryCell label="Danh mục" value={product.categoryName || '--'} />
              <SummaryCell label="Khu vực" value={product.originRegion || '--'} />
              <SummaryCell label="Đơn vị" value={product.unit || '--'} />
              <SummaryCell label="Số lô còn hàng" value={`${product.availableBatchCount} lô`} />
              <SummaryCell label="Tổng tồn kho" value={formatQuantity(product.totalAvailableQuantity, product.unit)} />
              <SummaryCell label="Chứng chỉ" value={product.certificationCount > 0 ? `${product.certificationCount} chứng chỉ` : '--'} />
            </div>
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Khoảng giá</p>
              <p className="mt-1 text-xl font-extrabold text-emerald-700">{formatPrice(product)}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Link to={`/buyer/sourcing/products/${product.productId}/batches`} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">Xem lô hàng</Link>
          <button onClick={onOpenRfq} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">RFQ</button>
        </div>
      </div>
    </div>
  )
}
