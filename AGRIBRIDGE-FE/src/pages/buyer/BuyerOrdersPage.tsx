import { AlertCircle, Eye, FileText, MapPin, Phone, Printer, Receipt, Truck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BuyerPanel, BuyerStatusPill, FilterTabBar, SearchInput } from '../../components/buyer/BuyerCommon'
import { AlertTriangle } from 'lucide-react'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  confirmBuyerOrderReceived,
  createBuyerOrderComplaint,
  demoConfirmBuyerOrderPayment,
  demoPayBuyerOrderRemaining,
  fetchBuyerOrder,
  fetchBuyerOrders,
  type BuyerOrder,
  type BuyerOrderPayment,
} from '../../services/buyerOrderService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

function formatCurrency(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ`
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('vi-VN')
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING_DEPOSIT: 'Chờ thanh toán tiền cọc',
  DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM: 'Đã cọc, chờ supplier xác nhận',
  PAID_WAITING_SUPPLIER_CONFIRM: 'Đã thanh toán, chờ supplier xác nhận',
  SUPPLIER_CONFIRMED: 'Supplier đã xác nhận',
  PREPARING: 'Đang chuẩn bị hàng',
  READY_TO_SHIP: 'Sẵn sàng giao hàng',
  SHIPPING: 'Đang giao hàng',
  DELIVERED: 'Đã giao tới nơi',
  WAITING_FINAL_PAYMENT: 'Chờ thanh toán phần còn lại',
  WAITING_BUYER_CONFIRM: 'Chờ buyer xác nhận nhận hàng',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  DISPUTED: 'Đang khiếu nại',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  WAITING_TRANSFER: 'Chờ chuyển khoản',
  PENDING_VERIFY: 'Chờ xác minh',
  PARTIALLY_PAID: 'Đã thanh toán một phần',
  WAITING_REMAINING_PAYMENT: 'Chờ thanh toán số tiền còn lại',
  PAID: 'Đã thanh toán',
  FAILED: 'Thất bại',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
}

const ESCROW_STATUS_LABELS: Record<string, string> = {
  NOT_FUNDED: 'Sàn chưa nhận tiền',
  PARTIALLY_HELD: 'Sàn đang giữ tiền cọc',
  HELD: 'Sàn đang giữ tiền',
  RELEASE_PENDING: 'Chờ giải ngân',
  RELEASED: 'Sàn đã giải ngân',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
  DISPUTED: 'Đang khiếu nại',
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
  WAITING_CONFIRMATION: 'Chờ buyer xác nhận',
  FAILED: 'Thất bại',
}

function statusLabel(status?: string | null) {
  if (!status) return 'Chưa có trạng thái'
  return `${ORDER_STATUS_LABELS[status] || status} (${status})`
}

function labeledStatus(status?: string | null, labels: Record<string, string> = {}) {
  if (!status) return 'Chưa có'
  return `${labels[status] || status} (${status})`
}

function findPayablePayment(order?: BuyerOrder | null): BuyerOrderPayment | null {
  if (!order) return null
  if (order.status === 'WAITING_FINAL_PAYMENT') {
    return {
      id: 0,
      amount: order.remainingAmount ?? Math.max((order.totalAmount ?? 0) - (order.invoicePaidAmount ?? 0), 0),
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
    return order.payments.find((payment) => payment.status === 'WAITING_TRANSFER') ?? order.payments[0]
  }
  return order.payments.find((payment) => payment.status === 'WAITING_REMAINING_PAYMENT') ?? null
}

function transferContentFor(order: BuyerOrder, payment?: BuyerOrderPayment | null) {
  if (payment?.transferContent) return payment.transferContent
  if (order.status === 'WAITING_FINAL_PAYMENT') return `AGRI-REMAINING-${order.orderId ?? order.id}`
  if (order.paymentOption === 'DEPOSIT_50' || order.status === 'PENDING_DEPOSIT') return `AGRI-DEPOSIT-${order.orderId ?? order.id}`
  return `AGRI-ORDER-${order.orderId ?? order.id}`
}

function payableAmountFor(order: BuyerOrder, payment?: BuyerOrderPayment | null) {
  if (payment?.amount != null) return payment.amount
  if (order.status === 'WAITING_FINAL_PAYMENT') return order.remainingAmount ?? Math.max((order.totalAmount ?? 0) - (order.invoicePaidAmount ?? 0), 0)
  if (order.status === 'PENDING_DEPOSIT') return order.depositAmount ?? (order.totalAmount ?? 0) * 0.5
  return order.totalAmount ?? 0
}

export function BuyerOrdersPage() {
  usePageTitle('Đơn hàng')
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState<BuyerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openDetail, setOpenDetail] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'shipping' | 'invoice' | 'complaint'>('info')
  const [detailLoading, setDetailLoading] = useState(false)
  const [complaintDraft, setComplaintDraft] = useState({ title: '', description: '', severity: 'MEDIUM' })
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | string>('all')

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await fetchBuyerOrders()
      const targetOrderId = Number(searchParams.get('orderId') || '')
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

  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? orders[0],
    [orders, selectedOrderId],
  )

  const allStatuses = useMemo(() => Array.from(new Set(orders.map((o) => o.status))), [orders])

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => filterStatus === 'all' || o.status === filterStatus)
      .filter((o) => {
        if (!searchKeyword.trim()) return true
        const kw = searchKeyword.trim().toLowerCase()
        return o.id.toLowerCase().includes(kw) || o.supplier.toLowerCase().includes(kw) || (o.product ?? '').toLowerCase().includes(kw)
      })
  }, [orders, filterStatus, searchKeyword])

  const refreshSelectedOrder = async (order: BuyerOrder) => {
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

  const handleDemoConfirmPayment = async () => {
    if (!selectedOrder?.orderId) return
    try {
      const updated = await demoConfirmBuyerOrderPayment(selectedOrder.orderId)
      setOrders((current) => current.map((item) => (item.orderId === updated.orderId ? updated : item)))
      setSelectedOrderId(updated.id)
      showToast('Đã demo xác nhận thanh toán.', 'success')
      await loadOrders()
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể xác nhận thanh toán demo.', 'error')
    }
  }

  const handleDemoPayRemaining = async () => {
    if (!selectedOrder?.orderId) return
    try {
      const updated = await demoPayBuyerOrderRemaining(selectedOrder.orderId)
      setOrders((current) => current.map((item) => (item.orderId === updated.orderId ? updated : item)))
      setSelectedOrderId(updated.id)
      showToast('Đã demo thanh toán phần còn lại.', 'success')
      await loadOrders()
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể thanh toán phần còn lại.', 'error')
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
    `inline-flex items-center gap-1.5 rounded-t-lg border px-3 py-2 text-xs font-semibold ${
      activeTab === tab
        ? 'border-slate-300 border-b-white bg-white text-blue-600'
        : 'border-transparent bg-transparent text-slate-600 hover:text-slate-900'
    }`

  return (
    <>
      <BuyerShell
        activeKey="orders"
        title="Quản lý Đơn hàng"
        subtitle="Theo dõi đơn hàng theo chi nhánh"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={searchKeyword}
              onChange={setSearchKeyword}
              placeholder="Tìm đơn, nhà cung cấp..."
              className="min-w-[220px] max-w-sm"
            />
            <FilterTabBar
              tabs={[
                { key: 'all', label: 'Tất cả', count: orders.length },
                ...allStatuses.map((s) => ({ key: s, label: s, count: orders.filter((o) => o.status === s).length })),
              ]}
              activeKey={filterStatus}
              onChange={setFilterStatus}
            />
          </div>
        }
      >
        <BuyerPanel title="Đơn hàng gần đây">
        {loading && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Đang tải dữ liệu đơn hàng...
          </div>
        )}
        {error && (
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
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">Mã đơn</th>
                  <th className="px-3 py-3">Nhà cung cấp</th>
                  <th className="px-3 py-3">Sản phẩm</th>
                  <th className="px-3 py-3">Chi nhánh</th>
                  <th className="px-3 py-3">Giá trị</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.map((row) => (
                  <tr key={row.id} className="bg-white text-sm transition-colors hover:bg-emerald-50/30">
                    <td className="px-3 py-2.5 font-bold text-slate-800">{row.id}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.supplier}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-800">{row.product}</p>
                      <p className="text-xs text-slate-400">{row.quantity}</p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{row.branch}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{row.value}</td>
                    <td className="px-3 py-2.5"><BuyerStatusPill status={statusLabel(row.status)} /></td>
                    <td className="px-3 py-2.5">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors active:scale-95"
                        onClick={() => { void openOrderDetail(row) }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BuyerPanel>
      </BuyerShell>

      {openDetail && selectedOrder ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={() => setOpenDetail(false)}>
          <div
            className="mx-auto mt-8 w-full max-w-5xl overflow-hidden rounded-2xl bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-3xl font-extrabold text-slate-900">Chi tiết đơn hàng {selectedOrder.id}</h3>
                <p className="text-xs text-slate-500">
                  {selectedOrder.rfqCode ? `Tạo từ ${selectedOrder.rfqCode}` : 'Đơn hàng đặt nhanh'}{selectedOrder.quoteId ? ` - Quote ${selectedOrder.quoteId}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600">{statusLabel(selectedOrder.status)}</span>
                <button className="text-slate-500" onClick={() => setOpenDetail(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 px-4 pt-3">
              <div className="flex flex-wrap gap-1">
                <button className={tabClass('info')} onClick={() => setActiveTab('info')}><FileText className="h-3.5 w-3.5" /> Thông tin đơn</button>
                <button className={tabClass('shipping')} onClick={() => setActiveTab('shipping')}><Truck className="h-3.5 w-3.5" /> Theo dõi giao hàng</button>
                <button className={tabClass('invoice')} onClick={() => setActiveTab('invoice')}><Receipt className="h-3.5 w-3.5" /> Hóa đơn & Thanh toán</button>
                <button className={tabClass('complaint')} onClick={() => setActiveTab('complaint')}><AlertCircle className="h-3.5 w-3.5" /> Khiếu nại</button>
              </div>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-4">
              {detailLoading ? <p className="mb-3 text-sm font-semibold text-blue-600">Đang tải chi tiết đơn hàng...</p> : null}
              {activeTab === 'info' ? (
                <div className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Nhà cung cấp</p><p className="text-sm font-semibold">{selectedOrder.supplier}</p></div>
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Chi nhánh nhận hàng</p><p className="text-sm font-semibold">{selectedOrder.branch}</p></div>
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Ngày tạo</p><p className="text-sm font-semibold">{formatDate(selectedOrder.createdAt)}</p></div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-bold">Sản phẩm trong đơn</h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left">Mã lô</th>
                            <th className="px-3 py-2 text-left">Sản phẩm</th>
                            <th className="px-3 py-2 text-left">Grade/Size</th>
                            <th className="px-3 py-2 text-left">Ngày thu hoạch</th>
                            <th className="px-3 py-2 text-left">SL</th>
                            <th className="px-3 py-2 text-left">Đơn giá</th>
                            <th className="px-3 py-2 text-left">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedOrder.items ?? []).map((item) => (
                            <tr key={`${item.batchId}-${item.productId}`} className="border-t border-slate-200">
                              <td className="px-3 py-2 text-blue-600">{item.batchCode}</td>
                              <td className="px-3 py-2">{item.productName}</td>
                              <td className="px-3 py-2">{[item.grade, item.size].filter(Boolean).join(' / ') || 'N/A'}</td>
                              <td className="px-3 py-2">{formatDate(item.harvestDate)}</td>
                              <td className="px-3 py-2">{item.quantity} {item.unit}</td>
                              <td className="px-3 py-2">{formatCurrency(item.price)}</td>
                              <td className="px-3 py-2 font-semibold">{formatCurrency(item.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-right text-sm font-bold">Tổng cộng: <span className="text-blue-600">{formatCurrency(selectedOrder.totalAmount)}</span></p>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-bold">Lịch giao hàng</h4>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-semibold">{selectedOrder.shippingServiceName || selectedOrder.shippingProviderName || 'Chưa có đơn vị vận chuyển'}</p>
                      <p className="text-xs text-slate-500">Dự kiến giao: {selectedOrder.estimatedDeliveryTime || 'Chưa có'}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-bold">Ghi chú nội bộ</h4>
                    <textarea className="h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Thêm ghi chú cho đơn hàng này..." />
                    <button className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Lưu ghi chú</button>
                  </div>
                </div>
              ) : activeTab === 'shipping' ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {(selectedOrder.trackingEvents?.length ? selectedOrder.trackingEvents : [{ title: 'Đơn hàng được tạo', time: formatDate(selectedOrder.createdAt), done: true }]).map((event) => (
                      <div key={`${event.title}-${event.time}`} className="flex items-start gap-2">
                        <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">•</span>
                        <div>
                          <p className="text-sm font-semibold">{event.title}</p>
                          <p className="text-xs text-slate-500">{event.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <h4 className="mb-2 text-sm font-bold">Thông tin vận chuyển</h4>
                    {selectedOrder.shipment ? (
                      <div className="mb-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs md:grid-cols-3">
                        <p><span className="text-slate-500">Provider:</span> <span className="font-bold">{selectedOrder.shipment.provider || 'MANUAL'}</span></p>
                        <p><span className="text-slate-500">Tracking:</span> <span className="font-bold">{selectedOrder.shipment.trackingCode || selectedOrder.trackingCode || 'Chưa có'}</span></p>
                        <p><span className="text-slate-500">Trạng thái:</span> <span className="font-bold">{labeledStatus(selectedOrder.shipment.shipmentStatus, SHIPMENT_STATUS_LABELS)}</span></p>
                        <p><span className="text-slate-500">Dự kiến:</span> <span className="font-bold">{formatDate(selectedOrder.shipment.expectedDeliveryDate || selectedOrder.expectedDeliveryDate)}</span></p>
                        <p><span className="text-slate-500">Đã giao:</span> <span className="font-bold">{formatDate(selectedOrder.shipment.deliveredAt)}</span></p>
                        <p><span className="text-slate-500">Người nhận:</span> <span className="font-bold">{selectedOrder.shipment.receiverName || selectedOrder.deliveryName || 'Chưa có'}</span></p>
                      </div>
                    ) : null}
                    <div className="grid gap-2 md:grid-cols-3 text-sm">
                      <p><span className="text-slate-500">Tài xế:</span> {selectedOrder.driverName || 'Chưa có'}</p>
                      <p><span className="text-slate-500">Số điện thoại:</span> {selectedOrder.driverPhone || selectedOrder.deliveryPhone || 'Chưa có'}</p>
                      <p><span className="text-slate-500">Biển số xe:</span> {selectedOrder.vehicleInfo || selectedOrder.trackingCode || 'Chưa có'}</p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white inline-flex items-center justify-center gap-1"><MapPin className="h-3.5 w-3.5" /> Xem bản đồ theo dõi</button>
                      <button className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1"><Phone className="h-3.5 w-3.5" /> Gọi tài xế</button>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'invoice' ? (
                <div className="space-y-3">
                  {findPayablePayment(selectedOrder) ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold text-emerald-900">Thông tin chuyển khoản demo</p>
                          <p className="text-xs text-emerald-700">Sàn giữ tiền escrow và chỉ giải ngân sau khi buyer xác nhận nhận hàng.</p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-emerald-700">
                          {labeledStatus(findPayablePayment(selectedOrder)?.status, PAYMENT_STATUS_LABELS)}
                        </span>
                      </div>
                      <div className="grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                        <p><span className="text-slate-500">Ngân hàng:</span> <span className="font-bold">DEMO BANK</span></p>
                        <p><span className="text-slate-500">Tên tài khoản:</span> <span className="font-bold">AGRIBRIDGE PLATFORM</span></p>
                        <p><span className="text-slate-500">Số tài khoản:</span> <span className="font-bold">123456789</span></p>
                        <p><span className="text-slate-500">Số tiền:</span> <span className="font-bold text-emerald-700">{formatCurrency(payableAmountFor(selectedOrder, findPayablePayment(selectedOrder)))}</span></p>
                        <p className="md:col-span-2"><span className="text-slate-500">Nội dung chuyển khoản:</span> <span className="font-bold text-blue-700">{transferContentFor(selectedOrder, findPayablePayment(selectedOrder))}</span></p>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {selectedOrder.status === 'PENDING_PAYMENT' || selectedOrder.status === 'PENDING_DEPOSIT' ? (
                          <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void handleDemoConfirmPayment()}>
                            <Receipt className="h-3.5 w-3.5" /> Demo xác nhận thanh toán
                          </button>
                        ) : null}
                        {selectedOrder.status === 'WAITING_FINAL_PAYMENT' ? (
                          <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void handleDemoPayRemaining()}>
                            <Receipt className="h-3.5 w-3.5" /> Thanh toán phần còn lại
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-lg font-extrabold">{selectedOrder.invoiceCode || 'Chưa có hóa đơn'}</p>
                      <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-600">{selectedOrder.invoiceStatus || 'UNPAID'}</span>
                    </div>
                    <p className="text-xs text-slate-500">Ngày phát hành: {formatDate(selectedOrder.createdAt)}</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <div className="rounded-md bg-slate-50 p-2"><p className="text-xs text-slate-500">Tổng tiền</p><p className="font-bold">{formatCurrency(selectedOrder.totalAmount)}</p></div>
                      <div className="rounded-md bg-slate-50 p-2"><p className="text-xs text-slate-500">Đã thanh toán</p><p className="font-bold text-emerald-600">{formatCurrency(selectedOrder.invoicePaidAmount)}</p></div>
                      <div className="rounded-md bg-slate-50 p-2"><p className="text-xs text-slate-500">Còn lại</p><p className="font-bold text-red-600">{formatCurrency((selectedOrder.totalAmount ?? 0) - (selectedOrder.invoicePaidAmount ?? 0))}</p></div>
                    </div>
                    <p className="mt-3 text-xs text-slate-600">Hạn thanh toán: <span className="font-semibold">{formatDate(selectedOrder.invoiceDueDate)}</span></p>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <div className="rounded-md bg-slate-50 p-2 text-xs">
                        <p className="text-slate-500">Phương thức</p>
                        <p className="font-bold text-slate-800">{selectedOrder.paymentOption || selectedOrder.paymentMethod || 'BANK_TRANSFER_DEMO'}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2 text-xs">
                        <p className="text-slate-500">Payment</p>
                        <p className="font-bold text-slate-800">{labeledStatus(selectedOrder.paymentStatus, PAYMENT_STATUS_LABELS)}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2 text-xs">
                        <p className="text-slate-500">Escrow</p>
                        <p className="font-bold text-slate-800">{labeledStatus(selectedOrder.escrowStatus, ESCROW_STATUS_LABELS)}</p>
                      </div>
                    </div>
                    {selectedOrder.payments?.length ? (
                      <div className="mt-3 space-y-2">
                        {selectedOrder.payments.map((payment) => (
                          <div key={payment.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                            <span className="font-semibold">{payment.paymentType || payment.paymentMethod}</span> · {payment.status} · {formatCurrency(payment.paidAmount || payment.amount)}
                            <p className="mt-1 text-[11px] text-slate-500">
                              {labeledStatus(payment.status, PAYMENT_STATUS_LABELS)} · {labeledStatus(payment.escrowStatus, ESCROW_STATUS_LABELS)}
                              {payment.transferContent ? <span className="ml-1 font-semibold text-blue-700">· {payment.transferContent}</span> : null}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-3">
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={complaintDraft.title}
                      placeholder="Tiêu đề khiếu nại"
                      onChange={(event) => setComplaintDraft((current) => ({ ...current, title: event.target.value }))}
                    />
                    <select
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={complaintDraft.severity}
                      onChange={(event) => setComplaintDraft((current) => ({ ...current, severity: event.target.value }))}
                    >
                      <option value="LOW">Thấp</option>
                      <option value="MEDIUM">Trung bình</option>
                      <option value="HIGH">Cao</option>
                    </select>
                    <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void handleCreateComplaint()}>
                      Tạo khiếu nại
                    </button>
                    <textarea
                      className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3"
                      value={complaintDraft.description}
                      placeholder="Mô tả vấn đề cần xử lý..."
                      onChange={(event) => setComplaintDraft((current) => ({ ...current, description: event.target.value }))}
                    />
                  </div>
                  {selectedOrder.complaints?.length ? (
                    <div className="space-y-2">
                      {selectedOrder.complaints.map((complaint) => (
                        <div key={complaint.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-slate-900">{complaint.title || 'Khiếu nại đơn hàng'}</p>
                            <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">{complaint.status}</span>
                          </div>
                          <p className="mt-1 text-slate-600">{complaint.description}</p>
                          {complaint.resolution ? <p className="mt-2 text-xs font-semibold text-emerald-700">Kết quả: {complaint.resolution}</p> : null}
                          <p className="mt-2 text-xs text-slate-500">Mức độ: {complaint.severity || 'MEDIUM'} · {formatDate(complaint.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-500">
                      Chưa có khiếu nại nào cho đơn hàng này
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-3">
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700" onClick={() => setOpenDetail(false)}>
                Đóng
              </button>
              <div className="flex gap-2">
                <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700"><Printer className="h-3.5 w-3.5" /> In đơn hàng</button>
                {selectedOrder.status === 'PENDING_PAYMENT' || selectedOrder.status === 'PENDING_DEPOSIT' ? (
                  <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white" onClick={() => void handleDemoConfirmPayment()}>
                    <Receipt className="h-3.5 w-3.5" /> Demo xác nhận thanh toán
                  </button>
                ) : null}
                {selectedOrder.status === 'WAITING_FINAL_PAYMENT' ? (
                  <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white" onClick={() => void handleDemoPayRemaining()}>
                    <Receipt className="h-3.5 w-3.5" /> Thanh toán phần còn lại
                  </button>
                ) : null}
                {selectedOrder.status === 'WAITING_BUYER_CONFIRM' ? (
                  <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white" onClick={() => void handleConfirmReceived()}>
                    <Truck className="h-3.5 w-3.5" /> Đã nhận hàng
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
