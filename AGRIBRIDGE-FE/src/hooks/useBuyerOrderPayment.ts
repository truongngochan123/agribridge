import { useCallback, useState } from 'react'
import { createMomoPayment, createMomoRemainingPayment, type MomoPaymentResponse } from '../services/buyerOrderService'
import { useToast } from './useToast'

type PaymentMode = 'full' | 'remaining'

type ConfirmPaymentArgs = {
  orderId: number
  paymentId?: number | null
  mode?: PaymentMode
  successMessage?: string
}

export function useBuyerOrderPayment() {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)

  const confirmPayment = useCallback(async ({ orderId, paymentId, mode = 'full', successMessage }: ConfirmPaymentArgs) => {
    if (!orderId) return null
    setConfirming(true)
    try {
      const payment: MomoPaymentResponse | null = mode === 'remaining'
        ? await createMomoRemainingPayment(orderId)
        : paymentId
          ? await createMomoPayment(paymentId)
          : null
      if (payment?.status === 'PAID') {
        showToast('MoMo da xac nhan thanh toan. Don hang dang duoc cap nhat.', 'success')
        return payment
      }
      if (!payment?.payUrl) throw new Error('MOMO_PAY_URL_MISSING')
      showToast(successMessage || 'Dang chuyen sang MoMo de thanh toan. Sau khi MoMo xac nhan, san se tam giu tien.', 'success')
      window.location.href = payment.payUrl
      return payment
    } catch {
      showToast('Khong the tao thanh toan MoMo. Vui long thu lai.', 'error')
      return null
    } finally {
      setConfirming(false)
    }
  }, [showToast])

  return { confirmPayment, confirming }
}
