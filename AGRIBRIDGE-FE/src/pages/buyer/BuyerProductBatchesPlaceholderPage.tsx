import {
  ArrowLeft,
  CalendarDays,
  Eye,
  Flame,
  Layers,
  Package2,
  PackageSearch,
  QrCode,
  Search,
  ShieldCheck,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BuyerQuickOrderModal } from '../../components/buyer/BuyerQuickOrderModal'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import type { BuyerQuickOrderPayload, BuyerQuickOrderTarget } from '../../components/buyer/buyerQuickOrderTypes'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { createQuickOrder } from '../../services/buyerOrderService'
import {
  createBuyerSourcingRfq,
  fetchBuyerSourcingProductBatches,
  fetchBuyerSourcingProduct,
  type BuyerBatchPreview,
  type BuyerSourcingProduct,
} from '../../services/buyerSourcingService'
import { resolveUploadedFileUrl } from '../../services/uploadService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

type TimeFilter = 'all' | '7d' | '30d' | '90d'
type StockFilter = 'all' | 'available' | 'out-of-stock'
type GradeFilter = 'all' | 'A' | 'B' | 'C'

type RfqFormState = {
  quantity: string
  unit: string
  deliveryDate: string
  province: string
  description: string
  expiredDate: string
}

type BuyerSourcingProductDetail = BuyerSourcingProduct & {
  batchList?: BuyerBatchPreview[]
  availableBatches?: BuyerBatchPreview[]
  lots?: BuyerBatchPreview[]
  productBatches?: BuyerBatchPreview[]
  supplierBatches?: BuyerBatchPreview[]
}

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
    if (Number.isInteger(compact)) return `${compact}k`
    return `${compact.toFixed(1).replace(/\.0$/, '')}k`
  }
  return value.toLocaleString('vi-VN')
}

function formatBatchPrice(batch: BuyerBatchPreview, unit?: string | null) {
  if (batch.price == null) return '--'
  return `${compactCurrency(batch.price)} /${unit || ''}`
}

