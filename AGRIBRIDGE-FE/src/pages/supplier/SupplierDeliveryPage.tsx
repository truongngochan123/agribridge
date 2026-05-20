import { AlertTriangle, CheckCircle2, FileVideo, Package, PhoneCall, RotateCcw, ShieldCheck, Truck, Upload, X, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchInput, SupplierPanel } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useNotificationModuleRefresh } from '../../hooks/useNotificationModuleRefresh'
import { usePageTitle } from '../../hooks/usePageTitle'
import { updateSupplierShipmentIncident } from '../../services/supplierService'
import { uploadRegistrationFile } from '../../services/uploadService'
import type { ShipmentItem, SupplierShipmentEvent, SupplierShipmentIncident } from '../../types/supplierDashboard'
import { useSupplierDashboardData } from './useSupplierDashboardData'

type StatusColor = 'amber' | 'blue' | 'indigo' | 'emerald' | 'rose' | 'slate'

const STATUS_COLOR_CLASSES: Record<StatusColor, { badge: string; ring: string; dot: string; bar: string }> = {
  amber: {
    badge: 'bg-amber-100 text-amber-800',
    ring: 'ring-amber-400',
    dot: 'bg-amber-400',
    bar: 'from-amber-400 to-amber-600',
  },
  blue: {
    badge: 'bg-blue-100 text-blue-800',
    ring: 'ring-blue-400',
    dot: 'bg-blue-400',
    bar: 'from-blue-400 to-blue-600',
  },
  indigo: {
    badge: 'bg-indigo-100 text-indigo-800',
    ring: 'ring-indigo-400',
    dot: 'bg-indigo-400',
    bar: 'from-indigo-400 to-indigo-600',
  },
  emerald: {
    badge: 'bg-emerald-100 text-emerald-800',
    ring: 'ring-emerald-400',
    dot: 'bg-emerald-500',
    bar: 'from-emerald-400 to-emerald-600',
  },
  rose: {
    badge: 'bg-rose-100 text-rose-700',
    ring: 'ring-rose-400',
    dot: 'bg-rose-400',
    bar: 'from-rose-400 to-rose-600',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-600',
    ring: 'ring-slate-300',
    dot: 'bg-slate-400',
    bar: 'from-slate-300 to-slate-400',
  },
}

const FILTER_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'preparing', label: 'Chuẩn bị' },
  { key: 'transit', label: 'Đang giao' },
  { key: 'done', label: 'Đã giao' },
  { key: 'issue', label: 'Sự cố' },
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
  CANCELLED: 'Đã hủy',
  FAILED: 'Giao thất bại',
  FAILED_DELIVERY: 'Giao thất bại',
  INCIDENT: 'Sự cố',
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  MISSING_ITEMS: 'Thiếu hàng',
  DAMAGED: 'Hàng lỗi/hư hỏng',
  WRONG_PRODUCT: 'Sai sản phẩm',
  DELAY: 'Giao hàng chậm',
  CONTACT_ISSUE: 'Không liên hệ được',
  DELIVERY_ISSUE: 'Sự cố giao hàng',
}

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Chờ nhà cung cấp xử lý',
  PENDING_SUPPLIER_RESPONSE: 'Chờ nhà cung cấp xử lý',
  WAITING_SUPPLIER_RESPONSE: 'Chờ nhà cung cấp xử lý',
  SUPPLIER_PROPOSED_RESOLUTION: 'Nhà cung cấp đã đề xuất',
  UNDER_REVIEW: 'Nhà cung cấp đang xem xét',
  WAITING_BUYER_RESPONSE: 'Chờ người mua xác nhận',
  WAITING_BUYER_CONFIRMATION: 'Chờ người mua xác nhận',
  NEGOTIATING: 'Đang thương lượng',
  ESCALATED: 'Đã chuyển xử lý cấp cao',
  RESOLVED: 'Đã xử lý',
  REJECTED: 'Đã từ chối',
  COMPENSATED: 'Đã bồi hoàn',
}

const INCIDENT_SEVERITY_LABELS: Record<string, string> = {
  HIGH: 'Cao',
  MEDIUM: 'Trung bình',
  LOW: 'Thấp',
}

const RESOLUTION_TYPE_LABELS: Record<string, string> = {
  ACCEPT_COMPLAINT: 'Chấp nhận khiếu nại',
  REJECT_COMPLAINT: 'Từ chối khiếu nại',
  REFUND: 'Hoàn tiền',
  PARTIAL_REFUND: 'Hoàn tiền một phần',
  REPLACEMENT: 'Đổi/trả hàng',
  RESEND_SHIPMENT: 'Gửi lại hàng',
  REQUEST_MORE_EVIDENCE: 'Yêu cầu thêm bằng chứng',
  PENDING: 'Chờ xử lý',
}

