import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Clock, MapPin, Package, PhoneCall, Truck, X } from 'lucide-react'
import { SearchInput } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useToast } from '../../hooks/useToast'
import {
  confirmBuyerDeliveryReceived,
  createBuyerDeliveryIncident,
  fetchBuyerDeliveries,
  fetchBuyerDelivery,
  fetchBuyerDeliveryTimeline,
  type BuyerDeliveryDetail,
  type BuyerDeliveryItem,
  type DeliveryStatus,
  type DeliveryTimelineEvent,
} from '../../services/buyerDeliveryService'
import { fetchBuyerBranches, type BuyerBranchSummary } from '../../services/buyerBranchService'
import { uploadRegistrationFile } from '../../services/uploadService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

const STATUS_OPTIONS: Array<{ value: DeliveryStatus | ''; label: string }> = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'PREPARING', label: 'Chuẩn bị' },
  { value: 'SHIPPED', label: 'Đã xuất kho' },
  { value: 'IN_TRANSIT', label: 'Đang giao' },
  { value: 'WAITING_CONFIRMATION', label: 'Chờ xác nhận' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'INCIDENT', label: 'Có sự cố' },
  { value: 'FAILED', label: 'Giao thất bại' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

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
  if (s === 'pending' || s === 'preparing' || s.includes('chuẩn')) return { color: 'amber', label: status }
  if (s === 'shipped' || s.includes('xuất kho')) return { color: 'blue', label: status }
  if (s === 'in_transit' || s.includes('đang giao')) return { color: 'indigo', label: status }
  if (s === 'waiting_confirmation' || s.includes('xác nhận')) return { color: 'indigo', label: status }
  if (s === 'delivered' || s.includes('đã giao')) return { color: 'emerald', label: status }
  if (s === 'incident' || s === 'failed' || s === 'cancelled' || s.includes('sự cố') || s.includes('hủy')) return { color: 'rose', label: status }
  return { color: 'slate', label: status || 'N/A' }
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const { color } = getStatusMeta(status)
  const cls = STATUS_COLORS[color]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cls.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
      {label || status}
    </span>
  )
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

