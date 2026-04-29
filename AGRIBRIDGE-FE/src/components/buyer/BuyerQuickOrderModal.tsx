  import {
    AlertCircle,
    AlertTriangle,
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
    BuyerPaymentMethod,
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

  function estimateWeightInGram(quantity: number, unit?: string | null) {
    if (!quantity || Number.isNaN(quantity)) return null
    const normalized = (unit || '').toLowerCase()
    if (normalized === 'kg') return Math.round(quantity * 1000)
    if (normalized === 'g') return Math.round(quantity)
    if (normalized === 'tấn' || normalized === 'ton') return Math.round(quantity * 1000000)
    return Math.round(quantity * 1000)
  }

  function normalizeSearchText(value?: string | null) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim()
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
      ward:
        get('agribridge.auth.companyWard') ||
        get('agribridge.auth.ward'),
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
const [, setDraftWardCode] = useState('')
const [draftAddress, setDraftAddress] = useState(buyerInfo.address || '')
const [provinceOptions, setProvinceOptions] = useState<VietnamProvinceOption[]>([])
const [wardOptions, setWardOptions] = useState<VietnamWardOption[]>([])
    const [provinceSearch, setProvinceSearch] = useState(buyerInfo.province || '')
    const [wardSearch, setWardSearch] = useState(buyerInfo.ward || '')
    const [showProvinceOptions, setShowProvinceOptions] = useState(false)
    const [showWardOptions, setShowWardOptions] = useState(false)
    const [loadingAddressOptions, setLoadingAddressOptions] = useState(false)
    const [addressLoadError, setAddressLoadError] = useState('')

    // ── Payment method state ──
    const [paymentMethod, setPaymentMethod] = useState<BuyerPaymentMethod>('ESCROW_TRANSFER')
    const [shippingQuote, setShippingQuote] = useState<BuyerShippingQuote | null>(null)
    const [shippingLoading, setShippingLoading] = useState(false)
    const [shippingError, setShippingError] = useState('')
    const inFlightShippingQuoteKeyRef = useRef('')

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
          if (profile.ward && profile.ward !== 'N/A') sessionStorage.setItem('agribridge.auth.companyWard', profile.ward)
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
            ward: prev.ward || (profile.ward !== 'N/A' ? profile.ward : null) || null,
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
    const realGhnQuote = shippingQuote?.providerCode === 'GHN' ? shippingQuote : null
    const shippingFee = realGhnQuote?.estimatedShippingFee ?? null
    const estimatedTotal = subtotal != null
      ? subtotal + (shippingFee ?? 0)
      : null
    const depositRate = 50
    const depositAmount = estimatedTotal != null ? estimatedTotal * 0.5 : null
    const balanceAmount = estimatedTotal != null && depositAmount != null ? estimatedTotal - depositAmount : null
    const remainingCredit = creditLimit?.remainingCredit ?? creditLimit?.creditLimit ?? null
    const creditDisabledReason = !creditLimit
      ? 'Nhà cung cấp chưa cấp công nợ cho buyer này.'
      : creditLimit.isBlocked
        ? creditLimit.blockedReason || 'Công nợ đang bị tạm khóa.'
        : estimatedTotal != null && remainingCredit != null && estimatedTotal > remainingCredit
          ? 'Không đủ hạn mức công nợ.'
          : ''
    const isCreditDisabled = Boolean(creditDisabledReason)
    const paymentMethodLabel =
      paymentMethod === 'DEPOSIT_50'
        ? 'Đặt cọc 50%'
        : paymentMethod === 'CREDIT'
          ? creditLimit
            ? `Công nợ ${creditLimit.paymentTermDays} ngày`
            : 'Công nợ'
          : 'Chuyển khoản qua sàn'
    const estimatedDeliveryTime =
      realGhnQuote?.estimatedDeliveryTime ||
      (realGhnQuote?.estimatedDaysMin != null && realGhnQuote?.estimatedDaysMax != null
        ? `${realGhnQuote.estimatedDaysMin} - ${realGhnQuote.estimatedDaysMax} ngày`
        : null)

    const filteredProvinceOptions = useMemo(() => {
      const query = normalizeSearchText(provinceSearch)
      if (!query) return provinceOptions
      return provinceOptions.filter((province) => normalizeSearchText(province.name).includes(query))
    }, [provinceOptions, provinceSearch])
    const filteredWardOptions = useMemo(() => {
      const query = normalizeSearchText(wardSearch)
      if (!query) return wardOptions
      return wardOptions.filter((ward) => normalizeSearchText(ward.name).includes(query))
    }, [wardOptions, wardSearch])

    const showMoqWarning =
      target.minMoq != null && quantityNumber > 0 && quantityNumber < target.minMoq
    const showStockError =
      target.availableQuantity != null &&
      target.availableQuantity > 0 &&
      quantityNumber > 0 &&
      quantityNumber > target.availableQuantity
    const canSubmit =
      !showStockError &&
      quantityNumber > 0 &&
      !submitting &&
      !(paymentMethod === 'CREDIT' && isCreditDisabled)

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

      if (!hasValidQuantity || !hasDeliveryAddress || subtotal == null) {
        setShippingQuote(null)
        setShippingError('')
        setShippingLoading(false)
        inFlightShippingQuoteKeyRef.current = ''
        return
      }

      const shippingQuoteKey = JSON.stringify({
        quantity: quantityNumber,
        province: buyerInfo.province,
        ward: buyerInfo.ward,
        address: buyerInfo.address,
        productId: target.productId,
        batchId: target.batchId ?? null,
        subtotal,
      })
      if (inFlightShippingQuoteKeyRef.current === shippingQuoteKey) {
        return
      }

      let ignore = false
      inFlightShippingQuoteKeyRef.current = shippingQuoteKey
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
            if (!ignore) {
              if (quote.providerCode === 'GHN') {
                setShippingQuote(quote)
              } else {
                setShippingQuote(null)
                setShippingError('Không thể tính phí vận chuyển từ GHN. Vui lòng kiểm tra địa chỉ hoặc cấu hình GHN.')
              }
            }
          })
          .catch((error) => {
            if (!ignore) {
              setShippingQuote(null)
              setShippingError(
                error instanceof Error && error.message
                  ? error.message
                  : 'Không thể tính phí vận chuyển từ GHN. Vui lòng kiểm tra địa chỉ hoặc cấu hình GHN.',
              )
            }
          })
          .finally(() => {
            if (inFlightShippingQuoteKeyRef.current === shippingQuoteKey) {
              inFlightShippingQuoteKeyRef.current = ''
            }
            if (!ignore) setShippingLoading(false)
          })
      }, 500)

      return () => {
        ignore = true
        window.clearTimeout(timeoutId)
        if (inFlightShippingQuoteKeyRef.current === shippingQuoteKey) {
          inFlightShippingQuoteKeyRef.current = ''
        }
      }
    }, [
      buyerInfo.address,
      buyerInfo.province,
      buyerInfo.ward,
      quantityNumber,
      subtotal,
      target.batchId,
      target.buyerCompanyId,
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
  setProvinceSearch(buyerInfo.province || '')
  setDraftProvinceCode('')
  setDraftWard(buyerInfo.ward || '')
  setWardSearch(buyerInfo.ward || '')
  setDraftWardCode('')
  setDraftAddress(buyerInfo.address || '')
  setWardOptions([])
  setShowProvinceOptions(false)
  setShowWardOptions(false)
  setEditingAddress(false)
}

