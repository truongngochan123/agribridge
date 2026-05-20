import {
  ArrowLeft,
  Award,
  Bookmark,
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Share2,
  ShieldCheck,
  Weight,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BuyerQuickOrderModal } from '../../components/buyer/BuyerQuickOrderModal'
import { BuyerOrderPaymentModal } from '../../components/buyer/BuyerOrderPaymentModal'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import type { BuyerPaymentMethod, BuyerQuickOrderPayload, BuyerQuickOrderTarget } from '../../components/buyer/buyerQuickOrderTypes'
import { useBuyerOrderPayment } from '../../hooks/useBuyerOrderPayment'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { createQuickOrder } from '../../services/buyerOrderService'
import {
  createBuyerSourcingRfq,
  fetchBuyerLotDetail,
  type BuyerLotDetail,
} from '../../services/buyerSourcingService'
import { resolveUploadedFileUrl } from '../../services/uploadService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

type ActiveTab = 'lot' | 'quality' | 'history' | 'supplier'

type QuickOrderPaymentModalData = {
  orderId: number
  orderCode: string
  productName: string
  quantity: number
  unit?: string | null
  subtotal?: number | null
  shippingFee?: number | null
  totalAmount?: number | null
  transferContent?: string | null
  paymentMethod: BuyerPaymentMethod
  creditTermDays?: number | null
}

type RfqFormState = {
  quantity: string
  unit: string
  deliveryDate: string
  province: string
  description: string
  expiredDate: string
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

function formatPrice(value?: number | null, unit?: string | null) {
  if (value == null || value <= 0) return '--'
  return `${compactCurrency(value)} /${unit || ''}`
}

function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '--'
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
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

function isUrl(value?: string | null) {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return /^https?:\/\//i.test(trimmed) || /^\/public\/batch\/\d+/i.test(trimmed)
}

function getLotId(lot: BuyerLotDetail) {
  return lot.id ?? lot.batchId
}

function getLotCode(lot: BuyerLotDetail) {
  const candidate = [lot.batchCode, lot.batchNo, lot.lotCode, lot.code]
    .map((value) => value?.trim())
    .find((value) => value && !isUrl(value))

  if (candidate) return candidate
  const id = getLotId(lot)
  return id ? `BATCH-${String(id).padStart(6, '0')}` : '--'
}

function getTraceabilityUrl(lot: BuyerLotDetail) {
  const candidates = [
    lot.traceabilityUrl,
    lot.qrCodeUrl,
    lot.publicUrl,
    lot.publicTraceUrl,
    lot.publicBatchUrl,
    lot.code,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  const found = candidates.find((value) => isUrl(value))
  if (found) return resolveUploadedFileUrl(found) || found
  const id = getLotId(lot)
  return id ? `/public/batch/${id}` : null
}

function getLotQuantity(lot: BuyerLotDetail) {
  return lot.availableQuantity ?? lot.quantity
}

function getLotMoq(lot: BuyerLotDetail) {
  return lot.moq ?? lot.minMoq
}

function getLotImages(lot: BuyerLotDetail) {
  const urls: string[] = []
  const collect = (value: unknown) => {
    if (!value) return
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) urls.push(resolveUploadedFileUrl(trimmed) || trimmed)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(collect)
      return
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>
      collect(record.url)
      collect(record.imageUrl)
      collect(record.image_url)
      collect(record.fileUrl)
      collect(record.file_url)
      collect(record.path)
    }
  }

  collect(lot.batchImageUrl)
  collect(lot.lotImageUrl)
  collect(lot.imageUrl)
  collect(lot.imageUrls)
  collect(lot.images)
  collect(lot.batchImages)
  collect(lot.lotImages)
  collect(lot.media)
  collect(lot.attachments)
  collect(lot.thumbnailUrl)
  collect(lot.productImageUrl)
  collect(lot.product?.imageUrl)
  collect(lot.product?.imageUrls)
  collect(lot.product?.images)
  return Array.from(new Set(urls.filter(Boolean)))
}

function deriveLotStatus(lot: BuyerLotDetail) {
  const normalized = (lot.status || '').toUpperCase()
  if (lot.expired || normalized.includes('EXPIRED') || normalized.includes('OUT') || normalized.includes('SOLD') || normalized.includes('HET')) return 'out-of-stock'
  if (!lot.expiryDate || lot.expiryDate < new Date().toISOString().slice(0, 10)) return 'out-of-stock'
  const quantity = getLotQuantity(lot)
  if (quantity != null && quantity <= 0) return 'out-of-stock'
  return 'available'
}

