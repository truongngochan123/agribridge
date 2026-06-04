import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  MapPin,
  Package,
  Phone,
  Printer,
  Receipt,
  ShieldAlert,
  Truck,
  UserRound,
  Warehouse,
  X,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OrdersSkeletonLoader } from '../../components/buyer/BuyerSkeletons'
import { useSearchParams } from 'react-router-dom'
import { BuyerPanel, SearchInput } from '../../components/buyer/BuyerCommon'
import { AlertTriangle } from 'lucide-react'
import { BuyerOrderPaymentModal } from '../../components/buyer/BuyerOrderPaymentModal'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useNotificationModuleRefresh } from '../../hooks/useNotificationModuleRefresh'
import type { BuyerPaymentMethod } from '../../components/buyer/buyerQuickOrderTypes'
import { useBuyerOrderPayment } from '../../hooks/useBuyerOrderPayment'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  confirmBuyerOrderReceived,
  confirmMomoReturn,
  createBuyerOrderComplaint,
  fetchBuyerOrder,
  fetchBuyerOrders,
  type BuyerOrder,
  type BuyerOrderPayment,
} from '../../services/buyerOrderService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'
import { getBranchContextFromSearchParams, matchesBranchContext } from '../../utils/branchContext'

const windows1252ByteMap: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
}

function normalizeVietnameseText(value?: string | number | null) {
  if (value == null) return ''
  const text = String(value).normalize('NFC')
  if (!/[\u00c2-\u00c4\u00c6-\u00cf\u00e1\u00e2\u00e3\u00e8-\u00ef\u00f2-\u00f5\u00f9-\u00fd\u2018-\u201d\u2022\ufffd]/.test(text)) return text
  if (text.includes('\ufffd')) return text

  const bytes: number[] = []
  for (const char of text) {
    const code = char.charCodeAt(0)
    const byte = code <= 0xff ? code : windows1252ByteMap[code]
    if (byte == null) return text
    bytes.push(byte)
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)).normalize('NFC')
  } catch {
    return text
  }
}

function formatCurrency(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ`
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('vi-VN')
}

function cleanBatchCode(rawBatch?: string | null) {
  if (!rawBatch) return ''
  if (rawBatch.includes('http') || rawBatch.includes('/batch/')) {
    const parts = rawBatch.split('/')
    return `Lô #${parts[parts.length - 1]}`
  }
  return rawBatch.toLowerCase().startsWith('batch') ? rawBatch.replace(/^batch/i, 'Lô') : `Lô ${rawBatch}`
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_SUPPLIER_CONFIRMATION: 'Chờ NCC xác nhận',
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING_DEPOSIT: 'Chờ tiền cọc',
  DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM: 'Chờ NCC xác nhận',
  PAID_WAITING_SUPPLIER_CONFIRM: 'Chờ NCC xác nhận',
  WAITING_FINAL_PAYMENT: 'Chờ thanh toán cuối',
  SUPPLIER_CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  READY_TO_SHIP: 'Sẵn sàng giao',
  IN_DELIVERY: 'Đang giao hàng',
  SHIPPING: 'Đang giao hàng',
  DELIVERED: 'Đã giao hàng',
  WAITING_BUYER_CONFIRM: 'Chờ nhận hàng',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  DISPUTED: 'Đang khiếu nại',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  WAITING_TRANSFER: 'Chờ thanh toán',
  PENDING_VERIFY: 'Chờ xác minh',
  PARTIALLY_PAID: 'Thanh toán 1 phần',
  WAITING_REMAINING_PAYMENT: 'Chờ thanh toán cuối',
  PAID: 'Đã thanh toán',
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  FAILED: 'Thất bại',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
}

const ESCROW_STATUS_LABELS: Record<string, string> = {
  NOT_FUNDED: 'Sàn chưa nhận tiền',
  PARTIALLY_HELD: 'Sàn giữ tiền cọc',
  HELD: 'Sàn đang giữ tiền',
  RELEASE_PENDING: 'Chờ giải ngân',
  RELEASED: 'Sàn đã giải ngân',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
  DISPUTED: 'Đang khiếu nại',
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  FULL: 'Thanh toán toàn bộ',
  FULL_PAYMENT: 'Thanh toán đầy đủ',
  DEPOSIT: 'Tiền cọc',
  REMAINING: 'Phần còn lại',
  BANK_TRANSFER_DEMO: 'Chuyển khoản',
  ESCROW_TRANSFER: 'Ký quỹ / Chuyển khoản',
  DEPOSIT_50: 'Cọc 50%',
  CREDIT: 'Công nợ',
  CREDIT_TERM: 'Công nợ',
  CREDIT_OPEN: 'Công nợ',
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Đã thanh toán một phần',
  PARTIAL: 'Đã thanh toán một phần',
  PAID: 'Đã thanh toán',
  OVERDUE: 'Quá hạn',
  CANCELLED: 'Đã hủy',
}

const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Đang xử lý',
  PROCESSING: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  REJECTED: 'Từ chối',
  CLOSED: 'Đã đóng',
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  CRITICAL: 'Nghiêm trọng',
}

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  CREATED: 'Đã tạo vận đơn',
  SHIPPING: 'Đang vận chuyển',
  DELIVERED: 'Đã giao hàng',
  FAILED_DELIVERY: 'Giao thất bại',
  CANCELLED: 'Đã hủy',
  PENDING: 'Chờ lấy hàng',
  PREPARING: 'Đang chuẩn bị',
  SHIPPED: 'Đã rời kho',
  IN_TRANSIT: 'Đang vận chuyển',
  WAITING_CONFIRMATION: 'Chờ bên mua xác nhận',
  FAILED: 'Thất bại',
}

void ESCROW_STATUS_LABELS
void COMPLAINT_STATUS_LABELS
void SEVERITY_LABELS
void SHIPMENT_STATUS_LABELS

function statusLabel(status?: string | null) {
  if (!status) return 'Chưa có trạng thái'
  return ORDER_STATUS_LABELS[status] || status
}

function labeledStatus(status?: string | null, labels: Record<string, string> = {}) {
  if (!status) return 'Chưa có'
  return labels[status] || status
}

function findPayablePayment(order?: BuyerOrder | null): BuyerOrderPayment | null {
  if (!order) return null
  if (isOrderAlreadyPaid(order)) return null
  if (order.status === 'WAITING_FINAL_PAYMENT') {
    const remaining = remainingPayableFor(order)
    if (remaining <= 0) return null
    return {
      id: 0,
      amount: remaining,
      paidAmount: 0,
      paymentMethod: 'BANK_TRANSFER_DEMO',
      paymentType: 'REMAINING',
      status: 'WAITING_REMAINING_PAYMENT',
      escrowStatus: order.escrowStatus,
      transferContent: `AGRI-REMAINING-${order.orderId ?? order.id}`,
    }
  }
  if (!order.payments?.length) return null
  if (order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_DEPOSIT') {
    return order.payments.find((payment) => isPayablePayment(payment)) ?? null
  }
  return order.payments.find((payment) => payment.status === 'WAITING_REMAINING_PAYMENT' && isPayablePayment(payment)) ?? null
}

