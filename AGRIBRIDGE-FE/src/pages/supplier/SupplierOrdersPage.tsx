import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { SearchInput, SupplierPanel, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  createSupplierShipment,
  fetchSupplierOrders,
  getSupplierOrderDetail,
  runSupplierDemoOrderAction,
  updateSupplierOrderStatus,
  updateSupplierShipmentStatus,
  type CreateSupplierShipmentRequest,
  type SupplierOrderAction,
  type SupplierOrderDetail,
  type SupplierOrderRow,
  type SupplierShipmentStatusCode,
} from '../../services/supplierService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

type OrderTabKey = 'all' | 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED'

// eslint-disable-next-line react-refresh/only-export-components
export const ORDER_TABS: Array<{ key: OrderTabKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xác nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'SHIPPING', label: 'Đang giao' },
  { key: 'DELIVERED', label: 'Hoàn thành' },
  { key: 'CANCELLED', label: 'Đã hủy' },
]

const ACTION_LABEL: Record<SupplierOrderAction, string> = {
  VIEW_DETAIL: 'Chi tiết',
  CONFIRM_ORDER: 'Xác nhận',
  CANCEL_ORDER: 'Hủy',
  CREATE_SHIPMENT: 'Tạo vận đơn',
  START_SHIPPING: 'Bắt đầu giao',
  PREPARE_ORDER: 'Đang chuẩn bị hàng',
  READY_TO_SHIP: 'Sẵn sàng giao',
  MARK_IN_TRANSIT: 'Cập nhật đang vận chuyển',
  MARK_ARRIVED: 'Đã giao hàng',
  REPORT_INCIDENT: 'Báo sự cố',
  VIEW_SHIPMENT: 'Xem vận đơn',
}

function getSessionCompanyId(): number | null {
  const companyId = Number(localStorage.getItem('agribridge.auth.companyId'))
  return Number.isFinite(companyId) && companyId > 0 ? companyId : null
}

function isShippingOrder(order: SupplierOrderRow): boolean {
  return order.statusCode === 'CONFIRMED' && (order.shipmentStatusCode === 'SHIPPED' || order.shipmentStatusCode === 'IN_TRANSIT')
}

function isWaitingBuyer(order: SupplierOrderRow): boolean {
  return order.statusCode === 'CONFIRMED' && order.shipmentStatusCode === 'WAITING_CONFIRMATION'
}

function searchableText(order: SupplierOrderRow): string {
  return [
    order.id,
    order.customer,
    order.branch,
    order.product,
    order.quantity,
    order.value,
    order.status,
    order.shipmentStatus,
    order.orderDate,
    ...order.items.map((item) => `${item.product} ${item.batchCode} ${item.grade} ${item.size}`),
  ].join(' ').toLowerCase()
}

function emptyShipmentForm(): CreateSupplierShipmentRequest {
  return {
    carrierName: '',
    shippingMethod: '',
    driverName: '',
    driverPhone: '',
    vehicleInfo: '',
    trackingCode: '',
    shippingFee: undefined,
    note: '',
  }
}