function normalizeDefaultProvince(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === '--' || trimmed.toUpperCase() === 'N/A') return ''
  return trimmed
}

function getBuyerDefaultDeliveryProvince() {
  return (
    normalizeDefaultProvince(localStorage.getItem('agribridge.auth.branchProvince')) ||
    normalizeDefaultProvince(localStorage.getItem('agribridge.auth.companyProvince')) ||
    normalizeDefaultProvince(localStorage.getItem('agribridge.auth.province')) ||
    ''
  )
}

function createInitialRfqForm(lot: BuyerLotDetail): RfqFormState {
  return {
    quantity: '',
    unit: lot.unit || 'kg',
    deliveryDate: '',
    province: getBuyerDefaultDeliveryProvince(),
    description: '',
    expiredDate: '',
  }
}

function openDocumentUrl(url?: string | null) {
  if (!url) return
  window.open(resolveUploadedFileUrl(url) || url, '_blank', 'noopener,noreferrer')
}

function toQuickOrderTarget(lot: BuyerLotDetail, lotCode: string): BuyerQuickOrderTarget {
  return {
    productId: lot.productId ?? 0,
    productName: lot.productName || lotCode,
    categoryName: lot.categoryName,
    supplierName: lot.supplierName,
    supplierId: lot.supplierId ?? lot.supplierCompanyId,
    supplierCompanyId: lot.supplierCompanyId,
    originRegion: lot.originRegion || lot.originProvince || lot.supplierProvince,
    unit: lot.unit,
    price: lot.price ?? null,
    minMoq: getLotMoq(lot),
    availableQuantity: getLotQuantity(lot),
    imageUrl: lot.imageUrl || lot.productImageUrl || lot.batchImageUrl || lot.lotImageUrl,
    batchId: getLotId(lot),
    batchCode: lotCode,
    grade: lot.grade,
    size: lot.size,
    expiryDate: lot.expiryDate,
    expired: lot.expired,
  }
}

