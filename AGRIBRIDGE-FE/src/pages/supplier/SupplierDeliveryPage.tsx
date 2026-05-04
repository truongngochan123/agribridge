import { AlertTriangle, CheckCircle2, Clock, Package, PhoneCall, Truck, X } from 'lucide-react'
import { useState } from 'react'
import { SearchInput, SupplierPanel } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { updateSupplierShipmentStatus, type SupplierShipmentStatusCode } from '../../services/supplierService'
import type { ShipmentItem } from '../../types/supplierDashboard'
import { useSupplierDashboardData } from './useSupplierDashboardData'

// ─── Status helpers ────────────────────────────────────────────────────────────

type StatusColor = 'amber' | 'blue' | 'indigo' | 'emerald' | 'rose' | 'slate'

function getStatusMeta(status: string): { color: StatusColor; label: string } {
  const s = status?.toLowerCase() ?? ''
  if (s.includes('chuẩn bị') || s.includes('pending')) return { color: 'amber', label: status }
  if (s.includes('rời kho') || s.includes('shipped')) return { color: 'blue', label: status }
  if (s.includes('vận chuyển') || s.includes('transit')) return { color: 'indigo', label: status }
  if (s.includes('buyer') || s.includes('waiting')) return { color: 'indigo', label: status }
  if (s.includes('giao') || s.includes('delivered')) return { color: 'emerald', label: status }
  if (s.includes('hủy') || s.includes('failed') || s.includes('sự cố')) return { color: 'rose', label: status }
  return { color: 'slate', label: status || 'N/A' }
}

