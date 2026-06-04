import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Clock, MapPin, Package, PhoneCall, Truck, X, CheckCircle, CheckCircle2, UploadCloud } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { SearchInput } from '../../components/buyer/BuyerCommon'
import { BuyerPaymentInstructionModal } from '../../components/buyer/BuyerPaymentInstructionModal'
import { DeliverySkeletonLoader } from '../../components/buyer/BuyerSkeletons'
import { useNotificationModuleRefresh } from '../../hooks/useNotificationModuleRefresh'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useToast } from '../../hooks/useToast'
import {
  confirmBuyerDeliveryReceived,
  createBuyerDeliveryIncident,
  updateBuyerDeliveryIncident,
  fetchBuyerDeliveries,
  fetchBuyerDelivery,
  fetchBuyerDeliveryTimeline,
  type BuyerDeliveryDetail,
  type BuyerDeliveryItem,
  type DeliveryStatus,
  type DeliveryTimelineEvent,
} from '../../services/buyerDeliveryService'
import { fetchBuyerBranches, type BuyerBranchSummary } from '../../services/buyerBranchService'
import { createBuyerDebtPayment } from '../../services/buyerDebtApi'
import { uploadRegistrationFile } from '../../services/uploadService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'
import { getBranchContextFromSearchParams } from '../../utils/branchContext'

const STATUS_OPTIONS: Array<{ value: DeliveryStatus | ''; label: string }> = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'WAITING_PICKUP', label: 'Chờ lấy hàng' },
  { value: 'PICKED_UP', label: 'Đã lấy hàng tại kho' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'PREPARING', label: 'Chuẩn bị' },
  { value: 'SHIPPED', label: 'Đã xuất kho' },
  { value: 'IN_TRANSIT', label: 'Đang giao' },
  { value: 'OUT_FOR_DELIVERY', label: 'Đang giao tới người nhận' },
  { value: 'WAITING_CONFIRMATION', label: 'Chờ xác nhận' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'INCIDENT', label: 'Có sự cố' },
  { value: 'FAILED', label: 'Giao thất bại' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Đã tạo vận đơn',
  WAITING_PICKUP: 'Chờ lấy hàng',
  PENDING: 'Chờ xử lý',
  PREPARING: 'Chuẩn bị',
  PICKED_UP: 'Đã lấy hàng tại kho',
  SHIPPED: 'Đã xuất kho',
  SHIPPING: 'Đang giao',
  IN_TRANSIT: 'Đang vận chuyển',
  OUT_FOR_DELIVERY: 'Đang giao tới người nhận',
  WAITING_CONFIRMATION: 'Chờ xác nhận',
  DELIVERED: 'Đã giao',
  INCIDENT: 'Có sự cố',
  FAILED: 'Giao thất bại',
  FAILED_DELIVERY: 'Giao thất bại',
  CANCELLED: 'Đã hủy',
}

type StatusColor = 'amber' | 'blue' | 'indigo' | 'emerald' | 'rose' | 'slate'

const STATUS_COLORS: Record<StatusColor, { badge: string; ring: string; dot: string; bar: string }> = {
  amber:   { badge: 'bg-amber-100 text-amber-800',   ring: 'ring-amber-400',   dot: 'bg-amber-400',   bar: 'from-amber-400 to-amber-600' },
  blue:    { badge: 'bg-blue-100 text-blue-800',     ring: 'ring-blue-400',    dot: 'bg-blue-400',    bar: 'from-blue-400 to-blue-600' },
  indigo:  { badge: 'bg-indigo-100 text-indigo-800', ring: 'ring-indigo-400',  dot: 'bg-indigo-400',  bar: 'from-indigo-400 to-indigo-600' },
  emerald: { badge: 'bg-emerald-100 text-emerald-800', ring: 'ring-emerald-400', dot: 'bg-emerald-500', bar: 'from-emerald-400 to-emerald-600' },
  rose:    { badge: 'bg-rose-100 text-rose-700',     ring: 'ring-rose-400',    dot: 'bg-rose-400',    bar: 'from-rose-400 to-rose-600' },
  slate:   { badge: 'bg-slate-100 text-slate-600',   ring: 'ring-slate-300',   dot: 'bg-slate-400',   bar: 'from-slate-300 to-slate-400' },
}

function getStatusMeta(status: string): { color: StatusColor; label: string } {
  const s = (status ?? '').toLowerCase()
  const normalized = status?.toUpperCase()
  const label = STATUS_LABELS[normalized] ?? status ?? 'N/A'
  if (s === 'created' || s === 'waiting_pickup' || s === 'pending' || s === 'preparing' || s.includes('chuẩn')) return { color: 'amber', label }
  if (s === 'picked_up' || s === 'shipped' || s.includes('xuất kho')) return { color: 'blue', label }
  if (s === 'shipping' || s === 'in_transit' || s === 'out_for_delivery' || s === 'waiting_confirmation' || s.includes('đang giao') || s.includes('xác nhận')) return { color: 'indigo', label }
  if (s === 'delivered' || s.includes('đã giao')) return { color: 'emerald', label }
  if (s === 'incident' || s === 'failed' || s === 'failed_delivery' || s === 'cancelled' || s.includes('sự cố') || s.includes('hủy')) return { color: 'rose', label }
  return { color: 'slate', label }
}

function getDisplayStatusLabel(status: string, label?: string) {
  const candidate = label || status
  const normalized = candidate?.toUpperCase()
  const englishLabels: Record<string, string> = {
    CREATED: 'Đã tạo vận đơn',
    PENDING: 'Chờ xử lý',
    PREPARING: 'Đang chuẩn bị',
    SHIPPING: 'Đang giao',
    IN_TRANSIT: 'Đang vận chuyển',
    OUT_FOR_DELIVERY: 'Đang giao tới người nhận',
    WAITING_CONFIRMATION: 'Chờ xác nhận nhận hàng',
    DELIVERED: 'Đã giao',
    FAILED: 'Giao thất bại',
    FAILED_DELIVERY: 'Giao thất bại',
    CANCELLED: 'Đã hủy',
    CREATED_LABEL: 'Đã tạo vận đơn',
    PENDING_LABEL: 'Chờ xử lý',
  }
  if (STATUS_LABELS[normalized]) return STATUS_LABELS[normalized]
  if (englishLabels[normalized]) return englishLabels[normalized]
  if (/^[A-Z_]+$/.test(candidate || '')) return 'Chưa cập nhật'
  return candidate
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const { color } = getStatusMeta(status)
  const cls = STATUS_COLORS[color]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cls.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
      {getDisplayStatusLabel(status, label)}
    </span>
  )
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

function canConfirm(item: BuyerDeliveryItem) {
  // Chỉ hiển thị khi hàng đang chờ buyer xác nhận nhận hàng
  return item.status === 'WAITING_CONFIRMATION' && !item.confirmedReceivedAt
}

function canReportIncident(item: BuyerDeliveryItem, hasOpenIncident = false) {
  return item.status === 'WAITING_CONFIRMATION' && !item.confirmedReceivedAt && !hasOpenIncident
}

const OPEN_INCIDENT_STATUSES = [
  'OPEN',
  'PENDING_SUPPLIER_RESPONSE',
  'WAITING_SUPPLIER_RESPONSE',
  'PROCESSING',
  'UNDER_REVIEW',
  'SUPPLIER_PROPOSED_RESOLUTION',
  'WAITING_BUYER_RESPONSE',
  'WAITING_BUYER_CONFIRMATION',
  'NEGOTIATING',
  'ESCALATED',
]