const handleOpenEdit = () => {
  setDraftName(buyerInfo.fullName || '')
  setDraftPhone(buyerInfo.phone || '')
  setDraftProvince(buyerInfo.province || '')
  setProvinceSearch(buyerInfo.province || '')
  setDraftProvinceCode('')
  setDraftWard(buyerInfo.ward || '')
  setWardSearch(buyerInfo.ward || '')
  setDraftWardCode('')
  setDraftAddress(buyerInfo.address || '')
  setWardOptions([])
  setShowProvinceOptions(false)
  setShowWardOptions(false)
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
        depositRate: paymentMethod === 'DEPOSIT_50' ? depositRate : null,
        depositAmount: paymentMethod === 'DEPOSIT_50' ? depositAmount : null,
        balanceAmount: paymentMethod === 'DEPOSIT_50' ? balanceAmount : null,
        creditTermDays: paymentMethod === 'CREDIT' && creditLimit ? creditLimit.paymentTermDays : null,
        shippingFee: realGhnQuote?.estimatedShippingFee ?? null,
        shippingProviderCode: realGhnQuote?.providerCode ?? null,
        shippingProviderName: realGhnQuote?.providerName ?? null,
        shippingServiceName: realGhnQuote?.serviceName ?? null,
        estimatedDeliveryTime: realGhnQuote?.estimatedDeliveryTime ?? null,
        shippingPayer: realGhnQuote?.shippingPayer ?? 'BUYER',
        shippingStatus: realGhnQuote ? 'QUOTED' : 'PENDING_QUOTE',
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
                          {buyerInfo.ward ? (
                            <p className="text-xs text-slate-500">{buyerInfo.ward}</p>
                          ) : (
                            <p className="text-xs font-semibold text-amber-600">Thiếu xã/phường, vui lòng cập nhật địa chỉ nhận hàng.</p>
                          )}
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
                        <div className="relative">
                          <input
                            value={provinceSearch || draftProvince}
                            onFocus={() => {
                              setProvinceSearch('')
                              setShowProvinceOptions(true)
                            }}
                            onBlur={() => window.setTimeout(() => setShowProvinceOptions(false), 150)}
                            onChange={(e) => {
                              setProvinceSearch(e.target.value)
                              setShowProvinceOptions(true)
                            }}
                            className="h-10 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Chọn hoặc tìm tỉnh/thành"
                          />
                          {showProvinceOptions ? (
                            <div className="absolute z-30 mt-1 max-h-[220px] w-full overflow-y-auto rounded-lg border border-emerald-100 bg-white py-1 text-sm shadow-lg">
                              {filteredProvinceOptions.length > 0 ? (
                                filteredProvinceOptions.map((province) => (
                                  <button
                                    key={province.code}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      setDraftProvinceCode(String(province.code))
                                      setDraftProvince(province.name)
                                      setProvinceSearch(province.name)
                                      setDraftWard('')
                                      setDraftWardCode('')
                                      setWardSearch('')
                                      setWardOptions([])
                                      setShowProvinceOptions(false)
                                    }}
                                    className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-emerald-50"
                                  >
                                    {province.name}
                                  </button>
                                ))
                              ) : (
                                <p className="px-3 py-2 text-slate-400">Không tìm thấy</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Xã / Phường</label>
                        <div className="relative">
                          <input
                            value={wardSearch || draftWard}
                            disabled={!draftProvinceCode.trim()}
                            onFocus={() => {
                              setWardSearch('')
                              setShowWardOptions(true)
                            }}
                            onBlur={() => window.setTimeout(() => setShowWardOptions(false), 150)}
                            onChange={(e) => {
                              setWardSearch(e.target.value)
                              setShowWardOptions(true)
                            }}
                            className="h-10 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                            placeholder={draftProvinceCode.trim() ? 'Chọn hoặc tìm xã/phường' : 'Chọn tỉnh trước'}
                          />
                          {showWardOptions && draftProvinceCode.trim() ? (
                            <div className="absolute z-30 mt-1 max-h-[220px] w-full overflow-y-auto rounded-lg border border-emerald-100 bg-white py-1 text-sm shadow-lg">
                              {filteredWardOptions.length > 0 ? (
                                filteredWardOptions.map((ward) => (
                                  <button
                                    key={ward.code}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      setDraftWardCode(String(ward.code))
                                      setDraftWard(ward.name)
                                      setWardSearch(ward.name)
                                      setShowWardOptions(false)
                                    }}
                                    className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-emerald-50"
                                  >
                                    {ward.name}
                                  </button>
                                ))
                              ) : (
                                <p className="px-3 py-2 text-slate-400">Không tìm thấy</p>
                              )}
                            </div>
                          ) : null}
                        </div>
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
                    value={shippingLoading ? 'Đang tính...' : realGhnQuote?.providerName || 'Chờ tính'}
                  />
                  <ShippingRow label="Dịch vụ" value={realGhnQuote?.serviceName || 'Chờ tính'} />
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
                  Thông tin vận chuyển được tính dự kiến từ GHN sandbox. Hệ thống chưa tạo vận đơn thật ở bước này.
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
                      value="ESCROW_TRANSFER"
                      checked={paymentMethod === 'ESCROW_TRANSFER'}
                      onChange={() => setPaymentMethod('ESCROW_TRANSFER')}
                      className="mt-0.5 h-4 w-4 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">Chuyển khoản qua sàn</p>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Khuyến nghị</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">Sàn tạm giữ thanh toán và chỉ giải ngân cho nhà cung cấp sau khi đơn hàng hoàn tất.</p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50/50 border-slate-200">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="DEPOSIT_50"
                      checked={paymentMethod === 'DEPOSIT_50'}
                      onChange={() => setPaymentMethod('DEPOSIT_50')}
                      className="mt-0.5 h-4 w-4 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">Đặt cọc 50%</p>
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-700">Giảm rủi ro</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">Đặt cọc 50% qua sàn. Phần còn lại thanh toán trước khi nhận hàng hoặc khi đơn sẵn sàng giao.</p>
                      {paymentMethod === 'DEPOSIT_50' ? (
                        <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                          <p>Tiền cọc 50%: <span className="font-bold text-slate-800">{formatMoney(depositAmount)}</span></p>
                          <p>Còn lại: <span className="font-bold text-slate-800">{formatMoney(balanceAmount)}</span></p>
                        </div>
                      ) : null}
                    </div>
                  </label>

                  {/* Option: Credit */}
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                      isCreditDisabled
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-75'
                        : 'cursor-pointer border-slate-200 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="CREDIT"
                      checked={paymentMethod === 'CREDIT'}
                      onChange={() => setPaymentMethod('CREDIT')}
                      disabled={isCreditDisabled}
                      className="mt-0.5 h-4 w-4 accent-emerald-600 disabled:cursor-not-allowed"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">Công nợ</p>
                        {creditLimit && !isCreditDisabled ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                            Công nợ {creditLimit.paymentTermDays} ngày
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">Thanh toán sau theo hạn mức được cấp.</p>
                      {isCreditDisabled ? (
                        <p className="mt-1 text-xs font-semibold text-rose-600">{creditDisabledReason}</p>
                      ) : creditLimit ? (
                        <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                          {remainingCredit != null ? (
                            <p>
                              Hạn mức còn lại:{' '}
                              <span className="font-semibold text-slate-700">{formatMoney(remainingCredit)}</span>
                            </p>
                          ) : null}
                          <p>
                            Kỳ hạn:{' '}
                            <span className="font-semibold text-slate-700">{creditLimit.paymentTermDays} ngày</span>
                            {creditDueLabel ? ` · Dự kiến ${creditDueLabel}` : ''}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </label>
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
                    label="Tổng thanh toán"
                    value={estimatedTotal != null ? formatMoney(estimatedTotal) : '--'}
                    accent
                  />
                </div>
                {paymentMethod === 'DEPOSIT_50' ? (
                  <>
                    <SummaryRow label="Tiền cọc 50%" value={depositAmount != null ? formatMoney(depositAmount) : '--'} />
                    <SummaryRow label="Còn lại" value={balanceAmount != null ? formatMoney(balanceAmount) : '--'} />
                  </>
                ) : null}
                <SummaryRow
                  label="Phương thức thanh toán"
                  value={paymentMethodLabel}
                />
                <p className="pt-1 text-[11px] italic text-emerald-700/70">
                  Khoản thanh toán được chuyển vào tài khoản sàn và được tạm giữ cho đến khi đơn hàng hoàn tất.
                </p>
                {paymentMethod === 'DEPOSIT_50' ? (
                  <p className="text-[11px] italic text-emerald-700/70">
                    Bạn chỉ cần thanh toán trước 50% sau khi tạo đơn. Phần còn lại sẽ được thanh toán theo yêu cầu của nhà cung cấp hoặc trước khi nhận hàng.
                  </p>
                ) : null}
                {paymentMethod === 'CREDIT' ? (
                  <p className="text-[11px] italic text-emerald-700/70">
                    Đơn hàng sử dụng công nợ sẽ được theo dõi hạn thanh toán theo kỳ hạn đã cấp.
                  </p>
                ) : null}
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
