  import {
    AlertCircle,
    AlertTriangle,
    CreditCard,
    Edit2,
    MapPin,
    PackageCheck,
    Truck,
    User,
    X,
  } from 'lucide-react'
  import { useEffect, useMemo, useRef, useState } from 'react'
  import { fetchCurrentUserProfile } from '../../services/currentUserService'
  import {
    quoteBuyerShipping,
    type BuyerShippingQuote,
  } from '../../services/buyerShippingService'
  import {
  fetchVietnamProvinces,
  fetchVietnamWardsByProvinceCode,
  type VietnamProvinceOption,
  type VietnamWardOption,
} from '../../services/vietnamAddressService'
  import { resolveUploadedFileUrl } from '../../services/uploadService'
  import type {
    BuyerCreditLimit,
    BuyerQuickOrderBuyerInfo,
    BuyerQuickOrderPayload,
    BuyerQuickOrderTarget,
  } from './buyerQuickOrderTypes'

  // ─── Props ────────────────────────────────────────────────────────────────────

  type BuyerQuickOrderModalProps = {
    open?: boolean
    target: BuyerQuickOrderTarget
    buyerInfo?: BuyerQuickOrderBuyerInfo | null
    creditLimit?: BuyerCreditLimit | null
    submitting?: boolean
    onClose: () => void
    onSubmit?: (payload: BuyerQuickOrderPayload) => Promise<void> | void
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const PLACEHOLDER_IMAGE = '/images/seafood-market.jpg'

  function formatNumber(value?: number | null) {
    if (value == null || Number.isNaN(value)) return '--'
    return new Intl.NumberFormat('vi-VN').format(value)
  }

  function formatQuantity(value?: number | null, unit?: string | null): string {
    if (value == null || value <= 0) return '--'
    return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
  }

  function formatMoney(value?: number | null): string {
    if (value == null || Number.isNaN(value)) return '--'
    return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
  }

  function formatDateLabel(value?: string | null): string {
    if (!value) return '--'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('vi-VN')
  }

  function dateAfterDays(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function estimateWeightInGram(quantity: number, unit?: string | null) {
    if (!quantity || Number.isNaN(quantity)) return null
    const normalized = (unit || '').toLowerCase()
    if (normalized === 'kg') return Math.round(quantity * 1000)
    if (normalized === 'g') return Math.round(quantity)
    if (normalized === 'tấn' || normalized === 'ton') return Math.round(quantity * 1000000)
    return Math.round(quantity * 1000)
  }

  function getBuyerInfoFromSession(): BuyerQuickOrderBuyerInfo {
    const get = (key: string) => sessionStorage.getItem(key)?.trim() || null
    return {
      fullName: get('agribridge.auth.fullName'),
      companyName: get('agribridge.auth.companyName'),
      phone: get('agribridge.auth.phone'),
      province:
        get('agribridge.auth.branchProvince') ||
        get('agribridge.auth.companyProvince') ||
        get('agribridge.auth.province'),
      address: get('agribridge.auth.companyAddress') || get('agribridge.auth.address'),
    }
  }

  // ─── Sub-components ───────────────────────────────────────────────────────────

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
      <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-emerald-800">
        {children}
      </h4>
    )
  }

  function MiniRow({ label, value }: { label: string; value: string }) {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-xs font-bold text-slate-800">{value}</p>
      </div>
    )
  }

  function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-500">{label}</span>
        <span className={`font-bold ${accent ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</span>
      </div>
    )
  }

  // ─── Main Component ───────────────────────────────────────────────────────────

  export function BuyerQuickOrderModal({
    target,
    buyerInfo: buyerInfoProp,
    creditLimit,
    submitting = false,
    onClose,
    onSubmit,
  }: BuyerQuickOrderModalProps) {
    // ── Quantity state ──
    const defaultQty = (target.minMoq && target.minMoq > 0 ? target.minMoq : 1).toString()
    const [quantity, setQuantity] = useState(defaultQty)

    // ── Delivery address state ──
    const [buyerInfo, setBuyerInfo] = useState<BuyerQuickOrderBuyerInfo>(() => {
      if (buyerInfoProp) return buyerInfoProp
      return getBuyerInfoFromSession()
    })
    const [loadingBuyerInfo, setLoadingBuyerInfo] = useState(!buyerInfoProp)
    const [editingAddress, setEditingAddress] = useState(false)
    const [draftName, setDraftName] = useState(buyerInfo.fullName || '')
    const [draftPhone, setDraftPhone] = useState(buyerInfo.phone || '')
    const [draftProvince, setDraftProvince] = useState(buyerInfo.province || '')
const [draftProvinceCode, setDraftProvinceCode] = useState('')
const [draftWard, setDraftWard] = useState(buyerInfo.ward || '')
const [draftWardCode, setDraftWardCode] = useState('')
const [draftAddress, setDraftAddress] = useState(buyerInfo.address || '')
const [provinceOptions, setProvinceOptions] = useState<VietnamProvinceOption[]>([])
const [wardOptions, setWardOptions] = useState<VietnamWardOption[]>([])
    const [loadingAddressOptions, setLoadingAddressOptions] = useState(false)
    const [addressLoadError, setAddressLoadError] = useState('')

    // ── Payment method state ──
    const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CREDIT'>('BANK_TRANSFER')
    const [shippingQuote, setShippingQuote] = useState<BuyerShippingQuote | null>(null)
    const [shippingLoading, setShippingLoading] = useState(false)
    const [shippingError, setShippingError] = useState('')

    // ── Reset quantity when target changes ──
    useEffect(() => {
      const qty = target.minMoq && target.minMoq > 0 ? target.minMoq : 1
      setQuantity(qty.toString())
    }, [target])

    // ── Fetch buyer profile from API ──
    const fetchedRef = useRef(false)
    useEffect(() => {
      if (buyerInfoProp || fetchedRef.current) return
      fetchedRef.current = true
      setLoadingBuyerInfo(true)
      fetchCurrentUserProfile()
        .then((profile) => {
          if (!profile) return
          // Write useful fields back to sessionStorage for next time
          if (profile.fullName) sessionStorage.setItem('agribridge.auth.fullName', profile.fullName)
          if (profile.phone) sessionStorage.setItem('agribridge.auth.phone', profile.phone)
          if (profile.companyName) sessionStorage.setItem('agribridge.auth.companyName', profile.companyName)
          if (profile.province && profile.province !== 'N/A') sessionStorage.setItem('agribridge.auth.companyProvince', profile.province)
          if (profile.address && profile.address !== 'N/A') sessionStorage.setItem('agribridge.auth.companyAddress', profile.address)

          setBuyerInfo((prev) => ({
            fullName: prev.fullName || profile.fullName || null,
            companyName: prev.companyName || profile.companyName || null,
            phone: prev.phone || profile.phone || null,
            province:
              prev.province ||
              (profile.province !== 'N/A' ? profile.province : null) ||
              null,
            district: prev.district || null,
            ward: prev.ward || null,
            address:
              prev.address ||
              (profile.address !== 'N/A' ? profile.address : null) ||
              null,
          }))
        })
        .catch(() => {
          // Silently keep sessionStorage values
        })
        .finally(() => {
          setLoadingBuyerInfo(false)
        })
    }, [buyerInfoProp])

    useEffect(() => {
      let ignore = false

      async function loadProvinces() {
        setLoadingAddressOptions(true)
        setAddressLoadError('')
        try {
          const provinces = await fetchVietnamProvinces()
          if (!ignore) {
            setProvinceOptions(provinces)
          }
        } catch {
          if (!ignore) {
            setAddressLoadError('Không thể tải danh sách tỉnh/thành từ API. Dùng danh sách dự phòng.')
            setProvinceOptions([])
          }
        } finally {
          if (!ignore) {
            setLoadingAddressOptions(false)
          }
        }
      }

      void loadProvinces()
      return () => {
        ignore = true
      }
    }, [])

   

   useEffect(() => {
  let ignore = false

  async function loadWards() {
    if (!draftProvinceCode.trim()) {
      setWardOptions([])
      return
    }

    try {
      const wards = await fetchVietnamWardsByProvinceCode(Number(draftProvinceCode))
      if (!ignore) setWardOptions(wards)
    } catch {
      if (!ignore) setWardOptions([])
    }
  }

  void loadWards()
  return () => {
    ignore = true
  }
}, [draftProvinceCode])

    // ── Derived ──
    const quantityNumber = Number(quantity)
    const unitPrice = target.price ?? null
    const subtotal = unitPrice != null && quantityNumber > 0 && !Number.isNaN(quantityNumber)
      ? unitPrice * quantityNumber
      : null
    const shippingFee = shippingQuote?.estimatedShippingFee ?? null
    const estimatedTotal = subtotal != null
      ? subtotal + (shippingFee ?? 0)
      : null
    const estimatedDeliveryTime =
      shippingQuote?.estimatedDeliveryTime ||
      (shippingQuote?.estimatedDaysMin != null && shippingQuote?.estimatedDaysMax != null
        ? `${shippingQuote.estimatedDaysMin} - ${shippingQuote.estimatedDaysMax} ngày`
        : null)

    const showMoqWarning =
      target.minMoq != null && quantityNumber > 0 && quantityNumber < target.minMoq
    const showStockError =
      target.availableQuantity != null &&
      target.availableQuantity > 0 &&
      quantityNumber > 0 &&
      quantityNumber > target.availableQuantity
    const canSubmit = !showStockError && quantityNumber > 0 && !submitting

    const heroImage = useMemo(() => {
      if (!target.imageUrl) return PLACEHOLDER_IMAGE
      return resolveUploadedFileUrl(target.imageUrl) || target.imageUrl
    }, [target.imageUrl])

    const creditDueLabel = useMemo(() => {
      if (!creditLimit) return null
      const due = new Date()
      due.setDate(due.getDate() + creditLimit.paymentTermDays)
      return due.toLocaleDateString('vi-VN')
    }, [creditLimit])

    useEffect(() => {
      const hasValidQuantity = quantityNumber > 0 && !Number.isNaN(quantityNumber)
      const hasDeliveryAddress = Boolean(
        buyerInfo.province?.trim() &&
        buyerInfo.ward?.trim() &&
        buyerInfo.address?.trim(),
      )

      if (!hasValidQuantity || !hasDeliveryAddress) {
        setShippingQuote(null)
        setShippingError('')
        setShippingLoading(false)
        return
      }

      let ignore = false
      setShippingLoading(true)
      setShippingError('')

      const timeoutId = window.setTimeout(() => {
        quoteBuyerShipping({
          buyerCompanyId: target.buyerCompanyId ?? null,
          supplierId: target.supplierId ?? target.supplierCompanyId ?? null,
          productId: target.productId,
          batchId: target.batchId ?? null,
          quantity: quantityNumber,
          unit: target.unit || 'kg',
          fromProvince: target.originRegion || null,
          fromWard: null,
          fromAddress: null,
          toProvince: buyerInfo.province || null,
          toWard: buyerInfo.ward || null,
          toAddress: buyerInfo.address || null,
          weight: estimateWeightInGram(quantityNumber, target.unit),
          length: 40,
          width: 30,
          height: 30,
          insuranceValue: subtotal ?? 0,
        })
          .then((quote) => {
            if (!ignore) setShippingQuote(quote)
          })
          .catch(() => {
            if (!ignore) {
              setShippingQuote(null)
              setShippingError('Không thể tính phí vận chuyển. Vui lòng kiểm tra địa chỉ nhận hàng.')
            }
          })
          .finally(() => {
            if (!ignore) setShippingLoading(false)
          })
      }, 500)

      return () => {
        ignore = true
        window.clearTimeout(timeoutId)
      }
    }, [
      buyerInfo.address,
      buyerInfo.province,
      buyerInfo.ward,
      quantityNumber,
      subtotal,
      target.batchId,
      target.buyerCompanyId,
      target.originRegion,
      target.productId,
      target.supplierCompanyId,
      target.supplierId,
      target.unit,
    ])

    // ── Handlers ──
    const handleSaveAddress = () => {
      setBuyerInfo({
        fullName: draftName.trim() || buyerInfo.fullName,
        companyName: buyerInfo.companyName,
        phone: draftPhone.trim() || buyerInfo.phone,
        province: draftProvince.trim() || buyerInfo.province,
        ward: draftWard.trim() || buyerInfo.ward,
        address: draftAddress.trim() || buyerInfo.address,
      })
      setEditingAddress(false)
    }

    const handleCancelEdit = () => {
  setDraftName(buyerInfo.fullName || '')
  setDraftPhone(buyerInfo.phone || '')
  setDraftProvince(buyerInfo.province || '')
  setDraftProvinceCode('')
  setDraftWard(buyerInfo.ward || '')
  setDraftWardCode('')
  setDraftAddress(buyerInfo.address || '')
  setWardOptions([])
  setEditingAddress(false)
}

const handleOpenEdit = () => {
  setDraftName(buyerInfo.fullName || '')
  setDraftPhone(buyerInfo.phone || '')
  setDraftProvince(buyerInfo.province || '')
  setDraftProvinceCode('')
  setDraftWard(buyerInfo.ward || '')
  setDraftWardCode('')
  setDraftAddress(buyerInfo.address || '')
  setWardOptions([])
  setEditingAddress(true)
}

    const handleSubmit = () => {
      if (!canSubmit) return

      const payload: BuyerQuickOrderPayload = {
        buyerCompanyId: target.buyerCompanyId ?? null,
        supplierId: target.supplierId ?? target.supplierCompanyId ?? null,
        productId: target.productId,
        batchId: target.batchId ?? null,
        quantity: quantityNumber,
        unit: target.unit || 'kg',
        unitPrice,
        subtotal,
        deliveryName: buyerInfo.fullName || '',
        deliveryPhone: buyerInfo.phone || '',
        deliveryProvince: buyerInfo.province || '',
        deliveryWard: buyerInfo.ward || null,
        deliveryAddress: buyerInfo.address || '',
        paymentMethod,
        creditTermDays: paymentMethod === 'CREDIT' && creditLimit ? creditLimit.paymentTermDays : null,
        shippingFee: shippingQuote?.estimatedShippingFee ?? null,
        shippingProviderCode: shippingQuote?.providerCode ?? null,
        shippingProviderName: shippingQuote?.providerName ?? null,
        shippingServiceName: shippingQuote?.serviceName ?? null,
        estimatedDeliveryTime: shippingQuote?.estimatedDeliveryTime ?? null,
        shippingPayer: shippingQuote?.shippingPayer ?? 'BUYER',
        shippingStatus: shippingQuote ? 'QUOTED' : 'PENDING_QUOTE',
        orderStatus: 'PENDING_SUPPLIER_CONFIRMATION',
      }

      if (onSubmit) {
        void onSubmit(payload)
      }
    }

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black/50 p-3 backdrop-blur-sm">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

          {/* ── Header ── */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-700 to-teal-500 px-5 py-4">
            <div>
              <h3 className="text-xl font-extrabold text-white">Xác nhận đặt hàng</h3>
              <p className="mt-0.5 text-sm text-emerald-100/80">
                {target.productName}
                {target.batchCode ? ` · ${target.batchCode}` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/20"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Section 1: Batch info */}
            <section>
              <SectionTitle>
                <PackageCheck className="h-4 w-4 text-emerald-600" />
                Thông tin lô hàng
              </SectionTitle>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start gap-4">
                  <img
                    src={heroImage}
                    alt={target.productName}
                    className="h-20 w-20 shrink-0 rounded-xl object-cover shadow"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-base font-black text-slate-900">{target.productName}</h4>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">
                      {target.supplierName || 'Nhà cung cấp'}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                      <MiniRow label="Mã lô" value={target.batchCode || '--'} />
                      <MiniRow
                        label="Giá bán"
                        value={target.price != null ? `${formatNumber(target.price)}đ/${target.unit || ''}` : '--'}
                      />
                      <MiniRow label="MOQ" value={formatQuantity(target.minMoq, target.unit)} />
                      <MiniRow label="Tồn kho KD" value={formatQuantity(target.availableQuantity, target.unit)} />
                      <MiniRow label="Grade" value={target.grade || '--'} />
                      <MiniRow label="Size" value={target.size || '--'} />
                      <MiniRow label="Hạn sử dụng" value={formatDateLabel(target.expiryDate)} />
                      {target.originRegion ? (
                        <MiniRow label="Xuất xứ" value={target.originRegion} />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Quantity */}
            <section>
              <SectionTitle>
                <PackageCheck className="h-4 w-4 text-emerald-600" />
                Số lượng đặt
              </SectionTitle>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-semibold text-emerald-950">
                      Số lượng *
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        type="number"
                        min="0"
                        step="1"
                        className={`h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-2 ${
                          showStockError
                            ? 'border-rose-400 bg-rose-50 focus:border-rose-400 focus:ring-rose-100'
                            : 'border-emerald-200 bg-emerald-50/30 focus:border-emerald-400 focus:ring-emerald-100'
                        }`}
                        placeholder={
                          target.minMoq != null
                            ? `Tối thiểu ${formatQuantity(target.minMoq, target.unit)}`
                            : 'Nhập số lượng'
                        }
                      />
                      <span className="shrink-0 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700 border border-emerald-200">
                        {target.unit || 'kg'}
                      </span>
                    </div>
                    {showMoqWarning ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Số lượng thấp hơn MOQ {formatQuantity(target.minMoq, target.unit)}
                      </p>
                    ) : null}
                    {showStockError ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Số lượng vượt tồn kho khả dụng {formatQuantity(target.availableQuantity, target.unit)}
                      </p>
                    ) : null}
                  </div>
                  {unitPrice != null && quantityNumber > 0 && !Number.isNaN(quantityNumber) ? (
                    <div className="shrink-0 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-3 text-right border border-emerald-100">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Tiền hàng</p>
                      <p className="text-lg font-extrabold text-emerald-700">
                        {subtotal != null ? formatMoney(subtotal) : '--'}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Section 3: Delivery address */}
            <section>
              <SectionTitle>
                <MapPin className="h-4 w-4 text-emerald-600" />
                Người nhận &amp; địa chỉ giao hàng
              </SectionTitle>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                {!editingAddress ? (
                  <>
                    {loadingBuyerInfo ? (
                      <div className="flex items-center gap-2 py-1 text-xs text-slate-400">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                        Đang tải thông tin người nhận...
                      </div>
                    ) : null}
                    <div className={`grid gap-2 sm:grid-cols-2 transition-opacity ${loadingBuyerInfo ? 'opacity-50' : 'opacity-100'}`}>
                      <div className="flex items-start gap-2">
                        <User className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Người nhận</p>
                          <p className="text-sm font-bold text-slate-800">{buyerInfo.fullName || '--'}</p>
                          {buyerInfo.companyName ? (
                            <p className="text-xs text-slate-500">{buyerInfo.companyName}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Tỉnh/Khu vực
                          </p>
                          <p className="text-sm font-bold text-slate-800">{buyerInfo.province || '--'}</p>
                          {buyerInfo.district ? (
                            <p className="text-xs text-slate-500">{buyerInfo.district}</p>
                          ) : null}
                          {buyerInfo.ward ? (
                            <p className="text-xs text-slate-500">{buyerInfo.ward}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Địa chỉ chi tiết
                        </p>
                        <p className="text-sm font-semibold text-slate-700">{buyerInfo.address || '--'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">SĐT</p>
                        <p className="text-sm font-semibold text-slate-700">{buyerInfo.phone || '--'}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] italic text-slate-400">
                      Thời gian giao dự kiến sẽ được tính từ đơn vị vận chuyển dựa trên địa chỉ nhận hàng và khối
                      lượng đơn hàng.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenEdit}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Đổi địa chỉ nhận hàng
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-emerald-700">Chỉnh sửa địa chỉ nhận hàng tạm thời</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Người nhận</label>
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="h-10 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="Họ và tên"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">SĐT</label>
                        <input
                          value={draftPhone}
                          onChange={(e) => setDraftPhone(e.target.value)}
                          className="h-10 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="Số điện thoại"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Tỉnh/Khu vực</label>
                        <select
                          value={draftProvinceCode}
                          onChange={(e) => {
                            const code = e.target.value
                            const province = provinceOptions.find((item) => String(item.code) === String(code))

                            setDraftProvinceCode(code)
                            setDraftProvince(province?.name || '')
                            setDraftWard('')
                            setDraftWardCode('')
                            setWardOptions([])
                          }}
                          className="h-10 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="">Chọn tỉnh/thành</option>
                          {provinceOptions.map((province) => (
                            <option key={province.code} value={province.code}>
                              {province.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Xã / Phường</label>
                        <select
                          value={draftWardCode}
                          onChange={(e) => {
                            const code = e.target.value
                            const ward = wardOptions.find((item) => String(item.code) === String(code))

                            setDraftWardCode(code)
                            setDraftWard(ward?.name || '')
                          }}
                          disabled={!draftProvinceCode.trim()}
                          className="h-10 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          <option value="">Chọn xã/phường</option>
                          {wardOptions.map((ward) => (
                            <option key={ward.code} value={ward.code}>
                              {ward.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Địa chỉ chi tiết</label>
                        <input
                          value={draftAddress}
                          onChange={(e) => setDraftAddress(e.target.value)}
                          className="h-10 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="Số nhà, đường, phường..."
                        />
                      </div>
                    </div>
                    {loadingAddressOptions ? (
                      <p className="text-xs text-slate-500">Đang tải danh sách tỉnh/thành...</p>
                    ) : null}
                    {!loadingAddressOptions && addressLoadError ? (
                      <p className="text-xs text-slate-500">{addressLoadError}</p>
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveAddress}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95"
                      >
                        Lưu địa chỉ tạm
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95"
                      >
                        Hủy đổi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Section 4: Shipping & Payment */}
            <section>
              <SectionTitle>
                <Truck className="h-4 w-4 text-emerald-600" />
                Vận chuyển &amp; thanh toán
              </SectionTitle>

              {/* Shipping */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-3">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-slate-500">Vận chuyển</p>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <ShippingRow
                    label="Đơn vị vận chuyển"
                    value={shippingLoading ? 'Đang tính...' : shippingQuote?.providerName || 'Chờ tính'}
                  />
                  <ShippingRow label="Dịch vụ" value={shippingQuote?.serviceName || 'Chờ tính'} />
                  <ShippingRow
                    label="Phí vận chuyển"
                    value={
                      shippingLoading
                        ? 'Đang tính...'
                        : shippingFee != null
                          ? formatMoney(shippingFee)
                          : 'Chưa tính'
                    }
                  />
                  <ShippingRow
                    label="Thời gian giao dự kiến"
                    value={estimatedDeliveryTime || 'Chưa tính'}
                  />
                  <ShippingRow label="Người trả phí" value="Buyer" />
                </div>
                {shippingError ? (
                  <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                    {shippingError}
                  </p>
                ) : null}
                <p className="mt-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] italic text-slate-500">
                  Thông tin vận chuyển được tính dự kiến từ GHN sandbox/demo. Hệ thống chưa tạo vận đơn thật ở bước này.
                </p>
              </div>

              {/* Payment */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-slate-500">Thanh toán</p>
                <div className="space-y-2">
                  {/* Option: Bank Transfer */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50/50 border-slate-200">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="BANK_TRANSFER"
                      checked={paymentMethod === 'BANK_TRANSFER'}
                      onChange={() => setPaymentMethod('BANK_TRANSFER')}
                      className="mt-0.5 h-4 w-4 accent-emerald-600"
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Chuyển khoản sau khi nhà cung cấp xác nhận</p>
                      <p className="mt-0.5 text-xs text-slate-500">Thanh toán khi nhận được xác nhận đơn hàng</p>
                    </div>
                  </label>

                  {/* Option: Credit */}
                  {creditLimit && !creditLimit.isBlocked ? (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50/50 border-slate-200">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="CREDIT"
                        checked={paymentMethod === 'CREDIT'}
                        onChange={() => setPaymentMethod('CREDIT')}
                        className="mt-0.5 h-4 w-4 accent-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Công nợ {creditLimit.paymentTermDays} ngày
                        </p>
                        <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                          {creditLimit.creditLimit != null ? (
                            <p>Hạn mức công nợ: <span className="font-semibold text-slate-700">{formatMoney(creditLimit.creditLimit)}</span></p>
                          ) : null}
                          <p>
                            Ngày đến hạn dự kiến:{' '}
                            <span className="font-semibold text-slate-700">{creditDueLabel}</span>{' '}
                            ({dateAfterDays(creditLimit.paymentTermDays)})
                          </p>
                        </div>
                      </div>
                    </label>
                  ) : creditLimit?.isBlocked ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="flex items-center gap-2 text-sm font-bold text-rose-700">
                        <CreditCard className="h-4 w-4" />
                        Công nợ bị tạm khóa
                      </p>
                      {creditLimit.blockedReason ? (
                        <p className="mt-1 text-xs text-rose-600">{creditLimit.blockedReason}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Nhà cung cấp chưa cấp công nợ cho buyer này.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Section 5: Order summary */}
            <section>
              <SectionTitle>
                <PackageCheck className="h-4 w-4 text-emerald-600" />
                Tóm tắt đơn hàng
              </SectionTitle>
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 space-y-2">
                <SummaryRow
                  label="Đơn giá"
                  value={target.price != null ? `${formatNumber(target.price)}đ/${target.unit || ''}` : '--'}
                />
                <SummaryRow
                  label="Số lượng"
                  value={
                    quantityNumber > 0 && !Number.isNaN(quantityNumber)
                      ? formatQuantity(quantityNumber, target.unit)
                      : '--'
                  }
                />
                <div className="border-t border-emerald-100 pt-2">
                  <SummaryRow label="Tiền hàng" value={subtotal != null ? formatMoney(subtotal) : '--'} accent />
                </div>
                <SummaryRow label="Phí vận chuyển" value={shippingFee != null ? formatMoney(shippingFee) : 'Chưa tính'} />
                <div className="border-t border-emerald-200 pt-2">
                  <SummaryRow
                    label="Tổng tạm tính"
                    value={estimatedTotal != null ? formatMoney(estimatedTotal) : '--'}
                    accent
                  />
                </div>
                <SummaryRow
                  label="Phương thức thanh toán"
                  value={
                    paymentMethod === 'CREDIT' && creditLimit
                      ? `Công nợ ${creditLimit.paymentTermDays} ngày`
                      : 'Chuyển khoản'
                  }
                />
                <p className="pt-1 text-[11px] italic text-emerald-700/70">
                  Tổng cuối cùng có thể thay đổi sau khi phí vận chuyển được tính từ đơn vị vận chuyển.
                </p>
              </div>
            </section>
          </div>

          {/* ── Footer ── */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 active:scale-95"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:opacity-80"
            >
              <PackageCheck className="h-4 w-4" />
              {submitting ? 'Đang xử lý...' : 'Tạo đơn hàng'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  function ShippingRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">{label}</span>
        <span className="text-xs font-semibold italic text-slate-400">{value}</span>
      </div>
    )
  }

  // ─── Re-export types used by callers ──────────────────────────────────────────

  export type {
    BuyerQuickOrderBuyerInfo,
    BuyerCreditLimit,
    BuyerQuickOrderPayload,
    BuyerQuickOrderTarget,
  } from './buyerQuickOrderTypes'
