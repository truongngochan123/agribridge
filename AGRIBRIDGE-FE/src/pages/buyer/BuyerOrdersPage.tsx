import { AlertCircle, Eye, FileText, MapPin, Phone, Printer, Receipt, Truck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BuyerPanel, BuyerStatusPill } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useToast } from '../../hooks/useToast'
import {
  confirmBuyerOrderReceived,
  createBuyerOrderComplaint,
  fetchBuyerOrder,
  fetchBuyerOrders,
  type BuyerOrder,
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

export function BuyerOrdersPage() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<BuyerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openDetail, setOpenDetail] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'shipping' | 'invoice' | 'complaint'>('info')
  const [detailLoading, setDetailLoading] = useState(false)
  const [complaintDraft, setComplaintDraft] = useState({ title: '', description: '', severity: 'MEDIUM' })

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await fetchBuyerOrders()
      setOrders(data)
      setSelectedOrderId((current) => current || data[0]?.id || '')
    } catch (requestError) {
      setOrders([])
      setError(readApiErrorMessage(requestError) || 'Không thể tải danh sách đơn hàng.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? orders[0],
    [orders, selectedOrderId],
  )

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
      <BuyerShell activeKey="orders" title="Quản lý Đơn hàng" subtitle="Theo dõi đơn hàng theo chi nhánh">
        <BuyerPanel title="Đơn hàng gần đây">
          {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải dữ liệu đơn hàng...</p> : null}
          {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
          {!loading && !error && orders.length === 0 ? (
            <p className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-semibold text-emerald-800">
              Chưa có đơn hàng nào cho tài khoản buyer này.
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-emerald-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-emerald-50 text-emerald-800">
                <tr>
                  <th className="px-3 py-2 font-semibold">MÃ ĐƠN</th>
                  <th className="px-3 py-2 font-semibold">NHÀ CUNG CẤP</th>
                  <th className="px-3 py-2 font-semibold">SẢN PHẨM</th>
                  <th className="px-3 py-2 font-semibold">CHI NHÁNH</th>
                  <th className="px-3 py-2 font-semibold">GIÁ TRỊ</th>
                  <th className="px-3 py-2 font-semibold">TRẠNG THÁI</th>
                  <th className="px-3 py-2 font-semibold">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((row) => (
                  <tr key={row.id} className="border-t border-emerald-100">
                    <td className="px-3 py-2 font-semibold text-emerald-900">{row.id}</td>
                    <td className="px-3 py-2 text-emerald-900">{row.supplier}</td>
                    <td className="px-3 py-2 text-emerald-900">
                      {row.product}
                      <div className="text-xs text-emerald-700/70">{row.quantity}</div>
                    </td>
                    <td className="px-3 py-2 text-emerald-900">{row.branch}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-900">{row.value}</td>
                    <td className="px-3 py-2"><BuyerStatusPill status={row.status} /></td>
                    <td className="px-3 py-2">
                      <button
                        className="rounded-md border border-emerald-200 p-1.5 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => {
                          void openOrderDetail(row)
                        }}
                      >
                        <Eye className="h-4 w-4" />
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
                <span className="rounded-md bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600">{selectedOrder.status}</span>
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
                  <div className="flex justify-end">
                    <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Thanh toán</button>
                  </div>
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
                    {selectedOrder.payments?.length ? (
                      <div className="mt-3 space-y-2">
                        {selectedOrder.payments.map((payment) => (
                          <div key={payment.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                            <span className="font-semibold">{payment.paymentType || payment.paymentMethod}</span> · {payment.status} · {formatCurrency(payment.paidAmount || payment.amount)}
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
                <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white" onClick={() => void handleConfirmReceived()}>
                  <Truck className="h-3.5 w-3.5" /> Xác nhận nhận hàng
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