export function SupplierOrdersPage() {
  usePageTitle('Đơn hàng')
  const { showToast, showConfirm } = useToast()
  const [orders, setOrders] = useState<SupplierOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<OrderTabKey>('all')
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null)
  const [shipmentOrder, setShipmentOrder] = useState<SupplierOrderRow | null>(null)
  const [shipmentForm, setShipmentForm] = useState<CreateSupplierShipmentRequest>(() => emptyShipmentForm())

  const loadOrders = useCallback(async () => {
    const companyId = getSessionCompanyId()
    if (!companyId) {
      setError('Thiếu companyId trong session, vui lòng đăng nhập lại.')
      setOrders([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')
      setOrders(await fetchSupplierOrders(companyId))
    } catch (requestError) {
      setError(readApiErrorMessage(requestError) || 'Không thể tải danh sách đơn hàng.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const statusCount = useMemo(() => ({
    pending: orders.filter((item) => item.statusCode === 'PENDING').length,
    confirmed: orders.filter((item) => item.statusCode === 'CONFIRMED' && !isShippingOrder(item) && !isWaitingBuyer(item)).length,
    shipping: orders.filter(isShippingOrder).length,
    completed: orders.filter((item) => item.statusCode === 'DELIVERED').length,
    cancelled: orders.filter((item) => item.statusCode === 'CANCELLED').length,
  }), [orders])

  const filteredOrders = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesTab = activeTab === 'all'
        || (activeTab === 'SHIPPING' ? isShippingOrder(order) : order.statusCode === activeTab)
      const matchesKeyword = !keyword || searchableText(order).includes(keyword)
      return matchesTab && matchesKeyword
    })
  }, [activeTab, orders, searchKeyword])

  const replaceOrder = (updated: SupplierOrderRow) => {
    setOrders((prev) => prev.map((item) => (item.rawId === updated.rawId ? updated : item)))
  }

  const reloadSelectedOrder = async (orderId: number) => {
    const companyId = getSessionCompanyId()
    if (!companyId) return
    setSelectedOrder(await getSupplierOrderDetail(companyId, orderId))
  }

  const openOrderDetail = async (orderId: number) => {
    const companyId = getSessionCompanyId()
    if (!companyId) {
      showToast('Thiếu companyId trong session, vui lòng đăng nhập lại.', 'error')
      return
    }

    try {
      setDetailLoading(true)
      setSelectedOrder(await getSupplierOrderDetail(companyId, orderId))
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải chi tiết đơn hàng.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleOrderStatus = async (order: SupplierOrderRow | SupplierOrderDetail, status: 'CONFIRMED' | 'CANCELLED') => {
    const companyId = getSessionCompanyId()
    if (!companyId) {
      showToast('Thiếu companyId trong session, vui lòng đăng nhập lại.', 'error')
      return
    }

    const confirmed = await showConfirm(
      status === 'CONFIRMED' ? `Xác nhận đơn ${order.id}?` : `Hủy đơn ${order.id}?`,
      { title: 'Xác nhận thao tác', confirmText: status === 'CONFIRMED' ? 'Xác nhận' : 'Hủy đơn', cancelText: 'Đóng' },
    )
    if (!confirmed) return

    try {
      setUpdatingOrderId(order.rawId)
      const updated = await updateSupplierOrderStatus(companyId, order.rawId, status)
      replaceOrder(updated)
      if (selectedOrder?.rawId === updated.rawId) await reloadSelectedOrder(updated.rawId)
      showToast('Cập nhật đơn hàng thành công.', 'success')
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể cập nhật đơn hàng.', 'error')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleShipmentStatus = async (order: SupplierOrderRow | SupplierOrderDetail, status: SupplierShipmentStatusCode) => {
    const companyId = getSessionCompanyId()
    if (!companyId) {
      showToast('Thiếu companyId trong session, vui lòng đăng nhập lại.', 'error')
      return
    }

    const confirmed = await showConfirm(`Cập nhật vận đơn của ${order.id}?`, {
      title: 'Cập nhật vận đơn',
      confirmText: 'Cập nhật',
      cancelText: 'Đóng',
    })
    if (!confirmed) return

    try {
      setUpdatingOrderId(order.rawId)
      const updated = await updateSupplierShipmentStatus(companyId, order.rawId, status)
      replaceOrder(updated)
      if (selectedOrder?.rawId === updated.rawId) await reloadSelectedOrder(updated.rawId)
      showToast('Cập nhật vận đơn thành công.', 'success')
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể cập nhật vận đơn.', 'error')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleDemoAction = async (order: SupplierOrderRow | SupplierOrderDetail, action: SupplierOrderAction) => {
    try {
      setUpdatingOrderId(order.rawId)
      const updated = await runSupplierDemoOrderAction(order.rawId, action)
      replaceOrder(updated)
      if (selectedOrder?.rawId === updated.rawId) await reloadSelectedOrder(updated.rawId)
      await loadOrders()
      showToast('Cập nhật đơn hàng demo thành công.', 'success')
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể cập nhật đơn hàng demo.', 'error')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const openShipmentModal = (order: SupplierOrderRow | SupplierOrderDetail) => {
    setShipmentOrder(order as SupplierOrderRow)
    setShipmentForm(emptyShipmentForm())
  }

  const handleCreateShipment = async () => {
    const companyId = getSessionCompanyId()
    if (!companyId || !shipmentOrder) return

    try {
      setUpdatingOrderId(shipmentOrder.rawId)
      const updated = await createSupplierShipment(companyId, shipmentOrder.rawId, shipmentForm)
      replaceOrder(updated)
      setShipmentOrder(null)
      setShipmentForm(emptyShipmentForm())
      if (selectedOrder?.rawId === updated.rawId) await reloadSelectedOrder(updated.rawId)
      showToast('Đã tạo vận đơn.', 'success')
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tạo vận đơn.', 'error')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const renderActionButton = (order: SupplierOrderRow | SupplierOrderDetail, action: SupplierOrderAction) => {
    if (action === 'VIEW_DETAIL') {
      return (
        <button key={action} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => void openOrderDetail(order.rawId)}>
          {ACTION_LABEL[action]}
        </button>
      )
    }
    if (action === 'CONFIRM_ORDER') {
      return <ActionButton key={action} label={ACTION_LABEL[action]} disabled={updatingOrderId === order.rawId} onClick={() => void handleDemoAction(order, action)} />
    }
    if (action === 'CANCEL_ORDER') {
      return <ActionButton key={action} label={ACTION_LABEL[action]} danger disabled={updatingOrderId === order.rawId} onClick={() => void handleOrderStatus(order, 'CANCELLED')} />
    }
    if (action === 'CREATE_SHIPMENT') {
      return <ActionButton key={action} label={ACTION_LABEL[action]} disabled={updatingOrderId === order.rawId} onClick={() => openShipmentModal(order)} />
    }
    if (action === 'START_SHIPPING') {
      return <ActionButton key={action} label={ACTION_LABEL[action]} disabled={updatingOrderId === order.rawId} onClick={() => void handleDemoAction(order, action)} />
    }
    if (action === 'PREPARE_ORDER' || action === 'READY_TO_SHIP') {
      return <ActionButton key={action} label={ACTION_LABEL[action]} disabled={updatingOrderId === order.rawId} onClick={() => void handleDemoAction(order, action)} />
    }
    if (action === 'MARK_IN_TRANSIT') {
      return <ActionButton key={action} label={ACTION_LABEL[action]} disabled={updatingOrderId === order.rawId} onClick={() => void handleShipmentStatus(order, 'IN_TRANSIT')} />
    }
    if (action === 'MARK_ARRIVED') {
      return <ActionButton key={action} label={ACTION_LABEL[action]} disabled={updatingOrderId === order.rawId} onClick={() => void handleDemoAction(order, action)} />
    }
    if (action === 'VIEW_SHIPMENT') {
      return <span key={action} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{ACTION_LABEL[action]}</span>
    }
    if (action === 'REPORT_INCIDENT') {
      return <span key={action} className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{ACTION_LABEL[action]}</span>
    }
    return null
  }

  return (
    <>
      <SupplierShell
        activeKey="orders"
        title="Quản lý Đơn hàng"
        subtitle="Theo dõi và xử lý đơn đến bước giao tới nơi"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={searchKeyword}
              onChange={setSearchKeyword}
              placeholder="Tìm đơn hàng, khách hàng, batch..."
              className="min-w-[240px] max-w-sm"
            />
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {[
                { key: 'all' as OrderTabKey, label: 'Tất cả', count: orders.length },
                { key: 'PENDING' as OrderTabKey, label: 'Chờ xác nhận', count: statusCount.pending },
                { key: 'CONFIRMED' as OrderTabKey, label: 'Đã xác nhận', count: statusCount.confirmed },
                { key: 'SHIPPING' as OrderTabKey, label: 'Đang giao', count: statusCount.shipping },
                { key: 'DELIVERED' as OrderTabKey, label: 'Hoàn thành', count: statusCount.completed },
                { key: 'CANCELLED' as OrderTabKey, label: 'Đã hủy', count: statusCount.cancelled },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                    activeTab === tab.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                    activeTab === tab.key ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}>{tab.count}</span>
                </button>
              ))}
            </div>
          </div>
        }
      >

        <SupplierPanel>
          {loading && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
              Đang tải dữ liệu đơn hàng...
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{error}</div>
          )}
          {!loading && !error && orders.length === 0 && (
            <p className="mb-4 text-sm font-medium text-slate-400">Chưa có đơn hàng nào cho tài khoản này.</p>
          )}

          {!loading && !error && orders.length > 0 && filteredOrders.length === 0 ? (
            <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 text-sm font-semibold text-emerald-800">
              Không tìm thấy đơn hàng phù hợp.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[1180px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Mã đơn</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Sản phẩm + lô</th>
                  <th className="px-4 py-3">Số lượng</th>
                  <th className="px-4 py-3">Giá trị</th>
                  <th className="px-4 py-3">Trạng thái đơn</th>
                  <th className="px-4 py-3">Giao hàng</th>
                  <th className="px-4 py-3">Ngày đặt</th>
                  <th className="px-4 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="bg-white text-sm transition-colors hover:bg-emerald-50/30">
                    <td className="px-4 py-3 font-bold text-emerald-800">{order.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{order.customer}</p>
                      <p className="text-xs text-slate-400">{order.branch}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <OrderItemsPreview order={order} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.quantity}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{order.value}</td>
                    <td className="px-4 py-3"><SupplierStatusPill label={order.status} /></td>
                    <td className="px-4 py-3"><SupplierStatusPill label={order.shipmentStatus || 'Chưa tạo vận đơn'} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{order.orderDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {order.availableActions.map((action) => renderActionButton(order, action))}
                        {isWaitingBuyer(order) ? <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Chờ buyer xác nhận</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SupplierPanel>
      </SupplierShell>

      {selectedOrder || detailLoading ? (
        <OrderDetailModal
          detailLoading={detailLoading}
          selectedOrder={selectedOrder}
          setSelectedOrder={setSelectedOrder}
          renderActionButton={renderActionButton}
        />
      ) : null}

      {shipmentOrder ? (
        <ShipmentModal
          order={shipmentOrder}
          form={shipmentForm}
          setForm={setShipmentForm}
          updating={updatingOrderId === shipmentOrder.rawId}
          onClose={() => setShipmentOrder(null)}
          onSubmit={() => void handleCreateShipment()}
        />
      ) : null}
    </>
  )
}

function ActionButton({ label, danger, disabled, onClick }: { label: string; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      className={`rounded-lg px-2 py-1 text-xs font-semibold ${
        danger ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'
      } disabled:cursor-not-allowed disabled:opacity-60`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function OrderItemsPreview({ order }: { order: SupplierOrderRow }) {
  if (!order.items.length) {
    return <span className="font-semibold">N/A</span>
  }
  return (
    <div className="space-y-1">
      {order.items.slice(0, 3).map((item) => (
        <div key={item.id}>
          <p className="font-semibold">{item.product}</p>
          <p className="text-xs text-emerald-700/80">{item.batchCode} · Grade {item.grade} · Size {item.size} · {item.quantity}</p>
        </div>
      ))}
      {order.items.length > 3 ? <p className="text-xs font-semibold text-slate-500">+{order.items.length - 3} sản phẩm khác</p> : null}
    </div>
  )
}

function OrderDetailModal({
  detailLoading,
  selectedOrder,
  setSelectedOrder,
  renderActionButton,
}: {
  detailLoading: boolean
  selectedOrder: SupplierOrderDetail | null
  setSelectedOrder: (order: SupplierOrderDetail | null) => void
  renderActionButton: (order: SupplierOrderDetail, action: SupplierOrderAction) => ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4">
      <div className="mx-auto mt-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">
              {selectedOrder ? `Chi tiết ${selectedOrder.id}` : 'Đang tải chi tiết đơn hàng...'}
            </h3>
            {selectedOrder ? <p className="text-xs text-slate-500">{selectedOrder.customer} · {selectedOrder.orderDate}</p> : null}
          </div>
          <button onClick={() => setSelectedOrder(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        {selectedOrder ? (
          <div className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <InfoTile title="Khách hàng" main={selectedOrder.customer} sub={`${selectedOrder.customerPhone || 'Chưa có SĐT'} · ${selectedOrder.customerEmail || 'Chưa có email'}`} />
              <InfoTile title="Giao hàng" main={selectedOrder.branch} sub={`${selectedOrder.deliveryAddress || 'Chưa có địa chỉ'} · ${selectedOrder.deliveryProvince}`} />
              <InfoTile title="Tổng giá trị" main={selectedOrder.value} sub={selectedOrder.status} />
              <InfoTile title="Vận đơn" main={selectedOrder.shipmentStatus || 'Chưa tạo vận đơn'} sub={selectedOrder.shipment?.trackingCode || ''} />
            </div>

            <div className="rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 px-3 py-2 text-sm font-bold text-slate-900">Sản phẩm trong đơn</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Lô</th>
                      <th className="px-3 py-2">Sản phẩm</th>
                      <th className="px-3 py-2">Grade/Size</th>
                      <th className="px-3 py-2">SL</th>
                      <th className="px-3 py-2">Đơn giá</th>
                      <th className="px-3 py-2">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-700">{item.batchCode}</td>
                        <td className="px-3 py-2 text-slate-700">{item.product}</td>
                        <td className="px-3 py-2 text-slate-700">Grade {item.grade} · Size {item.size}</td>
                        <td className="px-3 py-2 text-slate-700">{item.quantity}</td>
                        <td className="px-3 py-2 text-slate-700">{item.price}</td>
                        <td className="px-3 py-2 font-bold text-emerald-700">{item.lineTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedOrder.shipmentEvents.length > 0 ? (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-bold text-slate-900">Lịch sử giao hàng</p>
                <div className="mt-2 space-y-2">
                  {selectedOrder.shipmentEvents.map((event) => (
                    <div key={event.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                      <p className="font-semibold text-slate-800">{event.description}</p>
                      <p className="text-xs text-slate-500">{event.status} · {event.eventTime}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedOrder.note ? <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><span className="font-bold">Ghi chú: </span>{selectedOrder.note}</div> : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
              {selectedOrder.availableActions.map((action) => renderActionButton(selectedOrder, action))}
              {isWaitingBuyer(selectedOrder) ? <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">Chờ buyer xác nhận</span> : null}
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSelectedOrder(null)}>
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <p className="p-6 text-center text-sm font-semibold text-emerald-700">{detailLoading ? 'Đang tải...' : ''}</p>
        )}
      </div>
    </div>
  )
}

function InfoTile({ title, main, sub }: { title: string; main: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className="font-bold text-slate-900">{main}</p>
      {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
    </div>
  )
}

function ShipmentModal({
  order,
  form,
  setForm,
  updating,
  onClose,
  onSubmit,
}: {
  order: SupplierOrderRow
  form: CreateSupplierShipmentRequest
  setForm: (form: CreateSupplierShipmentRequest) => void
  updating: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const update = (key: keyof CreateSupplierShipmentRequest, value: string) => {
    setForm({ ...form, [key]: key === 'shippingFee' ? (value ? Number(value) : undefined) : value })
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/35 p-4">
      <div className="mx-auto mt-16 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Tạo vận đơn - {order.id}</h3>
            <p className="text-xs text-slate-500">{order.customer} · {order.product}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <ShipmentInput label="Đơn vị vận chuyển" value={form.carrierName ?? ''} onChange={(value) => update('carrierName', value)} />
          <ShipmentInput label="Phương thức" value={form.shippingMethod ?? ''} onChange={(value) => update('shippingMethod', value)} />
          <ShipmentInput label="Tài xế" value={form.driverName ?? ''} onChange={(value) => update('driverName', value)} />
          <ShipmentInput label="SĐT tài xế" value={form.driverPhone ?? ''} onChange={(value) => update('driverPhone', value)} />
          <ShipmentInput label="Phương tiện" value={form.vehicleInfo ?? ''} onChange={(value) => update('vehicleInfo', value)} />
          <ShipmentInput label="Phí giao hàng" value={form.shippingFee === undefined ? '' : String(form.shippingFee)} onChange={(value) => update('shippingFee', value)} />
          <ShipmentInput label="Tracking code" value={form.trackingCode ?? ''} onChange={(value) => update('trackingCode', value)} placeholder="Bỏ trống để tự sinh" />
          <ShipmentInput label="Ghi chú" value={form.note ?? ''} onChange={(value) => update('note', value)} />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={onClose} disabled={updating}>Đóng</button>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={onSubmit} disabled={updating}>
            {updating ? 'Đang tạo...' : 'Tạo vận đơn'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShipmentInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input
        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
