import { Bookmark, Eye, PackageSearch, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
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
      <div className="space-y-4">
        <BuyerPanel>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/40 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Tìm sản phẩm, nhà cung cấp, khu vực..."
              />
            </label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-11 rounded-lg border border-emerald-200 bg-white px-3 text-sm"
            >
              <option value="all">Tất cả danh mục</option>
              {categoryOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={region} onChange={(event) => setRegion(event.target.value)} className="h-9 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700">
              <option value="all">Tất cả khu vực</option>
              {regionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value as PriceFilter)} className="h-9 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700">
              {priceFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="h-9 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700">
              <option value="all">Tất cả phân loại</option>
              {gradeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </BuyerPanel>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <BuyerPanel title="Bộ lọc">
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-2 font-semibold text-emerald-900">Danh mục</p>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={categoryId === 'all'} onChange={() => setCategoryId('all')} className="accent-emerald-600" />
                    Tất cả
                  </label>
                  {categoryOptions.map((item) => (
                    <label key={item.id} className="flex items-center gap-2">
                      <input type="radio" checked={categoryId === String(item.id)} onChange={() => setCategoryId(String(item.id))} className="accent-emerald-600" />
                      {item.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-semibold text-emerald-900">Khu vực</p>
                <select value={region} onChange={(event) => setRegion(event.target.value)} className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm">
                  <option value="all">Tất cả khu vực</option>
                  {regionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <p className="mb-2 font-semibold text-emerald-900">Mức giá</p>
                <div className="space-y-1.5">
                  {priceFilters.map((item) => (
                    <label key={item.value} className="flex items-center gap-2">
                      <input type="radio" name="price" checked={priceFilter === item.value} onChange={() => setPriceFilter(item.value)} className="accent-emerald-600" />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-semibold text-emerald-900">Phân loại</p>
                <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm">
                  <option value="all">Tất cả</option>
                  {gradeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
          </BuyerPanel>

          <div>
            <div className="mb-3 flex items-center justify-between text-sm text-emerald-800">
              <span>{filteredProducts.length} sản phẩm phù hợp</span>
              {loading ? <span>Đang tải...</span> : null}
            </div>
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
            ) : null}
            {!loading && !error && filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-white p-8 text-center text-sm text-emerald-700">
                <PackageSearch className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                Chưa có sản phẩm phù hợp với bộ lọc hiện tại.
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <article key={product.productId} className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-[0_4px_12px_rgba(16,120,74,0.08)]">
                  <div className="relative">
                    <img src={product.imageUrl || placeholderImage} alt={product.productName} className="h-40 w-full rounded-xl object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-800">
                      {product.availableBatchCount} lô
                    </span>
                    <span className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-bold ${product.hasAvailableStock ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'}`}>
                      {product.hasAvailableStock ? 'Còn hàng' : 'Hết hàng'}
                    </span>
                    {product.certificationCount > 0 ? (
                      <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-800">
                        {product.certificationCount} chứng chỉ
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 min-h-[112px]">
                    <h3 className="line-clamp-2 text-lg font-bold text-emerald-950">{product.productName}</h3>
                    <p className="mt-1 text-xs font-semibold text-emerald-700/80">{product.supplierName || 'Nhà cung cấp'}</p>
                    <p className="text-xs text-emerald-700/80">{product.originRegion || '--'} · {product.categoryName || '--'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <SummaryCell label="GRADE" value={product.gradeSummary || '--'} />
                    <SummaryCell label="SIZE" value={product.sizeSummary || '--'} />
                    <SummaryCell label="TỒN KHO" value={formatQuantity(product.totalAvailableQuantity, product.unit)} />
                    <SummaryCell label="MOQ" value={formatQuantity(product.minMoq, product.unit)} />
                  </div>
                  <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Giá bán</p>
                    <p className="mt-1 text-xl font-extrabold text-emerald-700">{formatPrice(product)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
                    <button
                      onClick={() => handleOrderNow(product)}
                      disabled={!product.hasAvailableStock}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Đặt hàng ngay
                    </button>
                    <button onClick={() => openRfqModal(product)} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700">RFQ</button>
                    <button title="Xem chi tiết sản phẩm" onClick={() => openDetail(product)} className="rounded-lg border border-emerald-200 px-2.5 py-2 text-emerald-700 hover:bg-emerald-50">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <Link to={`/buyer/sourcing/products/${product.productId}/batches`} className="rounded-lg border border-emerald-200 py-2 text-center text-xs font-semibold text-emerald-700">
                      Xem lô hàng
                    </Link>
                    <button
                      title="Lưu sản phẩm"
                      onClick={() => toggleSaved(product.productId)}
                      className={`rounded-lg border px-2.5 py-2 ${savedIds.has(product.productId) ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-emerald-200 text-emerald-700'}`}
                    >
                      <Bookmark className={`h-4 w-4 ${savedIds.has(product.productId) ? 'fill-current' : ''}`} />
                    </button>
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
