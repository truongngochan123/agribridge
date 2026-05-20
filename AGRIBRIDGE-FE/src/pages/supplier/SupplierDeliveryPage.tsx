import { AlertTriangle, CheckCircle2, Package, PhoneCall, Truck, X } from 'lucide-react'
import { useState } from 'react'
import { SearchInput, SupplierPanel } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import type { ShipmentItem, SupplierShipmentEvent } from '../../types/supplierDashboard'
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

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:ring-2 ${cls.ring} hover:ring-offset-1`}
    >
      <div className={`h-1 w-full bg-gradient-to-r ${cls.bar}`} />

      <div className="p-4">
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

function ShipmentDetailModal({ ship, onClose }: { ship: ShipmentItem; onClose: () => void }) {
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
  const { data, loading, error } = useSupplierDashboardData()
  const shipmentRows = data?.shipments ?? []

  const [activeFilter, setActiveFilter] = useState('all')
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')

  const filtered = shipmentRows
    .filter((shipment) => matchFilter(shipment.status, activeFilter))
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
              onDetail={() => setActiveShipmentId(ship.id)}
            />
          ))}
        </div>
      </SupplierShell>

      {activeShipment && (
        <ShipmentDetailModal
          ship={activeShipment}
          onClose={() => setActiveShipmentId(null)}
        />
      )}
    </>
  )
}
