import { CreditCard, Landmark, QrCode, X } from 'lucide-react'
import type { BuyerPaymentMethod } from './buyerQuickOrderTypes'

export type BuyerPaymentInstructionModalProps = {
  open: boolean
  orderCode?: string | null
  paymentMethod: BuyerPaymentMethod
  totalAmount?: number | null
  depositAmount?: number | null
  balanceAmount?: number | null
  transferContent?: string | null
  payableAmount?: number | null
  onClose: () => void
  onDemoPaid?: () => void
}

function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

export function BuyerPaymentInstructionModal({
  open,
  orderCode,
  paymentMethod,
  totalAmount,
  depositAmount,
  balanceAmount,
  transferContent: backendTransferContent,
  payableAmount,
  onClose,
  onDemoPaid,
}: BuyerPaymentInstructionModalProps) {
  if (!open) return null

  const isDeposit = paymentMethod === 'DEPOSIT_50'
  const isCredit = paymentMethod === 'CREDIT'
  const orderNumber = String(orderCode || '').replace(/\D/g, '') || 'DEMO'
  const transferContent = backendTransferContent || (isDeposit ? `AGRI-DEPOSIT-${orderNumber}` : `AGRI-ORDER-${orderNumber}`)
  const upfrontAmount = payableAmount ?? (isDeposit ? depositAmount : totalAmount)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Thông tin thanh toán</h3>
            <p className="mt-0.5 text-xs text-slate-500">Demo thanh toán qua tài khoản sàn</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
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
                  <span className="font-semibold">DEMO BANK</span>
                  <span className="text-slate-500">Số tài khoản</span>
                  <span className="font-semibold">123456789</span>
                  <span className="text-slate-500">Chủ tài khoản</span>
                  <span className="font-semibold">AGRIBRIDGE PLATFORM</span>
                  <span className="text-slate-500">Nội dung</span>
                  <span className="font-semibold">{transferContent}</span>
                  <span className="text-slate-500">{isDeposit ? 'Tiền cọc cần chuyển' : 'Số tiền cần chuyển'}</span>
                  <span className="font-bold text-emerald-700">
                    {formatMoney(upfrontAmount)}
                  </span>
                  {isDeposit ? (
                    <>
                      <span className="text-slate-500">Còn lại</span>
                      <span className="font-semibold">{formatMoney(balanceAmount)}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 p-4">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <QrCode className="h-10 w-10 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">QR thanh toán demo</p>
                  <p className="mt-1 text-xs text-slate-500">Trạng thái: Chờ thanh toán</p>
                </div>
              </div>
            </>
          )}

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-slate-500">
            Trong bản demo, nút này mô phỏng bước xác nhận thanh toán. Sau này có thể thay bằng MoMo sandbox hoặc webhook thanh toán thật.
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Đóng
            </button>
            {!isCredit ? (
              <button type="button" onClick={onDemoPaid} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                [Demo] Xác nhận đã thanh toán
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
