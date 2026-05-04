import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ShoppingCart, FileText, Truck } from 'lucide-react'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import {
  fetchBuyerDashboard,
  type BuyerDashboardAlert,
  type BuyerDashboardDeliveryOrder,
  type BuyerDashboardKpi,
  type BuyerDashboardPayload,
  type BuyerDashboardPendingRfq,
} from '../../services/buyerDashboardApi'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

const emptyDashboard: BuyerDashboardPayload = {
  kpis: [],
  alerts: [],
  deliveryOrders: [],
  pendingRfqs: [],
}

const kpiLabels: Record<string, string> = {
  totalOrders: 'Tổng đơn hàng',
  pendingOrders: 'Đơn chờ xử lý',
  payableDebt: 'Công nợ phải trả',
}

const alertLabels: Record<string, string> = {
  debtDueSoon: 'Công nợ sắp đến hạn',
  rfqExpiring: 'RFQ sắp hết hạn',
  lateShipments: 'Shipment giao trễ',
}

// Gradient accent per KPI index
const KPI_ACCENTS = [
  { from: 'from-emerald-400', to: 'to-teal-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { from: 'from-blue-400',    to: 'to-indigo-500', bg: 'bg-blue-50',   text: 'text-blue-700' },
  { from: 'from-amber-400',   to: 'to-orange-500', bg: 'bg-amber-50',  text: 'text-amber-700' },
  { from: 'from-violet-400',  to: 'to-purple-500', bg: 'bg-violet-50', text: 'text-violet-700' },
]

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat('vi-VN').format(Number(value ?? 0))
}

export function BuyerDashboardPage() {
  const [dashboard, setDashboard] = useState<BuyerDashboardPayload>(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setDashboard(await fetchBuyerDashboard())
    } catch (requestError) {
      setDashboard(emptyDashboard)
      setError(readApiErrorMessage(requestError) || 'Không thể tải dữ liệu tổng quan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  return (
    <BuyerShell activeKey="overview" title="Tổng quan" subtitle="Theo dõi hoạt động mua hàng của bạn">
      {/* Loading / Error banners */}
      {loading && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          Đang tải dữ liệu tổng quan...
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button
            className="ml-2 rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:opacity-90"
            onClick={() => void loadDashboard()}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* KPI grid */}
      <KpiGrid items={dashboard.kpis} />

      {/* Alert grid */}
      {dashboard.alerts.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Cảnh báo vận hành</h2>
          <AlertGrid items={dashboard.alerts} />
        </div>
      )}

      {/* Delivery + RFQ panels */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <BuyerPanel
          title="Đơn hàng đang giao"
          right={
            <Link to="/buyer/delivery" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
              <Truck className="h-3.5 w-3.5" /> Theo dõi giao hàng
            </Link>
          }
        >
          <DeliveryList rows={dashboard.deliveryOrders} />
        </BuyerPanel>

        <BuyerPanel
          title="RFQ chờ báo giá"
          right={
            <Link to="/buyer/rfq" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
              <FileText className="h-3.5 w-3.5" /> Xem RFQ
            </Link>
          }
        >
          <RfqList rows={dashboard.pendingRfqs} />
        </BuyerPanel>
      </div>
    </BuyerShell>
  )
}

function KpiGrid({ items }: { items: BuyerDashboardKpi[] }) {
  if (!items.length) return null
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item, i) => {
        const accent = KPI_ACCENTS[i % KPI_ACCENTS.length]
        return (
          <article
            key={item.id}
            className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
          >
            {/* Left gradient bar */}
            <span className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b ${accent.from} ${accent.to}`} />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{kpiLabels[item.id] ?? item.label}</p>
            <p className="mt-1.5 text-2xl font-extrabold leading-none text-slate-900">{item.displayValue}</p>
          </article>
        )
      })}
    </div>
  )
}

function AlertGrid({ items }: { items: BuyerDashboardAlert[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => {
        const content = (
          <article className={`rounded-xl border p-3 ${alertToneClass(item.tone)}`}>
            <p className="text-xs font-bold uppercase tracking-wide opacity-70">{alertLabels[item.id] ?? item.title}</p>
            <p className="mt-1.5 text-2xl font-extrabold">{item.value}</p>
          </article>
        )
        return item.targetPath ? <Link key={item.id} to={item.targetPath}>{content}</Link> : <div key={item.id}>{content}</div>
      })}
    </div>
  )
}

function DeliveryList({ rows }: { rows: BuyerDashboardDeliveryOrder[] }) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
          <Truck className="h-6 w-6 text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600">Không có đơn đang giao</p>
        <p className="text-xs text-slate-400">Chưa có đơn hàng đang chờ hoặc đang vận chuyển</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Link
          key={`${row.orderId}-${row.shipmentId ?? 'shipment'}`}
          to={`/buyer/orders?orderId=${row.orderId}`}
          className="block rounded-xl border border-slate-100 bg-white p-3 transition-all hover:border-emerald-200 hover:shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">{row.orderCode}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{row.productText}</p>
              <p className="mt-0.5 text-xs text-slate-400">ETA: {formatDate(row.estimatedDeliveryAt)}{row.trackingCode ? ` · ${row.trackingCode}` : ''}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                {row.statusLabel ?? row.status ?? 'N/A'}
              </span>
              <p className="mt-1.5 text-xs font-extrabold text-slate-800">{row.displayAmount}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function RfqList({ rows }: { rows: BuyerDashboardPendingRfq[] }) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <ShoppingCart className="h-6 w-6 text-amber-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600">Không có RFQ đang chờ</p>
        <p className="text-xs text-slate-400">Chưa có yêu cầu báo giá nào đang mở</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Link
          key={row.rfqId}
          to={`/buyer/rfq?rfqId=${row.rfqId}`}
          className="block rounded-xl border border-slate-100 bg-white p-3 transition-all hover:border-amber-200 hover:shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">{row.rfqCode}</p>
              <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-800">{row.productText || row.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{formatNumber(row.quantity)} {row.unit ?? ''} · Hết hạn: {formatDate(row.expiredAt)}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {row.quoteCount} báo giá
              </span>
              <p className="mt-1.5 text-xs text-slate-400">{row.province || 'Chưa có tỉnh'}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function alertToneClass(tone: BuyerDashboardAlert['tone']) {
  if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-700'
  if (tone === 'warning') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}
