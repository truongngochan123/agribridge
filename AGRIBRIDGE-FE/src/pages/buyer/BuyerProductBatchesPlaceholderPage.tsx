import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
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
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useToast } from '../../hooks/useToast'
import {
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
  if (normalized.includes('OUT') || normalized.includes('SOLD') || normalized.includes('HET')) return 'out-of-stock'
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

function qcBadgeStyle(value?: string | null) {
  const normalized = (value || '').toUpperCase()
  if (normalized === 'PASS') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (normalized === 'FAIL') return 'bg-rose-100 text-rose-700 border border-rose-200'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}

function openExternal(url?: string | null) {
  if (!url) return
  window.open(resolveUploadedFileUrl(url) || url, '_blank', 'noopener,noreferrer')
}

export function BuyerProductBatchesPage() {
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
  const [detailBatch, setDetailBatch] = useState<BuyerBatchPreview | null>(null)

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
    if (batch.id) {
      navigate(`/buyer/lots/${batch.id}`)
      return
    }
    showToast('Lô hàng chưa có mã chi tiết để đặt hàng.', 'info')
  }

  const handleRfq = (batch: BuyerBatchPreview) => {
    const code = getBatchCode(batch)
    sessionStorage.setItem('agribridge.buyer.rfq.context', JSON.stringify({ productId: parsedProductId, batchId: batch.id, batchCode: code }))
    showToast(`Đã lưu ngữ cảnh RFQ cho lô ${code}.`, 'info')
    navigate('/buyer/rfq')
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
              onDetail={() => setDetailBatch(batch)}
            />
          ))}
        </div>
      </div>

      {detailBatch ? (
        <BatchDetailModal
          batch={detailBatch}
          product={product}
          unit={unit}
          onClose={() => setDetailBatch(null)}
          onOrder={() => handleOrderNow(detailBatch)}
          onRfq={() => handleRfq(detailBatch)}
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

function BatchDetailModal({
  batch,
  product,
  unit,
  onClose,
  onOrder,
  onRfq,
}: {
  batch: BuyerBatchPreview
  product: BuyerSourcingProductDetail | null
  unit: string
  onClose: () => void
  onOrder: () => void
  onRfq: () => void
}) {
  const code = getBatchCode(batch)
  const status = deriveBatchStatus(batch)
  const images = getBatchImages(batch, product)
  const qcResult = batch.qcResult || 'N/A'
  const traceUrl = getBatchTraceabilityUrl(batch)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 px-5 py-4">
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-white/30 shadow-lg">
                <img src={images[0] || getProductImage(product)} alt={code} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-white drop-shadow">{code}</h3>
                <p className="mt-0.5 text-[11px] text-white/70">{product?.productName || '--'} · {product?.originRegion || '--'}</p>
              </div>
            </div>
            <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">Grade {batch.grade || '--'}</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">{batchStatusLabel(status)}</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">QC {qcResult}</span>
            {images.length > 0 ? <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">{images.length} ảnh</span> : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {images.length > 0 ? (
            <section className="border-b border-slate-100 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Hình ảnh lô hàng</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((url, index) => (
                  <img key={`${url}-${index}`} src={url} alt={`batch-${index}`} className="h-24 w-24 shrink-0 rounded-xl border border-slate-200 object-cover shadow-sm" />
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 sm:grid-cols-4">
            <SummaryCell label="Mã lô" value={code} />
            <SummaryCell label="Grade" value={batch.grade || '--'} />
            <SummaryCell label="Size" value={batch.size || '--'} />
            <SummaryCell label="Tồn kho" value={formatQuantity(getBatchQuantity(batch), unit)} />
            <SummaryCell label="MOQ" value={formatQuantity(getBatchMoq(batch), unit)} />
            <SummaryCell label="Giá" value={formatBatchPrice(batch, unit)} />
            <SummaryCell label="Thu hoạch" value={formatDateLabel(batch.harvestDate)} />
            <SummaryCell label="Hết hạn" value={formatDateLabel(batch.expiryDate)} />
            <SummaryCell label="Bảo quản" value={batch.storageTemp || '--'} />
            <SummaryCell label="Trạng thái" value={batchStatusLabel(status)} />
          </section>

          <section className="border-b border-slate-100 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">QC / kiểm định</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${qcBadgeStyle(batch.qcResult)}`}>QC {qcResult}</span>
              <p className="mt-2 text-sm text-slate-600">{batch.qcNotes || 'Không có ghi chú QC.'}</p>
              {batch.qcDocumentUrl ? (
                <button onClick={() => openExternal(batch.qcDocumentUrl)} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Xem file
                </button>
              ) : null}
            </div>
          </section>

          {batch.videoUrl ? (
            <section className="border-b border-slate-100 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Video lô hàng</p>
              <button onClick={() => openExternal(batch.videoUrl)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Video className="h-4 w-4 text-emerald-600" />
                Xem video
              </button>
            </section>
          ) : null}

          {traceUrl ? (
            <section className="border-b border-slate-100 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Truy xuất nguồn gốc</p>
              <button
                onClick={() => window.open(traceUrl, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <QrCode className="h-4 w-4 text-emerald-600" />
                Truy xuất nguồn gốc
              </button>
            </section>
          ) : null}

          <section className="p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Ghi chú / mô tả</p>
            <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              {batch.notes || batch.description || '--'}
            </p>
          </section>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
            Đóng
          </button>
          <button onClick={onRfq} className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
            RFQ
          </button>
          <button onClick={onOrder} disabled={status === 'out-of-stock'} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300">
            Đặt hàng ngay
          </button>
        </div>
      </div>
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