function DeliveryCard({
  item,
  onTimeline,
  onDetail,
  onMap,
  onConfirm,
}: {
  item: BuyerDeliveryItem
  onTimeline: () => void
  onDetail: () => void
  onMap: () => void
  onConfirm: () => void
}) {
  const { color } = getStatusMeta(item.status)
  const cls = STATUS_COLORS[color]
  const eta = item.estimatedDeliveryAt
    ? formatDate(item.estimatedDeliveryAt)
    : (item.estimatedDeliveryTime || 'Chưa có')

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:ring-2 ${cls.ring} hover:ring-offset-1`}>
      {/* Top accent stripe */}
      <div className={`h-1 w-full bg-gradient-to-r ${cls.bar}`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                {item.trackingCode || String(item.id)}
              </span>
              <StatusBadge status={item.status} label={item.statusLabel} />
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {item.orderRef} · {item.supplierName}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-bold text-emerald-700">ETA: {eta}</p>
          </div>
        </div>

        {/* Cargo + destination */}
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Package className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-semibold text-slate-700 truncate max-w-[120px]">{item.productsText || 'Hàng hóa'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Truck className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-semibold truncate max-w-[100px]">{item.destination || item.branchName || 'Chưa có'}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${cls.bar} transition-all duration-500`}
              style={{ width: `${Math.min(Math.max(item.progress, 0), 100)}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">{item.progress}%</p>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onDetail}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2 text-xs font-bold text-white transition hover:opacity-90 active:scale-95"
          >
            Chi tiết & Cập nhật
          </button>
          <button
            onClick={onTimeline}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title="Timeline"
          >
            <Clock className="h-4 w-4" />
          </button>
          <button
            onClick={onMap}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title="Bản đồ"
          >
            <MapPin className="h-4 w-4" />
          </button>
          {item.driverPhone && (
            <a
              href={`tel:${item.driverPhone}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              title="Gọi tài xế"
            >
              <PhoneCall className="h-4 w-4" />
            </a>
          )}
          {canConfirm(item) && (
            <button
              onClick={onConfirm}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Xác nhận đã nhận hàng
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
import { usePageTitle } from '../../hooks/usePageTitle'

export function BuyerDeliveryPage() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const branchContext = getBranchContextFromSearchParams(searchParams)
  const branchLabel = branchContext?.branchName || (branchContext?.branchId ? `Chi nhánh #${branchContext.branchId}` : '')
  const [deliveries, setDeliveries] = useState<BuyerDeliveryItem[]>([])
  const [branches, setBranches] = useState<BuyerBranchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ branchId: branchContext?.branchId || '', status: '', keyword: '', fromDate: '', toDate: '' })
  const [timeline, setTimeline] = useState<{ shipment: BuyerDeliveryItem; events: DeliveryTimelineEvent[] } | null>(null)
  const [detail, setDetail] = useState<BuyerDeliveryDetail | null>(null)
  const [mapShipment, setMapShipment] = useState<BuyerDeliveryItem | null>(null)
  const [incidentShipment, setIncidentShipment] = useState<BuyerDeliveryItem | null>(null)
  const [confirmShipment, setConfirmShipment] = useState<BuyerDeliveryItem | null>(null)
  const [paymentDue, setPaymentDue] = useState<BuyerDeliveryDetail['paymentDue'] | null>(null)
  const [submittingPaymentDue, setSubmittingPaymentDue] = useState(false)
  const [updateIncidentTarget, setUpdateIncidentTarget] = useState<{
    shipment: BuyerDeliveryItem
    incident: BuyerDeliveryDetail['incidents'][number]
  } | null>(null)

  const deliveryRequestId = useRef(0)
  const deepLinkHandledRef = useRef('')

  const loadBranches = useCallback(async () => {
    try {
      setBranches(await fetchBuyerBranches())
    } catch {
      setBranches([])
    }
  }, [])

  const loadDeliveries = useCallback(async () => {
    const requestId = deliveryRequestId.current + 1
    deliveryRequestId.current = requestId

    try {
      setLoading(true)
      setError('')
      const deliveryData = await fetchBuyerDeliveries(filters)
      if (deliveryRequestId.current !== requestId) return

      setDeliveries(deliveryData)
    } catch (requestError) {
      if (deliveryRequestId.current !== requestId) return

      setDeliveries([])
      setError(readApiErrorMessage(requestError) || 'Không thể tải danh sách giao hàng.')
    } finally {
      if (deliveryRequestId.current === requestId) {
        setLoading(false)
      }
    }
  }, [filters])

  useEffect(() => {
    void loadBranches()
  }, [loadBranches])

  useEffect(() => {
    void loadDeliveries()
  }, [loadDeliveries])

  useNotificationModuleRefresh(['DELIVERY'], loadDeliveries)

  useEffect(() => {
    const targetShipmentId = searchParams.get('shipmentId')
    const incidentTarget = searchParams.get('incident') === 'true'
    if (!targetShipmentId || !incidentTarget || loading) return
    const key = `${targetShipmentId}:${deliveries.length}`
    if (deepLinkHandledRef.current === key) return
    const shipment = deliveries.find((item) => String(item.shipmentId) === targetShipmentId || item.id === targetShipmentId || item.trackingCode === targetShipmentId)
    if (!shipment) return
    deepLinkHandledRef.current = key
    void openDetail(shipment)
  }, [deliveries, loading, searchParams])

  const branchOptions = useMemo(() => branches.filter((branch) => branch.isActive), [branches])

  const openTimeline = async (shipment: BuyerDeliveryItem) => {
    try {
      setTimeline({ shipment, events: await fetchBuyerDeliveryTimeline(shipment.shipmentId) })
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải timeline.', 'error')
    }
  }

  const openDetail = async (shipment: BuyerDeliveryItem) => {
    try {
      setDetail(await fetchBuyerDelivery(shipment.shipmentId))
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải chi tiết giao hàng.', 'error')
    }
  }

  const refreshAfterAction = async (updated?: BuyerDeliveryDetail) => {
    if (updated) {
      setDetail(updated)
    }
    await loadDeliveries()
  }

  const openIncidentReport = (shipment: BuyerDeliveryItem) => {
    if (!canReportIncident(shipment)) {
      showToast('Chỉ có thể báo sự cố khi đơn hàng đang chờ xác nhận nhận hàng.', 'error')
      return
    }
    setIncidentShipment(shipment)
  }

  usePageTitle('Theo dõi Giao hàng')
  return (
    <>
      <BuyerShell
        activeKey="delivery"
        title={branchLabel ? `Theo dõi Giao hàng - ${branchLabel}` : 'Theo dõi Giao hàng'}
        subtitle={branchLabel ? 'Đang xem vận chuyển trong phạm vi chi nhánh' : 'Theo dõi trạng thái vận chuyển'}
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            {branchLabel ? (
              <button
                className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-white"
                onClick={() => {
                  setFilters((current) => ({ ...current, branchId: '' }))
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    next.delete('branchId')
                    next.delete('branchName')
                    return next
                  }, { replace: true })
                }}
              >
                Chi nhánh: {branchLabel}
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <SearchInput
              value={filters.keyword}
              onChange={(v) => setFilters((c) => ({ ...c, keyword: v }))}
              placeholder="Tìm mã vận đơn, NCC..."
              className="min-w-[220px] max-w-sm"
            />
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:outline-none"
              value={filters.branchId}
              onChange={(e) => setFilters((c) => ({ ...c, branchId: e.target.value }))}
            >
              <option value="">Tất cả chi nhánh</option>
              {branchOptions.map((b) => <option key={b.rawId} value={b.rawId}>{b.name}</option>)}
            </select>
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:outline-none"
              value={filters.status}
              onChange={(e) => setFilters((c) => ({ ...c, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((s) => <option key={s.value || 'all'} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        }
      >
        {loading ? (
          <DeliverySkeletonLoader />
        ) : null}
        {!loading && error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {!loading && !error && deliveries.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <Truck className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">Chưa có shipment nào</p>
            <p className="max-w-xs text-xs text-slate-400">Chưa có vận đơn nào phù hợp với bộ lọc hiện tại.</p>
          </div>
        )}
        {!loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {deliveries.map((item) => (
              <DeliveryCard
                key={item.shipmentId}
                item={item}
                onTimeline={() => void openTimeline(item)}
                onDetail={() => void openDetail(item)}
                onMap={() => setMapShipment(item)}
                onConfirm={() => setConfirmShipment(item)}
              />
            ))}
          </div>
        ) : null}
      </BuyerShell>

      {timeline ? <TimelineModal timeline={timeline} onClose={() => setTimeline(null)} /> : null}
      {detail ? <DetailDrawer
        detail={detail}
        onClose={() => setDetail(null)}
        onIncident={() => openIncidentReport(detail.shipment)}
        onConfirm={() => { setDetail(null); setConfirmShipment(detail.shipment) }}
        onUpdateIncident={(incident) => setUpdateIncidentTarget({ shipment: detail.shipment, incident })}
        onIncidentActionDone={async () => {
          setDetail(await fetchBuyerDelivery(detail.shipment.shipmentId))
          await loadDeliveries()
        }}
      /> : null}
      {mapShipment ? <MapModal shipment={mapShipment} onClose={() => setMapShipment(null)} /> : null}
      {incidentShipment ? <IncidentModal shipment={incidentShipment} detail={detail ?? undefined} onClose={() => setIncidentShipment(null)} onDone={() => void refreshAfterAction()} /> : null}
      {updateIncidentTarget ? (
        <UpdateIncidentModal
          shipment={updateIncidentTarget.shipment}
          incident={updateIncidentTarget.incident}
          detail={detail ?? undefined}
          onClose={() => setUpdateIncidentTarget(null)}
          onDone={async () => {
            setUpdateIncidentTarget(null)
            const refreshed = await fetchBuyerDelivery(updateIncidentTarget.shipment.shipmentId)
            setDetail(refreshed)
            await loadDeliveries()
          }}
        />
      ) : null}
      {confirmShipment ? <ConfirmReceivedModal shipment={confirmShipment} onClose={() => setConfirmShipment(null)} onDone={(updated) => { if (updated?.paymentDue) setPaymentDue(updated.paymentDue); void refreshAfterAction(updated) }} /> : null}
      <BuyerPaymentInstructionModal
        open={Boolean(paymentDue)}
        mode="debt"
        title="Thanh toán phần còn lại"
        description={paymentDue?.dueDate ? `Hạn thanh toán: ${formatDate(paymentDue.dueDate)}` : 'Thanh toán qua tài khoản sàn'}
        invoiceCode={paymentDue?.displayInvoiceCode || paymentDue?.invoiceCode}
        orderCode={paymentDue?.orderCode}
        supplierName={paymentDue?.supplierName}
        productName={paymentDue?.productName}
        quantity={paymentDue?.quantity}
        unit={paymentDue?.unit}
        paymentMethod={paymentDue?.paymentMethod === 'DEPOSIT_50' ? 'DEPOSIT_50' : 'ESCROW_TRANSFER'}
        totalAmount={paymentDue?.totalAmount}
        paidAmount={paymentDue?.paidAmount}
        balanceAmount={paymentDue?.remainingAmount}
        payableAmount={paymentDue?.remainingAmount}
        transferContent={paymentDue?.transferContent}
        onClose={() => setPaymentDue(null)}
        onDemoPaid={async () => {
          if (!paymentDue) return
          setSubmittingPaymentDue(true)
          try {
            await createBuyerDebtPayment({
              invoiceId: paymentDue.invoiceId,
              amount: paymentDue.remainingAmount,
              paymentMethod: 'BANK_TRANSFER_DEMO',
              paymentDate: new Date().toISOString(),
              note: `Demo thanh toán phần còn lại ${paymentDue.invoiceCode || paymentDue.orderCode}`,
            })
            showToast('Thanh toán phần còn lại thành công.', 'success')
            setPaymentDue(null)
            await loadDeliveries()
          } catch (requestError) {
            showToast(readApiErrorMessage(requestError) || 'Không thể thanh toán phần còn lại.', 'error')
          } finally {
            setSubmittingPaymentDue(false)
          }
        }}
        submitting={submittingPaymentDue}
      />
    </>
  )
}

function TimelineModal({ timeline, onClose }: { timeline: { shipment: BuyerDeliveryItem; events: DeliveryTimelineEvent[] }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-14 w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <ModalHeader title={`Timeline ${timeline.shipment.trackingCode || timeline.shipment.id}`} onClose={onClose} />
        <div className="mt-4 space-y-3">
          {timeline.events.length ? timeline.events.map((event) => (
            <div key={event.id} className="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm">
              <span className="mt-1 h-3 w-3 rounded-full bg-emerald-500" />
              <div>
                <p className="font-bold text-slate-900">{event.statusLabel}</p>
                <p className="text-slate-600">{event.description || getDisplayStatusLabel(event.status, event.statusLabel)}</p>
                <p className="text-xs text-slate-500">{event.location || 'Chưa có vị trí'} · {formatDate(event.eventTime)}</p>
              </div>
            </div>
          )) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Chưa có timeline.</p>}
        </div>
      </div>
    </div>
  )
}

function MapModal({ shipment, onClose }: { shipment: BuyerDeliveryItem; onClose: () => void }) {
  const hasCoordinates = shipment.currentLat != null && shipment.currentLng != null
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-14 w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <ModalHeader title="Theo dõi vị trí" onClose={onClose} />
        {hasCoordinates ? (
          <iframe
            title="Bản đồ giao hàng"
            className="mt-4 h-80 w-full rounded-xl border border-slate-200"
            src={`https://www.google.com/maps?q=${shipment.currentLat},${shipment.currentLng}&z=15&output=embed`}
          />
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-bold text-slate-900">Chưa có tọa độ realtime.</p>
            <p className="mt-2"><MapPin className="mr-1 inline h-4 w-4" /> Vị trí hiện tại: {shipment.currentLocation || 'Chưa cập nhật'}</p>
            <p>Địa chỉ giao: {shipment.destination || shipment.branchName || 'Chưa có'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function mapIncidentType(type: string) {
  const map: Record<string, string> = {
    MISSING_ITEMS: 'Thiếu hàng',
    DAMAGED: 'Hàng lỗi/hư hỏng',
    WRONG_PRODUCT: 'Sai sản phẩm',
    DELAY: 'Giao trễ',
    CONTACT_ISSUE: 'Không liên hệ được tài xế/đơn vị giao hàng',
    OTHER: 'Khác',
  }
  return map[type] || type
}

function mapIncidentStatus(status: string) {
  const map: Record<string, string> = {
    OPEN: 'Đang xử lý',
    PENDING_SUPPLIER_RESPONSE: 'Chờ nhà cung cấp phản hồi',
    WAITING_SUPPLIER_RESPONSE: 'Chờ nhà cung cấp xử lý',
    PROCESSING: 'Đang xử lý',
    UNDER_REVIEW: 'Nhà cung cấp đang xem xét',
    WAITING_BUYER_RESPONSE: 'Chờ bên mua phản hồi',
    WAITING_BUYER_CONFIRMATION: 'Chờ bên mua xác nhận',
    SUPPLIER_PROPOSED_RESOLUTION: 'Nhà cung cấp đã đề xuất',
    NEGOTIATING: 'Đang thương lượng',
    ESCALATED: 'Đã chuyển xử lý cấp cao',
    RESOLVED: 'Đã xử lý',
    REJECTED: 'Đã từ chối',
    COMPENSATED: 'Đã bồi hoàn',
    INCIDENT: 'Có sự cố'
  }
  return map[status] || status
}

function mapTimelineStatus(status: string, label: string) {
  const map: Record<string, string> = {
    CREATED: 'Đã tạo vận đơn',
    PICKUP_PENDING: 'Lấy hàng tại kho',
    PREPARING: 'Đang chuẩn bị hàng',
    SHIPPED: 'Đã xuất kho',
    IN_TRANSIT: 'Đang vận chuyển',
    DELIVERED: 'Giao hàng thành công',
    INCIDENT: 'Có sự cố',
    FAILED: 'Giao thất bại',
    CANCELLED: 'Đã hủy'
  }
  return map[status] || label
}

function mapTimelineDescription(desc?: string | null) {
  if (!desc) return ''
  if (desc.includes('Buyer reported incident')) return desc.replace('Buyer reported incident', 'Bên mua báo sự cố')
  return desc
}



function ProgressBar({ progress, color = 'emerald' }: { progress: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full bg-gradient-to-r from-${color}-400 to-${color}-600 transition-all duration-500`}
        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
      />
    </div>
  )
}

function Timeline({ events }: { events: DeliveryTimelineEvent[] }) {
  if (!events || events.length === 0) {
    return <p className="text-sm font-medium text-slate-500">Chưa có timeline.</p>
  }
  return (
    <ol className="relative space-y-3 border-l border-dashed border-slate-200 pl-5">
      {events.map((event, i) => {
        const isDone = true
        const label = mapTimelineStatus(event.status, event.statusLabel)
        const desc = mapTimelineDescription(event.description || '')
        const timeStr = `${formatDate(event.eventTime)}${event.location ? ` · ${event.location}` : ''}`
        return (
          <li key={i} className="relative">
            <span
              className={`absolute -left-[1.45rem] flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                isDone
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3 text-slate-400" />}
            </span>
            <p className={`text-xs font-semibold ${isDone ? 'text-slate-800' : 'text-slate-400'}`}>{label}</p>
            {desc && <p className="text-[11px] font-medium text-slate-500">{desc}</p>}
            <p className="text-[11px] text-slate-400">{timeStr}</p>
          </li>
        )
      })}
    </ol>
  )
}

function DetailDrawer({ detail, onClose, onIncident, onConfirm, onUpdateIncident, onIncidentActionDone }: {
  detail: BuyerDeliveryDetail
  onClose: () => void
  onIncident: () => void
  onConfirm: () => void
  onUpdateIncident: (incident: BuyerDeliveryDetail['incidents'][number]) => void
  onIncidentActionDone: () => void
}) {
  const { showToast } = useToast()
  const s = detail.shipment
  const progress = s.progress ?? 0
  const openIncident = detail.incidents.find((i) => OPEN_INCIDENT_STATUSES.includes(i.status))
  const hasOpenIncident = Boolean(openIncident)
  // Chỉ cho xác nhận khi đang chờ buyer xác nhận, không bao gồm DELIVERED hay các trạng thái trung gian
  const showConfirm = s.status === 'WAITING_CONFIRMATION' && !s.confirmedReceivedAt && !hasOpenIncident
  const showReportIncident = canReportIncident(s, hasOpenIncident)

  // Fallback receiver
  const receiverText = (s as any).receiverName || (s as any).buyerName || (s as any).branchContactName || s.branchName || 'Chưa có'

  // ETA format
  const etaText = s.estimatedDeliveryAt && s.estimatedDeliveryAt !== 'Đang xử lý'
    ? formatDate(s.estimatedDeliveryAt)
    : 'Chưa có thời gian dự kiến'

  const handleBuyerIncidentAction = async (incident: BuyerDeliveryDetail['incidents'][number], action: 'ACCEPT_RESOLUTION' | 'REJECT_RESOLUTION' | 'REQUEST_CONTINUE' | 'ESCALATE') => {
    const promptText = action === 'ACCEPT_RESOLUTION'
      ? 'Nhập ghi chú đồng ý phương án (có thể để trống):'
      : action === 'REJECT_RESOLUTION'
        ? 'Nhập lý do chưa đồng ý phương án:'
        : 'Nhập yêu cầu xử lý tiếp:'
    const note = window.prompt(action === 'ESCALATE' ? 'Nhập lý do cần admin xử lý tranh chấp:' : promptText, '')
    if ((action === 'REJECT_RESOLUTION' || action === 'REQUEST_CONTINUE' || action === 'ESCALATE') && !note?.trim()) {
      showToast('Vui lòng nhập nội dung phản hồi để nhà cung cấp tiếp tục xử lý.', 'error')
      return
    }
    try {
      await updateBuyerDeliveryIncident(s.shipmentId, incident.id, { action, note: note?.trim() || undefined })
      showToast(
        action === 'ACCEPT_RESOLUTION'
          ? 'Đã đồng ý phương án xử lý.'
          : action === 'ESCALATE'
            ? 'Đã chuyển sự cố lên admin xử lý.'
            : 'Đã gửi phản hồi cho nhà cung cấp.',
        'success'
      )
      onIncidentActionDone()
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể gửi phản hồi sự cố.', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-white">{s.trackingCode || s.id}</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-white/20 text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {getDisplayStatusLabel(s.status, s.statusLabel)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-300">
              Mã đơn: <span className="font-bold text-white">{s.orderRef}</span> · Cung cấp bởi: <span className="font-bold text-white">{s.supplierName}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-6 p-5 bg-slate-50">

          {/* Thông tin người nhận & Địa chỉ */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-800">Thông tin người nhận</h4>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="text-base font-bold text-slate-900">{receiverText}</p>
                <p className="text-sm font-medium text-slate-700">{s.receiverPhone || s.buyerPhone || s.driverPhone || 'Chưa có số điện thoại'}</p>
              </div>

              <div className="mt-2.5 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{s.deliveryAddress || s.destination || 'Chưa có địa chỉ giao hàng'}</p>
                  {((s.branchName || s.branchContactName) && (s.branchName || s.branchContactName) !== 'N/A') && (
                    <p className="mt-1 text-sm text-slate-500">Chi nhánh: {s.branchName || s.branchContactName}</p>
                  )}
                  {s.vehicleInfo && s.vehicleInfo !== 'N/A' && (
                    <p className="mt-1 text-sm text-slate-500">Ghi chú: {s.vehicleInfo}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Thông tin hàng giao */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-800">Thông tin hàng giao</h4>
            <div className="space-y-3">
              {detail.products.map((item) => {
                const isBatchUrl = item.batchCode?.startsWith('http')
                const batchUrl = item.batchUrl || (isBatchUrl ? item.batchCode : null)
                const batchCodeText = isBatchUrl ? `BATCH-${item.batchId}` : (item.batchCode || `BATCH-${item.batchId}`)

                return (
                  <div key={`${item.batchId}-${item.productId}`} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                      {/* {item.productImage ? <img src={item.productImage} className="h-full w-full rounded-xl object-cover" /> : <Package className="h-6 w-6" />} */}
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-bold text-slate-900">{item.productName}</p>
                        {item.subtotal != null && (
                          <p className="shrink-0 font-bold text-emerald-700">{item.subtotal.toLocaleString('vi-VN')}đ</p>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-blue-600">
                          Mã lô: {batchCodeText}
                          {batchUrl && <a href={batchUrl} target="_blank" rel="noreferrer" className="ml-1 text-blue-500 underline hover:text-blue-700">Truy xuất</a>}
                        </p>
                        {item.price != null && (
                          <p className="shrink-0 text-xs text-slate-500">{item.price.toLocaleString('vi-VN')}đ/{item.unit}</p>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {item.quantity} {item.unit} <span className="mx-1 text-slate-300">·</span> Grade/Size: {item.grade || 'Chưa có'} / {item.size || 'Chưa có'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4. Thông tin vận chuyển */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-800">Thông tin vận chuyển</h4>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-y-4 gap-x-6 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nhà vận chuyển</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{s.carrierName || 'Chưa có'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Dịch vụ</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">Tiêu chuẩn</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Phí vận chuyển</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-700">{s.shippingFee == null ? 'Chưa xác nhận' : `${s.shippingFee.toLocaleString('vi-VN')}đ`}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Dự kiến giao</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{hasOpenIncident ? `${etaText} (Có thể thay đổi)` : etaText}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Trạng thái</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{getDisplayStatusLabel(s.status, s.statusLabel)}</p>
                </div>
                {s.driverName && s.driverName !== 'Chưa có' && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tài xế</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">{s.driverName}</p>
                  </div>
                )}
                {s.driverPhone && s.driverPhone !== 'Chưa có' && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">SĐT Tài xế</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">{s.driverPhone}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Tiến độ vận chuyển */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-800">Tiến độ vận chuyển</h4>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700">Trạng thái xử lý</p>
                <span className="text-sm font-extrabold text-emerald-700">{progress}%</span>
              </div>
              <ProgressBar progress={progress} />
            </div>
          </div>

          {/* 6. Timeline */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-800">Timeline</h4>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <Timeline events={detail.timeline} />
            </div>
          </div>

          {/* 7. Sự cố / Khiếu nại */}
          {(detail.incidents.length > 0 || detail.complaints.length > 0) && (
            <div>
              <h4 className="mb-2 text-sm font-bold text-slate-800">Sự cố / Khiếu nại</h4>
              <div className="space-y-3">
                {detail.incidents.map((item) => {
                  const isEditable = ['OPEN', 'PENDING_SUPPLIER_RESPONSE', 'WAITING_SUPPLIER_RESPONSE', 'PROCESSING', 'NEGOTIATING'].includes(item.status)
                  const needsBuyerConfirmation = ['SUPPLIER_PROPOSED_RESOLUTION', 'WAITING_BUYER_RESPONSE', 'WAITING_BUYER_CONFIRMATION'].includes(item.status)
                  const allEvidence = item.evidenceUrls ?? (item.imageUrl ? [item.imageUrl] : [])
                  const supplierEvidence = item.supplierEvidenceUrls ?? []
                  return (
                    <div key={`i-${item.id}`} className={`rounded-xl p-4 shadow-sm ${needsBuyerConfirmation ? 'border-2 border-orange-300 bg-orange-50 ring-2 ring-orange-100' : 'border border-red-200 bg-red-50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-red-900">{mapIncidentType(item.incidentType)}</p>
                          {(item.missingQuantity != null || item.damagedQuantity != null) && (
                            <p className="mt-0.5 text-xs font-semibold text-red-700">
                              {item.missingQuantity != null && `Thiếu: ${item.missingQuantity}`}
                              {item.missingQuantity != null && item.damagedQuantity != null && ' · '}
                              {item.damagedQuantity != null && `Hỏng: ${item.damagedQuantity}`}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          isEditable ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {mapIncidentStatus(item.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-red-800">{item.description}</p>
                      {item.updateNote && (
                        <div className="mt-2 rounded-lg border border-red-100 bg-white/60 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Ghi chú cập nhật</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-xs font-medium text-red-800">{item.updateNote}</p>
                        </div>
                      )}
                      {(item.supplierResponse || item.proposedResolution) && (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Phương án từ nhà cung cấp</p>
                          {item.supplierResponse ? <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-700">{item.supplierResponse}</p> : null}
                          {item.proposedResolution ? <p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{item.proposedResolution}</p> : null}
                          {needsBuyerConfirmation ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button onClick={() => void handleBuyerIncidentAction(item, 'ACCEPT_RESOLUTION')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Đồng ý phương án</button>
                              <button onClick={() => void handleBuyerIncidentAction(item, 'REJECT_RESOLUTION')} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">Không đồng ý</button>
                              <button onClick={() => void handleBuyerIncidentAction(item, 'REQUEST_CONTINUE')} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-bold text-orange-700">Yêu cầu xử lý tiếp</button>
                              <button onClick={() => void handleBuyerIncidentAction(item, 'ESCALATE')} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Chuyển admin</button>
                            </div>
                          ) : null}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-red-700">Thời gian báo: {formatDate(item.createdAt)}</p>
                      {item.updatedAt && (
                        <p className="text-xs text-red-600">Cập nhật lần cuối: {formatDate(item.updatedAt)}</p>
                      )}
                      {allEvidence.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-xs font-semibold text-red-700">Ảnh bằng chứng ({allEvidence.length}):</p>
                          <div className="flex flex-wrap gap-2">
                            {allEvidence.map((url, idx) => (
                              <a key={idx} href={url} target="_blank" rel="noreferrer">
                                <img src={url} className="h-16 w-16 rounded-lg object-cover border border-red-200 hover:opacity-80 transition" alt={`Bằng chứng ${idx + 1}`} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {supplierEvidence.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-xs font-semibold text-emerald-700">Bằng chứng từ nhà cung cấp ({supplierEvidence.length}):</p>
                          <div className="flex flex-wrap gap-2">
                            {supplierEvidence.map((url, idx) => (
                              <a key={idx} href={url} target="_blank" rel="noreferrer">
                                <img src={url} className="h-16 w-16 rounded-lg border border-emerald-200 object-cover transition hover:opacity-80" alt={`Bằng chứng nhà cung cấp ${idx + 1}`} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Per-card action button */}
                      <div className="mt-3">
                        {isEditable ? (
                          <button
                            onClick={() => onUpdateIncident(item)}
                            className="w-full rounded-xl border border-amber-300 bg-amber-50 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 active:scale-95"
                          >
                            Xem / Cập nhật sự cố
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateIncident(item)}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
                          >
                            Xem chi tiết
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {detail.complaints.map((item) => (
                  <div key={`c-${item.id}`} className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-amber-900">{item.title || 'Khiếu nại'}</p>
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800">{mapIncidentStatus(item.status || '')}</span>
                    </div>
                    <p className="mt-1 text-sm text-amber-800">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. Hình ảnh giao hàng / bằng chứng */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-800">Hình ảnh giao hàng</h4>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                <p className="text-sm font-medium text-slate-500">Chưa có hình ảnh giao hàng</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white px-5 py-3">
          <div className="flex gap-2">
            {openIncident ? (
              <button className="rounded-xl border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 px-4 py-2 text-xs font-bold transition active:scale-95" onClick={() => onUpdateIncident(openIncident)}>
                Xem / Cập nhật sự cố
              </button>
            ) : showReportIncident ? (
              <button className="rounded-xl border border-rose-300 bg-white text-rose-600 hover:bg-rose-50 px-4 py-2 text-xs font-bold transition active:scale-95" onClick={onIncident}>
                Báo sự cố giao hàng
              </button>
            ) : null}

            {showConfirm && (
              <button className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:opacity-90 px-4 py-2 text-xs font-bold transition active:scale-95" onClick={onConfirm}>
                Xác nhận đã nhận hàng
              </button>
            )}
          </div>

          <div className="ml-auto flex gap-2">
            {(s.receiverPhone || s.driverPhone) && (s.receiverPhone || s.driverPhone) !== 'Chưa có' && (
              <a
                href={`tel:${s.receiverPhone || s.driverPhone}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                Gọi điện thoại
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function IncidentModal({ shipment, detail, onClose, onDone }: { shipment: BuyerDeliveryItem; detail?: BuyerDeliveryDetail; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast()
  const s = detail?.shipment || shipment
  const reportAllowed = canReportIncident(s)

  useEffect(() => {
    if (!reportAllowed) {
      showToast('Chỉ có thể báo sự cố khi đơn hàng đang chờ xác nhận nhận hàng.', 'error')
      onClose()
    }
  }, [onClose, reportAllowed, showToast])

  // Determine delivery phase from shipment status
  const status = s.status
  // Phase A: hàng đang trên đường, chưa tới buyer
  const IN_TRANSIT_STATUSES = ['PENDING', 'PREPARING', 'SHIPPED', 'SHIPPING', 'IN_TRANSIT']
  // Phase B: hàng đã tới hoặc đang chờ xác nhận
  const RECEIVED_STATUSES = ['WAITING_CONFIRMATION']
  const isInTransit = IN_TRANSIT_STATUSES.includes(status)
  const isReceived = RECEIVED_STATUSES.includes(status)

  // Incident options per phase
  const INCIDENT_OPTIONS_IN_TRANSIT = [
    { value: 'DELAY', label: 'Giao trễ' },
    { value: 'CONTACT_ISSUE', label: 'Không liên hệ được tài xế/đơn vị giao hàng' },
    { value: 'OTHER', label: 'Khác' },
  ]
  const INCIDENT_OPTIONS_RECEIVED = [
    { value: 'MISSING_ITEMS', label: 'Thiếu hàng' },
    { value: 'DAMAGED', label: 'Hàng lỗi/hư hỏng' },
    { value: 'WRONG_PRODUCT', label: 'Sai sản phẩm' },
    { value: 'DELAY', label: 'Giao trễ' },
    { value: 'OTHER', label: 'Khác' },
  ]
  const incidentOptions = isInTransit ? INCIDENT_OPTIONS_IN_TRANSIT : INCIDENT_OPTIONS_RECEIVED

  const [incidentType, setIncidentType] = useState(() => incidentOptions[0].value)
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  // Summary logic
  const productInfo = detail?.products?.length
    ? detail.products.map(p => `${p.productName} (${p.quantity} ${p.unit})`).join(', ')
    : s.productsText || 'Chưa có'
  const supplierText = detail?.shipment?.supplierName || s.supplierName || 'Chưa có'
  const addressText = detail?.shipment?.deliveryAddress || s.destination || 'Chưa có'

  // Validation limits
  const productItem = detail?.products?.[0]
  let maxQty = productItem?.quantity
  let unit = productItem?.unit || ''

  if (maxQty == null && s.productsText) {
     const match = s.productsText.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]*)/)
     if (match) {
        maxQty = parseFloat(match[1])
        unit = match[2] || ''
     }
  }

  // Dynamic labels - quantity only shown for product-related incident types
  const QUANTITY_TYPES = ['MISSING_ITEMS', 'DAMAGED', 'WRONG_PRODUCT']
  const isQuantityRequired = incidentType === 'MISSING_ITEMS' || incidentType === 'DAMAGED'
  const isQuantityOptional = incidentType === 'WRONG_PRODUCT'
  const showQuantity = QUANTITY_TYPES.includes(incidentType)

  const quantityLabel = incidentType === 'MISSING_ITEMS' ? 'Số lượng thiếu'
    : incidentType === 'DAMAGED' ? 'Số lượng hỏng/không đạt'
    : incidentType === 'WRONG_PRODUCT' ? 'Số lượng bị ảnh hưởng' : ''

  const handleEvidenceAdd = (files: FileList | null) => {
    if (!files?.length) return
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
    const nextFiles: File[] = []
    for (const file of Array.from(files)) {
      if (!validTypes.includes(file.type)) {
        showToast('Chỉ chấp nhận ảnh (JPG, PNG, WebP) hoặc video (MP4, WebM, MOV).', 'error')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Kích thước mỗi file tối đa là 5MB.', 'error')
        continue
      }
      nextFiles.push(file)
    }
    if (nextFiles.length > 0) {
      setEvidenceFiles((prev) => [...prev, ...nextFiles])
    }
  }

  const submit = async () => {
    if (!reportAllowed) {
      showToast('Chỉ có thể báo sự cố khi đơn hàng đang chờ xác nhận nhận hàng.', 'error')
      onClose()
      return
    }

    // Guard: không được báo MISSING/DAMAGED/WRONG_PRODUCT khi hàng chưa tới
    const DELIVERY_ONLY_TYPES = ['MISSING_ITEMS', 'DAMAGED', 'WRONG_PRODUCT']
    if (DELIVERY_ONLY_TYPES.includes(incidentType) && !isReceived) {
      showToast('Chỉ có thể báo thiếu hàng, hàng hỏng hoặc sai sản phẩm sau khi hàng đã được giao tới.', 'error')
      return
    }

    if (!description.trim() || description.trim().length < 10) {
      showToast('Vui lòng nhập mô tả sự cố (ít nhất 10 ký tự).', 'error')
      return
    }

    const qtyNum = Number(quantity)
    if (isQuantityRequired) {
      if (!quantity || qtyNum <= 0) {
        showToast(`Vui lòng nhập ${quantityLabel.toLowerCase()} lớn hơn 0.`, 'error')
        return
      }
      if (maxQty != null && qtyNum > maxQty) {
        showToast(`${quantityLabel} không được vượt quá số lượng đặt (${maxQty} ${unit}).`, 'error')
        return
      }
      if (evidenceFiles.length === 0) {
        showToast('Vui lòng tải lên ảnh hoặc video bằng chứng cho sự cố này.', 'error')
        return
      }
    }

    if (isQuantityOptional && quantity) {
      if (qtyNum <= 0) {
        showToast(`Vui lòng nhập ${quantityLabel.toLowerCase()} lớn hơn 0.`, 'error')
        return
      }
      if (maxQty != null && qtyNum > maxQty) {
        showToast(`${quantityLabel} không được vượt quá số lượng đặt (${maxQty} ${unit}).`, 'error')
        return
      }
    }

    try {
      setSaving(true)
      const uploadedUrls: string[] = []
      for (const file of evidenceFiles) {
        const result = await uploadRegistrationFile(file)
        uploadedUrls.push(result.url)
      }
      const payload: any = { incidentType, description: description.trim() }
      if (uploadedUrls.length > 0) {
        payload.imageUrl = uploadedUrls[0]
        payload.evidenceUrls = uploadedUrls
      }

      if (incidentType === 'MISSING_ITEMS' && quantity) {
        payload.missingQuantity = Number(quantity)
      }
      if (incidentType === 'DAMAGED' && quantity) {
        payload.damagedQuantity = Number(quantity)
      }

      await createBuyerDeliveryIncident(shipment.shipmentId, payload)
      showToast('Đã ghi nhận sự cố giao hàng. Nhà cung cấp sẽ được thông báo để xử lý.', 'success')
      onClose()
      onDone()
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể báo sự cố.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Báo sự cố giao hàng</h3>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              {s.trackingCode || s.id} {s.orderRef ? `· ${s.orderRef}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">

          {/* Card tóm tắt */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="grid gap-y-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nhà cung cấp</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{supplierText}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sản phẩm</p>
                <p className="mt-0.5 line-clamp-1 text-sm font-bold text-slate-800">{productInfo}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Địa chỉ giao</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{addressText}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Loại sự cố</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={incidentType}
                  onChange={(e) => {
                    setIncidentType(e.target.value)
                    setQuantity('')
                  }}
                >
                  {incidentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {showQuantity && (
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">{quantityLabel} {isQuantityRequired ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(Tùy chọn)</span>}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      placeholder="VD: 5"
                      className={`h-11 w-full rounded-xl border border-slate-200 bg-white pl-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${unit ? 'pr-12' : 'pr-3'}`}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                    {unit && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                        {unit}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Mô tả sự cố <span className="text-red-500">*</span></label>
              <textarea
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                value={description}
                placeholder="Mô tả ngắn gọn vấn đề khi nhận/giao hàng..."
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Ảnh/Video bằng chứng {isQuantityRequired && <span className="text-red-500">*</span>}</label>
              {evidenceFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {evidenceFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="group relative">
                      {file.type.startsWith('video/') ? (
                        <video
                          className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                          src={URL.createObjectURL(file)}
                          controls
                        />
                      ) : (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Bằng chứng ${idx + 1}`}
                          className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                        />
                      )}
                      <button
                        onClick={() => setEvidenceFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-md transition group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-6 transition hover:border-slate-300 hover:bg-slate-100">
                <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div className="px-4 text-center">
                  <p className="text-sm font-bold text-slate-700">Tải ảnh hoặc video bằng chứng</p>
                  <p className="mt-1 text-xs text-slate-500">JPG, PNG, WebP, MP4, WebM, MOV · Tối đa 5MB mỗi file</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg, image/png, image/webp, video/mp4, video/webm, video/quicktime"
                  className="hidden"
                  onChange={(e) => handleEvidenceAdd(e.target.files)}
                />
              </label>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
          <p className="max-w-[60%] text-xs font-medium text-slate-500">
            Thông tin này sẽ được gửi cho nhà cung cấp để xử lý.
          </p>
          <button
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition hover:opacity-90 active:scale-95 disabled:opacity-60"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? 'Đang gửi...' : 'Gửi sự cố'}
          </button>
        </div>

      </div>
    </div>
  )
}


function UpdateIncidentModal({
  shipment,
  incident,
  detail,
  onClose,
  onDone,
}: {
  shipment: BuyerDeliveryItem
  incident: BuyerDeliveryDetail['incidents'][number]
  detail?: BuyerDeliveryDetail
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useToast()
  const isEditable = ['OPEN', 'PENDING_SUPPLIER_RESPONSE', 'WAITING_SUPPLIER_RESPONSE', 'PROCESSING', 'NEGOTIATING'].includes(incident.status)

  const [note, setNote] = useState('')
  const [missingQty, setMissingQty] = useState(incident.missingQuantity != null ? String(incident.missingQuantity) : '')
  const [damagedQty, setDamagedQty] = useState(incident.damagedQuantity != null ? String(incident.damagedQuantity) : '')
  const [newEvidence, setNewEvidence] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  // Product info for quantity validation
  const productItem = detail?.products?.[0]
  const maxQty = productItem?.quantity
  const unit = productItem?.unit || ''

  const handleEvidenceAdd = (files: FileList | null) => {
    if (!files?.length) return
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
    const nextFiles: File[] = []
    for (const file of Array.from(files)) {
      if (!validTypes.includes(file.type)) {
        showToast('Chỉ chấp nhận ảnh (JPG, PNG, WebP) hoặc video (MP4, WebM, MOV).', 'error')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Kích thước mỗi file tối đa là 5MB.', 'error')
        continue
      }
      nextFiles.push(file)
    }
    if (nextFiles.length > 0) {
      setNewEvidence((prev) => [...prev, ...nextFiles])
    }
  }

  const submit = async () => {
    if (!isEditable) { onClose(); return }

    const mqNum = missingQty ? Number(missingQty) : undefined
    const dqNum = damagedQty ? Number(damagedQty) : undefined

    if (mqNum != null && mqNum <= 0) {
      showToast('Số lượng thiếu phải lớn hơn 0.', 'error'); return
    }
    if (dqNum != null && dqNum <= 0) {
      showToast('Số lượng hỏng phải lớn hơn 0.', 'error'); return
    }
    if (maxQty != null && mqNum != null && mqNum > maxQty) {
      showToast(`Số lượng thiếu không được vượt quá ${maxQty} ${unit}.`, 'error'); return
    }
    if (maxQty != null && dqNum != null && dqNum > maxQty) {
      showToast(`Số lượng hỏng không được vượt quá ${maxQty} ${unit}.`, 'error'); return
    }

    try {
      setSaving(true)
      const uploadedUrls: string[] = []
      for (const file of newEvidence) {
        const result = await uploadRegistrationFile(file)
        uploadedUrls.push(result.url)
      }
      const payload: {
        note?: string
        missingQuantity?: number
        damagedQuantity?: number
        evidenceUrls?: string[]
      } = {}
      if (note.trim()) payload.note = note.trim()
      if (mqNum != null) payload.missingQuantity = mqNum
      if (dqNum != null) payload.damagedQuantity = dqNum
      if (uploadedUrls.length > 0) payload.evidenceUrls = uploadedUrls

      await updateBuyerDeliveryIncident(shipment.shipmentId, incident.id, payload)
      showToast('Đã cập nhật sự cố giao hàng.', 'success')
      onDone()
    } catch (err) {
      showToast(readApiErrorMessage(err) || 'Không thể cập nhật sự cố.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const allEvidence = incident.evidenceUrls ?? (incident.imageUrl ? [incident.imageUrl] : [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={`flex items-center justify-between border-b px-6 py-4 ${isEditable ? 'border-amber-100 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
          <div>
            <h3 className={`text-xl font-extrabold ${isEditable ? 'text-amber-900' : 'text-slate-900'}`}>
              {isEditable ? 'Cập nhật sự cố giao hàng' : 'Chi tiết sự cố giao hàng'}
            </h3>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              {shipment.trackingCode || shipment.id}{shipment.orderRef ? ` · ${shipment.orderRef}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">

          {/* Current incident info */}
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Loại sự cố</p>
                <p className="mt-0.5 text-sm font-bold text-red-900">{mapIncidentType(incident.incidentType)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                isEditable ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {mapIncidentStatus(incident.status)}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Mô tả ban đầu</p>
              <p className="mt-0.5 text-sm font-medium text-red-800">{incident.description}</p>
            </div>
            {(incident.missingQuantity != null || incident.damagedQuantity != null) && (
              <div className="mt-3 flex gap-4">
                {incident.missingQuantity != null && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Số lượng thiếu</p>
                    <p className="mt-0.5 text-sm font-bold text-red-800">{incident.missingQuantity} {unit}</p>
                  </div>
                )}
                {incident.damagedQuantity != null && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Số lượng hỏng</p>
                    <p className="mt-0.5 text-sm font-bold text-red-800">{incident.damagedQuantity} {unit}</p>
                  </div>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-red-700">Thời gian báo: {formatDate(incident.createdAt)}</p>
            {incident.updatedAt && <p className="text-xs text-red-600">Cập nhật lần cuối: {formatDate(incident.updatedAt)}</p>}
          </div>

          {/* Existing update note */}
          {incident.updateNote && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Lịch sử ghi chú cập nhật</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{incident.updateNote}</p>
            </div>
          )}

          {/* Existing evidence images */}
          {allEvidence.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-700">Ảnh bằng chứng hiện có ({allEvidence.length})</p>
              <div className="flex flex-wrap gap-2">
                {allEvidence.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noreferrer">
                    <img src={url} className="h-20 w-20 rounded-xl border border-slate-200 object-cover hover:opacity-80 transition shadow-sm" alt={`Bằng chứng ${idx + 1}`} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Editable section - only if OPEN/PROCESSING */}
          {isEditable ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-amber-200" />
                <p className="text-xs font-bold text-amber-700">Bổ sung thông tin</p>
                <div className="h-px flex-1 bg-amber-200" />
              </div>

              {/* Update note */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Ghi chú cập nhật</label>
                <textarea
                  className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  value={note}
                  placeholder="Thêm ghi chú hoặc thông tin bổ sung..."
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* Update quantities */}
              {(incident.incidentType === 'MISSING_ITEMS' || incident.incidentType === 'DAMAGED') && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {incident.incidentType === 'MISSING_ITEMS' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700">Cập nhật số lượng thiếu</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          placeholder={incident.missingQuantity != null ? String(incident.missingQuantity) : 'VD: 5'}
                          className={`h-11 w-full rounded-xl border border-slate-200 bg-white pl-3 text-sm font-medium outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 ${unit ? 'pr-12' : 'pr-3'}`}
                          value={missingQty}
                          onChange={(e) => setMissingQty(e.target.value)}
                        />
                        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{unit}</span>}
                      </div>
                    </div>
                  )}
                  {incident.incidentType === 'DAMAGED' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700">Cập nhật số lượng hỏng</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          placeholder={incident.damagedQuantity != null ? String(incident.damagedQuantity) : 'VD: 2'}
                          className={`h-11 w-full rounded-xl border border-slate-200 bg-white pl-3 text-sm font-medium outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 ${unit ? 'pr-12' : 'pr-3'}`}
                          value={damagedQty}
                          onChange={(e) => setDamagedQty(e.target.value)}
                        />
                        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{unit}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* New evidence images */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Thêm ảnh/video bằng chứng mới</label>
                {newEvidence.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {newEvidence.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="group relative">
                        {file.type.startsWith('video/') ? (
                          <video
                            className="h-16 w-16 rounded-lg border border-amber-200 object-cover"
                            src={URL.createObjectURL(file)}
                            controls
                          />
                        ) : (
                          <img
                            src={URL.createObjectURL(file)}
                            className="h-16 w-16 rounded-lg border border-amber-200 object-cover"
                            alt={`Bằng chứng mới ${idx + 1}`}
                          />
                        )}
                        <button
                          onClick={() => setNewEvidence((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-md transition group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-5 transition hover:border-amber-300 hover:bg-amber-50">
                  <div className="rounded-full bg-amber-100 p-2 text-amber-600">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-amber-700">Tải ảnh hoặc video bằng chứng mới</p>
                    <p className="mt-0.5 text-xs text-slate-500">JPG, PNG, WebP, MP4, WebM, MOV · Tối đa 5MB mỗi file</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => handleEvidenceAdd(e.target.files)}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <CheckCircle className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-bold text-slate-700">Sự cố đã được xử lý</p>
              <p className="mt-1 text-xs text-slate-500">Không thể cập nhật thêm khi sự cố đã {incident.status === 'RESOLVED' ? 'được giải quyết' : 'bị từ chối'}.</p>
              {incident.resolutionNote && (
                <div className="mt-3 rounded-lg bg-white border border-slate-200 p-3 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ghi chú giải quyết</p>
                  <p className="mt-1 text-sm text-slate-700">{incident.resolutionNote}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {isEditable && (
          <div className="flex items-center justify-end border-t border-slate-100 bg-white px-6 py-4">
            <button
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:opacity-90 active:scale-95 disabled:opacity-60"
              onClick={() => void submit()}
              disabled={saving}
            >
              {saving ? 'Đang lưu...' : 'Lưu cập nhật'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ConfirmReceivedModal({ shipment, onClose, onDone }: { shipment: BuyerDeliveryItem; onClose: () => void; onDone: (detail?: BuyerDeliveryDetail) => void }) {

  const { showToast } = useToast()
  const [condition, setCondition] = useState('OK')
  const [note, setNote] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!confirmed) {
      showToast('Vui lòng tick xác nhận thông tin.', 'error')
      return
    }
    try {
      setSaving(true)
      const evidenceImage = image ? (await uploadRegistrationFile(image)).url : undefined
      const updated = await confirmBuyerDeliveryReceived(shipment.shipmentId, { condition, note: note.trim(), evidenceImage, confirmed })
      showToast(condition === 'OK' ? 'Đã xác nhận nhận hàng.' : 'Đã ghi nhận sự cố, đơn chưa hoàn tất.', condition === 'OK' ? 'success' : 'info')
      onClose()
      onDone(updated)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể xác nhận nhận hàng.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal title="Xác nhận nhận hàng" onClose={onClose}>
      <select className="h-10 rounded-lg border border-slate-300 px-3 text-sm" value={condition} onChange={(event) => setCondition(event.target.value)}>
        <option value="OK">Hàng đầy đủ, đúng chất lượng</option>
        <option value="MISSING_ITEMS">Thiếu hàng</option>
        <option value="DAMAGED">Hàng lỗi/hư hỏng</option>
        <option value="WRONG_PRODUCT">Sai sản phẩm</option>
      </select>
      <textarea className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={note} placeholder="Ghi chú..." onChange={(event) => setNote(event.target.value)} />
      <input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        Tôi xác nhận thông tin nhận hàng là chính xác
      </label>
      <SubmitRow saving={saving} onSubmit={() => void submit()} submitText="Xác nhận" />
    </FormModal>
  )
}

function FormModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-16 w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <ModalHeader title={title} onClose={onClose} />
        <div className="mt-4 grid gap-3">{children}</div>
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-xl font-extrabold text-slate-900">{title}</h3>
      <button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}><X className="h-4 w-4" /></button>
    </div>
  )
}

function SubmitRow({ saving, onSubmit, submitText }: { saving: boolean; onSubmit: () => void; submitText: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
      <button className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60" onClick={onSubmit} disabled={saving}>{saving ? 'Đang gửi...' : submitText}</button>
    </div>
  )
}