function transferContentFor(order: BuyerOrder, payment?: BuyerOrderPayment | null) {
  if (payment?.transferContent) return payment.transferContent
  if (order.status === 'WAITING_FINAL_PAYMENT') return `AGRI-REMAINING-${order.orderId ?? order.id}`
  if (order.paymentOption === 'DEPOSIT_50' || order.status === 'PENDING_DEPOSIT') return `AGRI-DEPOSIT-${order.orderId ?? order.id}`
  return `AGRI-ORDER-${order.orderId ?? order.id}`
}

function payableAmountFor(order: BuyerOrder, payment?: BuyerOrderPayment | null) {
  if (payment?.amount != null) return Math.max((payment.amount ?? 0) - (payment.paidAmount ?? 0), 0)
  if (order.status === 'WAITING_FINAL_PAYMENT') return remainingPayableFor(order)
  if (order.status === 'PENDING_DEPOSIT') return order.depositAmount ?? (order.totalAmount ?? 0) * 0.5
  return Math.max((order.totalAmount ?? 0) - (order.invoicePaidAmount ?? 0), 0)
}

function remainingPayableFor(order: BuyerOrder) {
  return Math.max(order.remainingAmount ?? ((order.totalAmount ?? 0) - (order.invoicePaidAmount ?? 0)), 0)
}

function isPaidStatus(status?: string | null) {
  return ['PAID', 'PARTIALLY_PAID', 'COMPLETED', 'CONFIRMED', 'SUCCESS'].includes((status || '').trim().toUpperCase())
}

function isPayablePayment(payment?: BuyerOrderPayment | null) {
  if (!payment || isPaidStatus(payment.status)) return false
  return Math.max((payment.amount ?? 0) - (payment.paidAmount ?? 0), 0) > 0
}

function isOrderAlreadyPaid(order: BuyerOrder) {
  if (order.invoiceStatus === 'PAID' || order.paymentStatus === 'PAID') return true
  if ((order.invoicePaidAmount ?? 0) >= (order.totalAmount ?? Number.POSITIVE_INFINITY)) return true
  return order.payments?.some((payment) => isPaidStatus(payment.status) || (payment.amount ?? 0) > 0 && (payment.paidAmount ?? 0) >= (payment.amount ?? 0)) ?? false
}

