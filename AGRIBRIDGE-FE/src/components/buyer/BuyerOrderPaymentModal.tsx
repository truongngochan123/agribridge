import { CalendarDays, CheckCircle2, CreditCard, Eye, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { BuyerPaymentInstructionModal } from './BuyerPaymentInstructionModal'
import type { BuyerPaymentMethod } from './buyerQuickOrderTypes'

export type BuyerOrderPaymentModalProps = {
  open: boolean
  orderCode: string
  productName: string
  supplierName?: string | null
  quantity: number
  unit?: string | null
  subtotal?: number | null
  shippingFee?: number | null
  totalAmount?: number | null
  paymentMethod: BuyerPaymentMethod
  creditTermDays?: number | null
  creditLimit?: number | null
  remainingCreditAfterOrder?: number | null
  paymentDueDate?: string | null
  orderStatus?: string | null
  transferContent?: string | null
  onViewOrder?: () => void
  onClose: () => void
  onConfirmPaid: () => void
  confirming?: boolean
}

function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '--'
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
}

function formatDate(value?: string | null) {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function dueDateFromTerm(termDays?: number | null) {
  if (!termDays) return null
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + termDays)
  return dueDate.toISOString()
}

function orderStatusLabel(status?: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'PENDING' || normalized === 'PENDING_PAYMENT' || normalized === 'PENDING_CONFIRMATION') return 'Đang chờ giao hàng'
  if (normalized === 'CONFIRMED') return 'Đã xác nhận'
  if (normalized === 'PROCESSING' || normalized === 'PREPARING') return 'Đang chuẩn bị hàng'
  if (normalized === 'SHIPPING' || normalized === 'IN_TRANSIT') return 'Đang giao hàng'
  if (normalized === 'WAITING_BUYER_CONFIRM') return 'Chờ xác nhận nhận hàng'
  if (normalized === 'COMPLETED' || normalized === 'DELIVERED') return 'Hoàn tất'
  if (normalized === 'CANCELLED') return 'Đã hủy'
  return status || 'Đang chờ giao hàng'
}

function CreditSummaryRow({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: ReactNode
  emphasis?: boolean
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-start">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-sm ${emphasis ? 'font-extrabold text-slate-950' : 'font-bold text-slate-800'}`}>{value}</dd>
    </div>
  )
}

export function BuyerOrderPaymentModal({
  open,
  orderCode,
  productName,
  supplierName,
  quantity,
  unit,
  subtotal,
  shippingFee,
  totalAmount,
  paymentMethod,
  creditTermDays,
  creditLimit,
  remainingCreditAfterOrder,
  paymentDueDate,
  orderStatus,
  transferContent,
  onViewOrder,
  onClose,
  onConfirmPaid,
  confirming = false,
}: BuyerOrderPaymentModalProps) {
  const total = totalAmount ?? (subtotal ?? 0) + (shippingFee ?? 0)

  if (!open) return null

  if (paymentMethod === 'CREDIT') {
    const resolvedDueDate = paymentDueDate || dueDateFromTerm(creditTermDays)
    const creditLimitText =
      remainingCreditAfterOrder != null || creditLimit != null
        ? `${formatMoney(remainingCreditAfterOrder)} / ${formatMoney(creditLimit)}`
        : '--'

    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:p-5">
        <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Ghi nhận giao dịch
              </div>
              <h3 className="text-xl font-extrabold text-slate-950">Đơn hàng công nợ đã được tạo</h3>
              <p className="mt-1 text-sm text-slate-500">Đơn hàng đã được ghi nhận theo hình thức công nợ.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 px-5 py-5">
            <dl className="space-y-3.5">
              <CreditSummaryRow label="Mã đơn" value={orderCode || '--'} />
              <CreditSummaryRow label="Nhà cung cấp" value={supplierName || '--'} />
              <CreditSummaryRow label="Hình thức" value={creditTermDays ? `Công nợ ${creditTermDays} ngày` : 'Công nợ'} />
              <CreditSummaryRow label="Giá trị đơn" value={formatMoney(total)} emphasis />
              <CreditSummaryRow
                label="Hạn thanh toán"
                value={
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 font-extrabold text-amber-700">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(resolvedDueDate)}
                  </span>
                }
              />
            </dl>

            <div className="h-px bg-slate-200" />

            <dl className="space-y-3.5">
              <CreditSummaryRow label="Hạn mức còn lại" value={creditLimitText} emphasis />
              <CreditSummaryRow
                label="Trạng thái"
                value={
                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700">
                    {orderStatusLabel(orderStatus)}
                  </span>
                }
              />
            </dl>

            <div className="h-px bg-slate-200" />

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="text-sm text-slate-600">
                <p className="font-bold text-slate-900">Bạn không cần thanh toán ngay.</p>
                <p className="mt-1">Khoản công nợ sẽ được thanh toán theo kỳ hạn đã cấp.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onViewOrder || onClose}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-95"
              >
                <Eye className="h-4 w-4" />
                Xem đơn hàng
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <BuyerPaymentInstructionModal
      open={open}
      title="Thanh toán đơn hàng"
      description="Thanh toán qua tài khoản sàn"
      orderCode={orderCode}
      productName={productName}
      quantity={quantity}
      unit={unit}
      subtotal={subtotal}
      shippingFee={shippingFee}
      totalAmount={total}
      payableAmount={total}
      paymentMethod={paymentMethod}
      creditTermDays={creditTermDays}
      transferContent={transferContent}
      mode="order"
      onClose={onClose}
      onDemoPaid={onConfirmPaid}
      submitting={confirming}
    />
  )
}
