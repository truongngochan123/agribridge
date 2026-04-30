import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
      {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải dữ liệu tổng quan...</p> : null}
      {error ? (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
          <button className="ml-3 rounded-lg bg-red-600 px-3 py-1 text-xs text-white" onClick={() => void loadDashboard()}>
            Thử lại
          </button>
        </div>
      ) : null}

      <KpiGrid items={dashboard.kpis} />

      <div className="mt-5">
        <h2 className="mb-3 text-xl font-bold text-emerald-950">Cảnh báo vận hành</h2>
        <AlertGrid items={dashboard.alerts} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <BuyerPanel title="Đơn hàng đang giao" right={<Link to="/buyer/delivery" className="text-sm font-semibold text-emerald-700">Theo dõi giao hàng</Link>}>
          <DeliveryList rows={dashboard.deliveryOrders} />
        </BuyerPanel>

        <BuyerPanel title="RFQ chờ báo giá" right={<Link to="/buyer/rfq" className="text-sm font-semibold text-emerald-700">Xem RFQ</Link>}>
          <RfqList rows={dashboard.pendingRfqs} />
        </BuyerPanel>
      </div>
    </BuyerShell>
  )
}

function KpiGrid({ items }: { items: BuyerDashboardKpi[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-emerald-200/70 bg-emerald-50/30 p-3.5">
          <p className="text-xs font-semibold text-emerald-900/70">{kpiLabels[item.id] ?? item.label}</p>
          <p className="mt-1.5 text-[26px] font-extrabold leading-none text-emerald-950">{item.displayValue}</p>
        </article>
      ))}
    </div>
  )
}

function AlertGrid({ items }: { items: BuyerDashboardAlert[] }) {
  if (!items.length) {
    return <p className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-semibold text-emerald-800">Chưa có cảnh báo vận hành.</p>
  }
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => {
        const content = (
          <article className={`rounded-xl border p-3 ${alertToneClass(item.tone)}`}>
            <p className="text-sm font-semibold">{alertLabels[item.id] ?? item.title}</p>
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
    return <p className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-semibold text-emerald-800">Không có đơn đang chờ giao hoặc đang giao.</p>
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Link
          key={`${row.orderId}-${row.shipmentId ?? 'shipment'}`}
          to={`/buyer/orders?orderId=${row.orderId}`}
          className="block rounded-xl border border-emerald-100 bg-white p-3 hover:border-emerald-300 hover:bg-emerald-50/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-700">{row.orderCode}</p>
              <p className="mt-1 truncate text-sm font-semibold text-emerald-950">{row.productText}</p>
              <p className="mt-1 text-xs text-slate-500">ETA: {formatDate(row.estimatedDeliveryAt)} {row.trackingCode ? `- ${row.trackingCode}` : ''}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">{row.statusLabel ?? row.status ?? 'N/A'}</span>
              <p className="mt-2 text-xs font-extrabold text-emerald-900">{row.displayAmount}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function RfqList({ rows }: { rows: BuyerDashboardPendingRfq[] }) {
  if (!rows.length) {
    return <p className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-semibold text-emerald-800">Không có RFQ đang chờ báo giá.</p>
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Link key={row.rfqId} to={`/buyer/rfq?rfqId=${row.rfqId}`} className="block rounded-xl border border-emerald-100 bg-white p-3 hover:border-emerald-300 hover:bg-emerald-50/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-700">{row.rfqCode}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-emerald-950">{row.productText || row.title}</p>
              <p className="mt-1 text-xs text-slate-500">{formatNumber(row.quantity)} {row.unit ?? ''} - Hết hạn: {formatDate(row.expiredAt)}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">{row.quoteCount} báo giá</span>
              <p className="mt-2 text-xs text-slate-500">{row.province || 'Chưa có tỉnh'}</p>
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