const STATUS_COLOR_CLASSES: Record<StatusColor, { badge: string; ring: string; dot: string }> = {
  amber:   { badge: 'bg-amber-100 text-amber-800',   ring: 'ring-amber-400',   dot: 'bg-amber-400' },
  blue:    { badge: 'bg-blue-100 text-blue-800',     ring: 'ring-blue-400',    dot: 'bg-blue-400' },
  indigo:  { badge: 'bg-indigo-100 text-indigo-800', ring: 'ring-indigo-400',  dot: 'bg-indigo-400' },
  emerald: { badge: 'bg-emerald-100 text-emerald-800', ring: 'ring-emerald-400', dot: 'bg-emerald-500' },
  rose:    { badge: 'bg-rose-100 text-rose-700',     ring: 'ring-rose-400',    dot: 'bg-rose-400' },
  slate:   { badge: 'bg-slate-100 text-slate-600',   ring: 'ring-slate-300',   dot: 'bg-slate-400' },
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

// ─── Next-status transition map ────────────────────────────────────────────────

type NextAction = { label: string; status: SupplierShipmentStatusCode; variant: 'primary' | 'danger' }

function getNextActions(currentStatus: string): NextAction[] {
  const s = (currentStatus || '').toLowerCase()
  if (s.includes('chuẩn bị') || s === 'pending' || s === 'preparing') {
    return [{ label: 'Xác nhận lấy hàng', status: 'SHIPPED', variant: 'primary' }]
  }
  if (s.includes('rời kho') || s === 'shipped') {
    return [{ label: 'Đang vận chuyển', status: 'IN_TRANSIT', variant: 'primary' }]
  }
  if (s.includes('vận chuyển') || s === 'in_transit' || s === 'shipping') {
    return [
      { label: 'Đã đến nơi', status: 'WAITING_CONFIRMATION', variant: 'primary' },
      { label: 'Báo sự cố', status: 'FAILED', variant: 'danger' },
    ]
  }
  if (s.includes('chờ buyer') || s === 'waiting_confirmation') {
    return [{ label: 'Hoàn thành', status: 'DELIVERED', variant: 'primary' }]
  }
  return []
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

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

// ─── Shipment Card ─────────────────────────────────────────────────────────────

function ShipmentCard({
  ship,
  onDetail,
}: {
  ship: ShipmentItem
  onDetail: () => void
}) {
  const { color } = getStatusMeta(ship.status)
  const ring = STATUS_COLOR_CLASSES[color].ring

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:ring-2 ${ring} hover:ring-offset-1`}
    >
      {/* top accent stripe */}
      <div className={`h-1 w-full bg-gradient-to-r from-${color}-400 to-${color}-600`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-slate-900">{ship.id}</span>
              <StatusBadge status={ship.status} />
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

        {/* Cargo + fee row */}
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

        {/* Receiver */}
        {ship.receiverName && ship.receiverName !== 'N/A' && (
          <p className="mt-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{ship.receiverName}</span>
            {ship.receiverPhone && ship.receiverPhone !== 'N/A' ? ` · ${ship.receiverPhone}` : ''}
          </p>
        )}

        {/* Progress */}
        <div className="mt-3">
          <ProgressBar progress={ship.progress} color={color === 'emerald' ? 'emerald' : color === 'rose' ? 'rose' : 'indigo'} />
          <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">{ship.progress}%</p>
        </div>

        {/* Action */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onDetail}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2 text-xs font-bold text-white transition hover:opacity-90 active:scale-95"
          >
            Chi tiết & Cập nhật
          </button>
          {ship.receiverPhone && ship.receiverPhone !== 'N/A' && (
            <a
              href={`tel:${ship.receiverPhone}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
            >
              <PhoneCall className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

type TimelineStep = { label: string; time: string; done: boolean }

function buildTimeline(ship: { status: string; createdAt?: string; eta?: string }): TimelineStep[] {
  const s = (ship.status || '').toLowerCase()
  const isDone = (threshold: string) => s.includes(threshold) || ['delivered', 'failed', 'waiting'].some((k) => s.includes(k))
  const isAtLeast = (step: string) => s.includes(step)

  return [
    {
      label: 'Tạo đơn hàng & đặt lịch',
      time: ship.createdAt || 'N/A',
      done: true,
    },
    {
      label: 'Lấy hàng tại kho',
      time: isAtLeast('rời') || isAtLeast('transit') || isDone('wait') || isAtLeast('giao') ? 'Đã xong' : 'Chờ xử lý',
      done: isAtLeast('rời') || isAtLeast('transit') || isDone('wait') || isAtLeast('giao'),
    },
    {
      label: 'Đang vận chuyển',
      time: isAtLeast('transit') || isDone('wait') || isAtLeast('giao') ? 'Đang xử lý' : 'Chờ xử lý',
      done: isAtLeast('transit') || isDone('wait') || isAtLeast('giao'),
    },
    {
      label: 'Giao hàng thành công',
      time: isAtLeast('giao') ? 'Hoàn thành' : ship.eta || 'Dự kiến',
      done: isAtLeast('giao'),
    },
  ]
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative space-y-3 border-l border-dashed border-slate-200 pl-5">
      {steps.map((step, i) => (
        <li key={i} className="relative">
          <span
            className={`absolute -left-[1.45rem] flex h-5 w-5 items-center justify-center rounded-full border-2 ${
              step.done
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 bg-white'
            }`}
          >
            {step.done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3 text-slate-400" />}
          </span>
          <p className={`text-xs font-semibold ${step.done ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</p>
          <p className="text-[11px] text-slate-400">{step.time}</p>
        </li>
      ))}
    </ol>
  )
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────

function ShipmentDetailModal({
  ship,
  onClose,
  onStatusUpdated,
}: {
  ship: ShipmentItem
  onClose: () => void
  onStatusUpdated: () => void
}) {
  const { showToast } = useToast()
  const [updating, setUpdating] = useState(false)

  const timeline = buildTimeline(ship)
  const nextActions = getNextActions(ship.status)
  const { color } = getStatusMeta(ship.status)
  const dotClass = STATUS_COLOR_CLASSES[color].dot

  const handleStatusUpdate = async (action: NextAction) => {
    if (!ship.rawOrderId) {
      showToast('Không tìm thấy mã đơn hàng để cập nhật.', 'error')
      return
    }
    const companyId = Number(sessionStorage.getItem('agribridge.auth.companyId'))
    if (!companyId) {
      showToast('Chưa xác định công ty, vui lòng đăng nhập lại.', 'error')
      return
    }

    setUpdating(true)
    try {
      await updateSupplierShipmentStatus(companyId, ship.rawOrderId, action.status)
      showToast(`Cập nhật thành công: ${action.label}`, 'success')
      onStatusUpdated()
      onClose()
    } catch {
      showToast('Cập nhật trạng thái thất bại. Vui lòng thử lại.', 'error')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-white">{ship.id}</h3>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-white/20 text-white`}>
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                {ship.status}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-300">{ship.orderRef} · {ship.route}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 p-5">

          {/* Info grid */}
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

          {/* Progress */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">Tiến độ vận chuyển</p>
              <span className="text-sm font-extrabold text-emerald-700">{ship.progress}%</span>
            </div>
            <ProgressBar progress={ship.progress} />
          </div>

          {/* Timeline */}
          <div>
            <p className="mb-3 text-sm font-bold text-slate-800">Timeline</p>
            <Timeline steps={timeline} />
          </div>

          {/* Cargo note */}
          {ship.driver && ship.driver !== 'N/A' && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Truck className="h-4 w-4 shrink-0 text-blue-500" />
              <span>Tài xế: <strong>{ship.driver}</strong>{ship.phone && ship.phone !== 'N/A' ? ` · ${ship.phone}` : ''}</span>
            </div>
          )}
        </div>

        {/* Footer — next actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white px-5 py-3">
          {nextActions.length > 0 ? (
            <>
              {nextActions.map((action) => (
                <button
                  key={action.status}
                  disabled={updating}
                  onClick={() => { void handleStatusUpdate(action) }}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-60 ${
                    action.variant === 'danger'
                      ? 'border border-rose-300 bg-white text-rose-600 hover:bg-rose-50'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:opacity-90'
                  }`}
                >
                  {updating ? 'Đang cập nhật...' : action.label}
                </button>
              ))}
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">
              {ship.status.toLowerCase().includes('giao') ? '✓ Đã hoàn thành giao hàng' : 'Không có hành động tiếp theo'}
            </p>
          )}
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

// ─── Filter tabs ───────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'preparing', label: 'Chuẩn bị' },
  { key: 'transit', label: 'Đang giao' },
  { key: 'done', label: 'Đã giao' },
  { key: 'issue', label: 'Sự cố' },
]

function matchFilter(status: string, key: string) {
  const s = status.toLowerCase()
  if (key === 'all') return true
  if (key === 'preparing') return s.includes('chuẩn') || s.includes('rời kho')
  if (key === 'transit') return s.includes('vận chuyển') || s.includes('chờ buyer')
  if (key === 'done') return s.includes('giao')
  if (key === 'issue') return s.includes('sự cố') || s.includes('hủy') || s.includes('failed')
  return true
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function SupplierDeliveryPage() {
  usePageTitle('Theo dõi Giao hàng')
  const { data, loading, error, reload } = useSupplierDashboardData()
  const shipmentRows = data?.shipments ?? []

  const [activeFilter, setActiveFilter] = useState('all')
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null)

  const [searchKeyword, setSearchKeyword] = useState('')
  const filtered = shipmentRows
    .filter((s) => matchFilter(s.status, activeFilter))
    .filter((s) => {
      if (!searchKeyword.trim()) return true
      const kw = searchKeyword.trim().toLowerCase()
      return (
        s.id.toLowerCase().includes(kw) ||
        s.route.toLowerCase().includes(kw) ||
        s.cargo.toLowerCase().includes(kw) ||
        (s.driver ?? '').toLowerCase().includes(kw)
      )
    })
  const activeShipment = shipmentRows.find((s) => s.id === activeShipmentId) ?? null

  const tabCount = (key: string) => {
    if (key === 'all') return shipmentRows.length
    return shipmentRows.filter((s) => matchFilter(s.status, key)).length
  }

  return (
    <>
      <SupplierShell
        activeKey="delivery"
        title="Quản lý Giao hàng"
        subtitle="Theo dõi vận chuyển và cập nhật trạng thái giao hàng"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={searchKeyword}
              onChange={setSearchKeyword}
              placeholder="Tìm shipment, route, hàng hóa..."
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
        {/* States */}
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
            Không có shipment nào ở trạng thái "{FILTER_TABS.find((t) => t.key === activeFilter)?.label}".
          </p>
        )}

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((ship) => (
            <ShipmentCard
              key={ship.id}
              ship={ship}
              onDetail={() => setActiveShipmentId(ship.id)}
            />
          ))}
        </div>
      </SupplierShell>

      {/* Detail Modal */}
      {activeShipment && (
        <ShipmentDetailModal
          ship={activeShipment}
          onClose={() => setActiveShipmentId(null)}
          onStatusUpdated={reload}
        />
      )}
    </>
  )
}
