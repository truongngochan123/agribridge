import { BuyerPaymentInstructionModal } from './BuyerPaymentInstructionModal'
import type { BuyerPaymentMethod } from './buyerQuickOrderTypes'

export type BuyerOrderPaymentModalProps = {
  open: boolean
  orderCode: string
  productName: string
  quantity: number
  unit?: string | null
  subtotal?: number | null
  shippingFee?: number | null
  totalAmount?: number | null
  paymentMethod: BuyerPaymentMethod
  creditTermDays?: number | null
  transferContent?: string | null
  onClose: () => void
  onConfirmPaid: () => void
  confirming?: boolean
}

export function BuyerOrderPaymentModal({
  open,
  orderCode,
  productName,
  quantity,
  unit,
  subtotal,
  shippingFee,
  totalAmount,
  paymentMethod,
  creditTermDays,
  transferContent,
  onClose,
  onConfirmPaid,
  confirming = false,
}: BuyerOrderPaymentModalProps) {
  const total = totalAmount ?? (subtotal ?? 0) + (shippingFee ?? 0)

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