function canPayInitialOrder(order: BuyerOrder) {
  return (order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_DEPOSIT') && Boolean(findPayablePayment(order))
}

const ORDER_FILTERS = [
  { key: 'all', label: 'Tất cả', statuses: null },
  {
    key: 'pendingSupplier',
    label: 'Chờ NCC xác nhận',
    statuses: ['PENDING_SUPPLIER_CONFIRMATION', 'DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM', 'PAID_WAITING_SUPPLIER_CONFIRM', 'PENDING'],
  },
  { key: 'confirmed', label: 'Đã xác nhận', statuses: ['CONFIRMED', 'SUPPLIER_CONFIRMED', 'PREPARING', 'READY_TO_SHIP'] },
  { key: 'delivery', label: 'Đang giao hàng', statuses: ['IN_DELIVERY', 'SHIPPING', 'DELIVERED', 'WAITING_BUYER_CONFIRM'] },
  { key: 'completed', label: 'Hoàn tất', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Đã hủy', statuses: ['CANCELLED'] },
] as const

type OrderFilterKey = (typeof ORDER_FILTERS)[number]['key']
type PaymentFilterKey = 'credit' | 'deposit' | 'final' | 'overdue' | 'paid'

const PAYMENT_FILTERS: { key: PaymentFilterKey; label: string }[] = [
  { key: 'credit', label: 'Công nợ' },
  { key: 'deposit', label: 'Chờ tiền cọc' },
  { key: 'final', label: 'Chờ thanh toán cuối' },
  { key: 'overdue', label: 'Quá hạn' },
  { key: 'paid', label: 'Đã thanh toán' },
]

function matchOrderFilter(order: BuyerOrder, key: OrderFilterKey) {
  if (key === 'all') return true
  const filter = ORDER_FILTERS.find((item) => item.key === key)
  return Boolean((filter?.statuses as readonly string[] | null)?.includes(order.status))
}

function isOverdue(order: BuyerOrder) {
  return String(order.invoiceStatus || order.paymentStatus || '') === 'OVERDUE'
}

function matchPaymentFilter(order: BuyerOrder, key: PaymentFilterKey | 'all') {
  if (key === 'all') return true
  if (key === 'credit') return order.paymentMethod === 'CREDIT' || order.paymentOption === 'CREDIT' || order.paymentOption === 'CREDIT_TERM'
  if (key === 'deposit') return order.status === 'PENDING_DEPOSIT' || order.payments?.some((payment) => payment.paymentType === 'DEPOSIT' && payment.status !== 'PAID')
  if (key === 'final') return order.status === 'WAITING_FINAL_PAYMENT' || order.payments?.some((payment) => payment.status === 'WAITING_REMAINING_PAYMENT')
  if (key === 'overdue') return isOverdue(order)
  if (key === 'paid') return order.invoiceStatus === 'PAID' || order.paymentStatus === 'PAID'
  return true
}

function paymentMethodLabel(order: BuyerOrder) {
  const paymentCode = order.paymentOption || order.paymentMethod || order.payments?.[0]?.paymentType || order.payments?.[0]?.paymentMethod
  return PAYMENT_TYPE_LABELS[paymentCode || ''] ?? (paymentCode || 'Chuyển khoản')
}

function paymentStateLabel(order: BuyerOrder) {
  if (isOverdue(order)) return 'Quá hạn'
  if (order.status === 'PENDING_DEPOSIT') return 'Chờ tiền cọc'
  if (order.status === 'WAITING_FINAL_PAYMENT') return 'Chờ thanh toán cuối'
  if (order.invoiceStatus === 'PAID' || order.paymentStatus === 'PAID') return 'Đã thanh toán'
  if (order.paymentStatus || order.invoiceStatus) {
    return labeledStatus(order.paymentStatus || order.invoiceStatus, { ...PAYMENT_STATUS_LABELS, ...INVOICE_STATUS_LABELS })
  }
  const paymentCode = order.paymentOption || order.paymentMethod
  if (paymentCode === 'CREDIT' || paymentCode === 'CREDIT_TERM' || paymentCode === 'CREDIT_OPEN') return 'Theo hạn công nợ'
  return 'Chưa có'
}

function statusTone(status?: string | null) {
  if (status === 'COMPLETED' || status === 'PAID' || status === 'CONFIRMED' || status === 'SUPPLIER_CONFIRMED' || status === 'DELIVERED') return 'success'
  if (status === 'OVERDUE' || status === 'DISPUTED' || status === 'FAILED' || status === 'FAILED_DELIVERY') return 'danger'
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') return 'muted'
  if (status === 'IN_DELIVERY' || status === 'SHIPPING' || status === 'IN_TRANSIT') return 'info'
  return 'pending'
}

function EnterpriseStatusPill({ label, tone = 'pending' }: { label: string; tone?: 'success' | 'pending' | 'danger' | 'muted' | 'info' }) {
  const toneClass = {
    success: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-700',
    muted: 'bg-slate-100 text-slate-600',
    info: 'bg-blue-100 text-blue-800',
  }[tone] || 'bg-slate-100 text-slate-600'

  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-none ${toneClass}`}>
      {label}
    </span>
  )
}

// FilterGroup removed in favor of inline rendering to match SupplierOrdersPage

function BuyerOrderItemsPreview({ order }: { order: BuyerOrder }) {
  if (order.items?.length) {
    return (
      <div className="space-y-2">
        {order.items.slice(0, 2).map((item) => {
          const cleanBatch = cleanBatchCode(item.batchCode)
          return (
            <div key={`${item.batchId}-${item.productId}`}>
              <p className="max-w-[260px] truncate font-semibold text-slate-800" title={item.productName}>{item.productName}</p>
              <p className="text-xs text-slate-500">
                {[item.grade ? `Hạng ${item.grade}` : null, item.size ? `Cỡ ${item.size}` : null, `${item.quantity} ${item.unit}`]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
              {cleanBatch ? <p className="mt-0.5 text-[11px] font-medium text-slate-400">{cleanBatch}</p> : null}
            </div>
          )
        })}
        {order.items.length > 2 ? <p className="text-xs font-semibold text-slate-500">+{order.items.length - 2} sản phẩm khác</p> : null}
      </div>
    )
  }

  return (
    <div>
      <p className="max-w-[260px] truncate font-semibold text-slate-800" title={order.product}>{order.product || 'Chưa có'}</p>
      <p className="text-xs text-slate-500">{order.quantity || 'Chưa có số lượng'}</p>
    </div>
  )
}

type BuyerOrderTab = 'info' | 'shipping' | 'invoice' | 'complaint'
type ComplaintDraft = { title: string; description: string; severity: string }

const EMPTY_TEXT = 'Chưa có'

function cleanOrderStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING_SUPPLIER_CONFIRMATION: 'Chờ NCC xác nhận',
    PENDING: 'Chờ xử lý',
    CONFIRMED: 'Đã xác nhận',
    PENDING_PAYMENT: 'Chờ thanh toán',
    PENDING_DEPOSIT: 'Chờ tiền cọc',
    DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM: 'Chờ NCC xác nhận',
    PAID_WAITING_SUPPLIER_CONFIRM: 'Chờ NCC xác nhận',
    WAITING_FINAL_PAYMENT: 'Chờ thanh toán cuối',
    SUPPLIER_CONFIRMED: 'Đã xác nhận',
    PREPARING: 'Đang chuẩn bị',
    READY_TO_SHIP: 'Sẵn sàng giao',
    IN_DELIVERY: 'Đang giao hàng',
    SHIPPING: 'Đang giao hàng',
    DELIVERED: 'Đã giao hàng',
    WAITING_BUYER_CONFIRM: 'Chờ nhận hàng',
    COMPLETED: 'Hoàn tất',
    CANCELLED: 'Đã hủy',
    DISPUTED: 'Đang khiếu nại',
    REFUND_PENDING: 'Chờ hoàn tiền',
    REFUNDED: 'Đã hoàn tiền',
  }
  return status ? labels[status] || status : 'Chưa có trạng thái'
}

function cleanPaymentLabel(value?: string | null) {
  const labels: Record<string, string> = {
    WAITING_TRANSFER: 'Chờ thanh toán',
    PENDING_VERIFY: 'Chờ xác minh',
    PARTIALLY_PAID: 'Thanh toán một phần',
    WAITING_REMAINING_PAYMENT: 'Chờ thanh toán cuối',
    PAID: 'Đã thanh toán',
    PENDING: 'Chờ xử lý',
    CONFIRMED: 'Đã xác nhận',
    FAILED: 'Thất bại',
    REFUND_PENDING: 'Chờ hoàn tiền',
    REFUNDED: 'Đã hoàn tiền',
    UNPAID: 'Chưa thanh toán',
    PARTIAL: 'Thanh toán một phần',
    PARTIALLY_HELD: 'Sàn giữ tiền cọc',
    NOT_FUNDED: 'Sàn chưa nhận tiền',
    HELD: 'Sàn đang giữ tiền',
    RELEASE_PENDING: 'Chờ giải ngân',
    RELEASED: 'Đã giải ngân',
    DISPUTED: 'Đang khiếu nại',
    OVERDUE: 'Quá hạn',
  }
  return value ? labels[value] || value : EMPTY_TEXT
}

function cleanPaymentMethodLabel(order: BuyerOrder) {
  const code = order.paymentOption || order.paymentMethod || order.payments?.[0]?.paymentType || order.payments?.[0]?.paymentMethod
  const labels: Record<string, string> = {
    FULL: 'Thanh toán toàn bộ',
    FULL_PAYMENT: 'Thanh toán đầy đủ',
    DEPOSIT: 'Tiền cọc',
    REMAINING: 'Phần còn lại',
    BANK_TRANSFER_DEMO: 'Chuyển khoản',
    ESCROW_TRANSFER: 'Ký quỹ / Chuyển khoản',
    DEPOSIT_50: 'Cọc 50%',
    CREDIT: 'Công nợ',
    CREDIT_TERM: 'Công nợ',
    CREDIT_OPEN: 'Công nợ',
  }
  return code ? labels[code] || code : 'Chuyển khoản'
}

function cleanShipmentStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    CREATED: 'Đã tạo vận đơn',
    SHIPPING: 'Đang vận chuyển',
    DELIVERED: 'Đã giao hàng',
    FAILED_DELIVERY: 'Giao thất bại',
    CANCELLED: 'Đã hủy',
    PENDING: 'Chờ lấy hàng',
    PREPARING: 'Đang chuẩn bị',
    SHIPPED: 'Đã rời kho',
    IN_TRANSIT: 'Đang vận chuyển',
    WAITING_CONFIRMATION: 'Chờ bên mua xác nhận',
    FAILED: 'Thất bại',
  }
  return status ? labels[status] || status : EMPTY_TEXT
}

function cleanComplaintStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    OPEN: 'Đang xử lý',
    PROCESSING: 'Đang xử lý',
    RESOLVED: 'Đã giải quyết',
    REJECTED: 'Từ chối',
    CLOSED: 'Đã đóng',
  }
  return status ? labels[status] || status : EMPTY_TEXT
}

function cleanSeverityLabel(severity?: string | null) {
  const labels: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', CRITICAL: 'Nghiêm trọng' }
  return severity ? labels[severity] || severity : 'Trung bình'
}

function receiverAddress(order: BuyerOrder) {
  return order.shipment?.receiverAddress || [order.deliveryAddress, order.deliveryWard, order.deliveryDistrict, order.deliveryProvince].filter(Boolean).join(', ') || EMPTY_TEXT
}

function orderQuantityLabel(order: BuyerOrder) {
  if (order.items?.length) {
    return order.items.map((item) => `${Number(item.quantity ?? 0).toLocaleString('vi-VN')} ${item.unit || ''}`.trim()).join(' + ')
  }
  return order.quantity || EMPTY_TEXT
}

function paymentProgress(order: BuyerOrder) {
  const total = Number(order.totalAmount || 0)
  if (!total) return 0
  return Math.min(100, Math.round((Number(order.invoicePaidAmount || 0) / total) * 100))
}

function isDeliveryRisk(order: BuyerOrder) {
  return ['FAILED', 'FAILED_DELIVERY', 'CANCELLED'].includes(String(order.shipment?.shipmentStatus || order.status || '')) || String(order.status || '').includes('DISPUT')
}

function WorkspaceCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-900/5 ${className}`}>{children}</div>
}

function DetailKpi({ icon, label, value, tone = 'emerald' }: { icon: ReactNode; label: string; value: string; tone?: 'emerald' | 'amber' | 'blue' | 'rose' | 'slate' }) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    slate: 'bg-slate-50 text-slate-700 ring-slate-100',
  }[tone]
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
      <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${toneClass}`}>{icon}</div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold text-slate-900" title={value}>{value}</p>
    </div>
  )
}

function DetailLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-sm ${strong ? 'font-extrabold text-slate-950' : 'font-semibold text-slate-700'}`} title={value}>{value}</p>
    </div>
  )
}

