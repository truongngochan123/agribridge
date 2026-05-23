import { CreditCard, Landmark, X } from 'lucide-react'
import type { BuyerPaymentMethod } from './buyerQuickOrderTypes'

export type BuyerPaymentInstructionModalProps = {
  open: boolean
  title?: string
  description?: string
  invoiceCode?: string | null
  orderCode?: string | null
  supplierName?: string | null
  productName?: string | null
  quantity?: number | null
  unit?: string | null
  subtotal?: number | null
  shippingFee?: number | null
  creditTermDays?: number | null
  paymentMethod: BuyerPaymentMethod
  totalAmount?: number | null
  depositAmount?: number | null
  balanceAmount?: number | null
  paidAmount?: number | null
  transferContent?: string | null
  payableAmount?: number | null
  mode?: 'order' | 'debt'
  onClose: () => void
  onDemoPaid?: () => void
  submitting?: boolean
}

function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function paymentMethodLabel(method: BuyerPaymentMethod, creditTermDays?: number | null) {
  if (method === 'DEPOSIT_50') return 'Đặt cọc 50%'
  if (method === 'CREDIT') return creditTermDays ? `Công nợ ${creditTermDays} ngày` : 'Công nợ'
  return 'Chuyển khoản qua sàn'
}

export function BuyerPaymentInstructionModal({
  open,
  title,
  description,
  invoiceCode,
  orderCode,
  supplierName,
  productName,
  quantity,
  unit,
  subtotal,
  shippingFee,
  creditTermDays,
  paymentMethod,
  totalAmount,
  depositAmount,
  balanceAmount,
  paidAmount,
  transferContent: backendTransferContent,
  payableAmount,
  mode = 'order',
  onClose,
  onDemoPaid,
  submitting = false,
}: BuyerPaymentInstructionModalProps) {
  if (!open) return null

  const isDeposit = paymentMethod === 'DEPOSIT_50'
  const isDebt = mode === 'debt'
  const isCredit = paymentMethod === 'CREDIT' && !isDebt
  const isOrder = mode === 'order'
  const paymentRef = invoiceCode || orderCode
  const orderNumber = String(paymentRef || '').replace(/\D/g, '') || 'DEMO'
  const transferContent =
    backendTransferContent ||
    (isDebt ? `AGRI-DEBT-${invoiceCode || orderNumber}` : isDeposit ? `AGRI-DEPOSIT-${orderNumber}` : `AGRI-ORDER-${orderNumber}`)
  const upfrontAmount = payableAmount ?? (isDeposit ? depositAmount : totalAmount)
  const unitLabel = unit || ''

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 sm:p-5 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-h-[calc(100vh-2.5rem)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">{title || 'Thông tin thanh toán'}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{description || 'Thanh toán qua tài khoản sàn'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3.5 p-4">
          {isDebt ? (
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <span className="text-slate-500">Mã hóa đơn</span>
              <span className="font-semibold">{invoiceCode || '--'}</span>
              <span className="text-slate-500">Mã đơn hàng</span>
              <span className="font-semibold">{orderCode || '--'}</span>
              <span className="text-slate-500">Nhà cung cấp</span>
              <span className="font-semibold">{supplierName || '--'}</span>
              <span className="text-slate-500">Tổng hóa đơn</span>
              <span className="font-semibold">{formatMoney(totalAmount)}</span>
              <span className="text-slate-500">Đã thanh toán</span>
              <span className="font-semibold text-emerald-700">{formatMoney(paidAmount)}</span>
              <span className="text-slate-500">Còn phải trả</span>
              <span className="font-bold text-rose-600">{formatMoney(balanceAmount)}</span>
            </div>
          ) : null}

          {isOrder && !isCredit ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="grid gap-2 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Mã đơn hàng</span>
                  <span className="font-bold text-emerald-700">{orderCode || '--'}</span>
                </div>
                {productName ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Sản phẩm</span>
                    <span className="text-right font-semibold">{productName}</span>
                  </div>
                ) : null}
                {quantity ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Số lượng</span>
                    <span className="font-semibold">{quantity} {unitLabel}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Tiền hàng</span>
                  <span className="font-semibold">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Phí vận chuyển</span>
                  <span className="font-semibold">{formatMoney(shippingFee)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Tổng cần thanh toán</span>
                  <span className="font-bold text-emerald-700">{formatMoney(totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Phương thức thanh toán</span>
                  <span className="text-right font-semibold">{paymentMethodLabel(paymentMethod, creditTermDays)}</span>
                </div>
              </div>
            </div>
          ) : null}

          {isCredit ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CreditCard className="h-4 w-4" />
                Đơn hàng sử dụng công nợ. Không cần thanh toán ngay.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <Landmark className="h-4 w-4" />
                  Tài khoản nhận thanh toán
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <span className="text-slate-500">Ngân hàng</span>
                  <span className="font-semibold">MoMo ATM</span>
                  <span className="text-slate-500">Số tài khoản</span>
                  <span className="font-semibold">AGRIBRIDGE ESCROW</span>
                  <span className="text-slate-500">Chủ tài khoản</span>
                  <span className="font-semibold">AGRIBRIDGE PLATFORM</span>
                  <span className="text-slate-500">Nội dung</span>
                  <span className="font-semibold break-words">{transferContent}</span>
                  <span className="text-slate-500">{isDebt ? 'Số tiền cần thanh toán' : isDeposit ? 'Tiền cọc cần chuyển' : 'Số tiền cần chuyển'}</span>
                  <span className="font-bold text-emerald-700">{formatMoney(upfrontAmount)}</span>
                  {isDeposit && !isDebt ? (
                    <>
                      <span className="text-slate-500">Còn lại</span>
                      <span className="font-semibold">{formatMoney(balanceAmount)}</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3.5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <QrCode className="h-10 w-10 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">QR thanh toán demo</p>
                  <p className="mt-1 text-xs text-slate-500">Trạng thái: Chờ thanh toán</p>
                  {isDebt ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Sau khi xác nhận, hệ thống sẽ ghi nhận hóa đơn đã thanh toán và thông báo cho nhà cung cấp.
                    </p>
                  ) : null}
                </div>
              </div> */}
            </>
          )}

          {!isCredit ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onDemoPaid}
                disabled={submitting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? 'Đang xác nhận...' : 'Xác nhận đã thanh toán'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