function getStatusMeta(status: string): { color: StatusColor; label: string } {
  const normalized = normalizeStatus(status)
  const label = STATUS_LABELS[normalized] ?? status ?? 'N/A'
  if (normalized === 'WAITING_PICKUP' || normalized === 'PENDING' || normalized === 'PREPARING' || normalized === 'CREATED') {
    return { color: 'amber', label }
  }
  if (normalized === 'PICKED_UP' || normalized === 'SHIPPED') {
    return { color: 'blue', label }
  }
  if (normalized === 'IN_TRANSIT' || normalized === 'SHIPPING' || normalized === 'OUT_FOR_DELIVERY' || normalized === 'WAITING_CONFIRMATION') {
    return { color: 'indigo', label }
  }
  if (normalized === 'DELIVERED') {
    return { color: 'emerald', label }
  }
  if (normalized === 'CANCELLED' || normalized === 'FAILED' || normalized === 'FAILED_DELIVERY' || normalized === 'INCIDENT') {
    return { color: 'rose', label }
  }
  return { color: 'slate', label: status || 'N/A' }
}

function normalizeStatus(status: string) {
  const s = (status || '').trim().toLowerCase()
  if (s.includes('chờ lấy') || s === 'waiting_pickup') return 'WAITING_PICKUP'
  if (s.includes('lấy hàng') || s === 'picked_up') return 'PICKED_UP'
  if (s.includes('rời kho') || s.includes('xuất kho') || s === 'shipped') return 'SHIPPED'
  if (s.includes('vận chuyển') || s === 'in_transit' || s === 'shipping') return 'IN_TRANSIT'
  if (s.includes('người nhận') || s === 'out_for_delivery') return 'OUT_FOR_DELIVERY'
  if (s.includes('chờ người mua') || s.includes('chờ buyer') || s.includes('xác nhận') || s === 'waiting_confirmation') return 'WAITING_CONFIRMATION'
  if (s.includes('đã giao') || s === 'delivered') return 'DELIVERED'
  if (s.includes('hủy') || s === 'cancelled') return 'CANCELLED'
  if (s.includes('sự cố') || s === 'incident') return 'INCIDENT'
  if (s.includes('thất bại') || s === 'failed' || s === 'failed_delivery') return 'FAILED'
  if (s.includes('chuẩn bị') || s === 'preparing') return 'PREPARING'
  if (s === 'created') return 'CREATED'
  if (s === 'pending') return 'PENDING'
  return status.toUpperCase()
}

function StatusBadge({ status }: { status: string }) {
  const { color, label } = getStatusMeta(status)
  const cls = STATUS_COLOR_CLASSES[color]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cls.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
      {label}
    </span>
  )
}

const CLOSED_INCIDENT_STATUSES = new Set(['RESOLVED'])

function getOpenIncidents(ship: ShipmentItem) {
  return (ship.incidents ?? []).filter((incident) => !CLOSED_INCIDENT_STATUSES.has((incident.status || '').toUpperCase()))
}

function isShipmentMatch(ship: ShipmentItem, target: string) {
  const normalizedTarget = target.trim().toLowerCase()
  if (!normalizedTarget) return false
  return (
    ship.id.toLowerCase() === normalizedTarget ||
    String(ship.rawShipmentId ?? '').toLowerCase() === normalizedTarget ||
    ship.id.toLowerCase().includes(normalizedTarget)
  )
}