function formatDateLabel(value?: string | null) {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('vi-VN')
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dateAfterDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDateInput(date)
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

function createInitialBatchRfqForm(unit: string): RfqFormState {
  return {
    quantity: '',
    unit,
    deliveryDate: '',
    province: getBuyerDefaultDeliveryProvince(),
    description: '',
    expiredDate: '',
  }
}

function isUrl(value?: string | null) {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^https?:\/\//i.test(trimmed)) return true
  return /^\/public\/batch\/\d+/i.test(trimmed)
}

function getBatchCode(batch: BuyerBatchPreview, index = 0) {
  const candidate = [batch.batchCode, batch.batchNo, batch.lotCode, batch.code]
    .map((value) => value?.trim())
    .find((value) => value && !isUrl(value))

  if (candidate) return candidate
  return `BATCH-${String(batch.id ?? index + 1).padStart(6, '0')}`
}

function getBatchTraceabilityUrl(batch: BuyerBatchPreview) {
  const candidates = [
    batch.traceabilityUrl,
    batch.qrCodeUrl,
    batch.publicUrl,
    batch.publicTraceUrl,
    batch.publicBatchUrl,
    batch.code,
    batch.batchCode,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  return candidates.find((value) => isUrl(value)) || null
}

function getBatchQuantity(batch: BuyerBatchPreview) {
  return batch.availableQuantity ?? batch.quantity
}

function getBatchMoq(batch: BuyerBatchPreview) {
  return batch.moq ?? batch.minMoq
}

function getBatchId(batch: BuyerBatchPreview) {
  return batch.id ?? batch.batchId
}

function getProductImage(product?: BuyerSourcingProductDetail | null) {
  const raw = product?.imageUrl || product?.imageUrls?.[0] || ''
  return resolveUploadedFileUrl(raw) || raw || placeholderImage
}

function getBatchImages(batch: BuyerBatchPreview, product?: BuyerSourcingProductDetail | null) {
  const images = [batch.imageUrl, ...(batch.imageUrls ?? []), product?.imageUrl, ...(product?.imageUrls ?? [])]
    .map((url) => {
      const trimmed = url?.trim()
      return trimmed ? resolveUploadedFileUrl(trimmed) || trimmed : undefined
    })
    .filter((url): url is string => Boolean(url))
  return Array.from(new Set(images))
}

function deriveBatchStatus(batch: BuyerBatchPreview): 'available' | 'out-of-stock' {
  const normalized = (batch.status || '').toUpperCase()
  if (batch.expired || normalized.includes('EXPIRED') || normalized.includes('OUT') || normalized.includes('SOLD') || normalized.includes('HET')) return 'out-of-stock'
  if (!batch.expiryDate || batch.expiryDate < new Date().toISOString().slice(0, 10)) return 'out-of-stock'
  const quantity = getBatchQuantity(batch)
  if (quantity != null && quantity <= 0) return 'out-of-stock'
  return 'available'
}

function batchStatusLabel(status: 'available' | 'out-of-stock') {
  return status === 'available' ? 'Còn hàng' : 'Hết hàng'
}

function batchStatusBadge(status: 'available' | 'out-of-stock') {
  return status === 'available'
    ? 'border border-emerald-300/50 bg-emerald-500/15 text-emerald-700'
    : 'border border-rose-300/50 bg-rose-500/15 text-rose-700'
}

function toQuickOrderTarget(product: BuyerSourcingProductDetail, batch: BuyerBatchPreview, unit: string): BuyerQuickOrderTarget {
  return {
    productId: product.productId,
    categoryId: product.categoryId,
    productName: product.productName,
    categoryName: product.categoryName,
    supplierName: product.supplierName,
    supplierId: product.supplierCompanyId,
    supplierCompanyId: product.supplierCompanyId,
    originRegion: product.originRegion,
    unit,
    price: batch.price ?? null,
    minMoq: getBatchMoq(batch) ?? product.minMoq,
    availableQuantity: getBatchQuantity(batch),
    imageUrl: batch.imageUrl || product.imageUrl,
    batchId: getBatchId(batch),
    batchCode: getBatchCode(batch),
    grade: batch.grade,
    size: batch.size,
    expiryDate: batch.expiryDate,
    expired: batch.expired,
  }
}

export function BuyerProductBatchesPage() {
  usePageTitle('Lô sản phẩm')
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [product, setProduct] = useState<BuyerSourcingProductDetail | null>(null)
  const [batches, setBatches] = useState<BuyerBatchPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all')
  const [rfqBatch, setRfqBatch] = useState<BuyerBatchPreview | null>(null)
  const [rfqForm, setRfqForm] = useState<RfqFormState | null>(null)
  const [submittingRfq, setSubmittingRfq] = useState(false)
  const [quickOrderTarget, setQuickOrderTarget] = useState<BuyerQuickOrderTarget | null>(null)
  const [submittingQuickOrder, setSubmittingQuickOrder] = useState(false)

  const parsedProductId = Number(productId)
  const unit = product?.unit || 'kg'

  useEffect(() => {
    let ignore = false
    async function loadProduct() {
      if (!parsedProductId) {
        setError('Thiếu productId hợp lệ.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setBatchError(null)
      setBatches([])
      try {
        const [productResult, batchResult] = await Promise.allSettled([
          fetchBuyerSourcingProduct(parsedProductId),
          fetchBuyerSourcingProductBatches(parsedProductId),
        ])

        if (!ignore) {
          if (productResult.status === 'fulfilled') {
            setProduct(productResult.value as BuyerSourcingProductDetail)
          } else {
            setProduct(null)
            setError(readApiErrorMessage(productResult.reason) || 'Không thể tải thông tin sản phẩm.')
          }

          if (batchResult.status === 'fulfilled') {
            setBatches(batchResult.value)
          } else {
            setBatchError(readApiErrorMessage(batchResult.reason) || 'Không thể tải danh sách lô hàng.')
          }
        }
      } catch (requestError) {
        if (!ignore) setError(readApiErrorMessage(requestError) || 'Không thể tải thông tin sản phẩm.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void loadProduct()
    return () => {
      ignore = true
    }
  }, [parsedProductId])

  const filteredBatches = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    const now = new Date()

    return batches.filter((batch, index) => {
      const code = getBatchCode(batch, index)
      const searchable = [code, batch.grade, batch.size].join(' ').toLowerCase()
      if (keyword && !searchable.includes(keyword)) return false

      const status = deriveBatchStatus(batch)
      if (stockFilter !== 'all' && stockFilter !== status) return false
      if (gradeFilter !== 'all' && (batch.grade || '').toUpperCase() !== gradeFilter) return false
      if (timeFilter === 'all') return true

      const dateValue = batch.harvestDate || batch.expiryDate
      if (!dateValue) return false
      const target = new Date(dateValue)
      if (Number.isNaN(target.getTime())) return false
      const diffDays = (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
      if (timeFilter === '7d') return diffDays <= 7
      if (timeFilter === '30d') return diffDays <= 30
      return diffDays <= 90
    })
  }, [batches, gradeFilter, searchKeyword, stockFilter, timeFilter])

  const summary = useMemo(() => {
    const active = batches.filter((batch) => deriveBatchStatus(batch) === 'available').length
    return { total: batches.length, active, closed: batches.length - active }
  }, [batches])

  const avgPrice = useMemo(() => {
    const prices = batches.map((batch) => batch.price).filter((price): price is number => price != null && price > 0)
    if (prices.length === 0) return product?.minPrice ?? product?.maxPrice ?? 0
    return Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length)
  }, [batches, product?.maxPrice, product?.minPrice])

  const handleOrderNow = (batch: BuyerBatchPreview) => {
    if (deriveBatchStatus(batch) === 'out-of-stock') {
      showToast('Lô hàng hiện đã hết hàng.', 'info')
      return
    }
    if (!product) {
      showToast('Chưa tải xong dữ liệu sản phẩm.', 'info')
      return
    }
    setQuickOrderTarget(toQuickOrderTarget(product, batch, unit))
  }

  const submitQuickOrder = async (payload: BuyerQuickOrderPayload) => {
    setSubmittingQuickOrder(true)
    try {
      const result = await createQuickOrder(payload)
      showToast(result.message || 'Tạo đơn hàng thành công', 'success')
      setQuickOrderTarget(null)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tạo đơn hàng.', 'error')
    } finally {
      setSubmittingQuickOrder(false)
    }
  }

  const openLotDetail = (batch: BuyerBatchPreview) => {
    const lotId = getBatchId(batch)
    if (!lotId) {
      showToast('Lô hàng chưa có mã chi tiết.', 'info')
      return
    }
    navigate(`/buyer/lots/${lotId}`)
  }

  const handleRfq = (batch: BuyerBatchPreview) => {
    setRfqBatch(batch)
    setRfqForm(createInitialBatchRfqForm(unit))
  }

  const submitBatchRfq = async () => {
    if (!product || !rfqBatch || !rfqForm) return
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

    const batchCode = getBatchCode(rfqBatch)
    const description = `[Lô hàng: ${batchCode}] ${rfqForm.description.trim()}`.trim()

    setSubmittingRfq(true)
    try {
      await createBuyerSourcingRfq({
        buyerCompanyId,
        productId: parsedProductId,
        batchId: getBatchId(rfqBatch),
        categoryId: product.categoryId,
        quantity,
        unit: rfqForm.unit.trim(),
        deliveryDate: rfqForm.deliveryDate,
        province: rfqForm.province.trim(),
        description,
        expiredAt: `${rfqForm.expiredDate}T23:59:59`,
      })
      showToast('Đã tạo RFQ cho lô hàng.', 'success')
      setRfqBatch(null)
      setRfqForm(null)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tạo RFQ cho lô hàng.', 'error')
    } finally {
      setSubmittingRfq(false)
    }
  }
  return (
    <BuyerShell activeKey="sourcing" title="Danh sách lô hàng" subtitle="">
      <div className="flex h-full flex-col gap-3">
        <div className="shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-500 px-4 py-2.5 shadow-md">
            <button
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
              onClick={() => navigate('/buyer/sourcing')}
              aria-label="Quay về tìm nguồn hàng"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/30">
              <img src={getProductImage(product)} alt={product?.productName || 'product'} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">{product?.productName || 'Danh sách lô hàng'}</p>
              <p className="text-[10px] text-white/60">{product?.originRegion || '--'}{product?.unit ? ` · ${product.unit}` : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatChip icon={<Layers className="h-3 w-3" />} label="Tổng lô" value={summary.total} color="white" />
              <StatChip icon={<Flame className="h-3 w-3" />} label="Đang bán" value={summary.active} color="emerald" />
              <StatChip icon={<Package2 className="h-3 w-3" />} label="Đã hết" value={summary.closed} color="rose" />
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Giá TB</p>
              <p className="text-sm font-black text-white">
                {avgPrice > 0 ? compactCurrency(avgPrice) : '--'}
                <span className="ml-0.5 text-[10px] font-semibold text-white/60">/{unit}</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-sm">
            <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-[minmax(260px,1fr)_170px_170px_150px]">
              <label className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="Tìm theo mã lô, grade, size..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as TimeFilter)} className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-2 text-xs outline-none transition focus:border-emerald-400 focus:bg-white">
                  <option value="all">Tất cả thời gian</option>
                  <option value="7d">7 ngày</option>
                  <option value="30d">30 ngày</option>
                  <option value="90d">90 ngày</option>
                </select>
              </label>
              <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as StockFilter)} className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white">
                <option value="all">Tất cả trạng thái</option>
                <option value="available">Còn hàng</option>
                <option value="out-of-stock">Hết hàng</option>
              </select>
              <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value as GradeFilter)} className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white">
                <option value="all">Grade: Tất cả</option>
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
              </select>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-slate-500">
              Hiển thị <span className="font-bold text-emerald-600">{filteredBatches.length}</span>/{batches.length} lô hàng
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <PackageSearch className="h-4 w-4 animate-pulse text-emerald-500" />
            Đang tải lô hàng...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
        ) : null}

        {!error && batchError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">{batchError}</div>
        ) : null}

        {!loading && !error && filteredBatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-white p-8 text-center text-sm text-emerald-700">
            <PackageSearch className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            <p className="font-bold">Chưa có lô hàng phù hợp</p>
            <p className="mt-1 text-emerald-700/70">Thử đổi bộ lọc hoặc quay lại tìm sản phẩm khác</p>
          </div>
        ) : null}

        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredBatches.map((batch, index) => (
            <BatchCard
              key={batch.id ?? getBatchCode(batch, index)}
              batch={batch}
              index={index}
              product={product}
              unit={unit}
              onOrder={() => handleOrderNow(batch)}
              onRfq={() => handleRfq(batch)}
              onDetail={() => openLotDetail(batch)}
            />
          ))}
        </div>
      </div>

      {rfqBatch && rfqForm && product ? (
        <BatchRfqModal
          batch={rfqBatch}
          product={product}
          form={rfqForm}
          unit={unit}
          submitting={submittingRfq}
          onChange={setRfqForm}
          onClose={() => {
            setRfqBatch(null)
            setRfqForm(null)
          }}
          onSubmit={submitBatchRfq}
        />
      ) : null}

      {quickOrderTarget ? (
        <BuyerQuickOrderModal
          target={quickOrderTarget}
          submitting={submittingQuickOrder}
          onClose={() => setQuickOrderTarget(null)}
          onSubmit={(payload) => {
            void submitQuickOrder(payload)
          }}
        />
      ) : null}
    </BuyerShell>
  )
}

