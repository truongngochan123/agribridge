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
import { useEffect, useMemo, useState } from 'react'
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
  const [editingAddress, setEditingAddress] = useState(false)
  const [draftName, setDraftName] = useState(buyerInfo.fullName || '')
  const [draftPhone, setDraftPhone] = useState(buyerInfo.phone || '')
  const [draftProvince, setDraftProvince] = useState(buyerInfo.province || '')
  const [draftAddress, setDraftAddress] = useState(buyerInfo.address || '')

  // ── Payment method state ──
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CREDIT'>('BANK_TRANSFER')

  useEffect(() => {
    const qty = target.minMoq && target.minMoq > 0 ? target.minMoq : 1
    setQuantity(qty.toString())
  }, [target])

  // ── Derived ──
  const quantityNumber = Number(quantity)
  const unitPrice = target.price ?? null
  const subtotal = unitPrice != null && quantityNumber > 0 && !Number.isNaN(quantityNumber)
    ? unitPrice * quantityNumber
    : null

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

  // ── Handlers ──
  const handleSaveAddress = () => {
    setBuyerInfo({
      fullName: draftName.trim() || buyerInfo.fullName,
      companyName: buyerInfo.companyName,
      phone: draftPhone.trim() || buyerInfo.phone,
      province: draftProvince.trim() || buyerInfo.province,
      address: draftAddress.trim() || buyerInfo.address,
    })
    setEditingAddress(false)
  }

  const handleCancelEdit = () => {
    setDraftName(buyerInfo.fullName || '')
    setDraftPhone(buyerInfo.phone || '')
    setDraftProvince(buyerInfo.province || '')
    setDraftAddress(buyerInfo.address || '')
    setEditingAddress(false)
  }

  const handleOpenEdit = () => {
    setDraftName(buyerInfo.fullName || '')
    setDraftPhone(buyerInfo.phone || '')
    setDraftProvince(buyerInfo.province || '')
    setDraftAddress(buyerInfo.address || '')
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
      deliveryAddress: buyerInfo.address || '',
      paymentMethod,
      creditTermDays: paymentMethod === 'CREDIT' && creditLimit ? creditLimit.paymentTermDays : null,
      shippingFee: null,
      shippingStatus: 'PENDING_QUOTE',
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
                  <div className="grid gap-2 sm:grid-cols-2">
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
                      <input
                        value={draftProvince}
                        onChange={(e) => setDraftProvince(e.target.value)}
                        className="h-10 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Tỉnh/khu vực"
                      />
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
                <ShippingRow label="Đơn vị vận chuyển" value="Chờ tính" />
                <ShippingRow label="Dịch vụ" value="Chờ tính" />
                <ShippingRow label="Phí vận chuyển" value="Chưa tính" />
                <ShippingRow label="Thời gian giao dự kiến" value="Chưa tính" />
                <ShippingRow label="Người trả phí" value="Buyer" />
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] italic text-slate-500">
                Phí vận chuyển và thời gian giao dự kiến sẽ được tính từ đơn vị vận chuyển sau khi hệ thống
                tích hợp API vận chuyển.
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
              <SummaryRow label="Phí vận chuyển" value="Chưa tính" />
              <div className="border-t border-emerald-200 pt-2">
                <SummaryRow
                  label="Tổng tạm tính"
                  value={subtotal != null ? formatMoney(subtotal) : '--'}
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
