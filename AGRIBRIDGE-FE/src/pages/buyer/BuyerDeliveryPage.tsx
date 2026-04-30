import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapPin, Phone, X } from 'lucide-react'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
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

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

function canConfirm(item: BuyerDeliveryItem) {
  return !item.confirmedReceivedAt && !['CANCELLED', 'FAILED', 'DELIVERED'].includes(item.status)
}

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

  const loadDeliveries = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [deliveryData, branchData] = await Promise.all([
        fetchBuyerDeliveries(filters),
        branches.length ? Promise.resolve(branches) : fetchBuyerBranches(),
      ])
      setDeliveries(deliveryData)
      setBranches(branchData)
    } catch (requestError) {
      setDeliveries([])
      setError(readApiErrorMessage(requestError) || 'Không thể tải danh sách giao hàng.')
    } finally {
      setLoading(false)
    }
  }, [branches, filters])

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

  return (
    <>
      <BuyerShell activeKey="delivery" title="Theo dõi Giao hàng" subtitle="Theo dõi trạng thái vận chuyển">
        <BuyerPanel
          title="Theo dõi Giao hàng"
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <input
                className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"
                placeholder="Tìm mã vận đơn, NCC..."
                value={filters.keyword}
                onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              />
              <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm" value={filters.branchId} onChange={(event) => setFilters((current) => ({ ...current, branchId: event.target.value }))}>
                <option value="">Tất cả chi nhánh</option>
                {branchOptions.map((branch) => <option key={branch.rawId} value={branch.rawId}>{branch.name}</option>)}
              </select>
              <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                {STATUS_OPTIONS.map((status) => <option key={status.value || 'all'} value={status.value}>{status.label}</option>)}
              </select>
            </div>
          }
        >
          {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải giao hàng...</p> : null}
          {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
          {!loading && !error && deliveries.length === 0 ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-semibold text-emerald-800">Chưa có shipment nào phù hợp.</p>
          ) : null}
          <div className="space-y-4">
            {deliveries.map((item) => (
              <article key={item.shipmentId} className="rounded-xl border border-emerald-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xl font-extrabold text-emerald-950">{item.trackingCode || item.id}</h4>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">{item.statusLabel}</span>
                    </div>
                    <p className="mt-1 text-sm text-emerald-700/80">Đơn hàng: {item.orderRef}</p>
                    <p className="text-sm text-emerald-700/80">NCC: {item.supplierName}</p>
                    <p className="text-sm text-emerald-700/80">Sản phẩm: {item.productsText}</p>
                    <p className="text-sm text-emerald-700/80">Giao đến: {item.destination || item.branchName}</p>
                  </div>
                  <div className="text-right text-sm text-emerald-700/80">
                    <p className="font-semibold text-emerald-900">ETA: {formatDate(item.estimatedDeliveryAt) !== 'Chưa có' ? formatDate(item.estimatedDeliveryAt) : item.estimatedDeliveryTime || 'Chưa có'}</p>
                    <p>Tài xế: {item.driverName || 'Chưa có'}</p>
                    <p>Biển số: {item.vehicleInfo || 'Chưa có'}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-emerald-700/70">Tiến độ giao hàng</p>
                  <div className="mt-1 h-2 rounded-full bg-emerald-100">
                    <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${item.progress}%` }} />
                  </div>
                  <p className="mt-1 text-right text-xs font-semibold text-emerald-700">{item.progress}%</p>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-6">
                  <button className="rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-semibold text-emerald-700" onClick={() => void openTimeline(item)}>Timeline chi tiết</button>
                  <button className="rounded-lg border border-emerald-200 py-2 text-sm font-semibold text-emerald-700" onClick={() => void openDetail(item)}>Chi tiết</button>
                  <button className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white" onClick={() => setMapShipment(item)}>Xem bản đồ</button>
                  <a
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 py-2 text-sm font-semibold ${item.driverPhone ? 'text-emerald-700' : 'pointer-events-none text-slate-400 opacity-60'}`}
                    href={item.driverPhone ? `tel:${item.driverPhone}` : undefined}
                  >
                    <Phone className="h-4 w-4" /> Gọi tài xế
                  </a>
                  <button className="rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600" onClick={() => setIncidentShipment(item)}>Báo sự cố</button>
                  <button className="rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canConfirm(item)} onClick={() => setConfirmShipment(item)}>Xác nhận nhận hàng</button>
                </div>
              </article>
            ))}
          </div>
        </BuyerPanel>
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
      <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={onClose} disabled={saving}>Đóng</button>
      <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={onSubmit} disabled={saving}>{saving ? 'Đang gửi...' : submitText}</button>
    </div>
  )
}