function ProgressBar({ progress, color = 'emerald' }: { progress: number; color?: StatusColor }) {
  const barClass = STATUS_COLOR_CLASSES[color]?.bar ?? STATUS_COLOR_CLASSES.emerald.bar
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${barClass} transition-all duration-500`}
        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
      />
    </div>
  )
}

function ShipmentCard({ ship, onDetail }: { ship: ShipmentItem; onDetail: () => void }) {
  const { color } = getStatusMeta(ship.status)
  const cls = STATUS_COLOR_CLASSES[color]
  const progressColor: StatusColor = color === 'emerald' ? 'emerald' : color === 'rose' ? 'rose' : 'indigo'
  const openIncidents = getOpenIncidents(ship)
  const hasOpenIncident = openIncidents.length > 0

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:ring-2 ${hasOpenIncident ? 'border-2 border-orange-300 ring-2 ring-orange-100' : 'border border-slate-200'} ${cls.ring} hover:ring-offset-1`}
    >
      <div className={`h-1 w-full bg-gradient-to-r ${hasOpenIncident ? 'from-orange-500 to-rose-500' : cls.bar}`} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-slate-900">{ship.id}</span>
              <StatusBadge status={ship.status} />
              {hasOpenIncident ? (
                <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                  Cần xử lý · {openIncidents.length}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {ship.orderRef} · {ship.route}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-bold text-emerald-700">{ship.eta}</p>
            {ship.estimatedDeliveryTime && (
              <p className="text-[11px] text-slate-400">{ship.estimatedDeliveryTime}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Package className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-semibold text-slate-700">{ship.cargo}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Truck className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-semibold">
              {ship.shippingFee && ship.shippingFee !== '—' ? ship.shippingFee : 'Chưa xác nhận'}
            </span>
          </div>
        </div>

        {ship.receiverName && ship.receiverName !== 'N/A' && (
          <p className="mt-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{ship.receiverName}</span>
            {ship.receiverPhone && ship.receiverPhone !== 'N/A' ? ` · ${ship.receiverPhone}` : ''}
          </p>
        )}

        <div className="mt-3">
          <ProgressBar progress={ship.progress} color={progressColor} />
          <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">{ship.progress}%</p>
        </div>

        {hasOpenIncident ? (
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800">
            Có tranh chấp giao hàng chưa xử lý. Mở chi tiết để phản hồi buyer.
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onDetail}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2 text-xs font-bold text-white transition hover:opacity-90 active:scale-95"
          >
            Chi tiết
          </button>
          {ship.receiverPhone && ship.receiverPhone !== 'N/A' && (
            <a
              href={`tel:${ship.receiverPhone}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              title="Gọi người nhận"
            >
              <PhoneCall className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function Timeline({ events }: { events: SupplierShipmentEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs font-medium text-slate-400">Chưa có timeline.</p>
  }
  return (
    <ol className="relative space-y-3 border-l border-dashed border-slate-200 pl-5">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[1.45rem] flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white">
            <CheckCircle2 className="h-3 w-3" />
          </span>
          <p className="text-xs font-semibold text-slate-800">{event.description || getStatusMeta(event.status).label}</p>
          <p className="text-[11px] text-slate-400">
            {event.eventTime}{event.location ? ` · ${event.location}` : ''}
          </p>
        </li>
      ))}
    </ol>
  )
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url)
}

function IncidentStatusBadge({ status }: { status: string }) {
  const normalized = (status || 'PENDING_SUPPLIER_RESPONSE').toUpperCase()
  const cls = normalized === 'RESOLVED' || normalized === 'COMPENSATED' ? 'bg-emerald-100 text-emerald-800'
    : normalized === 'REJECTED' ? 'bg-slate-200 text-slate-700'
      : normalized === 'WAITING_BUYER_RESPONSE' ? 'bg-blue-100 text-blue-800'
        : normalized === 'UNDER_REVIEW' ? 'bg-amber-100 text-amber-800'
          : 'bg-rose-100 text-rose-800'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${cls}`}>{DISPUTE_STATUS_LABELS[normalized] ?? status}</span>
}

function SeverityBadge({ severity }: { severity?: string | null }) {
  const normalized = (severity || 'LOW').toUpperCase()
  const cls = normalized === 'HIGH' ? 'bg-rose-100 text-rose-800'
    : normalized === 'MEDIUM' ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-100 text-slate-700'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${cls}`}>{INCIDENT_SEVERITY_LABELS[normalized] ?? normalized}</span>
}

function EvidenceGallery({ title, urls, onOpen }: { title: string; urls: string[]; onOpen: (url: string) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{title}</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{urls.length}</span>
      </div>
      {urls.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs font-medium text-slate-400">Chưa có tệp đính kèm.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => onOpen(url)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              title="Mở bằng chứng"
            >
              {isVideoUrl(url) ? (
                <div className="flex h-full w-full items-center justify-center text-slate-500">
                  <FileVideo className="h-7 w-7" />
                </div>
              ) : (
                <img src={url} alt="Bằng chứng sự cố" className="h-full w-full object-cover transition group-hover:scale-105" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type ResolutionOptionKey = 'FULL_REFUND' | 'PARTIAL_REFUND' | 'RESEND_SHIPMENT' | 'REQUEST_EVIDENCE' | 'REJECT_CLAIM'

const RESOLUTION_OPTIONS: Array<{
  key: ResolutionOptionKey
  title: string
  description: string
  action: string
  resolutionType: string
  tone: string
  icon: typeof ShieldCheck
  group: 'primary' | 'secondary' | 'danger'
}> = [
  {
    key: 'FULL_REFUND',
    title: 'Hoàn tiền toàn bộ',
    description: 'Dùng khi lỗi nghiêm trọng và cần bồi hoàn toàn bộ giá trị ảnh hưởng.',
    action: 'OFFER_COMPENSATION',
    resolutionType: 'ACCEPT_COMPLAINT',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800 ring-emerald-100',
    icon: ShieldCheck,
    group: 'primary',
  },
  {
    key: 'PARTIAL_REFUND',
    title: 'Hoàn tiền một phần',
    description: 'Đề xuất khoản bồi hoàn theo số lượng/giá trị bị ảnh hưởng.',
    action: 'PARTIAL_REFUND',
    resolutionType: 'PARTIAL_REFUND',
    tone: 'border-blue-200 bg-blue-50 text-blue-800 ring-blue-100',
    icon: RotateCcw,
    group: 'primary',
  },
  {
    key: 'RESEND_SHIPMENT',
    title: 'Gửi lại hàng',
    description: 'Tạo phương án gửi bù hoặc thay thế lô hàng cho buyer.',
    action: 'RESEND_SHIPMENT',
    resolutionType: 'RESEND_SHIPMENT',
    tone: 'border-amber-200 bg-amber-50 text-amber-800 ring-amber-100',
    icon: Package,
    group: 'primary',
  },
  {
    key: 'REQUEST_EVIDENCE',
    title: 'Yêu cầu thêm bằng chứng',
    description: 'Yêu cầu buyer bổ sung ảnh, số lượng, biên bản nhận hàng hoặc thông tin kiểm đếm.',
    action: 'REQUEST_MORE_EVIDENCE',
    resolutionType: 'REQUEST_MORE_EVIDENCE',
    tone: 'border-slate-200 bg-slate-50 text-slate-800 ring-slate-100',
    icon: AlertTriangle,
    group: 'secondary',
  },
  {
    key: 'REJECT_CLAIM',
    title: 'Từ chối yêu cầu',
    description: 'Chỉ dùng khi có căn cứ vận hành rõ ràng để từ chối khiếu nại.',
    action: 'REJECT_COMPLAINT',
    resolutionType: 'REJECT_COMPLAINT',
    tone: 'border-rose-200 bg-rose-50 text-rose-800 ring-rose-100',
    icon: XCircle,
    group: 'danger',
  },
]

function formatCurrencyPreview(value?: string) {
  const amount = value ? Number(value) : 0
  if (!Number.isFinite(amount) || amount <= 0) return 'Chưa nhập'
  return amount.toLocaleString('vi-VN') + 'đ'
}

function buildResolutionPreview(option: (typeof RESOLUTION_OPTIONS)[number], note: string, resendDate?: string) {
  if (option.key === 'RESEND_SHIPMENT') {
    return [option.title, resendDate ? `Ngày dự kiến gửi lại: ${resendDate}` : '', note].filter(Boolean).join('\n')
  }
  return [option.title, note].filter(Boolean).join('\n')
}

function IncidentConversationTimeline({ incident }: { incident: SupplierShipmentIncident }) {
  const events = incident.timeline ?? []
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Nhật ký thương lượng</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{events.length + 1} cập nhật</span>
      </div>
      <ol className="space-y-3">
        <li className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2">
          <p className="text-xs font-extrabold text-orange-800">Buyer báo sự cố</p>
          <p className="mt-0.5 text-xs text-orange-700">{incident.description}</p>
          <p className="mt-1 text-[11px] text-orange-600">{incident.createdAt ?? 'N/A'}</p>
        </li>
        {events.map((event) => (
          <li key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs font-extrabold text-slate-800">{event.description || getStatusMeta(event.status).label}</p>
            <p className="mt-1 text-[11px] text-slate-500">{event.eventTime}{event.location ? ` · ${event.location}` : ''}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function IncidentDisputeSection({ ship, onUpdated, focusIncident }: { ship: ShipmentItem; onUpdated: () => void; focusIncident?: boolean }) {
  const incidents = ship.incidents ?? []
  const openIncidents = getOpenIncidents(ship)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [noteById, setNoteById] = useState<Record<number, string>>({})
  const [resolutionById, setResolutionById] = useState<Record<number, string>>({})
  const [compensationById, setCompensationById] = useState<Record<number, string>>({})
  const [selectedResolutionById, setSelectedResolutionById] = useState<Partial<Record<number, ResolutionOptionKey>>>({})
  const [resendDateById, setResendDateById] = useState<Record<number, string>>({})
  const [filesById, setFilesById] = useState<Record<number, File[]>>({})
  const [galleryUrl, setGalleryUrl] = useState<string | null>(null)
  const [galleryZoom, setGalleryZoom] = useState(1)
  const incidentSectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!focusIncident) return
    const timer = window.setTimeout(() => {
      incidentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [focusIncident, ship.id])

  useEffect(() => {
    if (galleryUrl) setGalleryZoom(1)
  }, [galleryUrl])

  const submitResolution = async (incident: SupplierShipmentIncident) => {
    if (!ship.rawShipmentId) return
    const option = RESOLUTION_OPTIONS.find((item) => item.key === selectedResolutionById[incident.id])
    if (!option) {
      window.alert('Vui lòng chọn phương án xử lý trước khi gửi phản hồi.')
      return
    }
    const note = noteById[incident.id]?.trim()
    const contextualNote = resolutionById[incident.id]?.trim()
    const resendDate = resendDateById[incident.id]
    const resolution = buildResolutionPreview(option, contextualNote, resendDate)
    const compensationAmount = compensationById[incident.id] ? Number(compensationById[incident.id]) : undefined
    const requiresCompensation = option.key === 'FULL_REFUND' || option.key === 'PARTIAL_REFUND'
    if (requiresCompensation && compensationAmount == null) {
      window.alert('Vui lòng nhập số tiền bồi hoàn trước khi gửi phương án.')
      return
    }
    if (compensationAmount != null && (!Number.isFinite(compensationAmount) || compensationAmount <= 0)) {
      window.alert('Số tiền bồi hoàn phải lớn hơn 0.')
      return
    }
    if (option.key === 'RESEND_SHIPMENT' && !resendDate) {
      window.alert('Vui lòng nhập ngày dự kiến gửi lại hàng.')
      return
    }
    if (!note) {
      window.alert('Vui lòng nhập ghi chú phản hồi trước khi gửi phương án xử lý.')
      return
    }
    if ((option.key === 'REQUEST_EVIDENCE' || option.key === 'REJECT_CLAIM') && !contextualNote) {
      window.alert(option.key === 'REQUEST_EVIDENCE' ? 'Vui lòng nhập thông tin cần buyer bổ sung.' : 'Vui lòng nhập lý do từ chối yêu cầu.')
      return
    }
    setBusyId(incident.id)
    try {
      const evidenceUrls: string[] = []
      for (const file of filesById[incident.id] ?? []) {
        evidenceUrls.push((await uploadRegistrationFile(file)).url)
      }
      await updateSupplierShipmentIncident(ship.rawShipmentId, incident.id, {
        action: option.action,
        resolutionType: option.resolutionType,
        note,
        proposedResolution: resolution || undefined,
        compensationAmount,
        evidenceUrls,
      })
      setNoteById((prev) => ({ ...prev, [incident.id]: '' }))
      setResolutionById((prev) => ({ ...prev, [incident.id]: '' }))
      setCompensationById((prev) => ({ ...prev, [incident.id]: '' }))
      setSelectedResolutionById((prev) => {
        const next = { ...prev }
        delete next[incident.id]
        return next
      })
      setResendDateById((prev) => ({ ...prev, [incident.id]: '' }))
      setFilesById((prev) => ({ ...prev, [incident.id]: [] }))
      onUpdated()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div ref={incidentSectionRef} className={`rounded-xl border p-4 ${focusIncident ? 'border-orange-300 bg-orange-50 ring-4 ring-orange-100' : 'border-rose-100 bg-rose-50/40'}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <p className="text-sm font-extrabold text-slate-900">Xử lý sự cố / khiếu nại giao hàng</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-rose-700">{openIncidents.length} cần xử lý</span>
      </div>

      {incidents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-xs font-medium text-slate-400">Chưa có sự cố giao hàng nào được báo cáo.</p>
      ) : incidents.map((incident) => {
        const buyerEvidence = incident.evidenceUrls ?? []
        const supplierEvidence = incident.supplierEvidenceUrls ?? []
        const normalizedStatus = (incident.status || '').toUpperCase()
        const isClosed = CLOSED_INCIDENT_STATUSES.has(normalizedStatus)
        return (
          <div key={incident.id} className={`mb-3 rounded-xl bg-white p-4 shadow-sm last:mb-0 ${isClosed ? 'border border-slate-200' : 'border-2 border-orange-200 ring-2 ring-orange-50'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-slate-900">{INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType}</p>
                <p className="mt-1 text-xs text-slate-500">Báo cáo lúc {incident.createdAt ?? 'N/A'}{incident.updatedAt ? ` · Cập nhật ${incident.updatedAt}` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <SeverityBadge severity={incident.severity} />
                <IncidentStatusBadge status={incident.status} />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <InfoCard label="Số lượng ảnh hưởng" value={incident.affectedQuantity != null ? String(incident.affectedQuantity) : '—'} />
              <InfoCard label="Tệp đính kèm" value={String(incident.attachmentCount ?? buyerEvidence.length + supplierEvidence.length)} />
              <InfoCard label="Hướng xử lý" value={RESOLUTION_TYPE_LABELS[incident.resolutionType || 'PENDING'] ?? incident.resolutionType ?? 'Chờ xử lý'} />
            </div>

            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{incident.description}</p>
            {incident.buyerNotes && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">Ghi chú từ người mua: {incident.buyerNotes}</p>}
            {incident.supplierResponse && <p className="mt-2 whitespace-pre-wrap text-xs text-emerald-700">Phản hồi của nhà cung cấp: {incident.supplierResponse}</p>}
            {incident.proposedResolution && <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-blue-700">Đề xuất xử lý: {incident.proposedResolution}</p>}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <EvidenceGallery title="Bằng chứng từ người mua" urls={buyerEvidence} onOpen={setGalleryUrl} />
              <EvidenceGallery title="Bằng chứng từ nhà cung cấp" urls={supplierEvidence} onOpen={setGalleryUrl} />
            </div>

            <div className="mt-4">
              <IncidentConversationTimeline incident={incident} />
            </div>

            {!isClosed && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-extrabold text-slate-900">Trung tâm xử lý tranh chấp</p>
                  <p className="mt-0.5 text-xs text-slate-500">Chọn một phương án nghiệp vụ, nhập thông tin cần thiết rồi gửi phản hồi cho người mua.</p>
                </div>

                <div className="space-y-5 p-4">
                  <section>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">1. Chọn phương án xử lý</p>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Ưu tiên hoàn tiền / gửi lại hàng</span>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {RESOLUTION_OPTIONS.map((option) => {
                        const selected = selectedResolutionById[incident.id] === option.key
                        const Icon = option.icon
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setSelectedResolutionById((prev) => ({ ...prev, [incident.id]: option.key }))}
                            className={`group rounded-xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${option.tone} ${selected ? 'ring-2 shadow-sm' : 'bg-white'}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-white' : 'bg-white/80'}`}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
                                  {option.title}
                                  {option.group === 'danger' ? <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] text-white">Rủi ro</span> : null}
                                  {option.group === 'secondary' ? <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-white">Bổ sung</span> : null}
                                </span>
                                <span className="mt-1 block text-xs leading-5 opacity-80">{option.description}</span>
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>

                  {selectedResolutionById[incident.id] ? (
                    <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">2. Thông tin theo phương án đã chọn</p>
                      {(() => {
                        const selectedOption = RESOLUTION_OPTIONS.find((item) => item.key === selectedResolutionById[incident.id])
                        if (!selectedOption) return null
                        if (selectedOption.key === 'FULL_REFUND' || selectedOption.key === 'PARTIAL_REFUND') {
                          return (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="grid gap-1.5">
                                <span className="text-xs font-bold text-slate-600">Số tiền bồi hoàn</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={compensationById[incident.id] ?? ''}
                                  onChange={(event) => setCompensationById((prev) => ({ ...prev, [incident.id]: event.target.value }))}
                                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
                                  placeholder="VD: 1500000"
                                />
                              </label>
                              <label className="grid gap-1.5 sm:col-span-2">
                                <span className="text-xs font-bold text-slate-600">Giải thích phương án</span>
                                <textarea
                                  value={resolutionById[incident.id] ?? ''}
                                  onChange={(event) => setResolutionById((prev) => ({ ...prev, [incident.id]: event.target.value }))}
                                  rows={3}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                                  placeholder="Nêu căn cứ bồi hoàn, số lượng ảnh hưởng, cách đối soát..."
                                />
                              </label>
                            </div>
                          )
                        }
                        if (selectedOption.key === 'RESEND_SHIPMENT') {
                          return (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="grid gap-1.5">
                                <span className="text-xs font-bold text-slate-600">Ngày dự kiến gửi lại</span>
                                <input
                                  type="date"
                                  value={resendDateById[incident.id] ?? ''}
                                  onChange={(event) => setResendDateById((prev) => ({ ...prev, [incident.id]: event.target.value }))}
                                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400"
                                />
                              </label>
                              <label className="grid gap-1.5 sm:col-span-2">
                                <span className="text-xs font-bold text-slate-600">Ghi chú logistics</span>
                                <textarea
                                  value={resolutionById[incident.id] ?? ''}
                                  onChange={(event) => setResolutionById((prev) => ({ ...prev, [incident.id]: event.target.value }))}
                                  rows={3}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                                  placeholder="Mô tả hàng gửi lại, tuyến vận chuyển, điều kiện đóng gói..."
                                />
                              </label>
                            </div>
                          )
                        }
                        return (
                          <label className="grid gap-1.5">
                            <span className="text-xs font-bold text-slate-600">{selectedOption.key === 'REQUEST_EVIDENCE' ? 'Thông tin cần buyer bổ sung' : 'Lý do từ chối'}</span>
                            <textarea
                              value={resolutionById[incident.id] ?? ''}
                              onChange={(event) => setResolutionById((prev) => ({ ...prev, [incident.id]: event.target.value }))}
                              rows={3}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                              placeholder={selectedOption.key === 'REQUEST_EVIDENCE' ? 'VD: bổ sung ảnh cân hàng, biên bản kiểm đếm, ảnh seal thùng...' : 'Nêu rõ căn cứ vận hành, đối soát giao nhận và bằng chứng đi kèm...'}
                            />
                          </label>
                        )
                      })()}

                      <div className="mt-3 grid gap-3">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-bold text-slate-600">Ghi chú gửi cho người mua</span>
                          <textarea
                            value={noteById[incident.id] ?? ''}
                            onChange={(event) => setNoteById((prev) => ({ ...prev, [incident.id]: event.target.value }))}
                            rows={3}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                            placeholder="Tóm tắt phương án, cam kết xử lý và bước tiếp theo..."
                          />
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                          <Upload className="h-4 w-4" />
                          Tải lên bằng chứng của nhà cung cấp
                          <input
                            type="file"
                            className="hidden"
                            multiple
                            accept="image/*,video/*"
                            onChange={(event) => setFilesById((prev) => ({ ...prev, [incident.id]: Array.from(event.target.files ?? []) }))}
                          />
                          {(filesById[incident.id]?.length ?? 0) > 0 && <span className="ml-auto text-emerald-700">{filesById[incident.id]?.length} tệp</span>}
                        </label>
                      </div>
                    </section>
                  ) : null}

                  {selectedResolutionById[incident.id] ? (() => {
                    const selectedOption = RESOLUTION_OPTIONS.find((item) => item.key === selectedResolutionById[incident.id])
                    if (!selectedOption) return null
                    return (
                      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">3. Người mua sẽ nhận được</p>
                        <div className="mt-3 rounded-xl bg-white p-3 shadow-sm">
                          <p className="text-sm font-extrabold text-slate-900">{selectedOption.title}</p>
                          {(selectedOption.key === 'FULL_REFUND' || selectedOption.key === 'PARTIAL_REFUND') ? (
                            <p className="mt-1 text-xs font-bold text-emerald-700">Số tiền: {formatCurrencyPreview(compensationById[incident.id])}</p>
                          ) : null}
                          {selectedOption.key === 'RESEND_SHIPMENT' ? (
                            <p className="mt-1 text-xs font-bold text-amber-700">Ngày gửi lại: {resendDateById[incident.id] || 'Chưa nhập'}</p>
                          ) : null}
                          <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{noteById[incident.id] || 'Chưa nhập ghi chú gửi cho người mua.'}</p>
                          <p className="mt-2 text-xs text-slate-500">Bằng chứng đính kèm: {(filesById[incident.id]?.length ?? 0)} tệp</p>
                        </div>
                      </section>
                    )
                  })() : null}

                  <button
                    disabled={busyId === incident.id || !selectedResolutionById[incident.id]}
                    onClick={() => void submitResolution(incident)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {busyId === incident.id ? 'Đang gửi phản hồi...' : 'Gửi phản hồi xử lý'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {galleryUrl && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" onClick={() => setGalleryUrl(null)}>
          <div className="relative max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setGalleryUrl(null)} className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-2 text-white" aria-label="Đóng xem trước bằng chứng"><X className="h-5 w-5" /></button>
            {!isVideoUrl(galleryUrl) ? (
              <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full bg-black/60 px-3 py-2 text-xs font-bold text-white">
                <button onClick={() => setGalleryZoom((value) => Math.max(1, value - 0.25))}>Thu nhỏ</button>
                <span>{Math.round(galleryZoom * 100)}%</span>
                <button onClick={() => setGalleryZoom((value) => Math.min(3, value + 0.25))}>Phóng to</button>
              </div>
            ) : null}
            {isVideoUrl(galleryUrl) ? (
              <video src={galleryUrl} controls className="max-h-[85vh] max-w-full rounded-lg bg-black" />
            ) : (
              <img src={galleryUrl} alt="Xem trước bằng chứng" className="max-h-[85vh] max-w-full rounded-lg bg-white object-contain transition-transform" style={{ transform: `scale(${galleryZoom})` }} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ShipmentDetailModal({ ship, onClose, onIncidentUpdated, focusIncident }: { ship: ShipmentItem; onClose: () => void; onIncidentUpdated: () => void; focusIncident?: boolean }) {
  const timeline = ship.shipmentEvents ?? []
  const { color, label } = getStatusMeta(ship.status)
  const dotClass = STATUS_COLOR_CLASSES[color].dot

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-white">{ship.id}</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold text-white">
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                {label}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-300">{ship.orderRef} · {ship.route}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard label="Người nhận" value={ship.receiverName && ship.receiverName !== 'N/A' ? ship.receiverName : '—'} />
            <InfoCard label="Số điện thoại" value={ship.receiverPhone && ship.receiverPhone !== 'N/A' ? ship.receiverPhone : '—'} />
            <InfoCard label="Địa chỉ giao" value={ship.receiverAddress && ship.receiverAddress !== 'N/A' ? ship.receiverAddress : '—'} className="sm:col-span-2" />
            <InfoCard label="Nhà vận chuyển" value={ship.providerName && ship.providerName !== 'N/A' ? ship.providerName : '—'} />
            <InfoCard label="Dịch vụ" value={ship.serviceName && ship.serviceName !== 'N/A' ? ship.serviceName : '—'} />
            <InfoCard
              label="Phí vận chuyển"
              value={ship.shippingFee && ship.shippingFee !== '—' ? ship.shippingFee : 'Chưa xác nhận'}
              accent
            />
            <InfoCard label="Dự kiến giao" value={ship.estimatedDeliveryTime && ship.estimatedDeliveryTime !== 'N/A' ? ship.estimatedDeliveryTime : ship.eta || '—'} />
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">Tiến độ vận chuyển</p>
              <span className="text-sm font-extrabold text-emerald-700">{ship.progress}%</span>
            </div>
            <ProgressBar progress={ship.progress} />
          </div>

          <div>
            <p className="mb-3 text-sm font-bold text-slate-800">Timeline</p>
            <Timeline events={timeline} />
          </div>

          <IncidentDisputeSection ship={ship} onUpdated={onIncidentUpdated} focusIncident={focusIncident} />

          {ship.driver && ship.driver !== 'N/A' && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Truck className="h-4 w-4 shrink-0 text-blue-500" />
              <span>Tài xế: <strong>{ship.driver}</strong>{ship.phone && ship.phone !== 'N/A' ? ` · ${ship.phone}` : ''}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white px-5 py-3">
          <div className="ml-auto flex gap-2">
            {ship.receiverPhone && ship.receiverPhone !== 'N/A' && (
              <a
                href={`tel:${ship.receiverPhone}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                Gọi người nhận
              </a>
            )}
            {ship.driver && ship.driver !== 'N/A' && ship.phone && ship.phone !== 'N/A' && (
              <a
                href={`tel:${ship.phone}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                Gọi tài xế
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value, accent, className }: { label: string; value: string; accent?: boolean; className?: string }) {
  return (
    <div className={`rounded-xl bg-slate-50 px-3 py-2.5 ${className ?? ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${accent ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

function matchFilter(status: string, key: string) {
  const normalized = normalizeStatus(status)
  if (key === 'all') return true
  if (key === 'preparing') return ['CREATED', 'PENDING', 'PREPARING', 'WAITING_PICKUP', 'PICKED_UP', 'SHIPPED'].includes(normalized)
  if (key === 'transit') return ['IN_TRANSIT', 'SHIPPING', 'OUT_FOR_DELIVERY', 'WAITING_CONFIRMATION'].includes(normalized)
  if (key === 'done') return normalized === 'DELIVERED'
  if (key === 'issue') return ['INCIDENT', 'CANCELLED', 'FAILED', 'FAILED_DELIVERY'].includes(normalized)
  return true
}

export function SupplierDeliveryPage() {
  usePageTitle('Theo dõi giao hàng')
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, loading, error, reload } = useSupplierDashboardData()
  useNotificationModuleRefresh(['DELIVERY'], reload)
  const shipmentRows = data?.shipments ?? []

  const [activeFilter, setActiveFilter] = useState('all')
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const targetShipmentId = searchParams.get('shipmentId') || ''
  const shouldFocusIncident = searchParams.get('incident') === 'true'
  const targetShipment = useMemo(
    () => shipmentRows.find((shipment) => targetShipmentId && isShipmentMatch(shipment, targetShipmentId)) ?? null,
    [shipmentRows, targetShipmentId],
  )

  useEffect(() => {
    if (!targetShipment) return
    setActiveShipmentId(targetShipment.id)
    if (shouldFocusIncident) setActiveFilter('issue')
  }, [targetShipment, shouldFocusIncident])

  const filtered = shipmentRows
    .filter((shipment) => activeFilter === 'issue' ? getOpenIncidents(shipment).length > 0 || matchFilter(shipment.status, activeFilter) : matchFilter(shipment.status, activeFilter))
    .filter((shipment) => {
      if (!searchKeyword.trim()) return true
      const keyword = searchKeyword.trim().toLowerCase()
      return (
        shipment.id.toLowerCase().includes(keyword) ||
        shipment.route.toLowerCase().includes(keyword) ||
        shipment.cargo.toLowerCase().includes(keyword) ||
        (shipment.driver ?? '').toLowerCase().includes(keyword)
      )
    })

  const activeShipment = shipmentRows.find((shipment) => shipment.id === activeShipmentId) ?? null

  const tabCount = (key: string) => {
    if (key === 'all') return shipmentRows.length
    if (key === 'issue') return shipmentRows.filter((shipment) => getOpenIncidents(shipment).length > 0 || matchFilter(shipment.status, key)).length
    return shipmentRows.filter((shipment) => matchFilter(shipment.status, key)).length
  }

  return (
    <>
      <SupplierShell
        activeKey="delivery"
        title="Quản lý giao hàng"
        subtitle="Theo dõi vận chuyển và trạng thái giao hàng"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={searchKeyword}
              onChange={setSearchKeyword}
              placeholder="Tìm shipment, tuyến giao, hàng hóa..."
              className="min-w-[220px] max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {FILTER_TABS.map((tab) => {
                const count = tabCount(tab.key)
                const isActive = activeFilter === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                      isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                    }`}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        }
      >
        {loading && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Đang tải dữ liệu giao hàng...
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {!loading && !error && shipmentRows.length === 0 && (
          <SupplierPanel>
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <Truck className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-slate-700">Chưa có shipment nào</p>
              <p className="max-w-xs text-xs text-slate-400">
                Shipment được tạo tự động khi buyer đặt hàng. Chưa có đơn hàng nào được tạo cho tài khoản này.
              </p>
            </div>
          </SupplierPanel>
        )}
        {!loading && !error && shipmentRows.length > 0 && filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
            Không có shipment nào ở trạng thái "{FILTER_TABS.find((tab) => tab.key === activeFilter)?.label}".
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((ship) => (
            <ShipmentCard
              key={ship.id}
              ship={ship}
              onDetail={() => {
                setActiveShipmentId(ship.id)
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('shipmentId', ship.id)
                  if (getOpenIncidents(ship).length > 0) next.set('incident', 'true')
                  return next
                }, { replace: true })
              }}
            />
          ))}
        </div>
      </SupplierShell>

      {activeShipment && (
        <ShipmentDetailModal
          ship={activeShipment}
          onClose={() => {
            setActiveShipmentId(null)
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.delete('shipmentId')
              next.delete('incident')
              next.delete('incidentId')
              next.delete('targetModal')
              return next
            }, { replace: true })
          }}
          onIncidentUpdated={reload}
          focusIncident={shouldFocusIncident}
        />
      )}
    </>
  )
}