export function BuyerLotDetailPage() {
  usePageTitle('Chi tiết lô hàng')
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirmPayment, confirming } = useBuyerOrderPayment()

  const [lot, setLot] = useState<BuyerLotDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('lot')
  const [qty, setQty] = useState(1)
  const [saved, setSaved] = useState(false)
  const [rfqForm, setRfqForm] = useState<RfqFormState | null>(null)
  const [submittingRfq, setSubmittingRfq] = useState(false)
  const [quickOrderTarget, setQuickOrderTarget] = useState<BuyerQuickOrderTarget | null>(null)
  const [submittingQuickOrder, setSubmittingQuickOrder] = useState(false)
  const [paymentModalData, setPaymentModalData] = useState<QuickOrderPaymentModalData | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const parsedLotId = Number(lotId)

  useEffect(() => {
    let ignore = false
    async function loadLot() {
      if (!parsedLotId) {
        setError('Không tìm thấy lô hàng.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const detail = await fetchBuyerLotDetail(parsedLotId)
        if (ignore) return
        setLot(detail)
        const moq = getLotMoq(detail)
        setQty(moq && moq > 0 ? moq : 1)
      } catch (requestError) {
        if (!ignore) setError(readApiErrorMessage(requestError) || 'Không thể tải chi tiết lô hàng.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void loadLot()
    return () => {
      ignore = true
    }
  }, [parsedLotId])

  const images = useMemo(() => (lot ? getLotImages(lot) : []), [lot])
  const galleryImages = images.length > 0 ? images : [placeholderImage]
  const safeSelectedImageIndex = Math.min(selectedImageIndex, galleryImages.length - 1)
  const mainImage = galleryImages[safeSelectedImageIndex] || placeholderImage
  const thumbnailImages = galleryImages.slice(0, 3)
  const hiddenThumbnailCount = Math.max(galleryImages.length - 3, 0)
  const unit = lot?.unit || 'kg'
  const lotCode = lot ? getLotCode(lot) : '--'
  const quantity = lot ? getLotQuantity(lot) : undefined
  const moq = lot ? getLotMoq(lot) : undefined
  const status = lot ? deriveLotStatus(lot) : 'out-of-stock'
  const traceabilityUrl = lot ? getTraceabilityUrl(lot) : null
  const totalAmount = lot?.price && qty > 0 ? lot.price * qty : null
  const backTo = lot?.productId ? `/buyer/sourcing/products/${lot.productId}/batches` : '/buyer/sourcing'

  useEffect(() => {
    setSelectedImageIndex(0)
  }, [lot?.id, lot?.batchId, images])

  const updateQty = (nextValue: number) => {
    const min = moq && moq > 0 ? moq : 1
    setQty(Math.max(min, nextValue || min))
  }

  const handleOrderNow = () => {
    if (!lot) return
    if (status === 'out-of-stock') {
      showToast('Lô hàng này đã hết hạn hoặc không còn khả dụng.', 'error')
      return
    }
    setQuickOrderTarget(toQuickOrderTarget(lot, lotCode))
  }

  const submitQuickOrder = async (payload: BuyerQuickOrderPayload) => {
    setSubmittingQuickOrder(true)
    const currentTarget = quickOrderTarget
    try {
      const result = await createQuickOrder(payload)
      showToast('Tạo đơn hàng thành công. Vui lòng hoàn tất thanh toán.', 'success')
      setQuickOrderTarget(null)
      if (currentTarget) {
        setPaymentModalData({
          orderId: result.orderId,
          orderCode: result.orderCode,
          productName: currentTarget.productName,
          quantity: payload.quantity,
          unit: payload.unit,
          subtotal: payload.subtotal,
          shippingFee: payload.shippingFee,
          totalAmount: result.payableAmount ?? result.grandTotal ?? (payload.subtotal ?? 0) + (payload.shippingFee ?? 0),
          transferContent: result.transferContent ?? null,
          paymentMethod: payload.paymentMethod,
          creditTermDays: payload.creditTermDays ?? null,
        })
      }
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tạo đơn hàng.', 'error')
    } finally {
      setSubmittingQuickOrder(false)
    }
  }

  const handleConfirmPayment = async () => {
    if (!paymentModalData) return
    const updated = await confirmPayment({ orderId: paymentModalData.orderId })
    if (updated) {
      setPaymentModalData(null)
      navigate(`/buyer/orders?orderId=${paymentModalData.orderId}`)
    }
  }

  const openRfqModal = () => {
    if (!lot) return
    setRfqForm(createInitialRfqForm(lot))
  }

  const submitRfq = async () => {
    if (!lot || !rfqForm) return
    const quantityValue = Number(rfqForm.quantity)
    const buyerCompanyId = Number(localStorage.getItem('agribridge.auth.companyId'))
    if (!buyerCompanyId) {
      showToast('Thiếu thông tin công ty buyer, vui lòng đăng nhập lại.', 'error')
      return
    }
    if (!quantityValue || quantityValue <= 0) {
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
        productId: lot.productId ?? 0,
        batchId: getLotId(lot),
        categoryId: undefined,
        quantity: quantityValue,
        unit: rfqForm.unit.trim(),
        deliveryDate: rfqForm.deliveryDate,
        province: rfqForm.province.trim(),
        description: `[Lô hàng: ${lotCode}] ${rfqForm.description.trim()}`.trim(),
        expiredAt: `${rfqForm.expiredDate}T23:59:59`,
      })
      showToast('Đã tạo RFQ cho lô hàng.', 'success')
      setRfqForm(null)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tạo RFQ cho lô hàng.', 'error')
    } finally {
      setSubmittingRfq(false)
    }
  }

  const contactSupplier = () => {
    if (!lot) return
    if (lot.supplierId) {
      localStorage.setItem('agribridge.buyer.contact.context', JSON.stringify({ supplierId: lot.supplierId, batchId: getLotId(lot), productId: lot.productId }))
    }
    if (lot.supplierPhone) {
      window.location.href = `tel:${lot.supplierPhone}`
      return
    }
    if (lot.supplierEmail) {
      window.location.href = `mailto:${lot.supplierEmail}`
      return
    }
    showToast('Chưa có thông tin liên hệ nhà cung cấp.', 'info')
  }

  const toggleSaved = () => {
    setSaved((current) => !current)
    showToast(saved ? 'Đã bỏ lưu lô hàng tạm thời.' : 'Đã lưu lô hàng tạm thời.', 'success')
  }

  const shareLot = async () => {
    if (!lot) return
    const shareData = {
      title: `${lotCode} - ${lot.productName || 'Lô hàng'}`,
      url: window.location.href,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }
      await navigator.clipboard.writeText(window.location.href)
      showToast('Đã sao chép liên kết lô hàng.', 'success')
    } catch {
      showToast('Không thể chia sẻ liên kết lô hàng.', 'error')
    }
  }

  return (
    <BuyerShell activeKey="sourcing" title="Chi tiết lô hàng" subtitle={lot ? lotCode : ''}>
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
          Đang tải chi tiết lô hàng...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>
      ) : !lot ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Không tìm thấy lô hàng.</div>
      ) : (
        <div className="space-y-4 text-emerald-950">
          <div className="flex items-center justify-between gap-3">
            <Link to={backTo} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách lô hàng
            </Link>
            <div className="flex gap-2">
              <button onClick={toggleSaved} className={`rounded-lg border p-2 ${saved ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-200 text-emerald-700'}`}>
                <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
              </button>
              <button onClick={shareLot} className="rounded-lg border border-emerald-200 p-2 text-emerald-700">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="text-xs text-emerald-700/70">Dashboard &gt; Tìm nguồn hàng &gt; {lotCode}</p>

          <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-emerald-200 bg-white p-3">
              <div className="flex aspect-[16/9] min-h-[320px] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-50 sm:min-h-[380px]">
                <img src={mainImage} alt={lot.productName || lotCode} className="h-full w-full object-contain" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {thumbnailImages.map((img, index) => {
                  const isActive = safeSelectedImageIndex === index
                  const showOverlay = index === 2 && hiddenThumbnailCount > 0
                  return (
                    <button
                      key={`${img}-${index}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative h-20 overflow-hidden rounded-lg border bg-slate-50 transition sm:h-24 ${isActive ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'}`}
                    >
                      <img src={img} alt={`thumb-${index + 1}`} className="h-full w-full object-cover" />
                      {showOverlay ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-lg font-black text-white">
                          +{hiddenThumbnailCount}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <aside className="rounded-2xl border border-emerald-200 bg-white p-4">
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">{lotCode}</span>
              <h1 className="mt-2 text-3xl font-extrabold">{lot.productName || '--'}</h1>
              <p className="mt-1 text-sm text-emerald-700/80">{lot.supplierName || '--'}</p>
              <p className="inline-flex items-center gap-1 text-sm text-emerald-700/80">
                <MapPin className="h-4 w-4" />
                {lot.originRegion || lot.originProvince || lot.supplierProvince || '--'}
              </p>

              <p className="mt-3 text-[30px] font-extrabold text-emerald-700">{formatPrice(lot.price, unit)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <InfoLine label="Grade" value={lot.grade || '--'} />
                <InfoLine label="Size" value={lot.size || '--'} />
                <InfoLine label="MOQ" value={formatQuantity(moq, unit)} />
                <InfoLine label="Tồn kho" value={formatQuantity(quantity, unit)} highlight />
                <InfoLine label="Trạng thái" value={status === 'available' ? 'Còn hàng' : 'Hết hàng'} highlight={status === 'available'} />
              </div>

              {status === 'out-of-stock' ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  Lô hàng này đã hết hạn hoặc không còn khả dụng.
                </div>
              ) : null}

              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold">Số lượng {moq ? `(Tối thiểu ${formatQuantity(moq, unit)})` : ''}</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(qty - 1)} className="h-10 w-10 rounded-lg border border-emerald-200">-</button>
                  <input value={qty} onChange={(event) => updateQty(Number(event.target.value))} className="h-10 flex-1 rounded-lg border border-emerald-200 px-3" />
                  <button onClick={() => updateQty(qty + 1)} className="h-10 w-10 rounded-lg border border-emerald-200">+</button>
                  <span className="text-sm text-emerald-700/70">{unit}</span>
                </div>
                <p className="mt-1 text-sm text-emerald-700/70">Tạm tính: {totalAmount ? formatMoney(totalAmount) : '--'}</p>
              </div>

              <div className="mt-4 space-y-2">
                <button disabled={status === 'out-of-stock'} onClick={handleOrderNow} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                  Đặt hàng ngay
                </button>
                <button onClick={openRfqModal} className="w-full rounded-lg border border-emerald-400 py-2.5 text-sm font-semibold text-emerald-700">Gửi yêu cầu báo giá</button>
                <button onClick={contactSupplier} className="w-full rounded-lg border border-emerald-200 py-2.5 text-sm font-semibold text-emerald-700">Liên hệ nhà cung cấp</button>
              </div>
            </aside>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-white">
            <div className="flex flex-wrap gap-1 border-b border-emerald-100 p-2">
              {[
                ['lot', 'Thông tin lô hàng'],
                ['quality', 'Chất lượng & Chứng từ'],
                ['history', 'Lịch sử giao dịch'],
                ['supplier', 'Thông tin NCC'],
              ].map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key as ActiveTab)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === key ? 'bg-emerald-100 text-emerald-800' : 'text-emerald-700/80'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'lot' ? (
                <LotInfoTab lot={lot} lotCode={lotCode} traceabilityUrl={traceabilityUrl} />
              ) : activeTab === 'quality' ? (
                <QualityTab lot={lot} />
              ) : activeTab === 'history' ? (
                <HistoryTab lot={lot} unit={unit} />
              ) : (
                <SupplierTab lot={lot} onContact={contactSupplier} showToast={showToast} />
              )}
            </div>
          </section>
        </div>
      )}

      {lot && rfqForm ? (
        <LotRfqModal
          lot={lot}
          lotCode={lotCode}
          form={rfqForm}
          submitting={submittingRfq}
          onChange={setRfqForm}
          onClose={() => setRfqForm(null)}
          onSubmit={submitRfq}
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

      {paymentModalData ? (
        <BuyerOrderPaymentModal
          open={Boolean(paymentModalData)}
          orderCode={paymentModalData.orderCode}
          productName={paymentModalData.productName}
          quantity={paymentModalData.quantity}
          unit={paymentModalData.unit}
          subtotal={paymentModalData.subtotal}
          shippingFee={paymentModalData.shippingFee}
          totalAmount={paymentModalData.totalAmount}
          paymentMethod={paymentModalData.paymentMethod}
          creditTermDays={paymentModalData.creditTermDays}
          transferContent={paymentModalData.transferContent}
          confirming={confirming}
          onClose={() => setPaymentModalData(null)}
          onConfirmPaid={() => void handleConfirmPayment()}
        />
      ) : null}
    </BuyerShell>
  )
}

function InfoLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <p>
      {label}: <span className={`font-semibold ${highlight ? 'text-emerald-700' : ''}`}>{value}</span>
    </p>
  )
}

function LotInfoTab({ lot, lotCode, traceabilityUrl }: { lot: BuyerLotDetail; lotCode: string; traceabilityUrl: string | null }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <InfoBlock title="Thông tin cơ bản" rows={[
          ['Mã lô', lotCode],
          ['Ngày thu hoạch', formatDateLabel(lot.harvestDate)],
          ['Ngày đóng gói', formatDateLabel(lot.packingDate)],
          ['Hạn sử dụng', formatDateLabel(lot.expiryDate)],
        ]} />
        <InfoBlock title="Nguồn gốc & Bảo quản" rows={[
          ['Vùng/xuất xứ', lot.originRegion || lot.originProvince || '--'],
          ['Nhà cung cấp', lot.supplierName || '--'],
          ['Quy cách/size', lot.size || '--'],
          ['Nhiệt độ', lot.storageTemp || '--'],
          ['Trạng thái', deriveLotStatus(lot) === 'available' ? 'Còn hàng' : 'Hết hàng'],
        ]} />
      </div>

      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="font-semibold">Truy xuất nguồn gốc</p>
        {traceabilityUrl ? (
          <button onClick={() => openDocumentUrl(traceabilityUrl)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            <QrCode className="h-4 w-4" />
            Truy xuất nguồn gốc
          </button>
        ) : (
          <p className="mt-1 text-sm text-emerald-700/80">Chưa có link truy xuất nguồn gốc.</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Các lô liên quan đang được cập nhật.
      </div>
    </>
  )
}

function InfoBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div>
      <h3 className="text-xl font-bold">{title}</h3>
      <div className="mt-2 space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <p key={label}>{label}: <span className="font-semibold">{value}</span></p>
        ))}
      </div>
    </div>
  )
}

