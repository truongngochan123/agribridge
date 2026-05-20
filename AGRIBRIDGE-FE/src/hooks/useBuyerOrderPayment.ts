import { useCallback, useState } from 'react'
import { demoConfirmBuyerOrderPayment, demoPayBuyerOrderRemaining, type BuyerOrder } from '../services/buyerOrderService'
import { useToast } from './useToast'

type PaymentMode = 'full' | 'remaining'

type ConfirmPaymentArgs = {
  orderId: number
  mode?: PaymentMode
  successMessage?: string
}

export function useBuyerOrderPayment() {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)

  const confirmPayment = useCallback(async ({ orderId, mode = 'full', successMessage }: ConfirmPaymentArgs) => {
    if (!orderId) return null
    setConfirming(true)
    try {
      const updated: BuyerOrder =
        mode === 'remaining'
          ? await demoPayBuyerOrderRemaining(orderId)
          : await demoConfirmBuyerOrderPayment(orderId)
      showToast(
        successMessage ||
          'Thanh toán đã được ghi nhận. Sàn đang tạm giữ tiền và đơn hàng đang chờ nhà cung cấp xác nhận.',
        'success',
      )
      return updated
    } catch (error) {
      showToast('Không thể ghi nhận thanh toán. Vui lòng thử lại.', 'error')
      return null
    } finally {
      setConfirming(false)
    }
  }, [showToast])

  return { confirmPayment, confirming }
}