function canConfirm(item: BuyerDeliveryItem) {
  return !item.confirmedReceivedAt && !['CANCELLED', 'FAILED', 'DELIVERED'].includes(item.status)
}

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
              className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
            >
              Xác nhận
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
  const [deliveries, setDeliveries] = useState<BuyerDeliveryItem[]>([])
  const [branches, setBranches] = useState<BuyerBranchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ branchId: '', status: '', keyword: '', fromDate: '', toDate: '' })
  const [timeline, setTimeline] = useState<{ shipment: BuyerDeliveryItem; events: DeliveryTimelineEvent[] } | null>(null)
  const [detail, setDetail] = useState<BuyerDeliveryDetail | null>(null)
  const [mapShipment, setMapShipment] = useState<BuyerDeliveryItem | null>(null)
  const [incidentShipment, setIncidentShipment] = useState<BuyerDeliveryItem | null>(null)
  const [confirmShipment, setConfirmShipment] = useState<BuyerDeliveryItem | null>(null)

  const deliveryRequestId = useRef(0)

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

  usePageTitle('Theo dõi Giao hàng')
  return (
    <>
      <BuyerShell
        activeKey="delivery"
        title="Theo dõi Giao hàng"
        subtitle="Theo dõi trạng thái vận chuyển"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
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
        {loading && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Đang tải dữ liệu giao hàng...
          </div>
        )}
        {error && (
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
      </BuyerShell>

      {timeline ? <TimelineModal timeline={timeline} onClose={() => setTimeline(null)} /> : null}
      {detail ? <DetailDrawer detail={detail} onClose={() => setDetail(null)} /> : null}
      {mapShipment ? <MapModal shipment={mapShipment} onClose={() => setMapShipment(null)} /> : null}
      {incidentShipment ? <IncidentModal shipment={incidentShipment} onClose={() => setIncidentShipment(null)} onDone={() => void refreshAfterAction()} /> : null}
      {confirmShipment ? <ConfirmReceivedModal shipment={confirmShipment} onClose={() => setConfirmShipment(null)} onDone={(updated) => void refreshAfterAction(updated)} /> : null}
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
                <p className="text-slate-600">{event.description || event.status}</p>
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

function DetailDrawer({ detail, onClose }: { detail: BuyerDeliveryDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/35" onClick={onClose}>
      <aside className="ml-auto h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 border-b border-slate-200 bg-white p-4">
          <ModalHeader title={`Chi tiết ${detail.shipment.trackingCode || detail.shipment.id}`} onClose={onClose} />
          <p className="text-sm text-slate-500">{detail.shipment.orderRef} · {detail.shipment.supplierName}</p>
        </div>
        <div className="space-y-4 p-4">
          <section className="rounded-xl border border-slate-200 p-3">
            <h4 className="text-sm font-bold text-slate-900">Sản phẩm</h4>
            <div className="mt-2 space-y-2">
              {detail.products.map((item) => (
                <div key={`${item.batchId}-${item.productId}`} className="rounded-lg bg-slate-50 p-2 text-sm">
                  <p className="font-semibold">{item.productName} · {item.batchCode}</p>
                  <p className="text-xs text-slate-500">{item.quantity} {item.unit} · {item.grade || 'N/A'} / {item.size || 'N/A'}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 p-3">
            <h4 className="text-sm font-bold text-slate-900">Sự cố / khiếu nại</h4>
            <div className="mt-2 space-y-2">
              {[...detail.incidents.map((item) => ({ id: `i-${item.id}`, title: item.incidentType, desc: item.description, status: item.status })),
                ...detail.complaints.map((item) => ({ id: `c-${item.id}`, title: item.title || 'Khiếu nại', desc: item.description, status: item.status || '' }))].map((item) => (
                <div key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                  <p className="font-semibold">{item.title} · {item.status}</p>
                  <p className="text-slate-600">{item.desc}</p>
                </div>
              ))}
              {!detail.incidents.length && !detail.complaints.length ? <p className="text-sm text-slate-500">Chưa có sự cố.</p> : null}
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}

function IncidentModal({ shipment, onClose, onDone }: { shipment: BuyerDeliveryItem; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast()
  const [incidentType, setIncidentType] = useState('DELAY')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!description.trim()) {
      showToast('Vui lòng nhập mô tả sự cố.', 'error')
      return
    }
    try {
      setSaving(true)
      const imageUrl = image ? (await uploadRegistrationFile(image)).url : undefined
      await createBuyerDeliveryIncident(shipment.shipmentId, { incidentType, description: description.trim(), imageUrl })
      showToast('Đã báo sự cố giao hàng.', 'success')
      onClose()
      onDone()
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể báo sự cố.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal title="Báo sự cố giao hàng" onClose={onClose}>
      <select className="h-10 rounded-lg border border-slate-300 px-3 text-sm" value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>
        <option value="DELAY">Giao trễ</option>
        <option value="MISSING_ITEMS">Thiếu hàng</option>
        <option value="DAMAGED">Hàng lỗi/hư hỏng</option>
        <option value="WRONG_PRODUCT">Sai sản phẩm</option>
      </select>
      <textarea className="min-h-28 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={description} placeholder="Mô tả sự cố..." onChange={(event) => setDescription(event.target.value)} />
      <input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
      <SubmitRow saving={saving} onClose={onClose} onSubmit={() => void submit()} submitText="Gửi sự cố" />
    </FormModal>
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
      <SubmitRow saving={saving} onClose={onClose} onSubmit={() => void submit()} submitText="Xác nhận" />
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

function SubmitRow({ saving, onClose, onSubmit, submitText }: { saving: boolean; onClose: () => void; onSubmit: () => void; submitText: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
      <button className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={onClose} disabled={saving}>Đóng</button>
      <button className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60" onClick={onSubmit} disabled={saving}>{saving ? 'Đang gửi...' : submitText}</button>
    </div>
  )
}