export const BuyerProductBatchesPlaceholderPage = BuyerProductBatchesPage

function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'white' | 'emerald' | 'rose' }) {
  const colorClass =
    color === 'white'
      ? 'bg-white/15 text-white'
      : color === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-rose-50 text-rose-700'
  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${colorClass}`}>
      {icon}
      <span>{value}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
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

function BatchCard({
  batch,
  index,
  product,
  unit,
  onOrder,
  onRfq,
  onDetail,
}: {
  batch: BuyerBatchPreview
  index: number
  product: BuyerSourcingProductDetail | null
  unit: string
  onOrder: () => void
  onRfq: () => void
  onDetail: () => void
}) {
  const code = getBatchCode(batch, index)
  const status = deriveBatchStatus(batch)
  const images = getBatchImages(batch, product)
  const qcPass = (batch.qcResult || '').toUpperCase() === 'PASS'
  const traceUrl = getBatchTraceabilityUrl(batch)

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)]">
      <div className="relative h-28 shrink-0 overflow-hidden bg-slate-100">
        <img src={images[0] || getProductImage(product)} alt={code} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">{code}</span>
        <span className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold backdrop-blur-sm ${batchStatusBadge(status)}`}>
          {batchStatusLabel(status)}
        </span>
        {qcPass ? (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-emerald-700 shadow backdrop-blur-sm">
            <ShieldCheck className="h-3 w-3" />
            QC PASS
          </span>
        ) : null}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {traceUrl ? (
            <button
              type="button"
              title="Truy xuất nguồn gốc"
              onClick={(event) => {
                event.stopPropagation()
                window.open(traceUrl, '_blank', 'noopener,noreferrer')
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow backdrop-blur-sm transition hover:bg-white"
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {batch.videoUrl ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-700 shadow backdrop-blur-sm">
              <Video className="h-3 w-3" />
              Video
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="truncate text-[15px] font-bold text-slate-900">{code}</h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            Thu hoạch: {formatDateLabel(batch.harvestDate)} · HSD: {formatDateLabel(batch.expiryDate)}
          </p>
          {product?.supplierName ? <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">{product.supplierName}</p> : null}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <BuyerInfoChip label="Grade" value={batch.grade || '--'} />
            <BuyerInfoChip label="Size" value={batch.size || '--'} />
            <BuyerInfoChip label="Tồn kho" value={formatQuantity(getBatchQuantity(batch), unit)} highlight />
            <BuyerInfoChip label="MOQ" value={formatQuantity(getBatchMoq(batch), unit)} />
            <BuyerInfoChip label="Hết hạn" value={formatDateLabel(batch.expiryDate)} />
            <BuyerInfoChip label="Bảo quản" value={batch.storageTemp || '--'} />
          </div>
          <div className="mt-auto rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Giá bán</p>
            <p className="text-lg font-black text-emerald-700">{formatBatchPrice(batch, unit)}</p>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-[1fr_auto_auto] gap-1.5 border-t border-slate-100 pt-2">
          <button onClick={onOrder} disabled={status === 'out-of-stock'} className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 px-2 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:opacity-80">
            Đặt hàng ngay
          </button>
          <button onClick={onRfq} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95">RFQ</button>
          <button title="Xem chi tiết lô hàng" onClick={onDetail} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 active:scale-95">
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  )
}

function BatchRfqModal({
  batch,
  product,
  form,
  unit,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  batch: BuyerBatchPreview
  product: BuyerSourcingProductDetail
  form: RfqFormState
  unit: string
  submitting: boolean
  onChange: (form: RfqFormState) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const batchCode = getBatchCode(batch)
  const moq = getBatchMoq(batch)
  const quantity = Number(form.quantity)
  const showMoqWarning = moq != null && quantity > 0 && quantity < moq
  const images = getBatchImages(batch, product)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 className="text-xl font-extrabold text-emerald-950">Tạo RFQ theo lô hàng</h3>
            <p className="text-sm text-emerald-700/70">{product.productName} · {batchCode}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-start gap-3">
              <img src={images[0] || getProductImage(product)} alt={batchCode} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-base font-black text-slate-900">{batchCode}</h4>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">{product.productName}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{product.supplierName || 'Nhà cung cấp'}</p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  <BuyerInfoChip label="Giá lô" value={formatBatchPrice(batch, unit)} highlight />
                  <BuyerInfoChip label="MOQ" value={formatQuantity(moq, unit)} />
                  <BuyerInfoChip label="Tồn kho" value={formatQuantity(getBatchQuantity(batch), unit)} />
                  <BuyerInfoChip label="Grade" value={batch.grade || '--'} />
                  <BuyerInfoChip label="Size" value={batch.size || '--'} />
                  <BuyerInfoChip label="Hạn sử dụng" value={formatDateLabel(batch.expiryDate)} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Số lượng *</label>
              <input
                value={form.quantity}
                onChange={(event) => onChange({ ...form, quantity: event.target.value })}
                type="number"
                min="0"
                className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"
                placeholder={`Tối thiểu ${formatQuantity(moq, unit)}`}
              />
              {showMoqWarning ? (
                <p className="mt-1 text-xs font-semibold text-amber-600">
                  Số lượng đang thấp hơn MOQ {formatQuantity(moq, unit)}. Nhà cung cấp có thể không chấp nhận.
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Đơn vị *</label>
              <input value={form.unit} onChange={(event) => onChange({ ...form, unit: event.target.value })} className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="kg, thùng, tấn..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Ngày giao dự kiến *</label>
              <input value={form.deliveryDate} onChange={(event) => onChange({ ...form, deliveryDate: event.target.value })} type="date" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[3, 7, 14].map((days) => (
                  <button key={days} type="button" onClick={() => onChange({ ...form, deliveryDate: dateAfterDays(days) })} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">
                    {days} ngày
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Hạn báo giá *</label>
              <input value={form.expiredDate} onChange={(event) => onChange({ ...form, expiredDate: event.target.value })} type="date" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onChange({ ...form, expiredDate: dateAfterDays(0) })} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">Hôm nay</button>
                {[3, 7].map((days) => (
                  <button key={days} type="button" onClick={() => onChange({ ...form, expiredDate: dateAfterDays(days) })} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">
                    {days} ngày
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Tỉnh/khu vực giao hàng *</label>
              <input
                value={form.province}
                onChange={(event) => onChange({ ...form, province: event.target.value })}
                className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"
                placeholder="Nhập tỉnh/khu vực nhận hàng, ví dụ: TP. Hồ Chí Minh"
              />
              {form.province.trim() ? (
                <p className="mt-1 text-xs font-medium text-slate-500">Mặc định lấy từ địa chỉ/chi nhánh của bạn, có thể chỉnh nếu muốn giao nơi khác.</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Mô tả nhu cầu</label>
              <textarea
                value={form.description}
                onChange={(event) => onChange({ ...form, description: event.target.value })}
                className="h-24 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm"
                placeholder="Ví dụ: cần loại A, đóng thùng lạnh, giao buổi sáng, ưu tiên có chứng chỉ/QC."
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 text-sm text-emerald-900">
            Bạn sắp gửi RFQ: Cần mua <span className="font-bold">{form.quantity || '--'} {form.unit || unit}</span> {product.productName}, lô <span className="font-bold">{batchCode}</span>, giao tại <span className="font-bold">{form.province || '--'}</span>, hạn báo giá <span className="font-bold">{form.expiredDate || '--'}</span>, ngày giao <span className="font-bold">{form.deliveryDate || '--'}</span>.
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">Hủy</button>
          <button disabled={submitting} onClick={onSubmit} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:bg-emerald-300">
            {submitting ? 'Đang gửi...' : 'Gửi RFQ'}
          </button>
        </div>
      </div>
    </div>
  )
}