function QualityTab({ lot }: { lot: BuyerLotDetail }) {
  const certifications = lot.certifications ?? []
  const hasQc = Boolean(lot.qcResult || lot.qcNotes || lot.qcDocumentUrl)
  return (
    <>
      <h3 className="text-xl font-extrabold text-emerald-950">Chứng nhận</h3>
      {certifications.length > 0 ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {certifications.map((cert, index) => (
            <article key={`${cert.name}-${index}`} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-600" />
                <p className="font-bold text-emerald-900">{cert.name}</p>
              </div>
              <div className="mt-2 space-y-1 text-xs text-emerald-700">
                <p>Cấp bởi: <span className="font-semibold">{cert.issuedBy || '--'}</span></p>
                <p>Ngày cấp: <span className="font-semibold">{formatDateLabel(cert.issuedDate)}</span></p>
                <p>Hết hạn: <span className="font-semibold">{formatDateLabel(cert.expiryDate)}</span></p>
              </div>
              {cert.documentUrl ? (
                <button onClick={() => openDocumentUrl(cert.documentUrl)} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Xem chứng chỉ
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Chưa có chứng chỉ.</p>
      )}

      <h3 className="mt-6 text-xl font-extrabold text-emerald-950">Kiểm định chất lượng</h3>
      {hasQc ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${lot.qcResult === 'PASS' ? 'bg-emerald-100 text-emerald-700' : lot.qcResult === 'FAIL' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
            <Check className="h-3.5 w-3.5" />
            QC {lot.qcResult || 'N/A'}
          </span>
          <p className="mt-3 text-sm text-slate-700">{lot.qcNotes || 'Không có ghi chú QC.'}</p>
          {lot.qcDocumentUrl ? (
            <button onClick={() => openDocumentUrl(lot.qcDocumentUrl)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              <FileText className="h-4 w-4" />
              Xem file kiểm định
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Chưa có dữ liệu kiểm định.</p>
      )}
    </>
  )
}

function HistoryTab({ lot, unit }: { lot: BuyerLotDetail; unit: string }) {
  const rows = lot.transactionHistory ?? []
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Lịch sử giao dịch đang được cập nhật.</p>
  }
  return (
    <div className="space-y-3">
      {rows.map((item, index) => (
        <article key={item.id ?? index} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="font-semibold text-slate-800">{item.buyerName || item.buyer || 'Buyer'}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDateLabel(item.date)}</span>
            <span className="inline-flex items-center gap-1"><Weight className="h-3.5 w-3.5" /> {typeof item.quantity === 'number' ? formatQuantity(item.quantity, item.unit || unit) : item.quantity || '--'}</span>
            <span>{item.status || '--'}</span>
          </div>
        </article>
      ))}
    </div>
  )
}

function SupplierTab({ lot, onContact, showToast }: { lot: BuyerLotDetail; onContact: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const supplier = lot.supplier
  const supplierRoute = lot.supplierId ? `/suppliers/${lot.supplierId}` : ''
  const supplierName = lot.supplierName || supplier?.companyName || supplier?.name || '--'
  const supplierLocation = lot.supplierProvince || supplier?.province || lot.originRegion || lot.originProvince || '--'
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold">{supplierName}</h3>
          <p className="mt-1 inline-flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" /> {supplierLocation}</p>
        </div>
        {supplier?.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Đã xác minh</span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-white p-3"><p className="text-lg font-extrabold text-emerald-700">{supplier?.responseRate != null ? `${supplier.responseRate}%` : 'Đang cập nhật'}</p><p className="text-sm text-emerald-700/80">Tỷ lệ phản hồi</p></div>
        <div className="rounded-lg bg-white p-3"><p className="text-lg font-extrabold text-emerald-700">{supplier?.deliveryRate != null ? `${supplier.deliveryRate}%` : 'Đang cập nhật'}</p><p className="text-sm text-emerald-700/80">Giao đúng hẹn</p></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {supplierRoute ? (
          <Link to={supplierRoute} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Xem trang nhà cung cấp</Link>
        ) : (
          <button onClick={() => showToast('Chưa có trang nhà cung cấp cho dữ liệu này.', 'info')} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Xem trang nhà cung cấp</button>
        )}
        {lot.supplierPhone ? <a href={`tel:${lot.supplierPhone}`} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700"><Phone className="h-4 w-4" /> {lot.supplierPhone}</a> : null}
        {lot.supplierEmail ? <a href={`mailto:${lot.supplierEmail}`} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700"><Mail className="h-4 w-4" /> Email</a> : null}
        {!lot.supplierPhone && !lot.supplierEmail ? <button onClick={onContact} className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700">Liên hệ nhà cung cấp</button> : null}
      </div>
    </div>
  )
}

function LotRfqModal({
  lot,
  lotCode,
  form,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  lot: BuyerLotDetail
  lotCode: string
  form: RfqFormState
  submitting: boolean
  onChange: (form: RfqFormState) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const unit = lot.unit || 'kg'
  const moq = getLotMoq(lot)
  const quantity = Number(form.quantity)
  const showMoqWarning = moq != null && quantity > 0 && quantity < moq

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 className="text-xl font-extrabold text-emerald-950">Tạo RFQ theo lô hàng</h3>
            <p className="text-sm text-emerald-700/70">{lot.productName || '--'} · {lotCode}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-50"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              <MiniInfo label="Sản phẩm" value={lot.productName || '--'} />
              <MiniInfo label="Mã lô" value={lotCode} />
              <MiniInfo label="Nhà cung cấp" value={lot.supplierName || '--'} />
              <MiniInfo label="Giá lô" value={formatPrice(lot.price, unit)} highlight />
              <MiniInfo label="MOQ" value={formatQuantity(moq, unit)} />
              <MiniInfo label="Tồn kho" value={formatQuantity(getLotQuantity(lot), unit)} />
              <MiniInfo label="Grade" value={lot.grade || '--'} />
              <MiniInfo label="Size" value={lot.size || '--'} />
              <MiniInfo label="Hạn sử dụng" value={formatDateLabel(lot.expiryDate)} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Số lượng *</label>
              <input value={form.quantity} onChange={(event) => onChange({ ...form, quantity: event.target.value })} type="number" min="0" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder={`Tối thiểu ${formatQuantity(moq, unit)}`} />
              {showMoqWarning ? <p className="mt-1 text-xs font-semibold text-amber-600">Số lượng đang thấp hơn MOQ {formatQuantity(moq, unit)}. Nhà cung cấp có thể không chấp nhận.</p> : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Đơn vị *</label>
              <input value={form.unit} onChange={(event) => onChange({ ...form, unit: event.target.value })} className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
            </div>
            <DateField label="Ngày giao dự kiến *" value={form.deliveryDate} days={[3, 7, 14]} onChange={(value) => onChange({ ...form, deliveryDate: value })} />
            <DateField label="Hạn báo giá *" value={form.expiredDate} days={[0, 3, 7]} onChange={(value) => onChange({ ...form, expiredDate: value })} todayLabel />
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Tỉnh/khu vực giao hàng *</label>
              <input value={form.province} onChange={(event) => onChange({ ...form, province: event.target.value })} className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" placeholder="Nhập tỉnh/khu vực nhận hàng, ví dụ: TP. Hồ Chí Minh" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Mô tả nhu cầu</label>
              <textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} className="h-24 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm" placeholder="Ví dụ: cần loại A, đóng thùng lạnh, giao buổi sáng, ưu tiên có chứng chỉ/QC." />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 text-sm text-emerald-900">
            Bạn sắp gửi RFQ: Cần mua <span className="font-bold">{form.quantity || '--'} {form.unit || unit}</span> {lot.productName || '--'}, lô <span className="font-bold">{lotCode}</span>, giao tại <span className="font-bold">{form.province || '--'}</span>, hạn báo giá <span className="font-bold">{form.expiredDate || '--'}</span>, ngày giao <span className="font-bold">{form.deliveryDate || '--'}</span>.
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">Hủy</button>
          <button disabled={submitting} onClick={onSubmit} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:bg-emerald-300">{submitting ? 'Đang gửi...' : 'Gửi RFQ'}</button>
        </div>
      </div>
    </div>
  )
}

function MiniInfo({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`truncate text-xs font-bold ${highlight ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

function DateField({ label, value, days, onChange, todayLabel }: { label: string; value: string; days: number[]; onChange: (value: string) => void; todayLabel?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-emerald-950">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} type="date" className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {days.map((day) => (
          <button key={day} type="button" onClick={() => onChange(dateAfterDays(day))} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">
            {day === 0 && todayLabel ? 'Hôm nay' : `${day} ngày`}
          </button>
        ))}
      </div>
    </div>
  )
}