function ProductOrderCard({ order }: { order: BuyerOrder }) {
  const rows = order.items?.length ? order.items : []
  if (!rows.length) {
    return (
      <WorkspaceCard>
        <div className="flex gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700">
            <Package className="h-9 w-9" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Sản phẩm mua</p>
            <h4 className="mt-1 truncate text-base font-extrabold text-slate-950">{order.product || EMPTY_TEXT}</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <DetailLine label="Số lượng" value={order.quantity || EMPTY_TEXT} strong />
              <DetailLine label="Nhà cung cấp" value={order.supplier || EMPTY_TEXT} />
              <DetailLine label="Nguồn RFQ" value={order.rfqCode || 'Đặt nhanh'} />
            </div>
          </div>
        </div>
      </WorkspaceCard>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((item) => {
        const meta = [item.grade ? `Hạng ${item.grade}` : null, item.size ? `Cỡ ${item.size}` : null, cleanBatchCode(item.batchCode)].filter(Boolean)
        return (
          <WorkspaceCard key={`${item.batchId}-${item.productId}`} className="transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
            <div className="flex gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-100 via-teal-50 to-lime-100 text-emerald-700">
                <Package className="h-10 w-10" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">{cleanBatchCode(item.batchCode) || 'Lô hàng'}</p>
                    <h4 className="mt-1 truncate text-base font-extrabold text-slate-950" title={item.productName}>{item.productName || EMPTY_TEXT}</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {meta.map((label) => (
                        <span key={label} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">{label}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Thành tiền</p>
                    <p className="text-lg font-extrabold text-emerald-700">{formatCurrency(item.subtotal)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <DetailLine label="Số lượng" value={`${Number(item.quantity ?? 0).toLocaleString('vi-VN')} ${item.unit || ''}`.trim()} strong />
                  <DetailLine label="Đơn giá" value={formatCurrency(item.price)} />
                  <DetailLine label="Ngày thu hoạch" value={formatDate(item.harvestDate)} />
                  <DetailLine label="MOQ / SLA" value="Theo lô đã chốt" />
                </div>
              </div>
            </div>
          </WorkspaceCard>
        )
      })}
    </div>
  )
}

function BuyerOrderDetailModal({
  order,
  activeTab,
  detailLoading,
  complaintDraft,
  onActiveTabChange,
  onClose,
  onComplaintDraftChange,
  onCreateComplaint,
  onOpenPaymentModal,
  onConfirmReceived,
}: {
  order: BuyerOrder
  activeTab: BuyerOrderTab
  detailLoading: boolean
  complaintDraft: ComplaintDraft
  onActiveTabChange: (tab: BuyerOrderTab) => void
  onClose: () => void
  onComplaintDraftChange: (value: ComplaintDraft | ((current: ComplaintDraft) => ComplaintDraft)) => void
  onCreateComplaint: () => void
  onOpenPaymentModal: (order: BuyerOrder, isRemaining: boolean) => void
  onConfirmReceived: () => void
}) {
  const payablePayment = findPayablePayment(order)
  const remainingAmount = order.remainingAmount ?? Math.max(Number(order.totalAmount || 0) - Number(order.invoicePaidAmount || 0), 0)
  const progress = paymentProgress(order)
  const shipmentStatus = cleanShipmentStatusLabel(order.shipment?.shipmentStatus || order.status)
  const risk = isDeliveryRisk(order)
  const latestComplaint = order.complaints?.[0]
  const tabs: Array<{ key: BuyerOrderTab; label: string; icon: ReactNode; count?: string }> = [
    { key: 'info', label: 'Thông tin đơn', icon: <FileText className="h-4 w-4" /> },
    { key: 'shipping', label: 'Theo dõi giao hàng', icon: <Truck className="h-4 w-4" /> },
    { key: 'invoice', label: 'Hóa đơn & Thanh toán', icon: <Receipt className="h-4 w-4" /> },
    { key: 'complaint', label: 'Khiếu nại', icon: <ShieldAlert className="h-4 w-4" />, count: order.complaints?.length ? String(order.complaints.length) : undefined },
  ]

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="mx-auto my-4 w-full max-w-6xl overflow-hidden rounded-3xl bg-slate-50 shadow-2xl shadow-slate-950/25"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-5 text-white sm:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.18) 52%, transparent 53%)' }} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white shadow-sm backdrop-blur">Procurement order</span>
                <EnterpriseStatusPill label={cleanOrderStatusLabel(order.status)} tone={statusTone(order.status)} />
              </div>
              <h3 className="mt-3 truncate text-2xl font-extrabold tracking-normal text-white sm:text-3xl">Chi tiết đơn hàng {order.id}</h3>
              <p className="mt-1 text-sm font-medium text-emerald-50/90">
                {order.rfqCode ? `Tạo từ ${order.rfqCode}` : 'Đơn hàng đặt nhanh'}{order.quoteId ? ` · Báo giá ${order.quoteId}` : ''} · {order.supplier || EMPTY_TEXT}
              </p>
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 active:scale-95" onClick={onClose} aria-label="Đóng">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Sản phẩm</p>
              <p className="mt-1 truncate text-sm font-extrabold">{order.product || order.items?.[0]?.productName || EMPTY_TEXT}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Số lượng</p>
              <p className="mt-1 truncate text-sm font-extrabold">{orderQuantityLabel(order)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">ETA</p>
              <p className="mt-1 truncate text-sm font-extrabold">{formatDate(order.shipment?.expectedDeliveryDate || order.expectedDeliveryDate || order.estimatedDeliveryTime)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Còn phải trả</p>
              <p className="mt-1 truncate text-sm font-extrabold">{formatCurrency(remainingAmount)}</p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-extrabold transition-all sm:flex-none ${
                  activeTab === tab.key
                    ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100'
                    : 'text-slate-600 hover:bg-white/70 hover:text-emerald-700'
                }`}
                onClick={() => onActiveTabChange(tab.key)}
              >
                {tab.icon}
                {tab.label}
                {tab.count ? <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700 ring-1 ring-rose-100">{tab.count}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-4 sm:p-5">
          {detailLoading ? (
            <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">Đang tải chi tiết đơn hàng...</div>
          ) : null}

          {activeTab === 'info' ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailKpi icon={<Warehouse className="h-5 w-5" />} label="Nhà cung cấp" value={order.supplier || EMPTY_TEXT} />
                <DetailKpi icon={<Building2 className="h-5 w-5" />} label="Chi nhánh nhận" value={order.branch || EMPTY_TEXT} tone="blue" />
                <DetailKpi icon={<CalendarDays className="h-5 w-5" />} label="Ngày tạo" value={formatDate(order.createdAt)} tone="slate" />
                <DetailKpi icon={<CircleDollarSign className="h-5 w-5" />} label="Tổng phải trả" value={formatCurrency(order.totalAmount)} tone="emerald" />
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.8fr]">
                <ProductOrderCard order={order} />
                <div className="space-y-4">
                  <WorkspaceCard>
                    <h4 className="text-sm font-extrabold text-slate-950">Tóm tắt thanh toán</h4>
                    <div className="mt-3 space-y-3">
                      <DetailLine label="Phương thức" value={cleanPaymentMethodLabel(order)} strong />
                      <DetailLine label="Trạng thái tín dụng" value={cleanPaymentLabel(order.paymentStatus || order.invoiceStatus)} />
                      <DetailLine label="Nguồn RFQ" value={order.rfqCode || 'Đặt nhanh'} />
                    </div>
                  </WorkspaceCard>
                  <WorkspaceCard>
                    <h4 className="text-sm font-extrabold text-slate-950">Người nhận & địa chỉ</h4>
                    <div className="mt-3 space-y-3">
                      <DetailLine label="Người nhận" value={order.shipment?.receiverName || order.deliveryName || EMPTY_TEXT} strong />
                      <DetailLine label="Điện thoại" value={order.shipment?.receiverPhone || order.deliveryPhone || EMPTY_TEXT} />
                      <DetailLine label="Địa chỉ giao" value={receiverAddress(order)} />
                    </div>
                  </WorkspaceCard>
                </div>
              </div>
              <WorkspaceCard>
                <h4 className="text-sm font-extrabold text-slate-950">Ghi chú nội bộ</h4>
                <textarea className="mt-3 h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100" placeholder="Thêm ghi chú cho đơn hàng này..." />
                <button className="mt-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-700 active:scale-95">Lưu ghi chú</button>
              </WorkspaceCard>
            </div>
          ) : activeTab === 'shipping' ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <WorkspaceCard>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-extrabold text-slate-950">Timeline vận hành giao hàng</h4>
                    <p className="text-xs font-medium text-slate-500">Theo dõi trạng thái, ETA và điểm rủi ro giao nhận.</p>
                  </div>
                  <EnterpriseStatusPill label={risk ? 'Có rủi ro giao hàng' : shipmentStatus} tone={risk ? 'danger' : statusTone(order.shipment?.shipmentStatus || order.status)} />
                </div>
                <div className="space-y-4">
                  {(order.trackingEvents?.length ? order.trackingEvents : [{ title: 'Đơn hàng được tạo', time: formatDate(order.createdAt), done: true }]).map((event, index, events) => {
                    const title = normalizeVietnameseText(event.title)
                    const time = normalizeVietnameseText(event.time)
                    return (
                      <div key={`${title}-${time}`} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ring-4 ${event.done ? 'bg-emerald-600 text-white ring-emerald-50' : 'bg-white text-slate-400 ring-slate-100'}`}>
                            {event.done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                          </span>
                          {index < events.length - 1 ? <span className="mt-1 h-8 w-px bg-slate-200" /> : null}
                        </div>
                        <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                          <p className="font-bold text-slate-900">{title}</p>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">{time}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </WorkspaceCard>
              <div className="space-y-4">
                <WorkspaceCard>
                  <h4 className="text-sm font-extrabold text-slate-950">Thông tin logistics</h4>
                  <div className="mt-3 grid gap-3">
                    <DetailLine label="Đơn vị vận chuyển" value={order.shipment?.provider || order.shippingProviderName || order.shippingServiceName || 'Tự điều phối'} strong />
                    <DetailLine label="Mã vận đơn" value={order.shipment?.trackingCode || order.trackingCode || EMPTY_TEXT} />
                    <DetailLine label="ETA / SLA giao" value={formatDate(order.shipment?.expectedDeliveryDate || order.expectedDeliveryDate || order.estimatedDeliveryTime)} />
                    <DetailLine label="Đã giao" value={formatDate(order.shipment?.deliveredAt)} />
                  </div>
                </WorkspaceCard>
                <WorkspaceCard>
                  <h4 className="text-sm font-extrabold text-slate-950">Điều phối nhận hàng</h4>
                  <div className="mt-3 grid gap-3">
                    <DetailLine label="Người nhận" value={order.shipment?.receiverName || order.deliveryName || EMPTY_TEXT} strong />
                    <DetailLine label="Số điện thoại" value={order.shipment?.receiverPhone || order.deliveryPhone || EMPTY_TEXT} />
                    <DetailLine label="Địa chỉ" value={receiverAddress(order)} />
                    <DetailLine label="Tài xế / xe" value={[order.driverName, order.vehicleInfo].filter(Boolean).join(' · ') || EMPTY_TEXT} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"><MapPin className="h-3.5 w-3.5" /> Theo dõi</button>
                    <button className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 active:scale-95"><Phone className="h-3.5 w-3.5" /> Gọi</button>
                  </div>
                </WorkspaceCard>
              </div>
            </div>
          ) : activeTab === 'invoice' ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailKpi icon={<CircleDollarSign className="h-5 w-5" />} label="Tổng phải trả" value={formatCurrency(order.totalAmount)} />
                <DetailKpi icon={<CheckCircle2 className="h-5 w-5" />} label="Đã thanh toán" value={formatCurrency(order.invoicePaidAmount)} tone="blue" />
                <DetailKpi icon={<CreditCard className="h-5 w-5" />} label="Còn lại" value={formatCurrency(remainingAmount)} tone={remainingAmount > 0 ? 'amber' : 'emerald'} />
                <DetailKpi icon={<CalendarDays className="h-5 w-5" />} label="Hạn thanh toán" value={formatDate(order.invoiceDueDate)} tone={isOverdue(order) ? 'rose' : 'slate'} />
              </div>
              <WorkspaceCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Hóa đơn</p>
                    <h4 className="mt-1 text-xl font-extrabold text-slate-950">{order.invoiceCode || 'Chưa có hóa đơn'}</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500">Ngày phát hành: {formatDate(order.createdAt)}</p>
                  </div>
                  <EnterpriseStatusPill label={cleanPaymentLabel(order.invoiceStatus || 'UNPAID')} tone={order.invoiceStatus === 'PAID' ? 'success' : isOverdue(order) ? 'danger' : 'pending'} />
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <DetailLine label="Phương thức" value={cleanPaymentMethodLabel(order)} strong />
                  <DetailLine label="Thanh toán" value={cleanPaymentLabel(order.paymentStatus || order.invoiceStatus)} />
                  <DetailLine label="Ký quỹ" value={cleanPaymentLabel(order.escrowStatus)} />
                </div>
              </WorkspaceCard>
              {payablePayment ? (
                <WorkspaceCard className="border-emerald-200 bg-emerald-50/80">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-emerald-950">Thông tin chuyển khoản </h4>
                      <p className="mt-1 text-xs font-medium text-emerald-700">Sàn giữ tiền ký quỹ và giải ngân theo trạng thái nhận hàng.</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">{cleanPaymentLabel(payablePayment.status)}</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailLine label="Ngân hàng" value="DEMO BANK" />
                    <DetailLine label="Tên tài khoản" value="AGRIBRIDGE PLATFORM" />
                    <DetailLine label="Số tài khoản" value="123456789" />
                    <DetailLine label="Số tiền cần thanh toán" value={formatCurrency(payableAmountFor(order, payablePayment))} strong />
                    <div className="md:col-span-2"><DetailLine label="Nội dung chuyển khoản" value={transferContentFor(order, payablePayment)} strong /></div>
                  </div>
                </WorkspaceCard>
              ) : null}
              {order.payments?.length ? (
                <WorkspaceCard>
                  <h4 className="text-sm font-extrabold text-slate-950">Lịch sử thanh toán</h4>
                  <div className="mt-3 space-y-2">
                    {order.payments.map((payment) => (
                      <div key={payment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-slate-900">{cleanPaymentMethodLabel({ ...order, paymentOption: payment.paymentType || payment.paymentMethod } as BuyerOrder)}</p>
                          <EnterpriseStatusPill label={cleanPaymentLabel(payment.status)} tone={statusTone(payment.status)} />
                        </div>
                        <p className="mt-1 text-sm font-extrabold text-emerald-700">{formatCurrency(payment.paidAmount || payment.amount)}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{cleanPaymentLabel(payment.escrowStatus)}{payment.transferContent ? ` · ${payment.transferContent}` : ''}</p>
                      </div>
                    ))}
                  </div>
                </WorkspaceCard>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <WorkspaceCard>
                <h4 className="text-base font-extrabold text-slate-950">Tạo hồ sơ khiếu nại</h4>
                <p className="mt-1 text-xs font-medium text-slate-500">Ghi nhận bằng chứng và bên đang chờ phản hồi để xử lý tranh chấp mua hàng.</p>
                <div className="mt-4 space-y-3">
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    value={complaintDraft.title}
                    placeholder="Tiêu đề khiếu nại"
                    onChange={(event) => onComplaintDraftChange((current) => ({ ...current, title: event.target.value }))}
                  />
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    value={complaintDraft.severity}
                    onChange={(event) => onComplaintDraftChange((current) => ({ ...current, severity: event.target.value }))}
                  >
                    <option value="LOW">Thấp</option>
                    <option value="MEDIUM">Trung bình</option>
                    <option value="HIGH">Cao</option>
                  </select>
                  <textarea
                    className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    value={complaintDraft.description}
                    placeholder="Mô tả vấn đề, bằng chứng, đề xuất hoàn tiền hoặc thay thế..."
                    onChange={(event) => onComplaintDraftChange((current) => ({ ...current, description: event.target.value }))}
                  />
                  <button className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 active:scale-95" onClick={onCreateComplaint}>
                    Tạo khiếu nại
                  </button>
                </div>
              </WorkspaceCard>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailKpi icon={<ShieldAlert className="h-5 w-5" />} label="Trạng thái tranh chấp" value={latestComplaint ? cleanComplaintStatusLabel(latestComplaint.status) : 'Không có'} tone={latestComplaint ? 'rose' : 'emerald'} />
                  <DetailKpi icon={<UserRound className="h-5 w-5" />} label="Bên chờ phản hồi" value={latestComplaint ? 'Nhà cung cấp / vận hành' : 'Không cần xử lý'} tone={latestComplaint ? 'amber' : 'slate'} />
                  <DetailKpi icon={<Package className="h-5 w-5" />} label="Đề xuất xử lý" value={latestComplaint?.resolution || 'Hoàn tiền / thay thế khi có kết luận'} tone="blue" />
                </div>
                <WorkspaceCard>
                  <h4 className="text-base font-extrabold text-slate-950">Dòng xử lý tranh chấp</h4>
                  {order.complaints?.length ? (
                    <div className="mt-4 space-y-3">
                      {order.complaints.map((complaint) => (
                        <div key={complaint.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-extrabold text-slate-950">{complaint.title || 'Khiếu nại đơn hàng'}</p>
                              <p className="mt-1 text-xs font-medium text-slate-500">Buyer evidence · {formatDate(complaint.createdAt)} · Mức độ {cleanSeverityLabel(complaint.severity)}</p>
                            </div>
                            <EnterpriseStatusPill label={cleanComplaintStatusLabel(complaint.status)} tone={complaint.status === 'RESOLVED' ? 'success' : 'danger'} />
                          </div>
                          <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-medium leading-6 text-slate-700">{complaint.description}</p>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Phản hồi NCC</p>
                              <p className="mt-1 text-sm font-semibold text-slate-700">{complaint.resolution ? 'Đã có đề xuất xử lý' : 'Đang chờ phản hồi'}</p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Kết quả</p>
                              <p className="mt-1 text-sm font-semibold text-emerald-700">{complaint.resolution || 'Chưa có kết luận'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-6 text-center">
                      <div>
                        <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                        <p className="mt-2 text-sm font-extrabold text-slate-900">Chưa có khiếu nại nào cho đơn hàng này</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">Nếu phát sinh thiếu hàng, sai chất lượng hoặc giao trễ, hồ sơ xử lý sẽ nằm tại đây.</p>
                      </div>
                    </div>
                  )}
                </WorkspaceCard>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold text-slate-500">Mã đơn: <span className="text-slate-800">{order.id}</span></p>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 active:scale-95"><Printer className="h-3.5 w-3.5" /> In đơn hàng</button>
            {canPayInitialOrder(order) ? (
              <button className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-700 active:scale-95" onClick={() => onOpenPaymentModal(order, false)}>
                <Receipt className="h-3.5 w-3.5" /> Xác nhận thanh toán
              </button>
            ) : null}
            {order.status === 'WAITING_FINAL_PAYMENT' && Boolean(findPayablePayment(order)) ? (
              <button className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-700 active:scale-95" onClick={() => onOpenPaymentModal(order, true)}>
                <Receipt className="h-3.5 w-3.5" /> Thanh toán cuối
              </button>
            ) : null}
            {order.status === 'WAITING_BUYER_CONFIRM' ? (
              <button className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-700 active:scale-95" onClick={onConfirmReceived}>
                <Truck className="h-3.5 w-3.5" /> Đã nhận hàng
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function BuyerOrdersPage() {
  usePageTitle('Đơn hàng')
  const { showToast } = useToast()
  const { confirmPayment, confirming } = useBuyerOrderPayment()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState<BuyerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openDetail, setOpenDetail] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'shipping' | 'invoice' | 'complaint'>('info')
  const [detailLoading, setDetailLoading] = useState(false)
  const [complaintDraft, setComplaintDraft] = useState({ title: '', description: '', severity: 'MEDIUM' })
  const [searchKeyword, setSearchKeyword] = useState('')
  const [orderFilter, setOrderFilter] = useState<OrderFilterKey>('all')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterKey | 'all'>('all')
  const [filterMode, setFilterMode] = useState<'status' | 'payment'>('status')
  const processedMomoReturnRef = useRef('')
  const [paymentModalData, setPaymentModalData] = useState<{
    orderId: number
    paymentId?: number | null
    orderCode: string
    productName: string
    quantity: number
    unit?: string
    subtotal?: number | null
    shippingFee?: number | null
    totalAmount?: number | null
    paymentMethod: BuyerPaymentMethod
    transferContent?: string | null
    isRemaining: boolean
  } | null>(null)
  const branchContext = getBranchContextFromSearchParams(searchParams)
  const branchLabel = branchContext?.branchName || (branchContext?.branchId ? `Chi nhánh #${branchContext.branchId}` : '')

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await fetchBuyerOrders()
      const targetOrderId = Number(searchParams.get('localOrderId') || searchParams.get('orderId') || '')
      if (Number.isFinite(targetOrderId) && targetOrderId > 0) {
        const detail = await fetchBuyerOrder(targetOrderId)
        const merged = data.some((item) => item.orderId === detail.orderId)
          ? data.map((item) => (item.orderId === detail.orderId ? detail : item))
          : [detail, ...data]
        setOrders(merged)
        setSelectedOrderId(detail.id)
        setOpenDetail(true)
      } else {
        setOrders(data)
        setSelectedOrderId((current) => current || data[0]?.id || '')
      }
    } catch (requestError) {
      setOrders([])
      setError(readApiErrorMessage(requestError) || 'Không thể tải danh sách đơn hàng.')
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!searchParams.get('resultCode') || !searchParams.get('requestId')) return
    const returnKey = `${searchParams.get('requestId') || ''}:${searchParams.get('transId') || ''}:${searchParams.get('resultCode') || ''}`
    if (processedMomoReturnRef.current === returnKey) return
    processedMomoReturnRef.current = returnKey
    const payload: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      payload[key] = value
    })
    const momoOrderIds = searchParams.getAll('orderId').filter((value) => value.startsWith('AGRI-'))
    if (momoOrderIds.length > 0) payload.orderId = momoOrderIds[momoOrderIds.length - 1]
    const cleanupMomoReturnParams = () => {
      const next = new URLSearchParams(searchParams)
      const localOrderId = searchParams.get('localOrderId') || searchParams.getAll('orderId').find((value) => /^\d+$/.test(value))
      next.delete('payment')
      next.delete('partnerCode')
      next.delete('requestId')
      next.delete('amount')
      next.delete('orderInfo')
      next.delete('orderType')
      next.delete('transId')
      next.delete('resultCode')
      next.delete('message')
      next.delete('payType')
      next.delete('responseTime')
      next.delete('extraData')
      next.delete('signature')
      next.delete('localOrderId')
      next.delete('orderId')
      if (localOrderId) next.set('orderId', localOrderId)
      setSearchParams(next, { replace: true })
    }
    if (!payload.orderId || !payload.requestId || !payload.amount || !payload.resultCode) {
      cleanupMomoReturnParams()
      return
    }
    void confirmMomoReturn(payload)
      .then(async () => {
        showToast('MoMo da xac nhan thanh toan. Don hang dang duoc cap nhat.', 'success')
        cleanupMomoReturnParams()
        await loadOrders()
      })
      .catch(() => {
        showToast('Da quay ve tu MoMo nhung chua xac minh duoc thanh toan.', 'error')
        cleanupMomoReturnParams()
      })
  }, [loadOrders, searchParams, setSearchParams, showToast])

  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? orders[0],
    [orders, selectedOrderId],
  )

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => matchOrderFilter(o, orderFilter))
      .filter((o) => matchPaymentFilter(o, paymentFilter))
      .filter((o) => matchesBranchContext(o, branchContext))
      .filter((o) => {
        if (!searchKeyword.trim()) return true
        const kw = searchKeyword.trim().toLowerCase()
        return o.id.toLowerCase().includes(kw) || o.supplier.toLowerCase().includes(kw) || (o.product ?? '').toLowerCase().includes(kw)
      })
  }, [branchContext, orders, orderFilter, paymentFilter, searchKeyword])

  const orderFilterItems = useMemo(
    () => ORDER_FILTERS.map((item) => ({ ...item, count: orders.filter((order) => matchOrderFilter(order, item.key)).length })),
    [orders],
  )

  const paymentFilterItems = useMemo(
    () => PAYMENT_FILTERS.map((item) => ({ ...item, count: orders.filter((order) => matchPaymentFilter(order, item.key)).length })),
    [orders],
  )

  const refreshSelectedOrder = useCallback(async (order: BuyerOrder) => {
    if (!order.orderId) return
    setDetailLoading(true)
    try {
      const updated = await fetchBuyerOrder(order.orderId)
      setOrders((current) => current.map((item) => (item.orderId === updated.orderId ? updated : item)))
      setSelectedOrderId(updated.id)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải chi tiết đơn hàng.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }, [showToast])

  const refreshOrderState = useCallback(async () => {
    await loadOrders()
    if (openDetail && selectedOrder?.orderId) {
      await refreshSelectedOrder(selectedOrder)
    }
  }, [loadOrders, openDetail, refreshSelectedOrder, selectedOrder])

  useNotificationModuleRefresh(['ORDER', 'PAYMENT', 'DELIVERY', 'DEBT', 'COMPLAINT'], refreshOrderState)

  const handleFilterModeChange = (mode: typeof filterMode) => {
    setFilterMode(mode)
    if (mode === 'status') {
      setPaymentFilter('all')
      return
    }
    setOrderFilter('all')
  }

  const openOrderDetail = async (order: BuyerOrder) => {
    setSelectedOrderId(order.id)
    setActiveTab('info')
    setOpenDetail(true)
    setComplaintDraft({ title: '', description: '', severity: 'MEDIUM' })
    await refreshSelectedOrder(order)
  }

  const handleConfirmReceived = async () => {
    if (!selectedOrder?.orderId) return
    try {
      await confirmBuyerOrderReceived(selectedOrder.orderId)
      showToast('Đã xác nhận nhận hàng.', 'success')
      await refreshSelectedOrder(selectedOrder)
      await loadOrders()
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể xác nhận nhận hàng.', 'error')
    }
  }

  const openPaymentModal = (order: BuyerOrder, isRemaining: boolean) => {
    const payment = findPayablePayment(order)
    const primaryItem = order.items?.[0]
    const rawQuantity = order.quantity || ''
    const quantityNumber = (primaryItem?.quantity ?? Number(rawQuantity.replace(/[^0-9.]/g, ''))) || 0
    const unitLabel = primaryItem?.unit ?? rawQuantity.replace(/[0-9.\s]/g, '').trim()

    const resolvedShippingFee =
      order.shippingProviderCode === 'GHN' && order.shipment?.shippingFee != null
        ? order.shipment.shippingFee
        : (order.shippingFee ?? null)

    setPaymentModalData({
      orderId: order.orderId || 0,
      paymentId: payment?.id || null,
      orderCode: order.id,
      productName: primaryItem?.productName || order.product || 'Sản phẩm',
      quantity: quantityNumber,
      unit: unitLabel || undefined,
      subtotal: primaryItem?.subtotal ?? order.subtotal,
      shippingFee: resolvedShippingFee,
      totalAmount: payableAmountFor(order, payment),
      paymentMethod: (order.paymentMethod || 'ESCROW_TRANSFER') as BuyerPaymentMethod,
      transferContent: transferContentFor(order, payment),
      isRemaining,
    })
  }

  const handleConfirmPayment = async () => {
    if (!paymentModalData) return
    const updated = await confirmPayment({
      orderId: paymentModalData.orderId,
      paymentId: paymentModalData.paymentId,
      mode: paymentModalData.isRemaining ? 'remaining' : 'full',
    })
    if (updated) {
      setPaymentModalData(null)
      await loadOrders()
      if (selectedOrder) {
        await refreshSelectedOrder(selectedOrder)
      }
    }
  }

  const handleCreateComplaint = async () => {
    if (!selectedOrder?.orderId || !complaintDraft.title.trim() || !complaintDraft.description.trim()) {
      showToast('Vui lòng nhập tiêu đề và nội dung khiếu nại.', 'error')
      return
    }
    try {
      await createBuyerOrderComplaint(selectedOrder.orderId, {
        title: complaintDraft.title.trim(),
        description: complaintDraft.description.trim(),
        severity: complaintDraft.severity,
      })
      setComplaintDraft({ title: '', description: '', severity: 'MEDIUM' })
      showToast('Đã tạo khiếu nại cho đơn hàng.', 'success')
      await refreshSelectedOrder(selectedOrder)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tạo khiếu nại.', 'error')
    }
  }

  const tabClass = (tab: typeof activeTab) =>
    `inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
      activeTab === tab
        ? 'border-emerald-600 text-emerald-700'
        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
    }`
  void tabClass

  return (
    <>
      <BuyerShell
        activeKey="orders"
        title={branchLabel ? `Quản lý Đơn hàng - ${branchLabel}` : 'Quản lý Đơn hàng'}
        subtitle={branchLabel ? 'Đang xem đơn hàng trong phạm vi chi nhánh' : 'Theo dõi đơn hàng theo chi nhánh'}
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
              {branchLabel ? (
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-white"
                  onClick={() => setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    next.delete('branchId')
                    next.delete('branchName')
                    return next
                  }, { replace: true })}
                >
                  Chi nhánh: {branchLabel}
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <SearchInput
                value={searchKeyword}
                onChange={setSearchKeyword}
                placeholder="Tìm đơn, nhà cung cấp, sản phẩm..."
                className="min-w-[240px] max-w-sm"
              />
              <div className="inline-flex shrink-0 overflow-hidden rounded-full border border-emerald-100 bg-emerald-50 p-1 shadow-sm">
                <button
                  onClick={() => handleFilterModeChange('status')}
                  className={`min-h-9 min-w-[88px] rounded-full px-4 text-sm font-extrabold transition ${
                    filterMode === 'status' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-emerald-700 hover:bg-white/70'
                  }`}
                >
                  Trạng thái đơn
                </button>
                <button
                  onClick={() => handleFilterModeChange('payment')}
                  className={`min-h-9 min-w-[88px] rounded-full px-4 text-sm font-extrabold transition ${
                    filterMode === 'payment' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-emerald-700 hover:bg-white/70'
                  }`}
                >
                  Thanh toán
                </button>
              </div>
              {filterMode === 'status' && (
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  {orderFilterItems.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setOrderFilter(tab.key as OrderFilterKey)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                        orderFilter === tab.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {tab.label}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        orderFilter === tab.key ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                      }`}>{tab.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {filterMode === 'payment' && (
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  {paymentFilterItems.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setPaymentFilter(paymentFilter === tab.key ? 'all' : (tab.key as PaymentFilterKey))}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                        paymentFilter === tab.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {tab.label}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        paymentFilter === tab.key ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                      }`}>{tab.count}</span>
                    </button>
                  ))}
                </div>
              )}
          </div>
        }
      >
        <BuyerPanel title="Danh sách đơn hàng">
        {loading ? (
          <OrdersSkeletonLoader />
        ) : null}
        {!loading && error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
          {!loading && !error && orders.length === 0 && (
            <p className="mb-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              Chưa có đơn hàng nào.
            </p>
          )}
          {!loading && !error && orders.length > 0 && filteredOrders.length === 0 ? (
            <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 text-sm font-semibold text-emerald-800">
              Không tìm thấy đơn hàng phù hợp.
            </p>
          ) : null}
          {!loading && <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[1160px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Mã đơn</th>
                  <th className="px-4 py-3">Nhà cung cấp</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">Giá trị</th>
                  <th className="px-4 py-3">Trạng thái đơn</th>
                  <th className="px-4 py-3">Thanh toán</th>
                  <th className="px-4 py-3">Ngày đặt</th>
                  <th className="px-4 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.map((row) => (
                  <tr
                    key={row.id}
                    className="group cursor-pointer bg-white text-sm transition-colors hover:bg-emerald-50/30"
                    onClick={() => { void openOrderDetail(row) }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-emerald-800">{row.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{row.supplier}</p>
                      <p className="max-w-[180px] truncate text-xs text-slate-400" title={row.branch}>{row.branch}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <BuyerOrderItemsPreview order={row} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-base font-extrabold text-slate-950">{row.value}</p>
                    </td>
                    <td className="px-4 py-3">
                      <EnterpriseStatusPill label={statusLabel(row.status)} tone={statusTone(row.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800">{paymentMethodLabel(row)}</p>
                        <EnterpriseStatusPill label={paymentStateLabel(row)} tone={isOverdue(row) ? 'danger' : statusTone(row.paymentStatus || row.invoiceStatus)} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={(event) => {
                          event.stopPropagation()
                          void openOrderDetail(row)
                        }}
                        aria-label={`Mở chi tiết đơn ${row.id}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </BuyerPanel>
      </BuyerShell>

      {openDetail && selectedOrder ? (
        <BuyerOrderDetailModal
          order={selectedOrder}
          activeTab={activeTab}
          detailLoading={detailLoading}
          complaintDraft={complaintDraft}
          onActiveTabChange={setActiveTab}
          onClose={() => setOpenDetail(false)}
          onComplaintDraftChange={setComplaintDraft}
          onCreateComplaint={() => void handleCreateComplaint()}
          onOpenPaymentModal={openPaymentModal}
          onConfirmReceived={() => void handleConfirmReceived()}
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
          transferContent={paymentModalData.transferContent}
          confirming={confirming}
          onClose={() => setPaymentModalData(null)}
          onConfirmPaid={() => void handleConfirmPayment()}
        />
      ) : null}
    </>
  )
}
